/**
 * _patch-treinador-id.mjs
 *
 * Corrige treinador_id para atletas que foram vinculados via athlete_links
 * mas cujo treinador_id não foi dual-written no doc users/{uid}.
 *
 * Scope: accountId = test-account-starter
 * Remove após uso.
 *
 * Uso: node scripts/_patch-treinador-id.mjs
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
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
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

const ACCOUNT_ID = 'test-account-starter';

// Busca todos os links ativos da conta
const linksSnap = await db.collection('athlete_links')
  .where('accountId', '==', ACCOUNT_ID)
  .where('status', '==', 'active')
  .get();

console.log(`Links ativos encontrados: ${linksSnap.size}`);

let fixed = 0;
let skipped = 0;
let missing = 0;

for (const linkDoc of linksSnap.docs) {
  const { athleteId, trainerId } = linkDoc.data();

  const userRef = db.collection('users').doc(athleteId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    console.log(`⚠️  users/${athleteId}: doc não existe (link órfão, ignorado)`);
    missing++;
    continue;
  }

  const userData = userSnap.data();
  if (userData.treinador_id === trainerId) {
    skipped++;
    continue;
  }

  await userRef.update({ treinador_id: trainerId, updatedAt: FieldValue.serverTimestamp() });
  console.log(`✅ users/${athleteId} (${userData.displayName || userData.email}): treinador_id → ${trainerId}`);
  fixed++;
}

console.log(`\nResumo: ${fixed} corrigidos, ${skipped} já corretos, ${missing} docs ausentes`);
