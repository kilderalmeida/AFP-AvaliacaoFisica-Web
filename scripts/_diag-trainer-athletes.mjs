/**
 * _diag-trainer-athletes.mjs — diagnóstico do fluxo trainer → athlete_links → user docs
 * Uso: node scripts/_diag-trainer-athletes.mjs
 * Remove após uso.
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
const { getFirestore } = await import('firebase-admin/firestore');
const app = initializeApp({
  credential: cert({
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);

console.log(`\nProjeto: ${env.VITE_FIREBASE_PROJECT_ID}\n`);

// 1. Trainer uid
const trainerSnap = await db.collection('users').where('email', '==', 'trainer.test@afp.dev').get();
if (trainerSnap.empty) { console.log('ERRO: trainer.test@afp.dev não encontrado'); process.exit(1); }
const trainer = trainerSnap.docs[0];
const trainerUid = trainer.id;
const trainerData = trainer.data();
console.log('=== TRAINER ===');
console.log('uid:', trainerUid);
console.log('papel:', trainerData.papel);
console.log('accountId:', trainerData.accountId);

// 2. athlete_links com trainerId = trainerUid E status = active
console.log('\n=== ATHLETE_LINKS (trainerId + status) ===');
try {
  const linksSnap = await db.collection('athlete_links')
    .where('trainerId', '==', trainerUid)
    .where('status', '==', 'active')
    .get();
  console.log('Links ativos encontrados:', linksSnap.size);
  linksSnap.docs.forEach(d => {
    const l = d.data();
    console.log(` id:${d.id} | athleteId:${l.athleteId} | trainerId:${l.trainerId} | status:${l.status}`);
  });
  if (linksSnap.size === 0) {
    console.log('AVISO: Nenhum link encontrado. Verificando todos os links da conta...');
    const allLinksSnap = await db.collection('athlete_links')
      .where('accountId', '==', 'test-account-starter')
      .get();
    console.log('Total de links na conta (qualquer status):', allLinksSnap.size);
    const byTrainer = {};
    allLinksSnap.docs.forEach(d => {
      const l = d.data();
      byTrainer[l.trainerId] = (byTrainer[l.trainerId] || 0) + 1;
      if (allLinksSnap.size <= 5) {
        console.log(` id:${d.id} | athleteId:${l.athleteId} | trainerId:${l.trainerId} | status:${l.status}`);
      }
    });
    console.log('trainerId distribution:', JSON.stringify(byTrainer));
    const mismatch = Object.keys(byTrainer).find(k => k !== trainerUid);
    if (mismatch) {
      console.log(`PROBLEMA: links têm trainerId='${mismatch}' mas trainer uid='${trainerUid}'`);
    }
  }

  // 3. Para cada link, verificar se o user doc existe e qual é o treinador_id
  if (linksSnap.size > 0) {
    console.log('\n=== USER DOCS DOS ATLETAS ===');
    const athleteIds = linksSnap.docs.map(d => d.data().athleteId);
    for (const athleteId of athleteIds.slice(0, 3)) { // primeiros 3
      const uSnap = await db.collection('users').doc(athleteId).get();
      if (!uSnap.exists) {
        console.log(`  ${athleteId}: NÃO EXISTE no Firestore`);
      } else {
        const u = uSnap.data();
        const match = u.treinador_id === trainerUid;
        console.log(`  ${athleteId}: treinador_id=${u.treinador_id} | match=${match ? '✅' : '❌ MISMATCH (uid trainer:'+trainerUid+')'} | papel=${u.papel} | displayName=${u.displayName}`);
      }
    }
  }
} catch (err) {
  console.log('ERRO na query athlete_links:', err.code || err.message);
  if (err.code === 9 || (err.message && err.message.includes('index'))) {
    console.log('→ ÍNDICE NÃO CONSTRUÍDO. Acesse o link abaixo para criar o índice ou aguarde alguns minutos:');
    console.log('  https://console.firebase.google.com/project/' + env.VITE_FIREBASE_PROJECT_ID + '/firestore/indexes');
  }
}
