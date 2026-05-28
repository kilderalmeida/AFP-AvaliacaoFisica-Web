/**
 * sessionService.js
 *
 * Fluxo canônico de treino baseado apenas em `activities`.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from './firebase/config.js';
import { getTrainerDashboardStatsFromBackend } from './trainer-dashboard-backend.service.js';
import { getAthleteDashboardStatsFromBackend } from './athlete-dashboard-backend.service.js';

async function ensureOwnUserProfileIfMissing(uid) {
  const authUser = auth.currentUser;
  if (!authUser || authUser.uid !== uid) return false;

  const now = new Date();
  const email = String(authUser.email || '');
  const fallbackName = email.includes('@') ? email.split('@')[0] : 'Usuario';

  const profilePayload = {
    uid,
    displayName: String(authUser.displayName || fallbackName),
    email,
    phoneNumber: String(authUser.phoneNumber || ''),
    photoURL: String(authUser.photoURL || ''),
    userTypes: [],
    status: 'pending',
    isProfileComplete: false,
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
    updatedBy: uid,
    schemaVersion: 2,
  };

  try {
    await setDoc(doc(db, 'users', uid), profilePayload, { merge: false });
    return true;
  } catch {
    // Self-provisioning is only allowed for platform_admin/account_admin.
    // For regular users, silently return false — caller handles the missing doc.
    return false;
  }
}

function toDateObject(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  // Cloud Functions serialize Timestamps as { _seconds, _nanoseconds }; Firestore SDK uses { seconds }
  const seconds = value?.seconds ?? value?._seconds;
  if (seconds) return new Date(seconds * 1000);

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getPeriodReferenceDate(session) {
  return toDateObject(session?.activityDate || session?.dataCheckin || session?.dataCheckout);
}

function getPeriodCutoffStart(days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - Number(days || 0));
  cutoffDate.setHours(0, 0, 0, 0);
  return cutoffDate;
}

function getSessionDistributionBucket(session) {
  const primary = Array.isArray(session?.atividades) ? String(session.atividades[0] || '').trim() : '';
  if (primary) return primary;

  const fallback = Array.isArray(session?.atividades) ? String(session.atividades[1] || '').trim() : '';
  return fallback || 'Sem categoria';
}

function formatDateTimePtBR(value) {
  const date = toDateObject(value);
  if (!date) return 'N/D';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function calculateDurationMinutes(startValue, endValue = new Date()) {
  const startDate = toDateObject(startValue);
  const endDate = toDateObject(endValue);

  if (!startDate || !endDate) return 0;

  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

function formatHoursFromMinutes(minutes = 0) {
  const hours = minutes / 60;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

function normalizeActivityAsSession(docSnap) {
  const data = docSnap.data();
  const checkinAt = data?.checkin?.createdAt || data?.activityDate || data?.createdAt || null;
  const checkoutAt = data?.checkout?.createdAt || null;
  const durationMinutes = Number(data?.durationMinutes) > 0
    ? Number(data.durationMinutes)
    : checkoutAt
      ? calculateDurationMinutes(checkinAt, checkoutAt)
      : 0;
  const pse = Number.isFinite(Number(data?.checkout?.pse)) ? Number(data.checkout.pse) : null;

  return {
    id: docSnap.id,
    athleteId: data?.athleteUserId || '',
    activityDate: data?.activityDate || data?.createdAt || null,
    atividades: [data?.activityType, data?.modality].filter(Boolean),
    vfc: Number(data?.checkin?.hrv) || 0,
    bemEstar: data?.checkin?.wellBeing || {},
    recuperacao: data?.checkout?.recovery || '',
    dorRegioes: Array.isArray(data?.checkin?.painRegions) ? data.checkin.painRegions : [],
    hidratacao: Number(data?.checkin?.hydration) || 0,
    dataCheckin: checkinAt,
    dataCheckout: data?.status === 'open' ? null : checkoutAt,
    pseFoster: pse,
    duracaoMin: durationMinutes,
    carga: pse !== null && durationMinutes > 0 ? pse * durationMinutes : 0,
    status: data?.status || (checkoutAt ? 'completed' : 'open'),
  };
}

function sortSessionsByDateDesc(sessions) {
  return sessions.sort((a, b) => {
    const timeA = toDateObject(a.dataCheckout || a.dataCheckin || a.activityDate)?.getTime() || 0;
    const timeB = toDateObject(b.dataCheckout || b.dataCheckin || b.activityDate)?.getTime() || 0;
    return timeB - timeA;
  });
}

function hasRecordedWellBeing(bemEstar) {
  if (!bemEstar || typeof bemEstar !== 'object') return false;

  return ['sleep', 'mood', 'fatigue', 'pain', 'stress'].some(
    (key) => Number(bemEstar?.[key]) > 0
  );
}

function hasCoachRelevantData(session) {
  if (!session) return false;

  return (
    Number(session.hidratacao) > 0 ||
    (Array.isArray(session.dorRegioes) && session.dorRegioes.length > 0) ||
    Number(session.vfc) > 0 ||
    (typeof session.recuperacao === 'string' && session.recuperacao.trim().length > 0) ||
    hasRecordedWellBeing(session.bemEstar) ||
    session.pseFoster === 0 ||
    Number.isFinite(Number(session.pseFoster)) ||
    Number(session.duracaoMin) > 0 ||
    Number(session.carga) > 0
  );
}

function buildLatestSessionCardData(allSessions) {
  const latestSession = allSessions[0] || null;

  if (!latestSession) {
    return null;
  }

  const fallbackSession = allSessions.find(
    (session, index) => index > 0 && hasCoachRelevantData(session)
  );
  const sourceSession = hasCoachRelevantData(latestSession)
    ? latestSession
    : fallbackSession || latestSession;
  const usesFallback = sourceSession?.id !== latestSession.id;

  return {
    session: latestSession,
    sourceSession,
    sourceType: usesFallback ? 'fallback' : 'current',
    sourceLabel: usesFallback ? 'últimos dados registrados' : 'dados da atividade atual',
    inheritedNotice: usesFallback
      ? 'Sem check-in/check-out suficiente na atividade atual. Exibindo o último registro válido do atleta.'
      : '',
  };
}

function normalizeRoleToken(value) {
  const token = String(value || '').normalize('NFC').trim().toLowerCase();
  if (!token) return '';

  // Map legacy Portuguese names → new canonical English names
  if (token === 'athlete' || token === 'atleta') return 'athlete';
  if (token === 'trainer' || token === 'treinador') return 'trainer';
  if (token === 'coach') return 'coach';
  if (token === 'admin' || token === 'platform_admin') return 'platform_admin';
  if (token === 'account_admin') return 'account_admin';

  return '';
}

function resolveCanonicalRole(userData) {
  const roleFromPapel = normalizeRoleToken(userData?.papel);
  const rolesFromUserTypes = Array.from(
    new Set(
      (Array.isArray(userData?.userTypes) ? userData.userTypes : [])
        .map((type) => normalizeRoleToken(type))
        .filter(Boolean)
    )
  );

  if (rolesFromUserTypes.length === 1) {
    return rolesFromUserTypes[0];
  }

  if (rolesFromUserTypes.length > 1) {
    if (roleFromPapel && rolesFromUserTypes.includes(roleFromPapel)) {
      return roleFromPapel;
    }

    if (rolesFromUserTypes.includes('coach')) return 'coach';
    if (rolesFromUserTypes.includes('trainer')) return 'trainer';
    if (rolesFromUserTypes.includes('athlete')) return 'athlete';
  }

  return roleFromPapel;
}

function normalizeProfileTypeFromUserData(userData) {
  return resolveCanonicalRole(userData);
}

function normalizeUserRole(userData) {
  return resolveCanonicalRole(userData);
}

function asTrimmedString(value) {
  return String(value || '').trim();
}

export async function getCurrentUserProfile(uid) {
  try {
    const userRef = doc(db, 'users', uid);
    let userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await ensureOwnUserProfileIfMissing(uid);
      userSnap = await getDoc(userRef);
    }

    if (!userSnap.exists()) return null;

    const userData = userSnap.data();
    return {
      uid,
      nome: userData?.displayName || userData?.nome || '',
      email: userData?.email || '',
      papel: normalizeProfileTypeFromUserData(userData),
      userTypes: Array.isArray(userData?.userTypes) ? userData.userTypes : [],
    };
  } catch (error) {
    console.error('Erro ao buscar perfil do usuário:', error);
    return null;
  }
}

export async function getAthleteSessions(uid) {
  try {
    const q = query(
      collection(db, 'activities'),
      where('athleteUserId', '==', uid),
      orderBy('activityDate', 'desc')
    );
    const snap = await getDocs(q);
    const sessions = snap.docs.map((d) => normalizeActivityAsSession(d));

    return sortSessionsByDateDesc(sessions);
  } catch (error) {
    console.error('Erro ao buscar atividades do atleta:', error);
    return [];
  }
}

async function getTrainerAthleteSessionsScoped(trainerUid, athleteUid) {
  try {
    const q = query(
      collection(db, 'activities'),
      where('trainerUserId', '==', trainerUid),
      where('athleteUserId', '==', athleteUid),
      orderBy('activityDate', 'desc')
    );
    const snap = await getDocs(q);
    const sessions = snap.docs.map((d) => normalizeActivityAsSession(d));
    return sortSessionsByDateDesc(sessions);
  } catch (error) {
    console.error('Erro ao buscar atividades do atleta no escopo do treinador:', error);
    return [];
  }
}

export async function getRecentAthleteSessions(uid, limitCount = 5) {
  const allSessions = await getAthleteSessions(uid);
  return allSessions.slice(0, limitCount);
}

export async function getDashboardStats(uid) {
  try {
    const sessions = await getAthleteSessions(uid);
    const totalMinutes = sessions.reduce((acc, item) => acc + Number(item.duracaoMin || 0), 0);

    return {
      totalSessions: sessions.length,
      totalMinutes,
      totalHoursLabel: formatHoursFromMinutes(totalMinutes),
      recentActivities: sessions,
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas do dashboard:', error);
    return {
      totalSessions: 0,
      totalMinutes: 0,
      totalHoursLabel: '0h',
      recentActivities: [],
    };
  }
}

export function formatDateTimeForDisplay(value) {
  return formatDateTimePtBR(value);
}

export function formatDurationForDisplay(minutes) {
  return formatHoursFromMinutes(minutes);
}

export function calculateDurationForDisplay(startValue, endValue) {
  return calculateDurationMinutes(startValue, endValue);
}

export function convertToDate(value) {
  return toDateObject(value);
}

export async function getAthletesByCoach(coachUid) {
  try {
    const snap = await getDocs(
      query(collection(db, 'users'), where('coach_id', '==', coachUid))
    );
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return users.filter((user) => normalizeUserRole(user) === 'athlete');
  } catch (error) {
    console.error('Erro ao buscar atletas do coach:', error);
    return [];
  }
}

export async function getTrainersByCoach(coachUid) {
  try {
    const snap = await getDocs(
      query(collection(db, 'users'), where('coach_id', '==', coachUid))
    );
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return users.filter((user) => normalizeUserRole(user) === 'trainer');
  } catch (error) {
    console.error('Erro ao buscar treinadores:', error);
    return [];
  }
}

export async function getAthleteSessionsByPeriod(athleteUid, days = 7) {
  try {
    const allSessions = await getAthleteSessions(athleteUid);
    const cutoffDate = getPeriodCutoffStart(days);

    return allSessions.filter((session) => {
      const sessionDate = toDateObject(session.dataCheckout || session.dataCheckin);
      return sessionDate && sessionDate >= cutoffDate;
    });
  } catch (error) {
    console.error('Erro ao buscar sessões do período:', error);
    return [];
  }
}

export async function getDashboardStatsByPeriod(uid, days = 7) {
  try {
    const allSessions = await getAthleteSessions(uid);
    const cutoffDate = getPeriodCutoffStart(days);

    const sessions = allSessions.filter((session) => {
      const sessionDate = getPeriodReferenceDate(session);
      return sessionDate && sessionDate >= cutoffDate;
    });

    const totalMinutes = sessions.reduce((acc, item) => acc + Number(item.duracaoMin || 0), 0);

    const activitiesMap = {};
    sessions.forEach((session) => {
      const bucket = getSessionDistributionBucket(session);
      activitiesMap[bucket] = (activitiesMap[bucket] || 0) + 1;
    });

    const latestSessionCard = buildLatestSessionCardData(allSessions);
    const lastSession = latestSessionCard?.session || null;

    return {
      totalSessions: sessions.length,
      totalMinutes,
      totalHoursLabel: formatHoursFromMinutes(totalMinutes),
      recentActivities: allSessions,
      activitiesDistribution: activitiesMap,
      lastSession,
      latestSessionCard,
      period: days,
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas do período:', error);
    return {
      totalSessions: 0,
      totalMinutes: 0,
      totalHoursLabel: '0h',
      recentActivities: [],
      activitiesDistribution: {},
      lastSession: null,
      latestSessionCard: null,
      period: days,
    };
  }
}

export async function getTrainerDashboardStatsByPeriod(trainerUid, athleteUid, days = 7) {
  try {
    if (!trainerUid || !athleteUid) {
      return {
        totalSessions: 0,
        totalMinutes: 0,
        totalHoursLabel: '0h',
        recentActivities: [],
        activitiesDistribution: {},
        lastSession: null,
        latestSessionCard: null,
        period: days,
      };
    }
    const backendStats = await getTrainerDashboardStatsFromBackend({
      trainerUid,
      athleteUid,
      days,
    });

    return {
      selectedAthleteUid: athleteUid,
      totalSessions: Number(backendStats?.totalSessions || 0),
      totalMinutes: Number(backendStats?.totalMinutes || 0),
      totalHoursLabel: String(backendStats?.totalHoursLabel || '0h'),
      recentActivities: Array.isArray(backendStats?.recentActivities) ? backendStats.recentActivities : [],
      activitiesDistribution:
        backendStats?.activitiesDistribution && typeof backendStats.activitiesDistribution === 'object'
          ? backendStats.activitiesDistribution
          : {},
      lastSession: backendStats?.lastSession || null,
      latestSessionCard: backendStats?.latestSessionCard || null,
      period: Number(backendStats?.period || days),
      mode: backendStats?.mode || 'backend-admin',
      authorization: backendStats?.authorization || 'active-trainer-athlete-link',
      authorizedTrainerUid: backendStats?.authorizedTrainerUid || trainerUid,
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas do treinador no período:', {
      message: error?.message,
      code: error?.code,
      status: error?.status,
      endpoint: error?.endpoint,
      runtimeConfig: error?.runtimeConfig,
      responsePayload: error?.responsePayload,
    });
    throw error;
  }
}

export async function getAthleteDashboardStats(uid, days = 7) {
  return getAthleteDashboardStatsFromBackend({ athleteUid: uid, days });
}
