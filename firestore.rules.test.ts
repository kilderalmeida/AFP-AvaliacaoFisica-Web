/**
 * firestore.rules.test.ts
 *
 * Testa as regras de segurança do Firestore para os fluxos
 * coach / trainer / athlete, com foco nas queries que quebraram
 * e foram corrigidas.
 *
 * Uso:
 *   npm run test:rules:emulator   (emulador Firestore na porta 8081)
 *   npm run test:rules             (apenas lint/type-check, sem emulador)
 *
 * Pré-requisito: Firebase Local Emulator Suite rodando
 *   firebase emulators:start --only firestore
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, test } from 'vitest';

// ── Constantes de teste ────────────────────────────────────────────────────────

const PROJECT_ID = 'afp-rules-test';
const ACCOUNT_ID = 'test-account-smoke';

const COACH_UID     = 'coach-smoke-uid';
const CTRAINER_UID  = 'ctrainer-smoke-uid';
const CATHLETE_UID  = 'cathlete-smoke-uid';
const TRAINER_UID   = 'trainer-smoke-uid';
const ATHLETE_UID   = 'athlete-smoke-uid';
const STRANGER_UID  = 'stranger-smoke-uid';

// ── Inicialização ──────────────────────────────────────────────────────────────

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8081,
    },
  });

  // Setup: cria todos os documentos necessários com regras desabilitadas.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // Usuários
    await setDoc(doc(db, 'users', COACH_UID), {
      papel: 'coach', accountId: ACCOUNT_ID, treinador_id: null, status: 'active',
    });
    await setDoc(doc(db, 'users', CTRAINER_UID), {
      papel: 'trainer', accountId: ACCOUNT_ID, treinador_id: COACH_UID, status: 'active',
    });
    await setDoc(doc(db, 'users', CATHLETE_UID), {
      // treinador_id aponta para o coach (não para ctrainer) para satisfazer a regra
      // `resource.data.treinador_id == request.auth.uid` quando coach lê o doc do atleta.
      papel: 'athlete', accountId: ACCOUNT_ID, treinador_id: COACH_UID, status: 'active',
    });
    await setDoc(doc(db, 'users', TRAINER_UID), {
      papel: 'trainer', accountId: ACCOUNT_ID, treinador_id: null, status: 'active',
    });
    await setDoc(doc(db, 'users', ATHLETE_UID), {
      papel: 'athlete', accountId: ACCOUNT_ID, treinador_id: TRAINER_UID, status: 'active',
    });
    await setDoc(doc(db, 'users', STRANGER_UID), {
      papel: 'athlete', accountId: 'other-account', treinador_id: null, status: 'active',
    });

    // athlete_links
    // cathlete ↔ coach  (para que listTrainerAthleteOptions(coachUid) funcione)
    await setDoc(doc(db, 'athlete_links', `${CATHLETE_UID}_${COACH_UID}`), {
      athleteId: CATHLETE_UID, trainerId: COACH_UID,
      accountId: ACCOUNT_ID, status: 'active',
    });
    // cathlete ↔ ctrainer  (vínculo de dados; coach não pode ler via client SDK)
    await setDoc(doc(db, 'athlete_links', `${CATHLETE_UID}_${CTRAINER_UID}`), {
      athleteId: CATHLETE_UID, trainerId: CTRAINER_UID,
      accountId: ACCOUNT_ID, status: 'active',
    });
    // athlete ↔ trainer
    await setDoc(doc(db, 'athlete_links', `${ATHLETE_UID}_${TRAINER_UID}`), {
      athleteId: ATHLETE_UID, trainerId: TRAINER_UID,
      accountId: ACCOUNT_ID, status: 'active',
    });

    // Atividade criada pelo coach para cathlete
    await setDoc(doc(db, 'activities', 'act-coach-smoke-1'), {
      athleteUserId: CATHLETE_UID, trainerUserId: COACH_UID,
      accountId: ACCOUNT_ID, status: 'completed',
    });
    // Atividade criada pelo trainer para athlete
    await setDoc(doc(db, 'activities', 'act-trainer-smoke-1'), {
      athleteUserId: ATHLETE_UID, trainerUserId: TRAINER_UID,
      accountId: ACCOUNT_ID, status: 'completed',
    });
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
  // Re-seed após cada test para garantir isolamento
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', COACH_UID),    { papel: 'coach',   accountId: ACCOUNT_ID, treinador_id: null,       status: 'active' });
    await setDoc(doc(db, 'users', CTRAINER_UID), { papel: 'trainer', accountId: ACCOUNT_ID, treinador_id: COACH_UID,  status: 'active' });
    await setDoc(doc(db, 'users', CATHLETE_UID), { papel: 'athlete', accountId: ACCOUNT_ID, treinador_id: COACH_UID,  status: 'active' });
    await setDoc(doc(db, 'users', TRAINER_UID),  { papel: 'trainer', accountId: ACCOUNT_ID, treinador_id: null,       status: 'active' });
    await setDoc(doc(db, 'users', ATHLETE_UID),  { papel: 'athlete', accountId: ACCOUNT_ID, treinador_id: TRAINER_UID, status: 'active' });
    await setDoc(doc(db, 'users', STRANGER_UID), { papel: 'athlete', accountId: 'other-account', treinador_id: null,  status: 'active' });
    await setDoc(doc(db, 'athlete_links', `${CATHLETE_UID}_${COACH_UID}`),    { athleteId: CATHLETE_UID, trainerId: COACH_UID,    accountId: ACCOUNT_ID, status: 'active' });
    await setDoc(doc(db, 'athlete_links', `${CATHLETE_UID}_${CTRAINER_UID}`), { athleteId: CATHLETE_UID, trainerId: CTRAINER_UID, accountId: ACCOUNT_ID, status: 'active' });
    await setDoc(doc(db, 'athlete_links', `${ATHLETE_UID}_${TRAINER_UID}`),   { athleteId: ATHLETE_UID,  trainerId: TRAINER_UID,  accountId: ACCOUNT_ID, status: 'active' });
    await setDoc(doc(db, 'activities', 'act-coach-smoke-1'),   { athleteUserId: CATHLETE_UID, trainerUserId: COACH_UID,   accountId: ACCOUNT_ID, status: 'completed' });
    await setDoc(doc(db, 'activities', 'act-trainer-smoke-1'), { athleteUserId: ATHLETE_UID,  trainerUserId: TRAINER_UID, accountId: ACCOUNT_ID, status: 'completed' });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ── athlete_links — acesso do coach ────────────────────────────────────────────
//
// Este é o conjunto mais crítico: a query que quebrou o Dashboard do coach.
// loadCoachFilters chamava listTrainerAthleteOptions(ctrainerUid) que emitia
// `WHERE trainerId == ctrainerUid` com auth.uid == coachUid → DENIED.

describe('athlete_links — acesso do coach', () => {

  test('coach lê links onde trainerId == coachUid → ALLOW', async () => {
    // Esta é a query correta: listTrainerAthleteOptions(coachUid)
    const ctx = testEnv.authenticatedContext(COACH_UID);
    const q = query(
      collection(ctx.firestore(), 'athlete_links'),
      where('trainerId', '==', COACH_UID),
      where('status', '==', 'active')
    );
    await assertSucceeds(getDocs(q));
  });

  test('coach lê links onde trainerId == ctrainerUid → DENY (BUG ORIGINAL)', async () => {
    // Esta era a query errada: loadAthletesForTrainer(ctrainerUid) chamado
    // dentro de loadCoachFilters com auth de coach → permission-denied.
    const ctx = testEnv.authenticatedContext(COACH_UID);
    const q = query(
      collection(ctx.firestore(), 'athlete_links'),
      where('trainerId', '==', CTRAINER_UID),
      where('status', '==', 'active')
    );
    await assertFails(getDocs(q));
  });

  test('coach lê link específico onde athleteId == coachUid → DENY', async () => {
    // Coach não é athlete em nenhum link — não deve acessar via athleteId
    const ctx = testEnv.authenticatedContext(COACH_UID);
    await assertFails(getDoc(doc(ctx.firestore(), 'athlete_links', `${CATHLETE_UID}_${CTRAINER_UID}`)));
  });

});

// ── athlete_links — acesso do trainer ─────────────────────────────────────────

describe('athlete_links — acesso do trainer', () => {

  test('trainer lê links onde trainerId == trainerUid → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(TRAINER_UID);
    const q = query(
      collection(ctx.firestore(), 'athlete_links'),
      where('trainerId', '==', TRAINER_UID),
      where('status', '==', 'active')
    );
    await assertSucceeds(getDocs(q));
  });

  test('trainer lê links de outro trainer → DENY', async () => {
    const ctx = testEnv.authenticatedContext(TRAINER_UID);
    const q = query(
      collection(ctx.firestore(), 'athlete_links'),
      where('trainerId', '==', CTRAINER_UID),
      where('status', '==', 'active')
    );
    await assertFails(getDocs(q));
  });

  test('athlete lê seus próprios links → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(ATHLETE_UID);
    const q = query(
      collection(ctx.firestore(), 'athlete_links'),
      where('athleteId', '==', ATHLETE_UID)
    );
    await assertSucceeds(getDocs(q));
  });

});

// ── users — leitura do coach ───────────────────────────────────────────────────
//
// coach lê doc de ctrainer: cathlete.treinador_id == coachUid → ALLOW
// coach lê doc de cathlete: cathlete.treinador_id == coachUid → ALLOW
// coach não lê doc de usuário de outra conta

describe('users — leitura do coach', () => {

  test('coach lê próprio doc → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(COACH_UID);
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', COACH_UID)));
  });

  test('coach lê doc do ctrainer (treinador_id == coachUid) → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(COACH_UID);
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', CTRAINER_UID)));
  });

  test('coach lê doc do cathlete (treinador_id == coachUid) → ALLOW', async () => {
    // getUserProfile(cathleteUid) executado pelo coach no listTrainerAthleteOptions
    const ctx = testEnv.authenticatedContext(COACH_UID);
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', CATHLETE_UID)));
  });

  test('coach não lê doc de stranger (outra conta, treinador_id != coachUid) → DENY', async () => {
    const ctx = testEnv.authenticatedContext(COACH_UID);
    await assertFails(getDoc(doc(ctx.firestore(), 'users', STRANGER_UID)));
  });

  test('coach não lê doc do trainer (treinador_id == null, sem vínculo) → DENY', async () => {
    const ctx = testEnv.authenticatedContext(COACH_UID);
    await assertFails(getDoc(doc(ctx.firestore(), 'users', TRAINER_UID)));
  });

});

// ── users — leitura do trainer ────────────────────────────────────────────────

describe('users — leitura do trainer', () => {

  test('trainer lê próprio doc → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(TRAINER_UID);
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', TRAINER_UID)));
  });

  test('trainer lê doc do athlete (treinador_id == trainerUid) → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(TRAINER_UID);
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', ATHLETE_UID)));
  });

  test('trainer não lê doc de cathlete (treinador_id == coachUid != trainerUid) → DENY', async () => {
    const ctx = testEnv.authenticatedContext(TRAINER_UID);
    await assertFails(getDoc(doc(ctx.firestore(), 'users', CATHLETE_UID)));
  });

});

// ── activities — acesso do coach ──────────────────────────────────────────────
//
// Atividades criadas via check-in pelo coach têm trainerUserId == coachUid.
// A regra permite ler se auth.uid == trainerUserId OU auth.uid == athleteUserId.
// Coach não deve ler atividades de outro trainer (ctrainer).

describe('activities — acesso do coach', () => {

  test('coach lê atividade onde trainerUserId == coachUid → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(COACH_UID);
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'activities', 'act-coach-smoke-1')));
  });

  test('coach não lê atividade de outro trainer (trainerUserId == trainerUid) → DENY', async () => {
    // Dashboard.loadDashboardStats antes do fix usava selectedTrainer (ctrainerUid)
    // como trainerUid na query — e todas as atividades vinham de trainerUid real,
    // não do coachUid. O coach não tinha acesso a nenhuma delas.
    const ctx = testEnv.authenticatedContext(COACH_UID);
    await assertFails(getDoc(doc(ctx.firestore(), 'activities', 'act-trainer-smoke-1')));
  });

});

// ── activities — acesso do trainer ────────────────────────────────────────────

describe('activities — acesso do trainer', () => {

  test('trainer lê atividade onde trainerUserId == trainerUid → ALLOW', async () => {
    const ctx = testEnv.authenticatedContext(TRAINER_UID);
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'activities', 'act-trainer-smoke-1')));
  });

  test('trainer não lê atividade de outro trainer → DENY', async () => {
    const ctx = testEnv.authenticatedContext(TRAINER_UID);
    await assertFails(getDoc(doc(ctx.firestore(), 'activities', 'act-coach-smoke-1')));
  });

});

// ── acesso não autenticado ─────────────────────────────────────────────────────

describe('acesso não autenticado', () => {

  test('unauthenticated lê users → DENY', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(ctx.firestore(), 'users', COACH_UID)));
  });

  test('unauthenticated lê athlete_links → DENY', async () => {
    const ctx = testEnv.unauthenticatedContext();
    const q = query(collection(ctx.firestore(), 'athlete_links'), where('trainerId', '==', COACH_UID));
    await assertFails(getDocs(q));
  });

  test('unauthenticated lê activities → DENY', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(ctx.firestore(), 'activities', 'act-coach-smoke-1')));
  });

});
