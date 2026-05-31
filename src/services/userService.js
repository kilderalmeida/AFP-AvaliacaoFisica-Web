import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from './firebase/config.js';

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() };
}

export async function listUsers(filters = {}) {
  const constraints = [];
  if (filters.papel) constraints.push(where('papel', '==', filters.papel));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.accountId) constraints.push(where('accountId', '==', filters.accountId));
  const q = constraints.length
    ? query(collection(db, 'users'), ...constraints)
    : collection(db, 'users');
  const snap = await getDocs(q);
  const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  return users.sort((a, b) =>
    String(a.displayName || a.email || '').localeCompare(
      String(b.displayName || b.email || ''),
      'pt-BR'
    )
  );
}

export async function listTrainers() {
  // Query both legacy Portuguese names and new canonical names
  const snap = await getDocs(
    query(collection(db, 'users'), where('papel', 'in', ['treinador', 'trainer', 'coach']))
  );
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .sort((a, b) =>
      String(a.displayName || '').localeCompare(String(b.displayName || ''), 'pt-BR')
    );
}

export async function createUser(
  { email, displayName, papel, status = 'invited', phone = '', birthDate = '', sex = '', gymId = '', treinador_id = '', accountId = null },
  _createdByUid
) {
  const callFn = httpsCallable(functions, 'createUserCallable');
  try {
    const result = await callFn({ email, displayName, papel, status, phone, birthDate, sex, gymId, treinador_id, accountId });
    const newUid = result.data.uid;

    // Send password-reset email so user sets their own password
    try { await sendPasswordResetEmail(auth, email); } catch { /* non-critical */ }

    return newUid;
  } catch (err) {
    // Map Cloud Function error back to the code the UI already handles
    if (err.code === 'functions/already-exists') {
      const mapped = new Error('Firebase: Error (auth/email-already-in-use).');
      mapped.code = 'auth/email-already-in-use';
      throw mapped;
    }
    throw err;
  }
}

export async function updateUserProfile(uid, data, updatedByUid) {
  // email cannot be changed through Firestore alone (Auth account is separate)
  const { email: _email, uid: _uid, ...safe } = data;
  await updateDoc(doc(db, 'users', uid), {
    ...safe,
    updatedBy: updatedByUid,
    updatedAt: serverTimestamp(),
  });
}

export async function linkAthleteToTrainer(athleteUid, trainerUid, updatedByUid) {
  await updateDoc(doc(db, 'users', athleteUid), {
    treinador_id: trainerUid || null,
    updatedBy: updatedByUid,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleUserStatus(uid, status, updatedByUid) {
  await updateDoc(doc(db, 'users', uid), {
    status,
    updatedBy: updatedByUid,
    updatedAt: serverTimestamp(),
  });
}

export async function sendInviteEmail(email) {
  await sendPasswordResetEmail(auth, email);
}

export const userService = {
  getUserProfile,
  listUsers,
  listTrainers,
  createUser,
  updateUserProfile,
  linkAthleteToTrainer,
  toggleUserStatus,
  sendInviteEmail,
};
