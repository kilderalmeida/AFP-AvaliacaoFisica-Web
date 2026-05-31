/**
 * athleteLinkService.js
 *
 * CRUD for athlete_links collection.
 * Limit enforcement lives in accountService (one-way dependency: accountService → athleteLinkService).
 *
 * athlete_links/{athleteId}_{trainerId}: {
 *   athleteId, trainerId, accountId,
 *   status: 'active' | 'inactive',
 *   linkedAt: Timestamp, unlinkedAt: Timestamp | null,
 *   createdBy, updatedBy
 * }
 *
 * Counting rule:
 *   An athlete counts toward activeAthleteLimit only when:
 *   - athlete_links document exists with status === 'active'
 *   - The link's accountId matches the account being checked
 */

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase/config.js';

// Deterministic ID: one canonical link per (athlete, trainer) pair.
function linkId(athleteId, trainerId) {
  return `${athleteId}_${trainerId}`;
}

// ── Core writes ───────────────────────────────────────────────────────────────

/**
 * Creates or reactivates an athlete link.
 * Does NOT enforce plan limits — call accountService.linkAthleteChecked for the guarded path.
 */
export async function createAthleteLink(athleteId, trainerId, accountId, createdByUid) {
  const id = linkId(athleteId, trainerId);
  await setDoc(
    doc(db, 'athlete_links', id),
    {
      athleteId,
      trainerId,
      accountId,
      status: 'active',
      linkedAt: serverTimestamp(),
      unlinkedAt: null,
      createdBy: createdByUid,
    },
    { merge: true }
  );
  // Dual-write treinador_id so the Firestore security rule
  // `resource.data.treinador_id == request.auth.uid` on users/{userId} reads is satisfied.
  updateDoc(doc(db, 'users', athleteId), { treinador_id: trainerId }).catch(() => {});
  return id;
}

export async function deactivateAthleteLink(athleteId, trainerId, updatedByUid) {
  const id = linkId(athleteId, trainerId);
  await updateDoc(doc(db, 'athlete_links', id), {
    status: 'inactive',
    unlinkedAt: serverTimestamp(),
    updatedBy: updatedByUid,
  });
  // Clear treinador_id so the trainer loses read access to this athlete's doc.
  updateDoc(doc(db, 'users', athleteId), { treinador_id: null }).catch(() => {});
  return id;
}

export async function reactivateAthleteLink(athleteId, trainerId, updatedByUid) {
  const id = linkId(athleteId, trainerId);
  await updateDoc(doc(db, 'athlete_links', id), {
    status: 'active',
    linkedAt: serverTimestamp(),
    unlinkedAt: null,
    updatedBy: updatedByUid,
  });
  // Restore treinador_id so the trainer can read this athlete's doc again.
  updateDoc(doc(db, 'users', athleteId), { treinador_id: trainerId }).catch(() => {});
  return id;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getTrainerActiveAthletes(trainerId) {
  const snap = await getDocs(
    query(
      collection(db, 'athlete_links'),
      where('trainerId', '==', trainerId),
      where('status', '==', 'active')
    )
  );
  return snap.docs.map((d) => ({ linkId: d.id, ...d.data() }));
}

/** All active links for a given athlete — normally 0 or 1. */
export async function getActiveLinksByAthlete(athleteId) {
  const snap = await getDocs(
    query(
      collection(db, 'athlete_links'),
      where('athleteId', '==', athleteId),
      where('status', '==', 'active')
    )
  );
  return snap.docs.map((d) => ({ linkId: d.id, ...d.data() }));
}

export async function getAthleteLink(athleteId, trainerId) {
  const snap = await getDocs(
    query(
      collection(db, 'athlete_links'),
      where('athleteId', '==', athleteId),
      where('trainerId', '==', trainerId)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { linkId: d.id, ...d.data() };
}

export async function getAccountActiveAthleteCount(accountId) {
  const snap = await getDocs(
    query(
      collection(db, 'athlete_links'),
      where('accountId', '==', accountId),
      where('status', '==', 'active')
    )
  );
  return snap.size;
}

export async function getAccountActiveAthleteLinks(accountId) {
  const snap = await getDocs(
    query(
      collection(db, 'athlete_links'),
      where('accountId', '==', accountId),
      where('status', '==', 'active')
    )
  );
  return snap.docs.map((d) => ({ linkId: d.id, ...d.data() }));
}

/**
 * Transfers an athlete from one trainer to another in a single atomic batch.
 * Writes: (1) deactivate old link, (2) create new link, (3) update treinador_id.
 * All three succeed or all fail — no partial state.
 * Same-account only: no limit check (net active count stays the same).
 */
export async function transferAthleteLink(
  athleteId,
  oldTrainerId,
  newTrainerId,
  newAccountId,
  updatedByUid
) {
  const oldId = linkId(athleteId, oldTrainerId);
  const newId = linkId(athleteId, newTrainerId);
  const now = serverTimestamp();
  const batch = writeBatch(db);

  batch.update(doc(db, 'athlete_links', oldId), {
    status: 'inactive',
    unlinkedAt: now,
    updatedBy: updatedByUid,
  });

  batch.set(doc(db, 'athlete_links', newId), {
    athleteId,
    trainerId: newTrainerId,
    accountId: newAccountId,
    status: 'active',
    linkedAt: now,
    unlinkedAt: null,
    createdBy: updatedByUid,
    updatedBy: updatedByUid,
  });

  batch.update(doc(db, 'users', athleteId), {
    treinador_id: newTrainerId,
    updatedBy: updatedByUid,
    updatedAt: now,
  });

  await batch.commit();
  return newId;
}

export async function getTrainerInactiveAthletes(trainerId) {
  const snap = await getDocs(
    query(
      collection(db, 'athlete_links'),
      where('trainerId', '==', trainerId),
      where('status', '==', 'inactive')
    )
  );
  return snap.docs.map((d) => ({ linkId: d.id, ...d.data() }));
}

export async function getAccountInactiveAthleteLinks(accountId) {
  const snap = await getDocs(
    query(
      collection(db, 'athlete_links'),
      where('accountId', '==', accountId),
      where('status', '==', 'inactive')
    )
  );
  return snap.docs.map((d) => ({ linkId: d.id, ...d.data() }));
}

export const athleteLinkService = {
  createAthleteLink,
  deactivateAthleteLink,
  reactivateAthleteLink,
  transferAthleteLink,
  getTrainerActiveAthletes,
  getTrainerInactiveAthletes,
  getActiveLinksByAthlete,
  getAthleteLink,
  getAccountActiveAthleteCount,
  getAccountActiveAthleteLinks,
  getAccountInactiveAthleteLinks,
};
