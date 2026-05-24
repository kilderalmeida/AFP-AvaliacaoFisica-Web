/**
 * diagnose-links.mjs — mapeia usuários e vínculos treinador↔atleta no Firestore
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

function role(u) {
  const p = String(u.papel || '').normalize('NFC').toLowerCase();
  const ut = (Array.isArray(u.userTypes) ? u.userTypes : []).map(x => String(x).normalize('NFC').toLowerCase());
  if (p === 'atleta' || p === 'athlete' || ut.includes('atleta') || ut.includes('athlete')) return 'atleta';
  if (p === 'treinador' || p === 'trainer' || ut.includes('treinador') || ut.includes('trainer')) return 'treinador';
  if (p === 'coach' || ut.includes('coach')) return 'coach';
  return p || 'unknown';
}

// ── 1. All users ────────────────────────────────────────────────────────────
const usersSnap = await db.collection('users').get();
const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  USUÁRIOS NO FIRESTORE                                       ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
for (const u of users) {
  const r = role(u);
  const name = (u.displayName || u.nome || u.email || u.id).substring(0, 28);
  const tid = u.treinador_id ?? '(ausente)';
  const cid = u.coach_id ?? '(ausente)';
  const uts = (Array.isArray(u.userTypes) ? u.userTypes : []).join(',') || '(none)';
  console.log(`  [${r.padEnd(10)}] ${u.id.padEnd(22)} "${name.padEnd(28)}"  treinador_id=${String(tid).padEnd(22)} coach_id=${cid}`);
}

const athletes  = users.filter(u => role(u) === 'atleta');
const trainers  = users.filter(u => ['treinador','coach'].includes(role(u)));
const withLink  = athletes.filter(u => u.treinador_id);
const noLink    = athletes.filter(u => !u.treinador_id);

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  DIAGNÓSTICO DE VÍNCULO treinador_id                        ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`  Atletas total      : ${athletes.length}`);
console.log(`  Com treinador_id   : ${withLink.length}`);
console.log(`  SEM treinador_id   : ${noLink.length}  ← precisam de backfill`);
console.log(`  Treinadores total  : ${trainers.length}`);

// ── 2. Activities with trainerUserId ────────────────────────────────────────
let actSnap;
try {
  actSnap = await db.collection('activities').orderBy('activityDate', 'desc').limit(50).get();
} catch {
  actSnap = await db.collection('activities').limit(50).get();
}

const actLinks = new Map(); // athleteUid -> Set(trainerUid)
let totalWithTrainer = 0;
for (const d of actSnap.docs) {
  const data = d.data();
  if (data.trainerUserId && data.athleteUserId) {
    totalWithTrainer++;
    if (!actLinks.has(data.athleteUserId)) actLinks.set(data.athleteUserId, new Set());
    actLinks.get(data.athleteUserId).add(data.trainerUserId);
  }
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  VÍNCULOS IMPLÍCITOS VIA activities.trainerUserId            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`  Atividades analisadas : ${actSnap.size}`);
console.log(`  Com trainerUserId     : ${totalWithTrainer}`);
console.log(`  Atletas com link impl.: ${actLinks.size}`);
for (const [ath, trSet] of actLinks) {
  const athUser = users.find(u => u.id === ath);
  const athName = athUser ? (athUser.displayName || athUser.nome || ath) : ath;
  console.log(`    athlete ${ath} ("${athName}") -> trainers: [${[...trSet].join(', ')}]`);
}

// ── 3. Backfill plan ─────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  PLANO DE BACKFILL                                           ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
for (const ath of noLink) {
  const name = ath.displayName || ath.nome || ath.email || ath.id;
  const trainerSet = actLinks.get(ath.id);
  if (trainerSet && trainerSet.size > 0) {
    const [primaryTrainer] = trainerSet;
    console.log(`  PODE BACKFILL: ${ath.id} ("${name}") <- treinador_id = ${primaryTrainer}  (fonte: activities)`);
  } else {
    console.log(`  SEM FONTE    : ${ath.id} ("${name}") — nenhuma atividade com trainerUserId`);
  }
}
if (noLink.length === 0) console.log('  Nenhum backfill necessário — todos os atletas têm treinador_id.');

console.log('');
process.exit(0);
