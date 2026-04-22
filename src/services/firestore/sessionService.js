/**
 * Serviço de Sessão (Check-in/Check-out)
 * Gerencia operações de sessão de treino no Firestore.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { createSession } from '../../models/sessionModel.js';

const SESSION_COLLECTION = 'sessaotreino';

function computeCargaTreino(pseFoster, duracaoMin) {
  const pse = Number(pseFoster) || 0;
  const duracao = Number(duracaoMin) || 0;
  return pse * duracao;
}

function normalizeFirestoreDate(value) {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
}

function normalizeSessionDoc(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    athleteId: data.athleteId,
    dataCheckin: normalizeFirestoreDate(data.dataCheckin),
    dataCheckout: normalizeFirestoreDate(data.dataCheckout),
    atividades: data.atividades || [],
    vfc: data.vfc || 0,
    bemEstar: data.bemEstar || {},
    recuperacao: data.recuperacao || '',
    bodyMap: data.bodyMap || {},
    hidratacao: data.hidratacao || 1,
    pseFoster: data.pseFoster ?? null,
    duracaoMin: data.duracaoMin ?? null,
    cargaTreino: data.cargaTreino ?? null,
    status: data.status || (data.dataCheckout ? 'fechada' : 'aberta'),
    createdAt: normalizeFirestoreDate(data.createdAt),
  };
}

export const sessionService = {
  /**
   * Cadastrar novo check-in para o atleta.
   * @param {string} athleteId
   * @param {object} [payload]
   * @returns {Promise<object>} Sessão criada
   */
  async createCheckIn(athleteId, payload = {}) {
    const session = createSession({
      athleteId,
      dataCheckin: payload.dataCheckin || new Date(),
      ...payload,
    });

    const sessionData = {
      athleteId: session.athleteId,
      dataCheckin: Timestamp.fromDate(new Date(session.dataCheckin)),
      dataCheckout: null,
      atividades: session.atividades,
      vfc: session.vfc,
      bemEstar: session.bemEstar,
      recuperacao: session.recuperacao,
      bodyMap: session.bodyMap,
      hidratacao: session.hidratacao,
      pseFoster: null,
      duracaoMin: null,
      cargaTreino: null,
      status: 'aberta',
      createdAt: Timestamp.fromDate(new Date(session.createdAt)),
    };

    const ref = await addDoc(collection(db, SESSION_COLLECTION), sessionData);
    return { id: ref.id, ...sessionData };
  },

  /**
   * Busca a sessão aberta mais recente do atleta.
   * @param {string} athleteId
   * @returns {Promise<object|null>} Sessão aberta ou null
   */
  async getOpenSession(athleteId) {
    const sessionsQuery = query(
      collection(db, SESSION_COLLECTION),
      where('athleteId', '==', athleteId),
      orderBy('dataCheckin', 'desc'),
      limit(10)
    );

    const snapshot = await getDocs(sessionsQuery);
    const openDoc = snapshot.docs.find((docSnap) => {
      const data = docSnap.data();
      return !data.dataCheckout;
    });

    return openDoc ? normalizeSessionDoc(openDoc) : null;
  },

  /**
   * Finaliza o check-out de uma sessão existente.
   * @param {string} sessionId
   * @param {number} pseFoster
   * @param {number} duracaoMin
   * @returns {Promise<object>} Dados de atualização da sessão
   */
  async finalizeCheckOut(sessionId, pseFoster, duracaoMin) {
    const cargaTreino = computeCargaTreino(pseFoster, duracaoMin);

    const updatePayload = {
      dataCheckout: Timestamp.now(),
      pseFoster: Number(pseFoster) || 0,
      duracaoMin: Number(duracaoMin) || 0,
      cargaTreino,
      status: 'fechada',
    };

    await updateDoc(doc(db, SESSION_COLLECTION, sessionId), updatePayload);
    return { id: sessionId, ...updatePayload };
  },

  /**
   * Calcula carga de treino com base em pseFoster * duracaoMin.
   * @param {number} pseFoster
   * @param {number} duracaoMin
   * @returns {number}
   */
  calculateCargaTreino(pseFoster, duracaoMin) {
    return computeCargaTreino(pseFoster, duracaoMin);
  },
};

export default sessionService;
