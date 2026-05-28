/**
 * seed-test-account.mjs
 *
 * Cria um ambiente de teste ponta-a-ponta para validar as regras de domínio:
 *   plans → account → trainer → athlete_links → bloqueio por activeAthleteLimit
 *
 * O que este script faz:
 *   1. Cria um treinador de teste no Auth + Firestore
 *   2. Cria uma account (trainer_account) vinculada ao treinador
 *   3. Atualiza o user doc do treinador com accountId
 *   4. Cria N atletas de teste (N = activeAthleteLimit do plano)
 *   5. Cria N athlete_links ativos
 *   6. Testa que a criação do (N+1)º vínculo é BLOQUEADA pelo limite
 *
 * Uso:
 *   node scripts/seed-test-account.mjs                  # plano starter (limite 10)
 *   node scripts/seed-test-account.mjs --plan pro        # limite 30
 *   node scripts/seed-test-account.mjs --plan starter --athletes 3   # popula apenas 3
 *   node scripts/seed-test-account.mjs --reset           # apaga dados de teste e recria
 *   node scripts/seed-test-account.mjs --dry-run         # só mostra o que faria
 *
 * Dados criados (estáveis/idempotentes):
 *   Auth/users:       trainer.test@afp.dev
 *   Auth/users:       athlete-test-{n}@afp.dev  (n = 1..N)
 *   accounts/{id}:    "Conta Teste AFP" (trainer_account)
 *   athlete_links:    {athleteId}_{trainerId}
 *
 * Pré-requisitos:
 *   .env.local com VITE_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   plans/ já populadas (rode seed-plans.mjs primeiro)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Parse .env.local ──────────────────────────────────────────────────────────
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
  if (val.startsWith('"') && val.endsWith('""')) val = val.slice(1, -2);
  else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
  env[key] = val;
}

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function argValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const PLAN_ID = argValue('--plan') || 'starter';
const OVERRIDE_ATHLETES = argValue('--athletes') ? Number(argValue('--athletes')) : null;
const DRY_RUN = args.includes('--dry-run');
const RESET = args.includes('--reset');

// ── Firebase Admin ────────────────────────────────────────────────────────────
const { initializeApp, cert } = await import('firebase-admin/app');
const { getAuth }              = await import('firebase-admin/auth');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

const app = initializeApp({
  credential: cert({
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const adminAuth = getAuth(app);
const db        = getFirestore(app);

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getOrCreateAuthUser(email, displayName, password = 'Test@AFP2025!') {
  try {
    const u = await adminAuth.getUserByEmail(email);
    return { uid: u.uid, action: 'reused' };
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    const u = await adminAuth.createUser({ email, displayName, password, emailVerified: true });
    return { uid: u.uid, action: 'created' };
  }
}

async function upsertUserDoc(db, uid, data) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return 'created';
  }
  await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return 'updated';
}

function linkId(athleteId, trainerId) {
  return `${athleteId}_${trainerId}`;
}

async function getActiveAthleteCount(db, accountId) {
  const snap = await db.collection('athlete_links')
    .where('accountId', '==', accountId)
    .where('status', '==', 'active')
    .get();
  return snap.size;
}

async function checkLimit(db, accountId, planId) {
  const planSnap = await db.collection('plans').doc(planId).get();
  if (!planSnap.exists) throw new Error(`Plano "${planId}" não encontrado. Rode seed-plans.mjs primeiro.`);
  const plan = planSnap.data();
  const count = await getActiveAthleteCount(db, accountId);
  return { count, limit: plan.activeAthleteLimit, allowed: count < plan.activeAthleteLimit };
}

async function deleteTestData(db, adminAuth, accountId, trainerEmail, athleteEmails) {
  console.log('\n🗑  Apagando dados de teste anteriores...');

  // Delete athlete_links
  const linksSnap = await db.collection('athlete_links')
    .where('accountId', '==', accountId)
    .get();
  for (const d of linksSnap.docs) {
    await d.ref.delete();
  }
  console.log(`   ${linksSnap.size} athlete_links removidos`);

  // Delete athlete user docs + Auth
  for (const email of athleteEmails) {
    try {
      const u = await adminAuth.getUserByEmail(email);
      await db.collection('users').doc(u.uid).delete();
      await adminAuth.deleteUser(u.uid);
    } catch { /* already gone */ }
  }
  console.log(`   ${athleteEmails.length} atletas removidos`);

  // Delete trainer user doc + Auth
  try {
    const u = await adminAuth.getUserByEmail(trainerEmail);
    await db.collection('users').doc(u.uid).delete();
    await adminAuth.deleteUser(u.uid);
    console.log(`   Treinador removido`);
  } catch { /* already gone */ }

  // Delete account
  await db.collection('accounts').doc(accountId).delete();
  console.log(`   Account ${accountId} removida\n`);
}

// ── Stable IDs ────────────────────────────────────────────────────────────────
// Account ID is deterministic so --reset and re-runs hit the same document.
const ACCOUNT_DOC_ID = `test-account-${PLAN_ID}`;
const TRAINER_EMAIL   = 'trainer.test@afp.dev';
const TRAINER_NAME    = 'Treinador Teste';

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n🔑 Projeto  : ${env.VITE_FIREBASE_PROJECT_ID}`);
console.log(`📋 Plano    : ${PLAN_ID}`);
console.log(`🧪 Dry-run  : ${DRY_RUN ? 'sim (nenhuma escrita)' : 'não'}`);
console.log(`♻️  Reset    : ${RESET ? 'sim (apaga e recria)' : 'não'}\n`);

// ── 0. Read plan ──────────────────────────────────────────────────────────────
const planSnap = await db.collection('plans').doc(PLAN_ID).get();
if (!planSnap.exists) {
  console.error(`❌ Plano "${PLAN_ID}" não existe. Rode primeiro:\n   node scripts/seed-plans.mjs\n`);
  process.exit(1);
}
const plan = planSnap.data();
const ATHLETE_LIMIT = plan.activeAthleteLimit;
const NUM_ATHLETES  = OVERRIDE_ATHLETES !== null
  ? Math.min(OVERRIDE_ATHLETES, ATHLETE_LIMIT)
  : ATHLETE_LIMIT;

const ATHLETE_EMAILS = Array.from({ length: NUM_ATHLETES + 1 }, (_, i) =>
  `athlete-test-${i + 1}@afp.dev`
);

console.log(`📊 Plano "${plan.name}": limite = ${ATHLETE_LIMIT} atletas ativos`);
console.log(`👥 Atletas a criar: ${NUM_ATHLETES} (+ 1 extra para teste de bloqueio)\n`);

if (DRY_RUN) {
  console.log('ℹ️  Dry-run ativo — nenhuma escrita realizada.\n');
  console.log('Dados que seriam criados:');
  console.log(`  Auth + users/${TRAINER_EMAIL}      (papel: trainer)`);
  for (let i = 1; i <= NUM_ATHLETES + 1; i++) {
    console.log(`  Auth + users/athlete-test-${i}@afp.dev`);
  }
  console.log(`  accounts/${ACCOUNT_DOC_ID}         (planId: ${PLAN_ID})`);
  console.log(`  athlete_links: ${NUM_ATHLETES} ativos + 1 bloqueado\n`);
  process.exit(0);
}

// ── 1. Reset if requested ──────────────────────────────────────────────────────
if (RESET) {
  await deleteTestData(db, adminAuth, ACCOUNT_DOC_ID, TRAINER_EMAIL, ATHLETE_EMAILS);
}

// ── 2. Create trainer ─────────────────────────────────────────────────────────
console.log('── Treinador ────────────────────────────────────────────────────');
const { uid: trainerUid, action: trainerAction } = await getOrCreateAuthUser(
  TRAINER_EMAIL, TRAINER_NAME
);
console.log(`${trainerAction === 'created' ? '✅' : '⏭ '} Auth: ${TRAINER_EMAIL} (uid: ${trainerUid}) [${trainerAction}]`);

// ── 3. Create / get account ────────────────────────────────────────────────────
console.log('\n── Account ──────────────────────────────────────────────────────');
const accountRef = db.collection('accounts').doc(ACCOUNT_DOC_ID);
const accountSnap = await accountRef.get();

if (!accountSnap.exists) {
  await accountRef.set({
    name: `Conta Teste AFP (${plan.name})`,
    type: 'trainer_account',
    planId: PLAN_ID,
    adminUid: trainerUid,
    createdBy: trainerUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`✅ Account criada: accounts/${ACCOUNT_DOC_ID}`);
} else {
  console.log(`⏭  Account já existe: accounts/${ACCOUNT_DOC_ID}`);
}

// ── 4. Link trainer → account ──────────────────────────────────────────────────
const trainerDocAction = await upsertUserDoc(db, trainerUid, {
  uid: trainerUid,
  displayName: TRAINER_NAME,
  email: TRAINER_EMAIL,
  papel: 'trainer',
  status: 'active',
  accountId: ACCOUNT_DOC_ID,
  treinador_id: null,
  gymId: '',
  phone: '',
  birthDate: '',
  sex: '',
  userTypes: ['trainer'],
  profileCompleted: true,
  schemaVersion: 2,
  createdBy: trainerUid,
});
console.log(`${trainerDocAction === 'created' ? '✅' : '⏭ '} Firestore: users/${trainerUid} (accountId vinculado) [${trainerDocAction}]`);

// ── 5. Create athletes + links ─────────────────────────────────────────────────
console.log(`\n── Atletas e vínculos (${NUM_ATHLETES} até o limite) ──────────────────────`);

const athleteUids = [];
for (let i = 1; i <= NUM_ATHLETES; i++) {
  const email = `athlete-test-${i}@afp.dev`;
  const name  = `Atleta Teste ${i}`;

  const { uid: athleteUid, action } = await getOrCreateAuthUser(email, name);
  athleteUids.push(athleteUid);

  await upsertUserDoc(db, athleteUid, {
    uid: athleteUid,
    displayName: name,
    email,
    papel: 'athlete',
    status: 'active',
    accountId: ACCOUNT_DOC_ID,
    treinador_id: trainerUid,  // legacy compat — dashboard still reads this
    gymId: '',
    phone: '',
    birthDate: '',
    sex: '',
    userTypes: ['athlete'],
    profileCompleted: true,
    schemaVersion: 2,
    createdBy: trainerUid,
  });

  const id = linkId(athleteUid, trainerUid);
  const linkRef = db.collection('athlete_links').doc(id);
  const linkSnap = await linkRef.get();

  if (!linkSnap.exists || linkSnap.data().status !== 'active') {
    await linkRef.set({
      athleteId: athleteUid,
      trainerId: trainerUid,
      accountId: ACCOUNT_DOC_ID,
      status: 'active',
      linkedAt: FieldValue.serverTimestamp(),
      unlinkedAt: null,
      createdBy: trainerUid,
    }, { merge: true });
    console.log(`✅ [${String(i).padStart(2, '0')}/${NUM_ATHLETES}] ${email} → athlete_links/${id} (ativo) [${action}]`);
  } else {
    console.log(`⏭  [${String(i).padStart(2, '0')}/${NUM_ATHLETES}] ${email} → vínculo já ativo`);
  }
}

// ── 6. Verify current count ────────────────────────────────────────────────────
const countCheck = await checkLimit(db, ACCOUNT_DOC_ID, PLAN_ID);
console.log(`\n📊 Contagem atual: ${countCheck.count}/${countCheck.limit} atletas ativos`);

if (countCheck.count === ATHLETE_LIMIT && NUM_ATHLETES === ATHLETE_LIMIT) {
  console.log('🎯 Limite atingido exatamente — pronto para testar bloqueio.');
}

// ── 7. Test limit block ────────────────────────────────────────────────────────
console.log('\n── Teste de bloqueio (atleta extra) ─────────────────────────────');
const extraEmail = `athlete-test-${NUM_ATHLETES + 1}@afp.dev`;
const extraName  = `Atleta Teste ${NUM_ATHLETES + 1}`;

const { uid: extraUid, action: extraAction } = await getOrCreateAuthUser(extraEmail, extraName);
console.log(`✅ Auth ${extraEmail} (uid: ${extraUid}) [${extraAction}]`);

await upsertUserDoc(db, extraUid, {
  uid: extraUid,
  displayName: extraName,
  email: extraEmail,
  papel: 'athlete',
  status: 'active',
  accountId: ACCOUNT_DOC_ID,
  treinador_id: null,  // will remain null since link will be blocked
  gymId: '',
  phone: '',
  birthDate: '',
  sex: '',
  userTypes: ['athlete'],
  profileCompleted: false,
  schemaVersion: 2,
  createdBy: trainerUid,
});

// Service-layer limit check (mirrors what client SDK does via accountService.linkAthleteChecked)
const limitCheck = await checkLimit(db, ACCOUNT_DOC_ID, PLAN_ID);

if (!limitCheck.allowed) {
  console.log(`\n🚫 BLOQUEADO — Limite atingido (${limitCheck.count}/${limitCheck.limit})`);
  console.log(`   Atleta "${extraEmail}" NÃO foi vinculado.`);
  console.log(`   ✅ Regra de domínio validada: excesso bloqueado corretamente.\n`);
} else {
  // If athletes < limit (--athletes flag used), inform instead of blocking
  console.log(`\nℹ️  Limite não atingido (${limitCheck.count}/${limitCheck.limit}) — sem bloqueio.`);
  console.log(`   Use sem --athletes para preencher até o limite e testar o bloqueio.\n`);
}

// ── 8. Summary ────────────────────────────────────────────────────────────────
console.log('── Resumo ───────────────────────────────────────────────────────');
console.log(`   Plano       : ${plan.name} (limit=${ATHLETE_LIMIT})`);
console.log(`   Account     : accounts/${ACCOUNT_DOC_ID}`);
console.log(`   Treinador   : ${TRAINER_EMAIL} (uid: ${trainerUid})`);
console.log(`   Atletas     : ${NUM_ATHLETES} ativos + 1 extra (${extraEmail})`);
console.log(`   Vínculos    : ${NUM_ATHLETES} ativos em athlete_links`);
console.log(`   Bloqueio    : ${!limitCheck.allowed ? '✅ validado' : 'não testado (limite não atingido)'}`);
console.log('\n── Login de teste ───────────────────────────────────────────────');
console.log(`   Treinador   : ${TRAINER_EMAIL} / Test@AFP2025!`);
console.log(`   Atleta 1    : athlete-test-1@afp.dev / Test@AFP2025!`);
console.log(`   Atleta extra: ${extraEmail} / Test@AFP2025! (sem vínculo ativo)\n`);
