import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase/config.js';

async function listActivitiesByAthlete(athleteUserId, { status, limit: limitCount } = {}) {
  const constraints = [where('athleteUserId', '==', athleteUserId)];
  if (status) constraints.push(where('status', '==', status));
  constraints.push(orderBy('activityDate', 'desc'));
  if (limitCount) constraints.push(limit(limitCount));

  const snap = await getDocs(query(collection(db, 'activities'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function listActivitiesByTrainer(trainerUserId, { athleteUserId, status, limit: limitCount } = {}) {
  const constraints = [where('trainerUserId', '==', trainerUserId)];
  if (athleteUserId) constraints.push(where('athleteUserId', '==', athleteUserId));
  if (status) constraints.push(where('status', '==', status));
  constraints.push(orderBy('activityDate', 'desc'));
  if (limitCount) constraints.push(limit(limitCount));

  const snap = await getDocs(query(collection(db, 'activities'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function createActivity(payload, createdByUid) {
  const now = serverTimestamp();
  const docRef = await addDoc(collection(db, 'activities'), {
    ...payload,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    createdBy: createdByUid,
  });

  // Propagate trainer-athlete link: when a real trainer (not the athlete themselves)
  // creates an activity, persist treinador_id on the athlete's user document.
  // This keeps trainer-athlete-context.service.js queries consistent.
  const { trainerUserId, athleteUserId } = payload;
  if (trainerUserId && athleteUserId && trainerUserId !== athleteUserId) {
    updateDoc(doc(db, 'users', athleteUserId), { treinador_id: trainerUserId }).catch(() => {
      // Non-fatal: link propagation is best-effort; the activity was already persisted.
    });
  }

  return docRef.id;
}

async function setActivityCheckout(activityId, checkoutData, updatedByUid) {
  await updateDoc(doc(db, 'activities', activityId), {
    checkout: checkoutData,
    status: 'completed',
    updatedAt: serverTimestamp(),
    updatedBy: updatedByUid,
  });
}

async function updateActivity(activityId, data, updatedByUid) {
  await updateDoc(doc(db, 'activities', activityId), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: updatedByUid,
  });
}

async function getActivity(activityId) {
  const snap = await getDoc(doc(db, 'activities', activityId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export const activityService = {
  listActivitiesByAthlete,
  listActivitiesByTrainer,
  createActivity,
  setActivityCheckout,
  updateActivity,
  getActivity,
};
