/**
 * seed-admin-user.mjs
 *
 * Cria (ou sincroniza) um usuário admin de teste no Firebase Auth + Firestore.
 *
 * Comportamento idempotente:
 *   - Se o email já existe no Auth → reutiliza o uid existente (não duplica).
 *   - Se o documento Firestore já existe → faz merge, preserva campos extra.
 *   - Se nada existe → cria Auth account + documento do zero.
 *
 * Uso:
 *   node scripts/seed-admin-user.mjs
 *   node scripts/seed-admin-user.mjs --email outro@test.com --password outraSenha
 *
 * Pré-requisitos:
 *   .env.local deve conter VITE_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Config ────────────────────────────────────────────────────────────────────
// Edite aqui (ou passe via --email / --password) para trocar o usuário de teste.
const DEFAULT_EMAIL = 'admin.test@afp.dev';
const DEFAULT_PASSWORD = 'Admin@AFP2025!';
const DEFAULT_DISPLAY_NAME = 'Admin Teste';
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function argValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

const EMAIL = argValue('--email') || DEFAULT_EMAIL;
const PASSWORD = argValue('--password') || DEFAULT_PASSWORD;
const DISPLAY_NAME = argValue('--name') || DEFAULT_DISPLAY_NAME;

// ── Parse .env.local (mesmo padrão dos outros scripts) ───────────────────────
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

console.log(`\n🔑 Projeto : ${env.VITE_FIREBASE_PROJECT_ID}`);
console.log(`📧 Email   : ${EMAIL}`);
console.log(`👤 Nome    : ${DISPLAY_NAME}\n`);

// ── 1. Auth — criar ou reutilizar ─────────────────────────────────────────────
let uid;
let authAction;

try {
  const existing = await adminAuth.getUserByEmail(EMAIL);
  uid = existing.uid;
  authAction = 'reutilizado (já existia)';

  // Garante que a senha está atualizada (útil ao re-rodar com nova senha)
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

console.log(`✅ Auth uid : ${uid}  (${authAction})`);

// ── 2. Firestore — criar ou fazer merge ───────────────────────────────────────
const now = FieldValue.serverTimestamp();
const ref = db.collection('users').doc(uid);
const snap = await ref.get();

const firestorePayload = {
  uid,
  displayName: DISPLAY_NAME,
  email: EMAIL,
  papel: 'admin',          // campo canônico de role no AFP
  status: 'active',
  phone: '',
  birthDate: '',
  sex: '',
  gymId: '',
  treinador_id: null,
  userTypes: ['admin'],
  profileCompleted: true,
  updatedAt: now,
  schemaVersion: 2,
};

if (!snap.exists) {
  firestorePayload.createdAt = now;
  firestorePayload.createdBy = uid; // auto-seed
  await ref.set(firestorePayload);
  console.log('✅ Firestore: documento criado em users/' + uid);
} else {
  // merge preserva campos que existam no doc mas não estejam no payload acima
  await ref.set(firestorePayload, { merge: true });
  console.log('✅ Firestore: documento atualizado (merge) em users/' + uid);
}

// ── 3. Verificação final ──────────────────────────────────────────────────────
const final = (await ref.get()).data();
console.log('\n📄 Documento final:');
console.log(JSON.stringify(
  { ...final, createdAt: '<serverTimestamp>', updatedAt: '<serverTimestamp>' },
  null,
  2
));

console.log('\n🎉 Pronto! Faça login com:');
console.log(`   Email   : ${EMAIL}`);
console.log(`   Senha   : ${PASSWORD}`);
console.log(`   Papel   : admin`);
console.log(`   Status  : active\n`);
