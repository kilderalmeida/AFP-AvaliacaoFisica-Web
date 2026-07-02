/**
 * diagnose-cathlete.mjs
 *
 * Diagnóstico pontual do documento cathlete@dev.local em staging.
 * Usa Admin SDK (bypass de rules) para inspecionar o estado real dos dados.
 *
 * Uso:
 *   node scripts/diagnose-cathlete.mjs
 *
 * NÃO modifica nenhum dado — somente leitura.
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
const { getFirestore } = await import('firebase-admin/firestore');

const app = initializeApp({
  credential: cert({
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);

const SEP = '─'.repeat(60);
console.log(`\n${SEP}`);
console.log('  AFP — Diagnóstico cathlete@dev.local (somente leitura)');
console.log(`  Projeto: ${env.VITE_FIREBASE_PROJECT_ID}`);
console.log(SEP);

const snap = await db.collection('users')
  .where('email', '==', 'cathlete@dev.local')
  .limit(1)
  .get();

if (snap.empty) {
  console.log('  ❌  cathlete@dev.local NÃO existe em users');
  process.exit(1);
}

const doc = snap.docs[0];
const data = doc.data();

console.log(`\n  uid:             ${doc.id}`);
console.log(`  email:           ${data.email}`);
console.log(`  displayName:     ${data.displayName ?? '(none)'}`);
console.log(`  papel:           ${data.papel ?? '(none)'}`);
console.log(`  userTypes:       ${JSON.stringify(data.userTypes ?? null)}`);
console.log(`  treinador_id:    ${data.treinador_id ?? '(null)'}`);
console.log(`  status:          ${data.status ?? '(none)'}`);
console.log(`  accountId:       ${data.accountId ?? '(none)'}`);
console.log(`  profileCompleted:${data.profileCompleted ?? '(none)'}`);
console.log(`  schemaVersion:   ${data.schemaVersion ?? '(none)'}`);

console.log(`\n${SEP}`);
console.log('  Campos completos do documento:');
console.log(SEP);
console.log(JSON.stringify(data, null, 2));
console.log('');
