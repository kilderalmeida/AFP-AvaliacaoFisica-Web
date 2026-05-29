/**
 * seed-dev-local-coach.mjs
 *
 * Provisiona o ecossistema coach @dev.local:
 *   coach@dev.local     → papel: coach
 *   ctrainer@dev.local  → papel: trainer, supervisionado pelo coach (treinador_id = coachUid)
 *   cathlete@dev.local  → papel: athlete, supervisionado pelo coach (treinador_id = coachUid)
 *
 * Isolado dos usuários trainer@dev.local / athlete1@dev.local / athlete2@dev.local.
 *
 * Regra Firestore relevante:
 *   resource.data.treinador_id == request.auth.uid
 * getAthletesByCoach e getTrainersByCoach usam where('treinador_id', '==', coachUid),
 * satisfazendo essa regra para que as queries passem na validação de segurança.
 *
 * Uso:
 *   node scripts/seed-dev-local-coach.mjs
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

// ⚠️  APENAS PARA DESENVOLVIMENTO/TESTE — não usar em produção
const DEFAULT_PASSWORD = 'Dev@AFP2025!';
const ACCOUNT_ID = 'test-account-starter';

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

async function upsertUserDoc(uid, payload) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...payload, createdAt: FieldValue.serverTimestamp(), createdBy: uid });
    console.log(`✅ Firestore: users/${uid} criado`);
  } else {
    await ref.set(payload, { merge: true });
    console.log(`⏭  Firestore: users/${uid} atualizado`);
  }
}

// ── 1. Coach ──────────────────────────────────────────────────────────────────
console.log('── coach@dev.local ──────────────────────────────────────────────');
const { uid: coachUid, displayName: coachName } = await resolveAuthUser(
  'coach@dev.local',
  'Coach Dev'
);

await upsertUserDoc(coachUid, {
  uid: coachUid,
  displayName: coachName,
  email: 'coach@dev.local',
  papel: 'coach',
  status: 'active',
  accountId: ACCOUNT_ID,
  treinador_id: null,
  gymId: '',
  phone: '',
  birthDate: '',
  sex: '',
  userTypes: ['coach'],
  profileCompleted: true,
  schemaVersion: 2,
  updatedAt: FieldValue.serverTimestamp(),
});

// ── 2. Trainer supervisionado pelo coach ──────────────────────────────────────
console.log('\n── ctrainer@dev.local ───────────────────────────────────────────');
const { uid: ctrainerUid, displayName: ctrainerName } = await resolveAuthUser(
  'ctrainer@dev.local',
  'Treinador Dev (Coach)'
);

await upsertUserDoc(ctrainerUid, {
  uid: ctrainerUid,
  displayName: ctrainerName,
  email: 'ctrainer@dev.local',
  papel: 'trainer',
  status: 'active',
  accountId: ACCOUNT_ID,
  // treinador_id aponta para o coach — satisfaz a regra Firestore que permite
  // ao coach ler esse documento via where('treinador_id', '==', coachUid)
  treinador_id: coachUid,
  gymId: '',
  phone: '',
  birthDate: '',
  sex: '',
  userTypes: ['trainer'],
  profileCompleted: true,
  schemaVersion: 2,
  updatedAt: FieldValue.serverTimestamp(),
});

// ── 3. Atleta direto do coach ─────────────────────────────────────────────────
console.log('\n── cathlete@dev.local ───────────────────────────────────────────');
const { uid: cathleteUid, displayName: cathleteName } = await resolveAuthUser(
  'cathlete@dev.local',
  'Atleta Dev (Coach)'
);

await upsertUserDoc(cathleteUid, {
  uid: cathleteUid,
  displayName: cathleteName,
  email: 'cathlete@dev.local',
  papel: 'athlete',
  status: 'active',
  accountId: ACCOUNT_ID,
  // treinador_id == coachUid: permite ao coach ler este doc via Client SDK
  // (regra Firestore: resource.data.treinador_id == request.auth.uid)
  treinador_id: coachUid,
  gymId: '',
  phone: '',
  birthDate: '',
  sex: '',
  userTypes: ['athlete'],
  profileCompleted: true,
  schemaVersion: 2,
  updatedAt: FieldValue.serverTimestamp(),
});

// ── 4. Atleta direto do ctrainer ──────────────────────────────────────────────
// cathleteB é o atleta "real" do ctrainer. treinador_id aponta para ctrainerUid
// para que o Client SDK permita getUserProfile(cathleteB) quando auth.uid == ctrainerUid.
// cathlete não serve para isso — tem treinador_id: coachUid.
console.log('\n── cathleteB@dev.local ──────────────────────────────────────────');
const { uid: cathleteBUid, displayName: cathleteBName } = await resolveAuthUser(
  'cathleteB@dev.local',
  'Atleta Dev (Ctrainer)'
);

await upsertUserDoc(cathleteBUid, {
  uid: cathleteBUid,
  displayName: cathleteBName,
  email: 'cathleteB@dev.local',
  papel: 'athlete',
  status: 'active',
  accountId: ACCOUNT_ID,
  // treinador_id == ctrainerUid: permite ao ctrainer ler este doc via Client SDK
  treinador_id: ctrainerUid,
  gymId: '',
  phone: '',
  birthDate: '',
  sex: '',
  userTypes: ['athlete'],
  profileCompleted: true,
  schemaVersion: 2,
  updatedAt: FieldValue.serverTimestamp(),
});

// ── 5. athlete_links ──────────────────────────────────────────────────────────
// cathlete  ↔ coach:    getTrainerActiveAthletes(coachUid) e listTrainerAthleteOptions(coachUid)
// cathleteB ↔ ctrainer: getTrainerActiveAthletes(ctrainerUid) e listTrainerAthleteOptions(ctrainerUid)
//
// O link cathlete↔ctrainer NÃO é criado: cathlete.treinador_id==coachUid faria
// getUserProfile falhar para ctrainer (regra: treinador_id == auth.uid).
console.log('\n── athlete_links ─────────────────────────────────────────────────');

async function upsertAthleteLink(athleteId, trainerId, accountId) {
  const linkId = `${athleteId}_${trainerId}`;
  const ref = db.collection('athlete_links').doc(linkId);
  await ref.set(
    {
      athleteId,
      trainerId,
      accountId,
      status: 'active',
      linkedAt: FieldValue.serverTimestamp(),
      unlinkedAt: null,
      createdBy: trainerId,
    },
    { merge: true }
  );
  console.log(`✅ athlete_links/${linkId} upserted`);
}

// Desativar link equivocado cathlete↔ctrainer se existir em staging
const badLinkId = `${cathleteUid}_${ctrainerUid}`;
const badLinkRef = db.collection('athlete_links').doc(badLinkId);
const badLinkSnap = await badLinkRef.get();
if (badLinkSnap.exists && badLinkSnap.data().status === 'active') {
  await badLinkRef.set(
    { status: 'inactive', unlinkedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  console.log(`⚠️  athlete_links/${badLinkId} desativado (cathlete.treinador_id != ctrainerUid)`);
}

await upsertAthleteLink(cathleteUid,  coachUid,    ACCOUNT_ID);  // cathlete  ↔ coach
await upsertAthleteLink(cathleteBUid, ctrainerUid, ACCOUNT_ID);  // cathleteB ↔ ctrainer

// ── Resumo ────────────────────────────────────────────────────────────────────
console.log('\n── Resumo ───────────────────────────────────────────────────────');
console.log('⚠️  APENAS PARA DESENVOLVIMENTO — dados de teste');
console.log('');
console.log('   coach@dev.local     → papel: coach');
console.log(`   uid:                  ${coachUid}`);
console.log(`   senha:                ${DEFAULT_PASSWORD}`);
console.log('');
console.log('   ctrainer@dev.local  → papel: trainer, supervisionado pelo coach');
console.log(`   uid:                  ${ctrainerUid}`);
console.log(`   senha:                ${DEFAULT_PASSWORD}`);
console.log('');
console.log('   cathlete@dev.local  → papel: athlete, atleta direto do coach');
console.log(`   uid:                  ${cathleteUid}`);
console.log(`   senha:                ${DEFAULT_PASSWORD}`);
console.log('');
console.log('   cathleteB@dev.local → papel: athlete, atleta direto do ctrainer');
console.log(`   uid:                  ${cathleteBUid}`);
console.log(`   senha:                ${DEFAULT_PASSWORD}`);
console.log('');
console.log('   Dashboard coach: 1 treinador (ctrainer) + 1 atleta direto (cathlete)');
console.log('   Meus Atletas ctrainer: 1 atleta (cathleteB@dev.local)');
