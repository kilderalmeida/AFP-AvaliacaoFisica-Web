/**
 * diagnose-ctrainer.mjs
 *
 * Diagnóstico pontual do fluxo ctrainer@dev.local em staging.
 * Usa Admin SDK (bypass de rules) para inspecionar o estado real dos dados.
 *
 * Uso:
 *   node scripts/diagnose-ctrainer.mjs
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
console.log('  AFP — Diagnóstico ctrainer@dev.local (somente leitura)');
console.log(`  Projeto: ${env.VITE_FIREBASE_PROJECT_ID}`);
console.log(SEP);

// ── 1. Localizar ctrainer pelo email ─────────────────────────────────────────
console.log('\n── 1. Perfil ctrainer@dev.local ─────────────────────────────');

const ctrainerSnap = await db.collection('users')
  .where('email', '==', 'ctrainer@dev.local')
  .limit(1)
  .get();

if (ctrainerSnap.empty) {
  console.log('  ❌  ctrainer@dev.local NÃO existe em users — execute seed-dev-local-coach.mjs');
  process.exit(1);
}

const ctrainerDoc = ctrainerSnap.docs[0];
const ctrainerUid = ctrainerDoc.id;
const ctrainerData = ctrainerDoc.data();

console.log(`  uid:          ${ctrainerUid}`);
console.log(`  papel:        ${ctrainerData.papel}`);
console.log(`  treinador_id: ${ctrainerData.treinador_id ?? '(null)'}`);
console.log(`  status:       ${ctrainerData.status}`);
console.log(`  accountId:    ${ctrainerData.accountId}`);

// ── 2. athlete_links WHERE trainerId == ctrainerUid ───────────────────────────
console.log('\n── 2. athlete_links ativos para ctrainerUid ─────────────────');

const linksSnap = await db.collection('athlete_links')
  .where('trainerId', '==', ctrainerUid)
  .where('status', '==', 'active')
  .get();

console.log(`  Total de links ativos: ${linksSnap.size}`);

if (linksSnap.empty) {
  console.log('  ❌  Nenhum athlete_link ativo — getTrainerActiveAthletes retornaria []');
  console.log('      Executar: node scripts/seed-dev-local-coach.mjs (recria os links)');
}

const athleteIds = linksSnap.docs.map(d => d.data().athleteId);
for (const d of linksSnap.docs) {
  const ld = d.data();
  console.log(`  link: ${d.id}`);
  console.log(`    athleteId: ${ld.athleteId}`);
  console.log(`    status:    ${ld.status}`);
}

// ── 3. getUserProfile para cada atleta vinculado ──────────────────────────────
console.log('\n── 3. Perfis dos atletas vinculados (Admin SDK) ─────────────');

for (const athleteId of athleteIds) {
  const aSnap = await db.collection('users').doc(athleteId).get();
  if (!aSnap.exists) {
    console.log(`  ❌  users/${athleteId} NÃO existe`);
    continue;
  }
  const ad = aSnap.data();
  const canCtrainerRead = ad.treinador_id === ctrainerUid;
  console.log(`\n  users/${athleteId}`);
  console.log(`    email:        ${ad.email}`);
  console.log(`    papel:        ${ad.papel}`);
  console.log(`    treinador_id: ${ad.treinador_id ?? '(null)'}`);
  if (canCtrainerRead) {
    console.log(`    ✅ treinador_id == ctrainerUid → getUserProfile PERMITIDO pelo Client SDK`);
  } else {
    console.log(`    ❌ treinador_id (${ad.treinador_id}) ≠ ctrainerUid (${ctrainerUid})`);
    console.log(`       → getUserProfile seria NEGADO para ctrainer (regra: treinador_id == auth.uid)`);
    console.log(`       → Promise.allSettled silencia o erro → athletes.length === 0`);
  }
}

// ── 4. Verificar se existe atleta com treinador_id == ctrainerUid ─────────────
console.log('\n── 4. Atletas com treinador_id == ctrainerUid ───────────────');

const directAthletesSnap = await db.collection('users')
  .where('treinador_id', '==', ctrainerUid)
  .get();

if (directAthletesSnap.empty) {
  console.log('  ❌  Nenhum usuário tem treinador_id == ctrainerUid');
  console.log('      Solução: criar athlete dedicado ao ctrainer com treinador_id: ctrainerUid');
} else {
  console.log(`  ${directAthletesSnap.size} usuário(s) com treinador_id == ctrainerUid:`);
  for (const d of directAthletesSnap.docs) {
    const ud = d.data();
    console.log(`    users/${d.id} (${ud.email}, papel: ${ud.papel})`);
  }
}

// ── 5. Resumo e ação recomendada ──────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log('  RESUMO DO DIAGNÓSTICO');
console.log(`${'═'.repeat(60)}`);

const hasLinks = !linksSnap.empty;
const hasReadableAthlete = athleteIds.some(async (id) => {
  const s = await db.collection('users').doc(id).get();
  return s.exists && s.data().treinador_id === ctrainerUid;
});

if (!hasLinks) {
  console.log('  Problema: sem athlete_links para ctrainer');
  console.log('  Ação:     node scripts/seed-dev-local-coach.mjs');
} else if (directAthletesSnap.empty) {
  console.log('  Problema: links existem mas nenhum atleta tem treinador_id == ctrainerUid');
  console.log('  Causa:    cathlete.treinador_id aponta para coachUid (correto para coach,');
  console.log('            mas bloqueia ctrainer de ler o perfil via Client SDK)');
  console.log('  Ação:     node scripts/seed-dev-local-coach.mjs (criará cathleteB@dev.local)');
}
console.log('');
