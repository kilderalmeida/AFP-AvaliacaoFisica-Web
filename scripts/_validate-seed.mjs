/**
 * _validate-seed.mjs — lê o Firestore e imprime o estado real dos dados de teste.
 * Uso interno, não precisa ser commitado.
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
const { getFirestore } = await import('firebase-admin/firestore');

const app = initializeApp({
  credential: cert({
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);

function ts(v) {
  if (!v) return 'null';
  if (v._seconds) return new Date(v._seconds * 1000).toISOString();
  if (v.toDate) return v.toDate().toISOString();
  return String(v);
}

// ── 1. Plans ──────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log('  PLANS');
console.log('══════════════════════════════════════════════════════');
for (const id of ['starter', 'pro', 'academy']) {
  const snap = await db.collection('plans').doc(id).get();
  if (!snap.exists) { console.log(`  ❌ plans/${id} — NÃO EXISTE`); continue; }
  const d = snap.data();
  const ok = d.activeAthleteLimit && d.isActive;
  console.log(`  ${ok ? '✅' : '⚠️'} plans/${id} → limit=${d.activeAthleteLimit}, isActive=${d.isActive}, name="${d.name}"`);
}

// ── 2. Account ────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log('  ACCOUNT');
console.log('══════════════════════════════════════════════════════');
const accSnap = await db.collection('accounts').doc('test-account-starter').get();
if (!accSnap.exists) {
  console.log('  ❌ accounts/test-account-starter — NÃO EXISTE');
} else {
  const a = accSnap.data();
  console.log(`  ✅ accounts/test-account-starter`);
  console.log(`     name    : ${a.name}`);
  console.log(`     type    : ${a.type}`);
  console.log(`     planId  : ${a.planId}`);
  console.log(`     adminUid: ${a.adminUid}`);
}

// ── 3. Trainer user ───────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log('  TRAINER USER');
console.log('══════════════════════════════════════════════════════');
const trainerSnap = await db.collection('users')
  .where('email', '==', 'trainer.test@afp.dev').get();
if (trainerSnap.empty) {
  console.log('  ❌ trainer.test@afp.dev — NÃO ENCONTRADO');
} else {
  const t = trainerSnap.docs[0].data();
  const ok = t.papel === 'trainer' && t.accountId === 'test-account-starter' && t.status === 'active';
  console.log(`  ${ok ? '✅' : '⚠️'} users/${t.uid}`);
  console.log(`     email    : ${t.email}`);
  console.log(`     papel    : ${t.papel}`);
  console.log(`     accountId: ${t.accountId}`);
  console.log(`     status   : ${t.status}`);
}

// ── 4. athlete_links ──────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log('  ATHLETE LINKS');
console.log('══════════════════════════════════════════════════════');
const linksSnap = await db.collection('athlete_links')
  .where('accountId', '==', 'test-account-starter').get();
const allLinks = linksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const activeLinks = allLinks.filter(l => l.status === 'active');
const inactiveLinks = allLinks.filter(l => l.status !== 'active');

console.log(`  Total de links      : ${allLinks.length}`);
console.log(`  ${activeLinks.length === 10 ? '✅' : '⚠️'} Links ativos          : ${activeLinks.length} (esperado: 10)`);
console.log(`  Links inativos      : ${inactiveLinks.length}`);

// ── 5. Athlete-test-11 (extra, should have NO active link) ────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log('  ATLETA EXTRA (athlete-test-11)');
console.log('══════════════════════════════════════════════════════');
const extraSnap = await db.collection('users')
  .where('email', '==', 'athlete-test-11@afp.dev').get();
if (extraSnap.empty) {
  console.log('  ❌ athlete-test-11 — user NÃO ENCONTRADO');
} else {
  const u = extraSnap.docs[0].data();
  // Check if this athlete has any active link
  const extraLinksSnap = await db.collection('athlete_links')
    .where('athleteId', '==', u.uid)
    .where('status', '==', 'active').get();
  const hasActiveLink = !extraLinksSnap.empty;
  console.log(`  ${!hasActiveLink ? '✅' : '❌'} users/${u.uid} (${u.email})`);
  console.log(`     papel         : ${u.papel}`);
  console.log(`     status        : ${u.status}`);
  console.log(`     accountId     : ${u.accountId || 'sem conta'}`);
  console.log(`     vínculo ativo : ${hasActiveLink ? '❌ TEM (ERRADO)' : '✅ NENHUM (correto — bloqueado pelo limite)'}`);
}

// ── 6. Limit check ────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log('  VALIDAÇÃO FINAL DO LIMITE');
console.log('══════════════════════════════════════════════════════');
const planDoc = await db.collection('plans').doc('starter').get();
const limit = planDoc.data()?.activeAthleteLimit || 0;
const activeCount = activeLinks.length;
console.log(`  Plano starter        : limite = ${limit}`);
console.log(`  Atletas ativos       : ${activeCount}`);
console.log(`  ${activeCount === limit ? '✅' : '⚠️'} Conta no limite     : ${activeCount === limit ? 'SIM' : 'NÃO'}`);
console.log(`  ${activeCount <= limit ? '✅' : '❌'} Limite respeitado   : ${activeCount <= limit ? 'SIM' : 'NÃO — VIOLAÇÃO'}`);

console.log('\n══════════════════════════════════════════════════════\n');
