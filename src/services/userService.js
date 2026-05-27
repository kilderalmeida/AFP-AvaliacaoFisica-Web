import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth, db, firebaseConfig } from './firebase/config.js';

// Secondary Firebase app so admin can create Auth accounts without signing out.
function getSecondaryAuth() {
  const name = 'afp-admin-secondary';
  const existing = getApps().find((a) => a.name === name);
  const app = existing ?? initializeApp(firebaseConfig, name);
  return getAuth(app);
}

function generateTempPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
  let p = '';
  for (let i = 0; i < 16; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() };
}

export async function listUsers(filters = {}) {
  const constraints = [];
  if (filters.papel) constraints.push(where('papel', '==', filters.papel));
  if (filters.status) constraints.push(where('status', '==', filters.status));
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
  const snap = await getDocs(
    query(collection(db, 'users'), where('papel', 'in', ['treinador', 'coach']))
  );
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .sort((a, b) =>
      String(a.displayName || '').localeCompare(String(b.displayName || ''), 'pt-BR')
    );
}

export async function createUser(
  { email, displayName, papel, status = 'invited', phone = '', birthDate = '', sex = '', gymId = '', treinador_id = '' },
  createdByUid
) {
  const secondaryAuth = getSecondaryAuth();
  const tempPassword = generateTempPassword();
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
  const newUid = cred.user.uid;

  // Sign out of secondary app immediately — doesn't affect admin session
  try { await signOut(secondaryAuth); } catch { /* non-critical */ }

  const now = serverTimestamp();
  await setDoc(doc(db, 'users', newUid), {
    uid: newUid,
    displayName: displayName.trim() || email.split('@')[0],
    email,
    papel,
    status,
    phone: phone || '',
    birthDate: birthDate || '',
    sex: sex || '',
    gymId: gymId || '',
    treinador_id: treinador_id || null,
    userTypes: [papel],
    profileCompleted: false,
    createdBy: createdByUid,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 2,
  });

  // Send password-reset email so user sets their own password
  try { await sendPasswordResetEmail(auth, email); } catch { /* non-critical */ }

  return newUid;
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
