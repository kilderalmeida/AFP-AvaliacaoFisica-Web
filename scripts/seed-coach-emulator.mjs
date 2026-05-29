/**
 * seed-coach-emulator.mjs
 *
 * Popula o Firebase Local Emulator com os dados mínimos
 * necessários para o smoke test do fluxo coach.
 *
 * NUNCA execute contra produção.
 * Projetado para ser chamado por firebase emulators:exec,
 * que injeta automaticamente:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8081
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
 *
 * Usa os mesmos UIDs da conta @dev.local de produção para que
 * validate-coach-flow-emulator.mjs funcione sem alterações.
 *
 * Uso:
 *   firebase emulators:exec --only auth,firestore \
 *     "node scripts/seed-coach-emulator.mjs && node scripts/validate-coach-flow-emulator.mjs"
 *
 * Ou via npm:
 *   npm run test:coach-flow:emulator
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Guarda de segurança: bloqueia execução fora do emulador ───────────────────
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    '\n❌  FIRESTORE_EMULATOR_HOST não está definido.\n' +
    '   Este script só pode ser executado via firebase emulators:exec.\n' +
    '   Exemplo: npm run test:coach-flow:emulator\n'
  );
  process.exit(1);
}

// ── Leitura do .env.local (para projectId e credenciais) ─────────────────────
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

// ── Init Admin SDK ────────────────────────────────────────────────────────────
// Com os env vars de emulador definidos, o Admin SDK roteia automaticamente
// para FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST.
// As credenciais reais são necessárias apenas para initializeApp; o emulador
// as aceita sem validação contra o backend do Google.
const { initializeApp, cert } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

const app = initializeApp({
  credential: cert({
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const adminAuth = getAuth(app);
const db = getFirestore(app);

// ── Constantes (mesmos UIDs da conta @dev.local de produção) ─────────────────
const COACH_UID        = 'XZhJi9FzuTUF3W4gFJk5zpVgdjo1';
const CTRAINER_UID     = 'huisheYvxUa3dfKnJWouSkwDEgJ3';
const CATHLETE_UID     = 'TRPBpdQkkjWchDQXX25qmtb5P8N2';
// cathleteB é o atleta dedicado ao ctrainer (treinador_id: ctrainerUid)
const CATHLETE_B_UID   = 'cathlete-b-emulator-smoke';
// UIDs fixos para simular trainer.test@afp.dev no emulador (Bloco 4 de regressão)
const TRAINER_TEST_UID = 'trainer-test-emulator-smoke';
const ATHLETE_TEST_UID = 'athlete-test-emulator-smoke';
const ACCOUNT_ID     = 'test-account-starter';
const DEFAULT_PASS   = 'Dev@AFP2025!';

const SEP  = '─'.repeat(60);
console.log(`\n${SEP}`);
console.log('  AFP — Seed do emulador (fluxo coach)');
console.log(`  Projeto   : ${env.VITE_FIREBASE_PROJECT_ID}`);
console.log(`  Firestore : ${process.env.FIRESTORE_EMULATOR_HOST}`);
console.log(`  Auth      : ${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'não definido'}`);
console.log(SEP);

let seeded = 0;
let errors = 0;

// ── Helpers ────────────────────────────────────────────────────────────────────

async function ensureAuthUser(uid, email, displayName) {
  try {
    await adminAuth.getUser(uid);
    console.log(`  ⏭   Auth: ${email} (uid já existe)`);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    await adminAuth.createUser({
      uid,
      email,
      password: DEFAULT_PASS,
      displayName,
      emailVerified: true,
    });
    console.log(`  ✅  Auth: ${email} criado (uid: ${uid})`);
  }
  seeded++;
}

async function upsertUser(uid, data) {
  await db.collection('users').doc(uid).set(
    { ...data, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  console.log(`  ✅  users/${uid} (${data.papel})`);
  seeded++;
}

async function upsertLink(athleteId, trainerId) {
  const id = `${athleteId}_${trainerId}`;
  await db.collection('athlete_links').doc(id).set(
    {
      athleteId,
      trainerId,
      accountId: ACCOUNT_ID,
      status: 'active',
      linkedAt: FieldValue.serverTimestamp(),
      unlinkedAt: null,
      createdBy: trainerId,
    },
    { merge: true }
  );
  console.log(`  ✅  athlete_links/${id}`);
  seeded++;
}

// ── Fase 1: Auth users ────────────────────────────────────────────────────────

console.log('\n── Auth users ────────────────────────────────────────────');
try {
  await ensureAuthUser(COACH_UID,        'coach@dev.local',      'Coach Dev');
  await ensureAuthUser(CTRAINER_UID,     'ctrainer@dev.local',   'Treinador Dev (Coach)');
  await ensureAuthUser(CATHLETE_UID,     'cathlete@dev.local',   'Atleta Dev (Coach)');
  await ensureAuthUser(CATHLETE_B_UID,   'cathleteB@dev.local',  'Atleta Dev (Ctrainer)');
  await ensureAuthUser(TRAINER_TEST_UID, 'trainer.test@afp.dev', 'Trainer Test');
  await ensureAuthUser(ATHLETE_TEST_UID, 'athlete.test@afp.dev', 'Athlete Test');
} catch (err) {
  console.error(`  ❌  Erro ao criar Auth user: ${err.message}`);
  errors++;
}

// ── Fase 2: Firestore users ────────────────────────────────────────────────────

console.log('\n── Firestore users ───────────────────────────────────────');
try {
  await upsertUser(COACH_UID, {
    uid: COACH_UID,
    email: 'coach@dev.local',
    displayName: 'Coach Dev',
    papel: 'coach',
    accountId: ACCOUNT_ID,
    treinador_id: null,
    status: 'active',
    profileCompleted: true,
    schemaVersion: 2,
  });

  await upsertUser(CTRAINER_UID, {
    uid: CTRAINER_UID,
    email: 'ctrainer@dev.local',
    displayName: 'Treinador Dev (Coach)',
    papel: 'trainer',
    accountId: ACCOUNT_ID,
    // treinador_id == coachUid: satisfaz a regra quando coach lê este doc
    treinador_id: COACH_UID,
    status: 'active',
    profileCompleted: true,
    schemaVersion: 2,
  });

  await upsertUser(CATHLETE_UID, {
    uid: CATHLETE_UID,
    email: 'cathlete@dev.local',
    displayName: 'Atleta Dev (Coach)',
    papel: 'athlete',
    accountId: ACCOUNT_ID,
    // treinador_id == coachUid: permite ao coach ler este doc via Client SDK
    treinador_id: COACH_UID,
    status: 'active',
    profileCompleted: true,
    schemaVersion: 2,
  });

  // cathleteB: atleta dedicado ao ctrainer
  // treinador_id == ctrainerUid: permite ao ctrainer ler este doc via Client SDK
  await upsertUser(CATHLETE_B_UID, {
    uid: CATHLETE_B_UID,
    email: 'cathleteB@dev.local',
    displayName: 'Atleta Dev (Ctrainer)',
    papel: 'athlete',
    accountId: ACCOUNT_ID,
    treinador_id: CTRAINER_UID,
    status: 'active',
    profileCompleted: true,
    schemaVersion: 2,
  });

  await upsertUser(TRAINER_TEST_UID, {
    uid: TRAINER_TEST_UID,
    email: 'trainer.test@afp.dev',
    displayName: 'Trainer Test',
    papel: 'trainer',
    accountId: ACCOUNT_ID,
    treinador_id: null,
    status: 'active',
    profileCompleted: true,
    schemaVersion: 2,
  });

  await upsertUser(ATHLETE_TEST_UID, {
    uid: ATHLETE_TEST_UID,
    email: 'athlete.test@afp.dev',
    displayName: 'Athlete Test',
    papel: 'athlete',
    accountId: ACCOUNT_ID,
    treinador_id: TRAINER_TEST_UID,
    status: 'active',
    profileCompleted: true,
    schemaVersion: 2,
  });
} catch (err) {
  console.error(`  ❌  Erro ao criar user doc: ${err.message}`);
  errors++;
}

// ── Fase 3: athlete_links ──────────────────────────────────────────────────────

console.log('\n── athlete_links ─────────────────────────────────────────');
try {
  // cathlete  ↔ coach:    listTrainerAthleteOptions(coachUid) + getTrainerActiveAthletes(coachUid)
  await upsertLink(CATHLETE_UID,   COACH_UID);

  // cathleteB ↔ ctrainer: listTrainerAthleteOptions(ctrainerUid) + getTrainerActiveAthletes(ctrainerUid)
  // cathleteB.treinador_id == ctrainerUid → getUserProfile permitido para ctrainer
  await upsertLink(CATHLETE_B_UID, CTRAINER_UID);

  // athlete ↔ trainer-test: regressão do fluxo trainer (Bloco 4)
  await upsertLink(ATHLETE_TEST_UID, TRAINER_TEST_UID);
} catch (err) {
  console.error(`  ❌  Erro ao criar athlete_link: ${err.message}`);
  errors++;
}

// ── Resumo ─────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
if (errors === 0) {
  console.log(`  ✅  Seed concluído — ${seeded} documentos/usuários criados/atualizados`);
} else {
  console.log(`  ❌  Seed com erros — ${errors} falha(s); ${seeded} sucesso(s)`);
}
console.log(`${'═'.repeat(60)}\n`);

process.exit(errors > 0 ? 1 : 0);
