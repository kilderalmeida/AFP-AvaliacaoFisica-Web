import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from './firebase/config.js';

export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
    };
  } catch (error) {
    throw new Error(getErrorMessage(error.code));
  }
}

export async function signup(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
    };
  } catch (error) {
    throw new Error(getErrorMessage(error.code));
  }
}

export async function logout() {
  try {
    await signOut(auth);
  } catch {
    throw new Error('Erro ao fazer logout.');
  }
}

export function getCurrentUser() {
  const user = auth.currentUser;
  return user
    ? { uid: user.uid, email: user.email }
    : null;
}

export function observeAuthState(callback) {
  return onAuthStateChanged(auth, (user) => {
    callback(
      user
        ? { uid: user.uid, email: user.email }
        : null
    );
  });
}

export const onAuthStateChange = observeAuthState;

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw new Error(getErrorMessage(error.code));
  }
}

function getErrorMessage(errorCode) {
  const errorMessages = {
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-email': 'Email inválido.',
    'auth/user-disabled': 'Conta desativada.',
    'auth/email-already-in-use': 'Este email já está em uso.',
    'auth/weak-password': 'Senha fraca. Use uma senha mais segura.',
    'auth/operation-not-allowed': 'Operação não permitida.',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
  };

  return errorMessages[errorCode] || 'Erro na autenticação. Tente novamente.';
}

export const authService = {
  login,
  signup,
  logout,
  getCurrentUser,
  observeAuthState,
  onAuthStateChange,
  resetPassword,
};

export default authService;