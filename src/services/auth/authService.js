/**
 * Serviço de Autenticação
 * Gerencia login, logout e observa mudanças de autenticação usando Firebase Auth
 */

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../firebase/config.js';

/**
 * Fazer login com email e senha
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} Usuário autenticado { uid, email }
 * @throws {Error} Erro ao fazer login
 */
export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error.code);
    throw new Error(errorMessage);
  }
}

/**
 * Criar nova conta de usuário
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} Usuário criado { uid, email }
 * @throws {Error} Erro ao criar conta
 */
export async function signup(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error.code);
    throw new Error(errorMessage);
  }
}

/**
 * Fazer logout do usuário autenticado
 * @returns {Promise<void>}
 * @throws {Error} Erro ao fazer logout
 */
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error('Erro ao fazer logout.');
  }
}

/**
 * Obter usuário atualmente autenticado
 * Retorna o usuário de forma síncrona se disponível
 * @returns {object|null} Usuário { uid, email } ou null
 */
export function getCurrentUser() {
  const user = auth.currentUser;
  return user
    ? {
        uid: user.uid,
        email: user.email,
      }
    : null;
}

/**
 * Observar mudanças de estado de autenticação
 * Chamado sempre que o usuário faz login/logout
 * @param {function} callback Função chamada com o usuário { uid, email } ou null
 * @returns {function} Unsubscribe para parar de observar
 */
export function observeAuthState(callback) {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      callback({
        uid: user.uid,
        email: user.email,
      });
    } else {
      callback(null);
    }
  });

  return unsubscribe;
}

/**
 * Usado como alias compatível para código antigo.
 */
export const onAuthStateChange = observeAuthState;

/**
 * Enviar email de reset de senha
 * @param {string} email
 * @returns {Promise<void>}
 * @throws {Error} Erro ao enviar email
 */
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    const errorMessage = getErrorMessage(error.code);
    throw new Error(errorMessage);
  }
}

/**
 * Converter código de erro do Firebase em mensagem legível
 * @param {string} errorCode
 * @returns {string} Mensagem de erro em português
 */
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

/**
 * Exportar todas as funções como serviço
 */
export const authService = {
  login,
  signup,
  logout,
  getCurrentUser,
  onAuthStateChange,
  resetPassword,
};

export default authService;
