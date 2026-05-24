'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Credential bootstrap
// Read service account key from parent .env.local when ADC would be stale
// (emulator-only — in production, ADC / managed identity is used instead)
// ---------------------------------------------------------------------------
function loadEnvLocal() {
  try {
    const p = path.resolve(__dirname, '..', '.env.local');
    const raw = fs.readFileSync(p, 'utf8');
    const out = {};
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('""')) ) val = val.slice(1, -2); // trailing ""
      else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

const _envLocal = loadEnvLocal();
const _clientEmail = _envLocal.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
const _privateKeyRaw = _envLocal.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
const _privateKey = _privateKeyRaw ? _privateKeyRaw.replace(/\\n/g, '\n') : undefined;

if (_clientEmail && _privateKey) {
  const { cert } = require('firebase-admin/app');
  initializeApp({ credential: cert({ projectId: 'afp-avaliacaofisica', clientEmail: _clientEmail, privateKey: _privateKey }) });
} else {
  initializeApp();
}

const db = getFirestore();
const firebaseAuth = getAuth();

// ---------------------------------------------------------------------------
// Helpers — mirrors sessionService.js normalizeActivityAsSession
// ---------------------------------------------------------------------------

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const seconds = value.seconds ?? value._seconds;
  if (seconds != null) return new Date(seconds * 1000);
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function durationMinutes(checkinAt, checkoutAt) {
  const s = toDate(checkinAt);
  const e = toDate(checkoutAt);
  if (!s || !e) return 0;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
}

function normalizeActivity(doc) {
  const data = doc.data();
  const checkinAt = data?.checkin?.createdAt ?? data?.activityDate ?? data?.createdAt ?? null;
  const checkoutAt = data?.checkout?.createdAt ?? null;
  const storedDuration = Number(data?.durationMinutes) > 0 ? Number(data.durationMinutes) : 0;
  const dur = storedDuration > 0 ? storedDuration : (checkoutAt ? durationMinutes(checkinAt, checkoutAt) : 0);
  const pse = Number.isFinite(Number(data?.checkout?.pse)) ? Number(data.checkout.pse) : null;

  return {
    id: doc.id,
    athleteId: data?.athleteUserId || '',
    activityDate: data?.activityDate ?? data?.createdAt ?? null,
    atividades: [data?.activityType, data?.modality].filter(Boolean),
    vfc: Number(data?.checkin?.hrv) || 0,
    bemEstar: data?.checkin?.wellBeing || {},
    recuperacao: data?.checkout?.recovery || '',
    dorRegioes: Array.isArray(data?.checkin?.painRegions) ? data.checkin.painRegions : [],
    hidratacao: Number(data?.checkin?.hydration) || 0,
    dataCheckin: checkinAt,
    dataCheckout: data?.status === 'open' ? null : checkoutAt,
    pseFoster: pse,
    duracaoMin: dur,
    carga: pse !== null && dur > 0 ? pse * dur : 0,
    status: data?.status || (checkoutAt ? 'completed' : 'open'),
  };
}

function buildDistribution(activities) {
  const map = {};
  for (const a of activities) {
    const bucket = Array.isArray(a.atividades) && a.atividades[0] ? a.atividades[0] : 'Sem categoria';
    map[bucket] = (map[bucket] || 0) + 1;
  }
  return map;
}

function buildLatestSessionCard(allActivities) {
  const latest = allActivities[0] ?? null;
  if (!latest) return null;
  const hasData = (a) =>
    Number(a.hidratacao) > 0 ||
    (Array.isArray(a.dorRegioes) && a.dorRegioes.length > 0) ||
    Number(a.vfc) > 0 ||
    (typeof a.recuperacao === 'string' && a.recuperacao.trim().length > 0) ||
    a.pseFoster === 0 ||
    Number.isFinite(Number(a.pseFoster)) ||
    Number(a.duracaoMin) > 0;

  const fallback = allActivities.slice(1).find(hasData) ?? null;
  const source = hasData(latest) ? latest : (fallback ?? latest);
  const usesFallback = source.id !== latest.id;
  return {
    session: latest,
    sourceSession: source,
    sourceType: usesFallback ? 'fallback' : 'current',
    sourceLabel: usesFallback ? 'últimos dados registrados' : 'dados da atividade atual',
    inheritedNotice: usesFallback
      ? 'Sem check-in/check-out suficiente na atividade atual. Exibindo o último registro válido do atleta.'
      : '',
  };
}

function formatHours(minutes) {
  const h = minutes / 60;
  return `${h.toFixed(h % 1 === 0 ? 0 : 1)}h`;
}

function cutoffDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - Number(days || 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Auth middleware — extracts and verifies Firebase ID token
// ---------------------------------------------------------------------------

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

  try {
    req.decodedToken = await firebaseAuth.verifyIdToken(token);
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// ---------------------------------------------------------------------------
// athleteDashboardStats
//
// GET ?athleteUid=<uid>&days=<7|30>
// Auth: token.uid must equal athleteUid
// Response: { totalSessions, totalMinutes, totalHoursLabel, recentActivities,
//             activitiesDistribution, lastSession, latestSessionCard, period }
// ---------------------------------------------------------------------------

const athleteApp = express();
athleteApp.use(cors({ origin: true }));
athleteApp.use(requireAuth);

athleteApp.get('/', async (req, res) => {
  const { athleteUid, days: daysRaw = '7' } = req.query;
  const days = Math.min(Math.max(Number(daysRaw) || 7, 1), 365);

  if (!athleteUid) return res.status(400).json({ error: 'athleteUid is required' });
  if (req.decodedToken.uid !== athleteUid) {
    return res.status(403).json({ error: 'Token uid does not match athleteUid' });
  }

  try {
    const snap = await db
      .collection('activities')
      .where('athleteUserId', '==', athleteUid)
      .orderBy('activityDate', 'desc')
      .get();

    const all = snap.docs.map(normalizeActivity);
    const cutoff = cutoffDate(days);

    const periodActivities = all.filter((a) => {
      const d = toDate(a.dataCheckout ?? a.dataCheckin ?? a.activityDate);
      return d && d >= cutoff;
    });

    const totalMinutes = periodActivities.reduce((s, a) => s + Number(a.duracaoMin || 0), 0);

    return res.json({
      totalSessions: periodActivities.length,
      totalMinutes,
      totalHoursLabel: formatHours(totalMinutes),
      recentActivities: all,
      activitiesDistribution: buildDistribution(periodActivities),
      lastSession: all[0] ?? null,
      latestSessionCard: buildLatestSessionCard(all),
      period: days,
    });
  } catch (err) {
    functions.logger.error('athleteDashboardStats error', err);
    return res.status(500).json({ error: err.message });
  }
});

exports.athleteDashboardStats = functions.https.onRequest(athleteApp);

// ---------------------------------------------------------------------------
// trainerDashboardStats
//
// GET ?trainerUid=<uid>&athleteUid=<uid>&days=<7|30>
// Auth: token.uid must equal trainerUid
// Security: athlete must have treinador_id == trainerUid OR at least one activity linking both
// Response: { ...same as athlete... , mode, authorization, authorizedTrainerUid }
// ---------------------------------------------------------------------------

const trainerApp = express();
trainerApp.use(cors({ origin: true }));
trainerApp.use(requireAuth);

trainerApp.get('/', async (req, res) => {
  const { trainerUid, athleteUid, days: daysRaw = '7' } = req.query;
  const days = Math.min(Math.max(Number(daysRaw) || 7, 1), 365);

  if (!trainerUid) return res.status(400).json({ error: 'trainerUid is required' });
  if (!athleteUid) return res.status(400).json({ error: 'athleteUid is required' });
  if (req.decodedToken.uid !== trainerUid) {
    return res.status(403).json({ error: 'Token uid does not match trainerUid' });
  }

  try {
    // Verify trainer-athlete link: athlete document must have treinador_id == trainerUid
    const athleteDoc = await db.collection('users').doc(athleteUid).get();
    const athleteData = athleteDoc.exists ? athleteDoc.data() : null;
    const linked = athleteData?.treinador_id === trainerUid;

    if (!linked) {
      // Fallback: check if any activity in the system links them
      const linkCheck = await db
        .collection('activities')
        .where('athleteUserId', '==', athleteUid)
        .where('trainerUserId', '==', trainerUid)
        .limit(1)
        .get();
      if (linkCheck.empty) {
        return res.status(403).json({
          error: 'Trainer is not authorized to view this athlete',
          code: 'TRAINER_ATHLETE_LINK_NOT_FOUND',
        });
      }
    }

    const snap = await db
      .collection('activities')
      .where('athleteUserId', '==', athleteUid)
      .orderBy('activityDate', 'desc')
      .get();

    const all = snap.docs.map(normalizeActivity);
    const cutoff = cutoffDate(days);

    const periodActivities = all.filter((a) => {
      const d = toDate(a.dataCheckout ?? a.dataCheckin ?? a.activityDate);
      return d && d >= cutoff;
    });

    const totalMinutes = periodActivities.reduce((s, a) => s + Number(a.duracaoMin || 0), 0);

    return res.json({
      totalSessions: periodActivities.length,
      totalMinutes,
      totalHoursLabel: formatHours(totalMinutes),
      recentActivities: all,
      activitiesDistribution: buildDistribution(periodActivities),
      lastSession: all[0] ?? null,
      latestSessionCard: buildLatestSessionCard(all),
      period: days,
      mode: 'backend-admin',
      authorization: 'active-trainer-athlete-link',
      authorizedTrainerUid: trainerUid,
    });
  } catch (err) {
    functions.logger.error('trainerDashboardStats error', err);
    return res.status(500).json({ error: err.message });
  }
});

exports.trainerDashboardStats = functions.https.onRequest(trainerApp);

// ---------------------------------------------------------------------------
// trainerActivities
//
// GET ?trainerUid=<uid>&athleteUid=<uid>&days=<7|30>&limit=<50>
// Auth: token.uid must equal trainerUid
// Alias simplificado do trainerDashboardStats — retorna apenas recentActivities
// (reservado para uso futuro por paginação ou filtros adicionais)
// ---------------------------------------------------------------------------

const trainerActivitiesApp = express();
trainerActivitiesApp.use(cors({ origin: true }));
trainerActivitiesApp.use(requireAuth);

trainerActivitiesApp.get('/', async (req, res) => {
  const { trainerUid, athleteUid, days: daysRaw = '30', limit: limitRaw = '50' } = req.query;
  const days = Math.min(Math.max(Number(daysRaw) || 30, 1), 365);
  const maxResults = Math.min(Math.max(Number(limitRaw) || 50, 1), 200);

  if (!trainerUid) return res.status(400).json({ error: 'trainerUid is required' });
  if (!athleteUid) return res.status(400).json({ error: 'athleteUid is required' });
  if (req.decodedToken.uid !== trainerUid) {
    return res.status(403).json({ error: 'Token uid does not match trainerUid' });
  }

  try {
    const athleteDoc = await db.collection('users').doc(athleteUid).get();
    const athleteData = athleteDoc.exists ? athleteDoc.data() : null;
    const linked = athleteData?.treinador_id === trainerUid;

    if (!linked) {
      const linkCheck = await db
        .collection('activities')
        .where('athleteUserId', '==', athleteUid)
        .where('trainerUserId', '==', trainerUid)
        .limit(1)
        .get();
      if (linkCheck.empty) {
        return res.status(403).json({
          error: 'Trainer is not authorized to view this athlete',
          code: 'TRAINER_ATHLETE_LINK_NOT_FOUND',
        });
      }
    }

    const cutoff = cutoffDate(days);

    const snap = await db
      .collection('activities')
      .where('athleteUserId', '==', athleteUid)
      .orderBy('activityDate', 'desc')
      .get();

    const all = snap.docs.map(normalizeActivity);
    const filtered = all
      .filter((a) => {
        const d = toDate(a.dataCheckout ?? a.dataCheckin ?? a.activityDate);
        return d && d >= cutoff;
      })
      .slice(0, maxResults);

    return res.json({
      activities: filtered,
      total: filtered.length,
      period: days,
      athleteUid,
      trainerUid,
    });
  } catch (err) {
    functions.logger.error('trainerActivities error', err);
    return res.status(500).json({ error: err.message });
  }
});

exports.trainerActivities = functions.https.onRequest(trainerActivitiesApp);
