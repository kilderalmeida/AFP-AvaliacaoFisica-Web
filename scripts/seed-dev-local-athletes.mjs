/**
 * seed-dev-local-athletes.mjs
 *
 * Provisiona o ecossistema completo de usuários @dev.local:
 *   trainer@dev.local   → papel: trainer
 *   athlete1@dev.local  → papel: athlete, vinculado ao trainer@dev.local
 *   athlete2@dev.local  → papel: athlete, vinculado ao trainer@dev.local
 *
 * displayName: lido do Firebase Auth (nome real do usuário) para não
 * sobrescrever nomes como "Carlos" ou "Maria" com valores de seed.
 * Se o Auth não tiver displayName, cai no fallback abaixo.
 *
 * Uso:
 *   node scripts/seed-dev-local-athletes.mjs
 *
 * Pré-requisitos:
 *   .env.local com VITE_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
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
  if (val.startsWith('"') && val.endsWith('""')) val = val.slice(1, -2);
  else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
  env[key] = val;
}

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

console.log(`\n🔑 Projeto: ${env.VITE_FIREBASE_PROJECT_ID}\n`);

const DEFAULT_PASSWORD = 'Dev@AFP2025!';
const ACCOUNT_ID = 'test-account-starter';

/**
 * Resolve o uid do usuário no Auth.
 * Cria a conta Auth se não existir (novas contas usam DEFAULT_PASSWORD).
 * Nunca altera a senha de contas existentes.
 * Retorna o uid e o displayName real do Auth.
 */
async function resolveAuthUser(email, fallbackDisplayName) {
  try {
    const u = await adminAuth.getUserByEmail(email);
    const displayName = u.displayName || fallbackDisplayName;
    console.log(`⏭  Auth: ${email} (uid: ${u.uid}, nome: "${displayName}")`);
    return { uid: u.uid, displayName };
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    const u = await adminAuth.createUser({
      email,
      password: DEFAULT_PASSWORD,
      displayName: fallbackDisplayName,
      emailVerified: true,
    });
    console.log(`✅ Auth: ${email} criado (uid: ${u.uid})`);
    return { uid: u.uid, displayName: fallbackDisplayName };
  }
}

/**
 * Cria ou atualiza o documento users/{uid}.
 * displayName sempre vem do Auth (nome real) — nunca do fallback do seed.
 */
async function upsertUserDoc(uid, payload) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...payload, createdAt: FieldValue.serverTimestamp(), createdBy: uid });
    console.log(`✅ Firestore: users/${uid} criado (displayName: "${payload.displayName}")`);
  } else {
    await ref.set(payload, { merge: true });
    console.log(`⏭  Firestore: users/${uid} atualizado (displayName: "${payload.displayName}")`);
  }
}

/** Cria ou ativa athlete_link entre atleta e treinador. */
async function upsertAthleteLink(athleteUid, trainerUid) {
  const linkId = `${athleteUid}_${trainerUid}`;
  const ref = db.collection('athlete_links').doc(linkId);
  const snap = await ref.get();
  if (!snap.exists || snap.data().status !== 'active') {
    await ref.set(
      {
        athleteId: athleteUid,
        trainerId: trainerUid,
        accountId: ACCOUNT_ID,
        status: 'active',
        linkedAt: FieldValue.serverTimestamp(),
        unlinkedAt: null,
        createdBy: trainerUid,
      },
      { merge: true }
    );
    console.log(`✅ athlete_links/${linkId} ativo`);
  } else {
    console.log(`⏭  athlete_links/${linkId} já está ativo`);
  }
}

// ── 1. Trainer ────────────────────────────────────────────────────────────────
console.log('── trainer@dev.local ────────────────────────────────────────────');
const { uid: trainerUid, displayName: trainerName } = await resolveAuthUser(
  'trainer@dev.local',
  'Trainer Dev'
);

await upsertUserDoc(trainerUid, {
  uid: trainerUid,
  displayName: trainerName,
  email: 'trainer@dev.local',
  papel: 'trainer',
  status: 'active',
  accountId: ACCOUNT_ID,
  treinador_id: null,
  gymId: '',
  phone: '',
  birthDate: '',
  sex: '',
  userTypes: ['trainer'],
  profileCompleted: true,
  schemaVersion: 2,
  updatedAt: FieldValue.serverTimestamp(),
});

// ── 2. Athletes ───────────────────────────────────────────────────────────────
const ATHLETES = [
  { email: 'athlete1@dev.local', fallbackName: 'Atleta 1 Dev' },
  { email: 'athlete2@dev.local', fallbackName: 'Atleta 2 Dev' },
];

for (const athlete of ATHLETES) {
  console.log(`\n── ${athlete.email} ──────────────────────────────────────────────`);

  const { uid: athleteUid, displayName } = await resolveAuthUser(
    athlete.email,
    athlete.fallbackName
  );

  await upsertUserDoc(athleteUid, {
    uid: athleteUid,
    displayName,
    email: athlete.email,
    papel: 'athlete',
    status: 'active',
    accountId: ACCOUNT_ID,
    treinador_id: trainerUid,
    gymId: '',
    phone: '',
    birthDate: '',
    sex: '',
    userTypes: ['athlete'],
    profileCompleted: true,
    schemaVersion: 2,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await upsertAthleteLink(athleteUid, trainerUid);
}

// ── Resumo ────────────────────────────────────────────────────────────────────
console.log('\n── Resumo ───────────────────────────────────────────────────────');
console.log('   trainer@dev.local  → papel: trainer');
console.log('   athlete1@dev.local → papel: athlete, vinculado a trainer@dev.local');
console.log('   athlete2@dev.local → papel: athlete, vinculado a trainer@dev.local');
console.log('\n   displayName restaurado a partir do Firebase Auth.');
console.log('   Se ainda aparecer nome errado, atualize o displayName no Auth Console.');
console.log('   Novas contas usam senha: Dev@AFP2025!\n');
