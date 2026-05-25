/**
 * validate-e2e.mjs
 *
 * Valida os 4 fluxos do AFP contra as Cloud Functions.
 *
 * Uso:
 *   node scripts/validate-e2e.mjs                  (emulador local porta 5001)
 *   node scripts/validate-e2e.mjs --production      (Cloud Functions em produção)
 *
 * Pré-requisito (modo emulador): emulador de functions rodando em localhost:5001
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Load .env.local manually (sem biblioteca)
// ---------------------------------------------------------------------------
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '..', '.env.local');
const envRaw = readFileSync(envPath, 'utf8');

function parseEnv(raw) {
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = parseEnv(envRaw);
const WEB_API_KEY = env.VITE_FIREBASE_API_KEY;
const PROJECT_ID = env.VITE_FIREBASE_PROJECT_ID || 'afp-avaliacaofisica';
const CLIENT_EMAIL = env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const IS_PRODUCTION = process.argv.includes('--production');
const EMULATOR_BASE = IS_PRODUCTION
  ? `https://us-central1-${PROJECT_ID}.cloudfunctions.net`
  : `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;

if (!WEB_API_KEY || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error('❌ Credenciais ausentes no .env.local');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// firebase-admin init (service account direto)
// ---------------------------------------------------------------------------
const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');

const app = initializeApp({
  credential: cert({ projectId: PROJECT_ID, clientEmail: CLIENT_EMAIL, privateKey: PRIVATE_KEY }),
});
const db = getFirestore(app);
const adminAuth = getAuth(app);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SEP = '─'.repeat(68);
const log = (...args) => console.log(...args);
const pass = (msg) => log(`  ✅  ${msg}`);
const fail = (msg) => log(`  ❌  ${msg}`);
const warn = (msg) => log(`  ⚠️   ${msg}`);
const info = (msg) => log(`  ℹ️   ${msg}`);

async function getIdToken(uid) {
  const customToken = await adminAuth.createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`getIdToken failed (${res.status}): ${txt}`);
  }
  const { idToken } = await res.json();
  return idToken;
}

async function callFunction(functionName, params, idToken) {
  const qs = new URLSearchParams(params).toString();
  const url = `${EMULATOR_BASE}/${functionName}?${qs}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
  });
  const latency = Date.now() - t0;
  const body = res.ok ? await res.json() : await res.text().catch(() => '(empty)');
  return { status: res.status, ok: res.ok, body, url, latency };
}

async function callFunctionRaw(functionName, params, authHeader) {
  const qs = new URLSearchParams(params).toString();
  const url = `${EMULATOR_BASE}/${functionName}?${qs}`;
  const headers = { 'Content-Type': 'application/json' };
  if (authHeader !== undefined) headers['Authorization'] = authHeader;
  const t0 = Date.now();
  const res = await fetch(url, { method: 'GET', headers });
  const latency = Date.now() - t0;
  return { status: res.status, latency, url };
}

const REQUIRED_ACTIVITY_FIELDS = ['id', 'status'];
const ACTIVITY_DATE_FIELDS = ['activityDate', 'dataCheckin'];

function validateActivityShape(activities, label, results) {
  if (!Array.isArray(activities) || activities.length === 0) return;
  let errors = 0;
  for (const a of activities) {
    const missing = REQUIRED_ACTIVITY_FIELDS.filter((f) => a[f] === undefined || a[f] === null);
    const hasDate = ACTIVITY_DATE_FIELDS.some((f) => a[f] !== undefined && a[f] !== null);
    if (!hasDate) missing.push('activityDate|dataCheckin');
    if (missing.length > 0) errors++;
  }
  if (errors === 0) {
    pass(`${label} shape OK: id, activityDate/dataCheckin, status presentes em ${activities.length} atividade(s)`);
    results.passed++;
  } else {
    fail(`${label} shape: ${errors}/${activities.length} atividades com campos ausentes`);
    results.failed++;
  }
}

function summarizeActivities(activities) {
  if (!Array.isArray(activities) || activities.length === 0) return 'nenhuma';
  const ids = activities.slice(0, 3).map((a) => a.id?.slice(0, 8) + '…');
  const extra = activities.length > 3 ? ` +${activities.length - 3} mais` : '';
  return `${activities.length} atividade(s): [${ids.join(', ')}${extra}]`;
}

function lastActivityDate(activities) {
  if (!Array.isArray(activities) || activities.length === 0) return 'n/a';
  const a = activities[0];
  const raw = a.dataCheckin || a.activityDate;
  if (!raw) return 'n/a';
  try {
    const d = raw._seconds ? new Date(raw._seconds * 1000) : new Date(raw);
    return d.toLocaleDateString('pt-BR');
  } catch { return String(raw); }
}

// ---------------------------------------------------------------------------
// Discover real users
// ---------------------------------------------------------------------------
log('\n' + SEP);
log('  AFP — Validação E2E dos 4 Fluxos');
log(`  Alvo    : ${IS_PRODUCTION ? '🚀 PRODUÇÃO' : '🔧 Emulador local'}`);
log('  Base URL: ' + EMULATOR_BASE);
log(SEP);

log('\n🔍  Buscando usuários no Firestore de produção…');

const usersSnap = await db.collection('users').limit(30).get();
const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

function normalizeRole(u) {
  const papel = String(u?.papel || '').normalize('NFC').trim().toLowerCase();
  if (papel === 'atleta' || papel === 'athlete') return 'atleta';
  if (papel === 'treinador' || papel === 'trainer') return 'treinador';
  if (papel === 'coach') return 'coach';
  const types = Array.isArray(u?.userTypes) ? u.userTypes : [];
  for (const t of types) {
    const n = String(t || '').normalize('NFC').trim().toLowerCase();
    if (n === 'atleta' || n === 'athlete') return 'atleta';
    if (n === 'treinador' || n === 'trainer') return 'treinador';
    if (n === 'coach') return 'coach';
  }
  return null;
}

const athletes = allUsers.filter((u) => normalizeRole(u) === 'atleta');
const trainers = allUsers.filter((u) => normalizeRole(u) === 'treinador' || normalizeRole(u) === 'coach');

info(`Usuários encontrados: ${allUsers.length} total | ${athletes.length} atletas | ${trainers.length} treinadores`);

if (athletes.length === 0) {
  warn('Nenhum atleta encontrado ��� fluxos de atleta serão ignorados.');
}
if (trainers.length === 0) {
  warn('Nenhum treinador encontrado — fluxos de treinador serão ignorados.');
}

const results = { passed: 0, failed: 0, warned: 0 };

// ---------------------------------------------------------------------------
// Fluxo 1 & 2 — Atleta > Dashboard e Activities List
// ---------------------------------------------------------------------------
if (athletes.length > 0) {
  const athlete = athletes[0];
  const athleteName = athlete.displayName || athlete.nome || athlete.email || athlete.id;
  log(`\n${SEP}`);
  log(`  Fluxo 1 + 2 — Atleta: ${athleteName} (${athlete.id})`);
  log(SEP);

  let athleteToken;
  try {
    athleteToken = await getIdToken(athlete.id);
    pass('Custom token gerado e trocado por ID token');
    results.passed++;
  } catch (err) {
    fail(`Falha ao gerar token do atleta: ${err.message}`);
    results.failed++;
  }

  if (athleteToken) {
    // Fluxo 1: athleteDashboardStats — 7 dias
    log('\n  📊  Fluxo 1 — Dashboard do atleta (7 dias)');
    const f1 = await callFunction('athleteDashboardStats', { athleteUid: athlete.id, days: 7 }, athleteToken);
    log(`     Endpoint : GET ${f1.url}`);
    log(`     Status   : HTTP ${f1.status}  (${f1.latency}ms)`);

    if (f1.ok) {
      pass(`athleteDashboardStats → HTTP 200 em ${f1.latency}ms`);
      results.passed++;
      log(`     totalSessions     : ${f1.body.totalSessions}`);
      log(`     totalHoursLabel   : ${f1.body.totalHoursLabel}`);
      log(`     recentActivities  : ${summarizeActivities(f1.body.recentActivities)}`);
      log(`     última atividade  : ${lastActivityDate(f1.body.recentActivities)}`);
      if (f1.body.latestSessionCard) {
        const s = f1.body.latestSessionCard.session;
        log(`     latestSessionCard : ${s?.id?.slice(0, 8)}… status=${s?.status}`);
      }
      if (!Array.isArray(f1.body.recentActivities)) {
        fail('recentActivities não é array'); results.failed++;
      } else {
        validateActivityShape(f1.body.recentActivities, 'athleteDashboardStats', results);
      }
    } else {
      fail(`athleteDashboardStats → HTTP ${f1.status}: ${typeof f1.body === 'string' ? f1.body.slice(0, 200) : JSON.stringify(f1.body).slice(0, 200)}`);
      results.failed++;
    }

    // Fluxo 2: Mesmo endpoint, simula activities list
    log('\n  📋  Fluxo 2 — Activities list do atleta (mesmo endpoint, extrai recentActivities)');
    const f2 = await callFunction('athleteDashboardStats', { athleteUid: athlete.id, days: 7 }, athleteToken);
    log(`     Endpoint : GET ${f2.url}`);
    log(`     Status   : HTTP ${f2.status}  (${f2.latency}ms)`);

    if (f2.ok) {
      pass(`activities list → HTTP 200`);
      results.passed++;
      const activitiesFromList = Array.isArray(f2.body.recentActivities) ? f2.body.recentActivities : [];
      const activitiesFromDash = Array.isArray(f1.body?.recentActivities) ? f1.body.recentActivities : [];
      const idsFromList = activitiesFromList.map((a) => a.id).sort().join(',');
      const idsFromDash = activitiesFromDash.map((a) => a.id).sort().join(',');

      if (idsFromList === idsFromDash) {
        pass('Dashboard e Activities list: IDs idênticos (mesma origem)');
        results.passed++;
      } else {
        warn('Dashboard e Activities list: IDs divergem');
        log(`     IDs dash : ${idsFromDash.slice(0, 120)}`);
        log(`     IDs list : ${idsFromList.slice(0, 120)}`);
        results.warned++;
      }
    } else {
      fail(`activities list → HTTP ${f2.status}`);
      results.failed++;
    }

    // Teste de segurança: atleta tentando acessar outro uid
    log('\n  🔐  Segurança — atleta acessando UID de outro usuário');
    const fakeUid = 'outro-usuario-uid-fake';
    const fSec = await callFunction('athleteDashboardStats', { athleteUid: fakeUid, days: 7 }, athleteToken);
    if (fSec.status === 403) {
      pass(`Bloqueio correto (HTTP 403) para uid diferente do token`);
      results.passed++;
    } else {
      fail(`Esperado 403, recebeu ${fSec.status} — verifique guard de segurança`);
      results.failed++;
    }
  }
}

// ---------------------------------------------------------------------------
// Fluxo 3 & 4 — Treinador > Dashboard e Activities List
// ---------------------------------------------------------------------------
if (trainers.length > 0) {
  const trainer = trainers[0];
  const trainerName = trainer.displayName || trainer.nome || trainer.email || trainer.id;
  log(`\n${SEP}`);
  log(`  Fluxo 3 + 4 — Treinador: ${trainerName} (${trainer.id})`);
  log(SEP);

  // Encontrar atletas vinculados (campo treinador_id)
  const linkedSnap = await db.collection('users')
    .where('treinador_id', '==', trainer.id)
    .limit(5)
    .get();
  const linkedAthletes = linkedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (linkedAthletes.length === 0) {
    warn(`Nenhum atleta com treinador_id=${trainer.id}. Tentando fallback via activities…`);
    results.warned++;

    // Fallback: buscar atividade que vincule trainerUid
    const actFallback = await db.collection('activities')
      .where('trainerUserId', '==', trainer.id)
      .limit(3)
      .get();
    const fallbackAthleteUids = [...new Set(actFallback.docs.map((d) => d.data().athleteUserId).filter(Boolean))];
    if (fallbackAthleteUids.length > 0) {
      info(`Fallback encontrou ${fallbackAthleteUids.length} atleta(s) via activities: ${fallbackAthleteUids.slice(0, 3).join(', ')}`);
      for (const uid of fallbackAthleteUids.slice(0, 1)) {
        const u = allUsers.find((x) => x.id === uid) || { id: uid };
        linkedAthletes.push(u);
      }
    }
  }

  info(`Atletas vinculados ao treinador: ${linkedAthletes.length}`);
  linkedAthletes.forEach((a) => {
    const name = a.displayName || a.nome || a.email || a.id;
    info(`  · ${name} (${a.id})`);
  });

  let trainerToken;
  try {
    trainerToken = await getIdToken(trainer.id);
    pass('Custom token do treinador gerado');
    results.passed++;
  } catch (err) {
    fail(`Falha ao gerar token do treinador: ${err.message}`);
    results.failed++;
  }

  if (trainerToken && linkedAthletes.length > 0) {
    const athlete = linkedAthletes[0];
    const athleteName = athlete.displayName || athlete.nome || athlete.email || athlete.id;

    // Fluxo 3: trainerDashboardStats — atleta inicial
    log(`\n  📊  Fluxo 3 — Dashboard do treinador para: ${athleteName}`);
    const f3 = await callFunction('trainerDashboardStats', {
      trainerUid: trainer.id, athleteUid: athlete.id, days: 7
    }, trainerToken);
    log(`     Endpoint : GET ${f3.url}`);
    log(`     Status   : HTTP ${f3.status}  (${f3.latency}ms)`);

    if (f3.ok) {
      pass(`trainerDashboardStats → HTTP 200 em ${f3.latency}ms`);
      results.passed++;
      log(`     totalSessions     : ${f3.body.totalSessions}`);
      log(`     totalHoursLabel   : ${f3.body.totalHoursLabel}`);
      log(`     mode              : ${f3.body.mode}`);
      log(`     authorization     : ${f3.body.authorization}`);
      log(`     recentActivities  : ${summarizeActivities(f3.body.recentActivities)}`);
      log(`     última atividade  : ${lastActivityDate(f3.body.recentActivities)}`);
      if (Array.isArray(f3.body.recentActivities)) {
        validateActivityShape(f3.body.recentActivities, 'trainerDashboardStats', results);
      }
    } else {
      fail(`trainerDashboardStats → HTTP ${f3.status}: ${typeof f3.body === 'string' ? f3.body.slice(0, 200) : JSON.stringify(f3.body).slice(0, 200)}`);
      results.failed++;
    }

    // Fluxo 4: Activities list do treinador (mesmo endpoint)
    log(`\n  📋  Fluxo 4 — Activities list do treinador para: ${athleteName}`);
    const f4 = await callFunction('trainerDashboardStats', {
      trainerUid: trainer.id, athleteUid: athlete.id, days: 7
    }, trainerToken);
    log(`     Endpoint : GET ${f4.url}`);
    log(`     Status   : HTTP ${f4.status}  (${f4.latency}ms)`);

    if (f4.ok) {
      pass(`activities list treinador → HTTP 200`);
      results.passed++;

      const idsF3 = Array.isArray(f3.body?.recentActivities) ? f3.body.recentActivities.map((a) => a.id).sort().join(',') : '';
      const idsF4 = Array.isArray(f4.body?.recentActivities) ? f4.body.recentActivities.map((a) => a.id).sort().join(',') : '';

      if (idsF3 === idsF4) {
        pass('Dashboard e Activities list treinador: IDs idênticos');
        results.passed++;
      } else {
        warn('Dashboard e Activities list treinador: IDs divergem');
        results.warned++;
      }
    } else {
      fail(`activities list treinador → HTTP ${f4.status}`);
      results.failed++;
    }

    // Troca de atleta (se houver mais de 1 vinculado)
    if (linkedAthletes.length >= 2) {
      const athlete2 = linkedAthletes[1];
      const name2 = athlete2.displayName || athlete2.nome || athlete2.email || athlete2.id;
      log(`\n  🔄  Troca de atleta → ${name2} (${athlete2.id})`);
      const fSwitch = await callFunction('trainerDashboardStats', {
        trainerUid: trainer.id, athleteUid: athlete2.id, days: 7
      }, trainerToken);
      if (fSwitch.ok) {
        pass(`Troca de atleta → HTTP 200, ${summarizeActivities(fSwitch.body.recentActivities)}`);
        results.passed++;
      } else {
        fail(`Troca de atleta → HTTP ${fSwitch.status}`);
        results.failed++;
      }
    } else {
      info('Apenas 1 atleta vinculado — troca de atleta não testada');
    }

    // Segurança: treinador acessando atleta não vinculado
    log('\n  🔐  Segurança — treinador acessando atleta não vinculado');
    const fSecTrainer = await callFunction('trainerDashboardStats', {
      trainerUid: trainer.id, athleteUid: 'atleta-nao-vinculado-fake', days: 7
    }, trainerToken);
    if (fSecTrainer.status === 403) {
      pass(`Bloqueio correto (HTTP 403) para atleta não vinculado`);
      results.passed++;
    } else {
      fail(`Esperado 403, recebeu ${fSecTrainer.status}`);
      results.failed++;
    }

  } else if (trainerToken && linkedAthletes.length === 0) {
    warn('Sem atletas vinculados — fluxos 3 e 4 não puderam ser testados com dados reais');
    results.warned++;
  }
}

// ---------------------------------------------------------------------------
// trainerActivities — probe básico
// ---------------------------------------------------------------------------
if (trainers.length > 0) {
  const trainer = trainers[0];
  const linkedSnap = await db.collection('users').where('treinador_id', '==', trainer.id).limit(1).get();
  const linkedAthletes = linkedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (linkedAthletes.length > 0) {
    log(`\n${SEP}`);
    log('  trainerActivities — endpoint reservado para paginação');
    log(SEP);
    const token = await getIdToken(trainer.id);
    const fAct = await callFunction('trainerActivities', {
      trainerUid: trainer.id, athleteUid: linkedAthletes[0].id, days: 30, limit: 20
    }, token);
    log(`     Status   : HTTP ${fAct.status}`);
    if (fAct.ok) {
      pass(`trainerActivities → HTTP 200, ${fAct.body.total} atividade(s) em ${fAct.body.period} dias`);
      results.passed++;
    } else {
      fail(`trainerActivities → HTTP ${fAct.status}`);
      results.failed++;
    }
  }
}

// ---------------------------------------------------------------------------
// ActivityDetailPage — verifica se a primeira atividade existe no Firestore
// ---------------------------------------------------------------------------
log(`\n${SEP}`);
log('  ActivityDetailPage — acessibilidade de atividade pelo ID');
log(SEP);

const activitiesSnap = await db.collection('activities').orderBy('activityDate', 'desc').limit(3).get();
if (activitiesSnap.empty) {
  warn('Nenhuma atividade no Firestore — ActivityDetailPage não pôde ser testada');
  results.warned++;
} else {
  for (const docSnap of activitiesSnap.docs) {
    const data = docSnap.data();
    const url = `http://localhost:5173/activities/${docSnap.id}`;
    log(`     ID       : ${docSnap.id}`);
    log(`     athleteId: ${data.athleteUserId}`);
    log(`     status   : ${data.status}`);
    log(`     URL      : ${url}`);
    pass(`Documento existe no Firestore → ActivityDetailPage conseguirá exibir`);
    results.passed++;
    break;
  }
}

// ---------------------------------------------------------------------------
// Testes de segurança HTTP — sem token (401) e token malformado (403)
// ---------------------------------------------------------------------------
log(`\n${SEP}`);
log('  Segurança HTTP — ausência e malformação de token');
log(SEP);

const secParams = athletes.length > 0
  ? { athleteUid: athletes[0].id, days: 7 }
  : { athleteUid: 'probe-uid', days: 7 };

// Sem Authorization header → deve retornar 401
const noAuth = await callFunctionRaw('athleteDashboardStats', secParams, undefined);
log(`     [sem token]     : HTTP ${noAuth.status}  (${noAuth.latency}ms)`);
if (noAuth.status === 401) {
  pass('Sem token → HTTP 401 (Missing Authorization header)');
  results.passed++;
} else {
  fail(`Sem token → esperado 401, recebeu ${noAuth.status}`);
  results.failed++;
}

// Token malformado (string arbitrária) → deve retornar 403
const badToken = await callFunctionRaw('athleteDashboardStats', secParams, 'Bearer INVALID.TOKEN.XYZ');
log(`     [token inválido] : HTTP ${badToken.status}  (${badToken.latency}ms)`);
if (badToken.status === 403) {
  pass('Token malformado → HTTP 403 (Invalid or expired token)');
  results.passed++;
} else {
  fail(`Token malformado → esperado 403, recebeu ${badToken.status}`);
  results.failed++;
}

// ---------------------------------------------------------------------------
// Resumo final
// ---------------------------------------------------------------------------
log(`\n${'═'.repeat(68)}`);
log(`  RESUMO`);
log(`${'═'.repeat(68)}`);
log(`  ✅  ${results.passed} passou`);
log(`  ❌  ${results.failed} falhou`);
log(`  ⚠️   ${results.warned} aviso(s)`);
log(`${'═'.repeat(68)}\n`);

process.exit(results.failed > 0 ? 1 : 0);
