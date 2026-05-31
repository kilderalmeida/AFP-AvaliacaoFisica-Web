/**
 * accountService.js
 *
 * accounts/{accountId}: {
 *   name: string,
 *   type: 'trainer_account' | 'academy_account',
 *   planId: string,
 *   adminUid: string,
 *   createdBy, createdAt, updatedAt
 * }
 *
 * plans/{planId}: {
 *   name: string,
 *   activeAthleteLimit: number,
 *   isActive: boolean
 * }
 *
 * Limit enforcement:
 *   canAddAthlete(accountId) → { allowed, count, limit, reason }
 *   linkAthleteChecked(...)   → enforces limit then calls createAthleteLink
 *   transferAthleteChecked(…) → deactivates old link, creates new one (no net count change)
 *
 * Dependency order (no cycle):
 *   accountService → athleteLinkService (count + create + deactivate)
 *   athleteLinkService has no import from accountService
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase/config.js';
import {
  createAthleteLink,
  deactivateAthleteLink,
  getAccountActiveAthleteCount,
  getActiveLinksByAthlete,
  transferAthleteLink,
} from './athleteLinkService.js';

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function getPlan(planId) {
  const snap = await getDoc(doc(db, 'plans', planId));
  if (!snap.exists()) return null;
  return { planId: snap.id, ...snap.data() };
}

export async function listActivePlans() {
  const snap = await getDocs(
    query(collection(db, 'plans'), where('isActive', '==', true))
  );
  return snap.docs.map((d) => ({ planId: d.id, ...d.data() }));
}

export async function listAllPlans() {
  const snap = await getDocs(collection(db, 'plans'));
  return snap.docs
    .map((d) => ({ planId: d.id, ...d.data() }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}

export async function createPlan(
  { name, activeAthleteLimit, description = '', isActive = true },
  createdByUid
) {
  const ref = doc(collection(db, 'plans'));
  const now = serverTimestamp();
  await setDoc(ref, {
    name,
    activeAthleteLimit: Number(activeAthleteLimit),
    description: description || '',
    isActive,
    createdBy: createdByUid,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updatePlan(planId, data, updatedByUid) {
  const { planId: _id, createdAt: _ca, createdBy: _cb, ...safe } = data;
  await updateDoc(doc(db, 'plans', planId), {
    ...safe,
    updatedBy: updatedByUid,
    updatedAt: serverTimestamp(),
  });
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export async function getAccount(accountId) {
  const snap = await getDoc(doc(db, 'accounts', accountId));
  if (!snap.exists()) return null;
  return { accountId: snap.id, ...snap.data() };
}

export async function createAccount(
  { name, type = 'trainer_account', planId, adminUid, athleteLimitOverride = null, status = 'active' },
  createdByUid
) {
  const ref = doc(collection(db, 'accounts'));
  const now = serverTimestamp();
  const data = {
    name,
    type, // 'trainer_account' | 'academy_account'
    planId,
    adminUid: adminUid || null,
    status,
    createdBy: createdByUid,
    createdAt: now,
    updatedAt: now,
  };
  if (athleteLimitOverride !== null && athleteLimitOverride !== undefined) {
    data.athleteLimitOverride = Number(athleteLimitOverride);
  }
  await setDoc(ref, data);
  return ref.id;
}

export async function listAccounts() {
  const snap = await getDocs(collection(db, 'accounts'));
  return snap.docs
    .map((d) => ({ accountId: d.id, ...d.data() }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}

export async function updateAccount(accountId, data, updatedByUid) {
  const { accountId: _id, createdAt: _ca, createdBy: _cb, ...safe } = data;
  await updateDoc(doc(db, 'accounts', accountId), {
    ...safe,
    updatedBy: updatedByUid,
    updatedAt: serverTimestamp(),
  });
}

// ── Limit check ───────────────────────────────────────────────────────────────

/**
 * Checks whether the account can accept one more active athlete.
 * Returns: { allowed: bool, count: number, limit: number, reason: string | null }
 */
export async function canAddAthlete(accountId) {
  const account = await getAccount(accountId);
  if (!account) {
    return { allowed: false, count: 0, limit: 0, reason: 'account_not_found' };
  }

  const plan = await getPlan(account.planId);
  if (!plan) {
    return { allowed: false, count: 0, limit: 0, reason: 'plan_not_found' };
  }

  const count = await getAccountActiveAthleteCount(accountId);
  const limit = account.athleteLimitOverride != null
    ? Number(account.athleteLimitOverride)
    : Number(plan.activeAthleteLimit) || 0;

  return {
    allowed: count < limit,
    count,
    limit,
    reason: count >= limit ? 'limit_reached' : null,
  };
}

// ── Guarded operations ────────────────────────────────────────────────────────

/**
 * Creates a new active athlete_link after verifying the account has capacity.
 * Throws with { code: 'limit_reached' | 'account_not_found' | 'plan_not_found', ... } if blocked.
 *
 * Use this (not createAthleteLink directly) whenever coming from client-facing code.
 */
export async function linkAthleteChecked(athleteId, trainerId, accountId, byUid) {
  const check = await canAddAthlete(accountId);

  if (!check.allowed) {
    const err = new Error(
      check.reason === 'limit_reached'
        ? `Limite de atletas ativos atingido (${check.count}/${check.limit}).`
        : `Não foi possível verificar o plano da conta (${check.reason}).`
    );
    err.code = check.reason;
    err.count = check.count;
    err.limit = check.limit;
    throw err;
  }

  return createAthleteLink(athleteId, trainerId, accountId, byUid);
}

/**
 * Transfers an athlete from their current trainer to a new trainer.
 * Deactivates the old link first (net active count unchanged), then creates the new link.
 * If the athlete has no active link, behaves like linkAthleteChecked.
 *
 * Throws { code: 'limit_reached' } if the target account is also at capacity AND
 * the athlete is not already in that account (transferring within the same account is always safe).
 */
export async function transferAthleteChecked(athleteId, newTrainerId, newAccountId, byUid) {
  const activeLinks = await getActiveLinksByAthlete(athleteId);

  // Deactivate all existing active links first
  for (const link of activeLinks) {
    await deactivateAthleteLink(link.athleteId, link.trainerId, byUid);
  }

  // After deactivation the count in the target account may have dropped by one
  // (if the athlete was already in the same account). Re-check the limit.
  return linkAthleteChecked(athleteId, newTrainerId, newAccountId, byUid);
}

/**
 * Transfers an athlete between trainers within the same account using a single
 * Firestore batch (atomic: deactivate old link + create new link + update
 * treinador_id all succeed or all fail together).
 * No limit check — net active count is unchanged for same-account transfers.
 */
export async function transferAthleteWithBatch(
  athleteId,
  oldTrainerId,
  newTrainerId,
  accountId,
  byUid
) {
  return transferAthleteLink(athleteId, oldTrainerId, newTrainerId, accountId, byUid);
}

export const accountService = {
  getPlan,
  listActivePlans,
  listAllPlans,
  createPlan,
  updatePlan,
  getAccount,
  listAccounts,
  createAccount,
  updateAccount,
  canAddAthlete,
  linkAthleteChecked,
  transferAthleteChecked,
  transferAthleteWithBatch,
};
