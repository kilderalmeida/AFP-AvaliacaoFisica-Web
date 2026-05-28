/**
 * seed-account-admin-user.mjs
 *
 * Cria (ou sincroniza) um usuário account_admin de teste no Firebase Auth + Firestore
 * e o vincula à conta test-account-starter.
 *
 * Comportamento idempotente:
 *   - Se o email já existe no Auth → reutiliza o uid existente.
 *   - Se o documento Firestore já existe → faz merge, preserva campos extra.
 *   - Se nada existe → cria Auth account + documento do zero.
 *
 * Uso:
 *   node scripts/seed-account-admin-user.mjs
 *
 * Pré-requisitos:
 *   .env.local com VITE_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const EMAIL = 'account-admin.test@afp.dev';
const PASSWORD = 'AccountAdmin@AFP2025!';
const DISPLAY_NAME = 'Account Admin Teste';
const ACCOUNT_ID = 'test-account-starter';

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

// ── Firebase Admin ────────────────────────────────────────────────────────────
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

console.log(`\n🔑 Projeto   : ${env.VITE_FIREBASE_PROJECT_ID}`);
console.log(`📧 Email     : ${EMAIL}`);
console.log(`👤 Nome      : ${DISPLAY_NAME}`);
console.log(`🏢 AccountId : ${ACCOUNT_ID}\n`);

// ── 1. Verificar que a conta de destino existe ────────────────────────────────
const accountSnap = await db.collection('accounts').doc(ACCOUNT_ID).get();
if (!accountSnap.exists) {
  console.error(`❌ accounts/${ACCOUNT_ID} não encontrada. Execute seed-test-account.mjs primeiro.`);
  process.exit(1);
}
console.log(`✅ accounts/${ACCOUNT_ID} encontrada (planId: ${accountSnap.data().planId})`);

// ── 2. Auth — criar ou reutilizar ─────────────────────────────────────────────
let uid;
let authAction;

try {
  const existing = await adminAuth.getUserByEmail(EMAIL);
  uid = existing.uid;
  authAction = 'reutilizado (já existia)';
  await adminAuth.updateUser(uid, { password: PASSWORD, displayName: DISPLAY_NAME });
} catch (err) {
  if (err.code !== 'auth/user-not-found') throw err;
  const created = await adminAuth.createUser({
    email: EMAIL,
    password: PASSWORD,
    displayName: DISPLAY_NAME,
    emailVerified: true,
  });
  uid = created.uid;
  authAction = 'criado agora';
}

console.log(`✅ Auth uid  : ${uid}  (${authAction})`);

// ── 3. Firestore — criar ou fazer merge ───────────────────────────────────────
const now = FieldValue.serverTimestamp();
const ref = db.collection('users').doc(uid);
const snap = await ref.get();

const payload = {
  uid,
  displayName: DISPLAY_NAME,
  email: EMAIL,
  papel: 'account_admin',
  status: 'active',
  accountId: ACCOUNT_ID,
  phone: '',
  birthDate: '',
  sex: '',
  gymId: '',
  treinador_id: null,
  userTypes: ['account_admin'],
  profileCompleted: true,
  updatedAt: now,
  schemaVersion: 2,
};

if (!snap.exists) {
  payload.createdAt = now;
  payload.createdBy = uid;
  await ref.set(payload);
  console.log(`✅ Firestore : users/${uid} criado`);
} else {
  await ref.set(payload, { merge: true });
  console.log(`✅ Firestore : users/${uid} atualizado (merge)`);
}

// ── 4. Verificação final ──────────────────────────────────────────────────────
const final = (await ref.get()).data();
const ok = final.papel === 'account_admin' && final.accountId === ACCOUNT_ID && final.status === 'active';

console.log('\n📄 Campos relevantes do documento:');
console.log(`   uid       : ${final.uid}`);
console.log(`   email     : ${final.email}`);
console.log(`   papel     : ${final.papel}`);
console.log(`   accountId : ${final.accountId}`);
console.log(`   status    : ${final.status}`);

console.log(`\n${ok ? '🎉 Tudo certo!' : '⚠️  Verifique os campos acima.'}`);
console.log('\n📋 Credenciais de teste:');
console.log(`   Email : ${EMAIL}`);
console.log(`   Senha : ${PASSWORD}`);
console.log(`   Papel : account_admin`);
console.log(`   Conta : ${ACCOUNT_ID}\n`);
