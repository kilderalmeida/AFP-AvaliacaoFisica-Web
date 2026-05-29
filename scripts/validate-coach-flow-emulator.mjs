/**
 * validate-coach-flow-emulator.mjs
 *
 * Valida o fluxo coach/trainer/athlete contra dados reais do Firestore.
 * Foco nas queries que quebraram e foram corrigidas:
 *
 *   1. loadCoachFilters usava listTrainerAthleteOptions(ctrainerUid) com auth de coach
 *      → Firestore nega (trainerId != auth.uid)
 *   2. CheckIn/CheckOut não entravam no branch do coach (normalizedProfileType !== 'trainer')
 *   3. Dashboard.loadDashboardStats usava selectedTrainer (ctrainerUid) em vez de coachUid
 *      → activities com trainerUserId == coachUid não eram retornadas
 *
 * Este script usa Admin SDK (bypass de rules) para verificar o estado dos dados
 * e confirma que as queries da aplicação retornarão os resultados corretos.
 * Para testar as regras de segurança em si, use: npm run test:rules:emulator
 *
 * Uso:
 *   npm run test:coach-flow:emulator
 *   node scripts/validate-coach-flow-emulator.mjs
 *
 * Pré-requisito: emuladores rodando (firebase emulators:start --only auth,firestore)
 * ou usar: firebase emulators:exec --only auth,firestore "node scripts/validate-coach-flow-emulator.mjs"
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(__dir, '..', '.env.local'), 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 0) continue;
  const key = t.slice(0, eq).trim();
  let val = t.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    val = val.slice(1, -1);
  env[key] = val;
}

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

const app = initializeApp({
  credential: cert({
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);

// ── helpers ────────────────────────────────────────────────────────────────────

const SEP  = '─'.repeat(64);
const pass = (msg) => console.log(`  ✅  ${msg}`);
const fail = (msg) => console.log(`  ❌  ${msg}`);
const info = (msg) => console.log(`  ℹ️   ${msg}`);
const warn = (msg) => console.log(`  ⚠️   ${msg}`);

const results = { passed: 0, failed: 0, warned: 0 };

function ok(label, condition, failMsg) {
  if (condition) { pass(label); results.passed++; }
  else           { fail(failMsg ?? label); results.failed++; }
}

// ── constantes dos usuários @dev.local ────────────────────────────────────────

const COACH_UID      = 'XZhJi9FzuTUF3W4gFJk5zpVgdjo1';
const CTRAINER_UID   = 'huisheYvxUa3dfKnJWouSkwDEgJ3';
const CATHLETE_UID   = 'TRPBpdQkkjWchDQXX25qmtb5P8N2';  // atleta direto do coach
const CATHLETE_B_UID = 'cathlete-b-emulator-smoke';       // atleta direto do ctrainer (emulador)
const ACCOUNT_ID     = 'test-account-starter';

console.log(`\n${SEP}`);
console.log('  AFP — Validação do fluxo coach (emulador / produção)');
console.log(`  Projeto: ${env.VITE_FIREBASE_PROJECT_ID}`);
console.log(SEP);

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 1 — Estado dos documentos de usuário @dev.local
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n── Bloco 1: documentos users/@dev.local ──────────────────────');

const [coachSnap, ctrainerSnap, cathleteSnap, cathleteBSnap] = await Promise.all([
  db.collection('users').doc(COACH_UID).get(),
  db.collection('users').doc(CTRAINER_UID).get(),
  db.collection('users').doc(CATHLETE_UID).get(),
  db.collection('users').doc(CATHLETE_B_UID).get(),
]);

ok(
  'users/coachUid existe',
  coachSnap.exists,
  `users/${COACH_UID} não existe — execute: npm run test:coach-flow:emulator (seed automático) ou node scripts/seed-dev-local-coach.mjs (produção)`
);
if (coachSnap.exists) {
  const d = coachSnap.data();
  ok(`coach.papel == 'coach'`,  d.papel === 'coach',        `coach.papel = '${d.papel}' (esperado: 'coach')`);
  ok(`coach.accountId correto`, d.accountId === ACCOUNT_ID, `coach.accountId = '${d.accountId}'`);
}

ok(
  'users/ctrainerUid existe',
  ctrainerSnap.exists,
  `users/${CTRAINER_UID} não existe — execute: npm run test:coach-flow:emulator (seed automático)`
);
if (ctrainerSnap.exists) {
  const d = ctrainerSnap.data();
  ok(`ctrainer.papel == 'trainer'`,       d.papel === 'trainer',   `ctrainer.papel = '${d.papel}'`);
  ok(`ctrainer.treinador_id == coachUid`, d.treinador_id === COACH_UID,
     `ctrainer.treinador_id = '${d.treinador_id}' (esperado: coachUid) — getTrainersByCoach retornaria vazio`);
}

ok(
  'users/cathleteUid existe (atleta direto do coach)',
  cathleteSnap.exists,
  `users/${CATHLETE_UID} não existe — execute: npm run test:coach-flow:emulator (seed automático)`
);
if (cathleteSnap.exists) {
  const d = cathleteSnap.data();
  ok(`cathlete.papel == 'athlete'`,       d.papel === 'athlete',   `cathlete.papel = '${d.papel}'`);
  ok(`cathlete.treinador_id == coachUid`, d.treinador_id === COACH_UID,
     `cathlete.treinador_id = '${d.treinador_id}' — coach não conseguiria ler este doc (regra: treinador_id == auth.uid)`);
}

ok(
  'users/cathleteBUid existe (atleta direto do ctrainer)',
  cathleteBSnap.exists,
  `users/${CATHLETE_B_UID} não existe — execute: npm run test:coach-flow:emulator (seed automático)`
);
if (cathleteBSnap.exists) {
  const d = cathleteBSnap.data();
  ok(`cathleteB.papel == 'athlete'`,          d.papel === 'athlete',    `cathleteB.papel = '${d.papel}'`);
  ok(`cathleteB.treinador_id == ctrainerUid`, d.treinador_id === CTRAINER_UID,
     `cathleteB.treinador_id = '${d.treinador_id}' — ctrainer não conseguiria ler este doc (regra: treinador_id == auth.uid)`);
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 2 — athlete_links necessários para o fluxo coach
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n── Bloco 2: athlete_links ────────────────────────────────────');

const linkCoachId    = `${CATHLETE_UID}_${COACH_UID}`;
const linkCtrainerId = `${CATHLETE_B_UID}_${CTRAINER_UID}`;

const [linkCoachSnap, linkCtrainerSnap] = await Promise.all([
  db.collection('athlete_links').doc(linkCoachId).get(),
  db.collection('athlete_links').doc(linkCtrainerId).get(),
]);

ok(
  `athlete_links/${linkCoachId} existe (cathlete↔coach)`,
  linkCoachSnap.exists,
  `Link cathlete↔coach não existe — getTrainerActiveAthletes(coachUid) retornaria vazio em Atividades/CheckIn/CheckOut/MeusAtletas`
);
if (linkCoachSnap.exists) {
  const d = linkCoachSnap.data();
  ok(`link cathlete↔coach está active`, d.status === 'active', `link status = '${d.status}' (esperado: 'active')`);
  ok(`link cathlete↔coach.trainerId == coachUid`, d.trainerId === COACH_UID,
     `trainerId = '${d.trainerId}' — query WHERE trainerId==coachUid não retornaria esse link`);
}

ok(
  `athlete_links/${linkCtrainerId} existe (cathleteB↔ctrainer)`,
  linkCtrainerSnap.exists,
  `Link cathleteB↔ctrainer não existe — getTrainerActiveAthletes(ctrainerUid) retornaria vazio em Meus Atletas`
);
if (linkCtrainerSnap.exists) {
  const d = linkCtrainerSnap.data();
  ok(`link cathleteB↔ctrainer está active`, d.status === 'active', `link status = '${d.status}' (esperado: 'active')`);
  ok(`link cathleteB↔ctrainer.trainerId == ctrainerUid`, d.trainerId === CTRAINER_UID,
     `trainerId = '${d.trainerId}' — query WHERE trainerId==ctrainerUid não retornaria esse link`);
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 3 — Queries que a aplicação executa (via Admin SDK = sem regras)
//           Valida se os dados retornariam os resultados corretos.
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n── Bloco 3: queries simuladas da aplicação ───────────────────');

// 3a. getTrainersByCoach(coachUid)
//     → users WHERE treinador_id == coachUid AND papel == 'trainer'
const trainersSnap = await db.collection('users')
  .where('treinador_id', '==', COACH_UID)
  .get();
const trainers = trainersSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(u => u.papel === 'trainer');
ok(
  `getTrainersByCoach: retorna ${trainers.length} trainer(s)`,
  trainers.length >= 1,
  `getTrainersByCoach retornou 0 trainers — seletor de treinador no Painel ficaria vazio`
);
if (trainers.length > 0) {
  info(`  trainers: ${trainers.map(t => t.id).join(', ')}`);
}

// 3b. listTrainerAthleteOptions(coachUid)
//     → athlete_links WHERE trainerId == coachUid AND status == active
//     Query correta para o coach (loadCoachFilters após a correção).
const linksCoachSnap = await db.collection('athlete_links')
  .where('trainerId', '==', COACH_UID)
  .where('status', '==', 'active')
  .get();
ok(
  `listTrainerAthleteOptions(coachUid): retorna ${linksCoachSnap.size} link(s)`,
  linksCoachSnap.size >= 1,
  `listTrainerAthleteOptions(coachUid) retornou 0 links — seletor de atleta no Painel ficaria vazio`
);

// 3c. getTrainerActiveAthletes(ctrainerUid)
//     → athlete_links WHERE trainerId == ctrainerUid AND status == active
//     Usado por TrainerAthletesPage para ctrainer. Admin SDK consegue executar;
//     client SDK com auth de ctrainer também pode (trainerId == auth.uid).
const linksCtrainerSnap = await db.collection('athlete_links')
  .where('trainerId', '==', CTRAINER_UID)
  .where('status', '==', 'active')
  .get();
ok(
  `getTrainerActiveAthletes(ctrainerUid): retorna ${linksCtrainerSnap.size} link(s)`,
  linksCtrainerSnap.size >= 1,
  `Nenhum link ativo para ctrainer — Meus Atletas do ctrainer ficaria vazio`
);

// 3d. getUserProfile(cathleteUid) como coach
//     → users/CATHLETE_UID, requer resource.data.treinador_id == auth.uid (coachUid)
if (cathleteSnap.exists) {
  const cathleteData = cathleteSnap.data();
  ok(
    `getUserProfile(cathlete) como coach: treinador_id satisfaz a regra`,
    cathleteData.treinador_id === COACH_UID,
    `cathlete.treinador_id = '${cathleteData.treinador_id}' — coach receberia permission-denied ao ler o perfil do atleta`
  );
}

// 3e. getUserProfile(cathleteBUid) como ctrainer
//     → users/CATHLETE_B_UID, requer resource.data.treinador_id == auth.uid (ctrainerUid)
//     Este é o caso que antes falhava silenciosamente (cathleteB não existia; cathlete tinha
//     treinador_id: coachUid, bloqueando getUserProfile para ctrainer).
if (cathleteBSnap.exists) {
  const cathleteBData = cathleteBSnap.data();
  ok(
    `getUserProfile(cathleteB) como ctrainer: treinador_id satisfaz a regra`,
    cathleteBData.treinador_id === CTRAINER_UID,
    `cathleteB.treinador_id = '${cathleteBData.treinador_id}' — ctrainer receberia permission-denied ao ler o perfil do atleta`
  );
}

// 3f. getTrainerDashboardStatsByPeriod(coachUid, cathleteUid, ...)
//     → activities WHERE trainerUserId == coachUid AND athleteUserId == cathleteUid
const activitiesCoachSnap = await db.collection('activities')
  .where('trainerUserId', '==', COACH_UID)
  .where('athleteUserId', '==', CATHLETE_UID)
  .get();
if (activitiesCoachSnap.size > 0) {
  ok(`activities coach+cathlete: ${activitiesCoachSnap.size} atividade(s) encontrada(s)`, true, '');
  info(`  Última: ${activitiesCoachSnap.docs[0]?.id}`);
} else {
  info(`  Nenhuma atividade coach+cathlete — Painel mostrará stats zerados (correto para conta nova)`);
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 4 — Regressão: trainer.test@afp.dev
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n── Bloco 4: regressão trainer.test@afp.dev ───────────────────');

const trainerTestSnap = await db.collection('users')
  .where('email', '==', 'trainer.test@afp.dev')
  .limit(1)
  .get();

if (trainerTestSnap.empty) {
  warn('trainer.test@afp.dev não encontrado — regressão de trainer pulada');
  results.warned++;
} else {
  const trainerDoc = trainerTestSnap.docs[0];
  const trainerUid = trainerDoc.id;
  const trainerData = trainerDoc.data();

  ok(`trainer.test papel == 'trainer'`, trainerData.papel === 'trainer', `papel = '${trainerData.papel}'`);

  const trainerLinksSnap = await db.collection('athlete_links')
    .where('trainerId', '==', trainerUid)
    .where('status', '==', 'active')
    .get();
  ok(
    `trainer.test tem ${trainerLinksSnap.size} atleta(s) vinculado(s)`,
    trainerLinksSnap.size > 0,
    `trainer.test não tem athlete_links ativos — Meus Atletas mostraria vazio`
  );

  // Verificar que todos os atletas vinculados têm treinador_id correto
  const athleteIds = trainerLinksSnap.docs.map(d => d.data().athleteId);
  let wrongTreinadorId = 0;
  for (const aid of athleteIds.slice(0, 5)) {
    const aSnap = await db.collection('users').doc(aid).get();
    if (!aSnap.exists) continue;
    if (aSnap.data().treinador_id !== trainerUid) wrongTreinadorId++;
  }
  ok(
    `treinador_id correto nos primeiros ${Math.min(5, athleteIds.length)} atleta(s) de trainer.test`,
    wrongTreinadorId === 0,
    `${wrongTreinadorId} atleta(s) com treinador_id errado — getUserProfile retornaria permission-denied`
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESUMO
// ══════════════════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(64)}`);
console.log('  RESUMO');
console.log(`${'═'.repeat(64)}`);
console.log(`  ✅  ${results.passed} passou`);
console.log(`  ❌  ${results.failed} falhou`);
console.log(`  ⚠️   ${results.warned} aviso(s)`);
console.log(`${'═'.repeat(64)}`);

if (results.failed > 0) {
  console.log('\n  Próximos passos:');
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('  1. npm run test:coach-flow:emulator      (seed + validação automatizados)');
  } else {
    console.log('  1. node scripts/seed-dev-local-coach.mjs   (recria usuários + links em produção)');
    console.log('  2. node scripts/_patch-treinador-id.mjs    (corrige treinador_id stale)');
  }
}
console.log('');

process.exit(results.failed > 0 ? 1 : 0);
