/**
 * seed-plans.mjs
 *
 * Cria (ou atualiza) os planos canônicos do AFP na collection `plans`.
 * Usa IDs determinísticos ('starter', 'pro', 'academy') para ser idempotente.
 *
 * Uso:
 *   node scripts/seed-plans.mjs
 *   node scripts/seed-plans.mjs --force   # sobrescreve mesmo se já existir
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

const FORCE = process.argv.includes('--force');

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

// ── Planos canônicos ──────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Para treinadores autônomos iniciando na plataforma.',
    activeAthleteLimit: 10,
    isActive: true,
    priceMonthlyBRL: 0,          // gratuito na fase inicial
    targetAccountType: 'trainer_account',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Para treinadores com volume moderado de atletas.',
    activeAthleteLimit: 30,
    isActive: true,
    priceMonthlyBRL: 0,
    targetAccountType: 'trainer_account',
  },
  {
    id: 'academy',
    name: 'Academy',
    description: 'Para academias com múltiplos treinadores e grande volume de atletas.',
    activeAthleteLimit: 100,
    isActive: true,
    priceMonthlyBRL: 0,
    targetAccountType: 'academy_account',
  },
];

console.log(`\n🔑 Projeto : ${env.VITE_FIREBASE_PROJECT_ID}`);
console.log(`💡 Modo    : ${FORCE ? 'force (sobrescreve)' : 'idempotente (pula se já existe)'}\n`);

let created = 0;
let skipped = 0;

for (const plan of PLANS) {
  const ref = db.collection('plans').doc(plan.id);
  const snap = await ref.get();

  if (snap.exists && !FORCE) {
    const existing = snap.data();
    console.log(`⏭  ${plan.id.padEnd(10)} — já existe (limit=${existing.activeAthleteLimit})`);
    skipped++;
    continue;
  }

  const { id, ...data } = plan;
  await ref.set({
    ...data,
    createdAt: snap.exists ? snap.data().createdAt : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`✅ ${plan.id.padEnd(10)} — ${snap.exists ? 'atualizado' : 'criado'} (limit=${plan.activeAthleteLimit})`);
  created++;
}

console.log(`\n📊 Resultado: ${created} criado/atualizado, ${skipped} ignorado.\n`);

console.log('📄 Estrutura esperada no Firestore:');
console.log('   plans/starter  → activeAthleteLimit: 10, isActive: true');
console.log('   plans/pro      → activeAthleteLimit: 30, isActive: true');
console.log('   plans/academy  → activeAthleteLimit: 100, isActive: true\n');
