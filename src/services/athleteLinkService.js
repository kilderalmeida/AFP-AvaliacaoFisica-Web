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
  return id;
}

export async function deactivateAthleteLink(athleteId, trainerId, updatedByUid) {
  const id = linkId(athleteId, trainerId);
  await updateDoc(doc(db, 'athlete_links', id), {
    status: 'inactive',
    unlinkedAt: serverTimestamp(),
    updatedBy: updatedByUid,
  });
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

export const athleteLinkService = {
  createAthleteLink,
  deactivateAthleteLink,
  reactivateAthleteLink,
  getTrainerActiveAthletes,
  getActiveLinksByAthlete,
  getAthleteLink,
  getAccountActiveAthleteCount,
  getAccountActiveAthleteLinks,
};
