/**
 * backfill-trainer-links.mjs
 *
 * Popula o campo `treinador_id` em documentos de atletas que estão sem vínculo,
 * usando as atividades existentes como fonte de verdade (campo trainerUserId).
 *
 * Regras de seleção:
 *   1. Só aplica se o atleta NÃO tem `treinador_id` definido.
 *   2. Busca atividades do atleta onde trainerUserId != athleteUserId (exclui self-checkin).
 *   3. O trainerUserId vencedor deve pertencer a um usuário com papel treinador/coach.
 *   4. Usa a atividade mais recente como fonte (por activityDate desc).
 *
 * Uso:
 *   node scripts/backfill-trainer-links.mjs            (dry-run — só exibe o que faria)
 *   node scripts/backfill-trainer-links.mjs --apply    (aplica as escritas no Firestore)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DRY_RUN = !process.argv.includes('--apply');

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
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

const app = initializeApp({
  credential: cert({
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);

const SEP = '─'.repeat(68);
const mode = DRY_RUN ? '[DRY-RUN]' : '[APPLY]';

console.log('\n' + SEP);
console.log(`  AFP — Backfill trainer-athlete links  ${mode}`);
if (DRY_RUN) console.log('  Execute com --apply para gravar no Firestore.');
console.log(SEP + '\n');

// ── Load users ───────────────────────────────────────────────────────────────
const usersSnap = await db.collection('users').get();
const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

function normalizeRole(u) {
  const p = String(u.papel || '').normalize('NFC').toLowerCase();
  const ut = (Array.isArray(u.userTypes) ? u.userTypes : []).map(x => String(x).normalize('NFC').toLowerCase());
  if (p === 'atleta' || p === 'athlete' || ut.includes('atleta') || ut.includes('athlete')) return 'atleta';
  if (p === 'treinador' || p === 'trainer' || ut.includes('treinador') || ut.includes('trainer')) return 'treinador';
  if (p === 'coach' || ut.includes('coach')) return 'coach';
  return p || 'unknown';
}

const trainerIds = new Set(users.filter(u => ['treinador', 'coach'].includes(normalizeRole(u))).map(u => u.id));
const athletesWithoutLink = users.filter(u => normalizeRole(u) === 'atleta' && !u.treinador_id);

console.log(`Usuários carregados     : ${users.length}`);
console.log(`Treinadores/coaches     : ${trainerIds.size} IDs: [${[...trainerIds].join(', ')}]`);
console.log(`Atletas sem treinador_id: ${athletesWithoutLink.length}\n`);

if (athletesWithoutLink.length === 0) {
  console.log('✅ Nenhum atleta sem vínculo. Backfill não necessário.');
  process.exit(0);
}

// ── For each unlinked athlete, find best trainer from activities ─────────────
let applied = 0;
let skipped = 0;
let errors = 0;

for (const athlete of athletesWithoutLink) {
  const name = athlete.displayName || athlete.nome || athlete.email || athlete.id;
  console.log(`\n${SEP}`);
  console.log(`  Atleta: ${athlete.id} ("${name}")`);

  // Busca atividades recentes desse atleta com trainerUserId real
  let actSnap;
  try {
    actSnap = await db.collection('activities')
      .where('athleteUserId', '==', athlete.id)
      .orderBy('activityDate', 'desc')
      .limit(20)
      .get();
  } catch {
    // Fallback sem orderBy se índice não existir
    actSnap = await db.collection('activities')
      .where('athleteUserId', '==', athlete.id)
      .limit(20)
      .get();
  }

  // Filtra atividades com trainerUserId diferente do próprio atleta e que seja treinador real
  const candidates = actSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.trainerUserId && a.trainerUserId !== athlete.id && trainerIds.has(a.trainerUserId));

  console.log(`  Atividades analisadas   : ${actSnap.size}`);
  console.log(`  Atividades com link real: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log(`  ⚠️  Sem atividades com trainerUserId válido — pulando.`);
    skipped++;
    continue;
  }

  // Vencedor: trainerUserId mais frequente entre os candidatos recentes
  const freq = {};
  for (const c of candidates) {
    freq[c.trainerUserId] = (freq[c.trainerUserId] || 0) + 1;
  }
  const winner = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  const winnerUser = users.find(u => u.id === winner);
  const winnerName = winnerUser ? (winnerUser.displayName || winnerUser.nome || winner) : winner;

  console.log(`  Treinador vencedor      : ${winner} ("${winnerName}") — ${freq[winner]} atividade(s)`);
  console.log(`  Fonte de atividades     : [${candidates.slice(0, 3).map(c => c.id.slice(0, 8) + '…').join(', ')}]`);

  if (DRY_RUN) {
    console.log(`  🔵 DRY-RUN: updateDoc(users/${athlete.id}, { treinador_id: "${winner}" })`);
    applied++;
  } else {
    try {
      await db.collection('users').doc(athlete.id).update({ treinador_id: winner });
      console.log(`  ✅ APLICADO: treinador_id="${winner}" gravado em users/${athlete.id}`);
      applied++;
    } catch (err) {
      console.log(`  ❌ ERRO: ${err.message}`);
      errors++;
    }
  }
}

console.log('\n' + '═'.repeat(68));
console.log(`  RESULTADO  ${mode}`);
console.log('═'.repeat(68));
console.log(`  ${DRY_RUN ? 'Seriam aplicados' : 'Aplicados'} : ${applied}`);
console.log(`  Sem fonte (pulados)     : ${skipped}`);
console.log(`  Erros                   : ${errors}`);
if (DRY_RUN && applied > 0) {
  console.log('\n  Execute com --apply para gravar:');
  console.log('  node scripts/backfill-trainer-links.mjs --apply');
}
console.log('═'.repeat(68) + '\n');

process.exit(errors > 0 ? 1 : 0);
