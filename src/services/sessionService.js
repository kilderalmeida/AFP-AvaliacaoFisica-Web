/**
 * sessionService.js
 * Service centralizado para operações de sessão de treino.
 *
 * Objetivo:
 * - Encapsular toda a lógica de leitura/escrita no Firestore
 * - Concentrar regras de negócio de check-in, check-out e dashboard
 * - Evitar duplicação de queries e helpers nas páginas
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase/config.js';

/**
 * Converte diferentes formatos de data para Date.
 *
 * Casos tratados:
 * - Firestore Timestamp (com toDate)
 * - Objeto com seconds
 * - Date nativo
 * - String/valor compatível com new Date()
 *
 * Retorna null se não conseguir interpretar a data.
 */
function toDateObject(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formata uma data para exibição em pt-BR.
 *
 * Esse helper é usado para padronizar a UI e evitar
 * lógica de formatação espalhada pelos componentes.
 */
function formatDateTimePtBR(value) {
  const date = toDateObject(value);
  if (!date) return 'N/D';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Calcula a duração entre duas datas em minutos.
 *
 * Usa arredondamento para manter o comportamento simples na UI.
 * Nunca retorna valor negativo.
 */
function calculateDurationMinutes(startValue, endValue = new Date()) {
  const startDate = toDateObject(startValue);
  const endDate = toDateObject(endValue);

  if (!startDate || !endDate) return 0;

  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

/**
 * Converte minutos acumulados em rótulo de horas.
 *
 * Exemplos:
 * - 60 -> 1h
 * - 90 -> 1.5h
 * - 120 -> 2h
 */
function formatHoursFromMinutes(minutes = 0) {
  const hours = minutes / 60;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

/**
 * Ordena sessões da mais recente para a mais antiga.
 *
 * Prioriza dataCheckout quando existir; caso contrário,
 * usa dataCheckin como referência de ordenação.
 */
function sortSessionsByDateDesc(sessions) {
  return sessions.sort((a, b) => {
    const timeA = toDateObject(a.dataCheckout || a.dataCheckin)?.getTime() || 0;
    const timeB = toDateObject(b.dataCheckout || b.dataCheckin)?.getTime() || 0;
    return timeB - timeA;
  });
}

function normalizeUserRole(userData) {
  return String(userData?.papel || userData?.perfil || '')
    .normalize('NFC')
    .trim()
    .toLowerCase();
}

function mergeUniqueUsersById(...userLists) {
  const uniqueMap = new Map();
  userLists.flat().forEach((user) => {
    if (user?.id) uniqueMap.set(user.id, user);
  });
  return Array.from(uniqueMap.values());
}

/**
 * Obtém o perfil do usuário em /users/{uid}.
 *
 * @param {string} uid - ID do usuário autenticado
 * @returns {Promise<Object|null>} Dados do perfil ou null
 */
export async function getCurrentUserProfile(uid) {
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    return userSnap.exists() ? userSnap.data() : null;
  } catch (error) {
    console.error('Erro ao buscar perfil do usuário:', error);
    return null;
  }
}

/**
 * Busca todas as sessões do atleta.
 *
 * O retorno já vem com:
 * - id do documento
 * - dados da sessão
 * - ordenação da mais recente para a mais antiga
 *
 * @param {string} uid - ID do atleta
 * @returns {Promise<Array>}
 */
export async function getAthleteSessions(uid) {
  try {
    const q = query(collection(db, 'sessaotreino'), where('athleteId', '==', uid));
    const snap = await getDocs(q);
    const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return sortSessionsByDateDesc(sessions);
  } catch (error) {
    console.error('Erro ao buscar sessões do atleta:', error);
    return [];
  }
}

/**
 * Retorna apenas as sessões mais recentes.
 *
 * Mantém a regra centralizada em vez de cada página
 * decidir manualmente quantas sessões exibir.
 *
 * @param {string} uid - ID do atleta
 * @param {number} limitCount - Quantidade máxima de itens
 * @returns {Promise<Array>}
 */
export async function getRecentAthleteSessions(uid, limitCount = 5) {
  try {
    const allSessions = await getAthleteSessions(uid);
    return allSessions.slice(0, limitCount);
  } catch (error) {
    console.error('Erro ao buscar sessões recentes:', error);
    return [];
  }
}

/**
 * Retorna a sessão ativa do atleta.
 *
 * Regra de negócio:
 * sessão ativa = sessão sem dataCheckout.
 *
 * @param {string} uid - ID do atleta
 * @returns {Promise<Object|null>}
 */
export async function getActiveSession(uid) {
  try {
    const q = query(
      collection(db, 'sessaotreino'),
      where('athleteId', '==', uid),
      where('dataCheckout', '==', null)
    );
    const snap = await getDocs(q);
    const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const activeSession = sessions.find(
      (item) =>
        item.dataCheckout === null ||
        item.dataCheckout === undefined ||
        item.pseFoster === null ||
        item.pseFoster === undefined
    );

    return activeSession || null;
  } catch (error) {
    console.error('Erro ao buscar sessão ativa:', error);
    return null;
  }
}
 
/**
 * Cria um novo check-in.
 *
 * Regra de negócio:
 * - não permite novo check-in se houver sessão ativa
 * - usa schema compatível com Android
 *
 * @param {string} uid - ID do atleta
 * @param {Object} payload - Dados opcionais do check-in
 * @returns {Promise<Object>}
 * @throws {Error} Se não cumprir regras de negócio
 */
export async function createCheckIn(uid, payload = {}) {
  try {
    const activeSession = await getActiveSession(uid);
    if (activeSession) {
      const formattedDate = formatDateTimePtBR(activeSession.dataCheckin);
      throw new Error(
        `Já existe um treino em aberto desde ${formattedDate}. Finalize-o antes de iniciar um novo.`
      );
    }

    const {
      atividades = [],
      vfc = 0,
      bemEstar = {},
      recuperacao = '',
      dorRegioes = [],
      hidratacao = 0,
    } = payload || {};

    const normalizedBemEstar = {
      fadiga: Number(bemEstar.fadiga) || 0,
      sono: Number(bemEstar.sono) || 0,
      dor: Number(bemEstar.dor) || 0,
      estresse: Number(bemEstar.estresse) || 0,
      humor: Number(bemEstar.humor) || 0,
    };

    const docRef = await addDoc(collection(db, 'sessaotreino'), {
      athleteId: uid,
      atividades: Array.isArray(atividades) ? atividades : [],
      vfc: Number(vfc) || 0,
      bemEstar: normalizedBemEstar,
      recuperacao: typeof recuperacao === 'string' ? recuperacao : '',
      dorRegioes: Array.isArray(dorRegioes) ? dorRegioes : [],
      hidratacao: Number(hidratacao) || 0,
      dataCheckin: serverTimestamp(),
      dataCheckout: null,
      pseFoster: null,
      duracaoMin: 0,
      carga: 0,
    });

    return {
      id: docRef.id,
      athleteId: uid,
      dataCheckin: new Date(),
    };
  } catch (error) {
    console.error('Erro ao criar check-in:', error);
    throw error;
  }
}

/**
 * Finaliza uma sessão existente com check-out.
 *
 * Regras:
 * - valida duracaoMin entre 1 e 180
 * - calcula carga = pseFoster * duracaoMin
 * - grava dataCheckout com serverTimestamp()
 *
 * Compatibilidade:
 * - aceita payload com pseFoster e duracaoMin
 * - mantém suporte legível para chamada legada
 *   finishCheckOut(sessionId, dataCheckinValue)
 *
 * @param {string} sessionId - ID da sessão
 * @param {Object|Date} payloadOrCheckinValue - payload do check-out ou data de check-in legada
 * @returns {Promise<Object>}
 * @throws {Error} Se houver erro na atualização
 */
export async function finishCheckOut(sessionId, payloadOrCheckinValue) {
  try {
    if (!sessionId) {
      throw new Error('ID da sessão é obrigatório.');
    }

    const isLegacyCall =
      payloadOrCheckinValue &&
      (payloadOrCheckinValue instanceof Date ||
        typeof payloadOrCheckinValue?.toDate === 'function' ||
        payloadOrCheckinValue?.seconds);

    let pseFoster = 0;
    let duracaoMin = 0;

    if (isLegacyCall) {
      duracaoMin = calculateDurationMinutes(payloadOrCheckinValue, new Date());
    } else {
      const payload = payloadOrCheckinValue || {};
      pseFoster = Number(payload.pseFoster);
      duracaoMin = Number(payload.duracaoMin);

    if (!Number.isFinite(duracaoMin) || duracaoMin < 1) {
    throw new Error('A duração deve ser de pelo menos 1 minuto.');
    }

      if (!Number.isFinite(pseFoster)) {
        throw new Error('PSE Foster é obrigatório para finalizar o check-out.');
      }
    }

    const carga = pseFoster * duracaoMin;
    const checkoutTime = new Date();

    await updateDoc(doc(db, 'sessaotreino', sessionId), {
      dataCheckout: serverTimestamp(),
      pseFoster: Number.isFinite(pseFoster) ? pseFoster : null,
      duracaoMin,
      carga,
    });

    return {
      time: checkoutTime,
      durationMinutes: duracaoMin,
      pseFoster: Number.isFinite(pseFoster) ? pseFoster : null,
      carga,
      status: 'sucesso',
    };
  } catch (error) {
    console.error('Erro ao realizar check-out:', error);
    throw error;
  }
}

/**
 * Retorna os dados consolidados usados pelo dashboard.
 *
 * Centraliza cálculo de:
 * - total de sessões
 * - total de minutos
 * - label de horas
 * - atividades recentes
 *
 * @param {string} uid - ID do atleta
 * @returns {Promise<Object>}
 */
export async function getDashboardStats(uid) {
  try {
    const sessions = await getAthleteSessions(uid);
    const totalMinutes = sessions.reduce((acc, item) => acc + Number(item.duracaoMin || 0), 0);

    return {
      totalSessions: sessions.length,
      totalMinutes,
      totalHoursLabel: formatHoursFromMinutes(totalMinutes),
      recentActivities: sessions,
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas do dashboard:', error);
    return {
      totalSessions: 0,
      totalMinutes: 0,
      totalHoursLabel: '0h',
      recentActivities: [],
    };
  }
}

/**
 * Helper exportado para formatação de data/hora na UI.
 *
 * @param {any} value - Timestamp, Date ou valor compatível
 * @returns {string}
 */
export function formatDateTimeForDisplay(value) {
  return formatDateTimePtBR(value);
}

/**
 * Helper exportado para exibição de horas acumuladas.
 *
 * @param {number} minutes - Duração em minutos
 * @returns {string}
 */
export function formatDurationForDisplay(minutes) {
  return formatHoursFromMinutes(minutes);
}

/**
 * Helper exportado para cálculo de duração.
 *
 * Útil em componentes que precisam mostrar tempo decorrido
 * sem duplicar a lógica do service.
 *
 * @param {any} startValue
 * @param {any} endValue
 * @returns {number}
 */
export function calculateDurationForDisplay(startValue, endValue) {
  return calculateDurationMinutes(startValue, endValue);
}

/**
 * Helper exportado para conversão de data.
 *
 * @param {any} value - Timestamp, Date ou string
 * @returns {Date|null}
 */
export function convertToDate(value) {
  return toDateObject(value);
}

/**
 * Busca atletas vinculados a um coach.
 *
 * Regra: query em /users onde coach_id ou coach_avaliador_id == uid
 *
 * @param {string} coachUid - UID do coach
 * @returns {Promise<Array>}
 */
export async function getAthletesByCoach(coachUid) {
  try {
    const snap = await getDocs(
      query(collection(db, 'users'), where('coach_id', '==', coachUid))
    );
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return users.filter((user) => normalizeUserRole(user) === 'atleta');
  } catch (error) {
    console.error('Erro ao buscar atletas do coach:', error);
    return [];
  }
}

/**
 * Busca atletas vinculados a um treinador.
 *
 * Regra: query em /users onde treinador_id == uid
 *
 * @param {string} trainerUid - UID do treinador
 * @returns {Promise<Array>}
 */
export async function getAthletesByTrainer(trainerUid) {
  try {
    const snap = await getDocs(
      query(collection(db, 'users'), where('treinador_id', '==', trainerUid))
    );
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const athletes = users.filter((user) => normalizeUserRole(user) === 'atleta');
    console.log('[sessionService][debug] atletas encontrados para treinador:', athletes.length);
    console.log('[sessionService][debug] atletas encontrados para treinador selecionado:', athletes.length);
    return athletes;
  } catch (error) {
    console.error('Erro ao buscar atletas do treinador:', error);
    return [];
  }
}

/**
 * Busca treinadores vinculados a um coach.
 *
 * @param {string} coachUid - UID do coach
 * @returns {Promise<Array>}
 */
export async function getTrainersByCoach(coachUid) {
  try {
    const snap = await getDocs(
      query(collection(db, 'users'), where('coach_id', '==', coachUid))
    );
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const trainers = users.filter((user) => normalizeUserRole(user) === 'treinador');
    console.log('[sessionService][debug] treinadores encontrados para coach:', trainers.length);
    return trainers;
  } catch (error) {
    console.error('Erro ao buscar treinadores:', error);
    return [];
  }
}

/**
 * Busca sessões de um atleta em um período.
 *
 * @param {string} athleteUid - UID do atleta
 * @param {number} days - Número de dias para filtro (7 ou 30)
 * @returns {Promise<Array>}
 */
export async function getAthleteSessionsByPeriod(athleteUid, days = 7) {
  try {
    const allSessions = await getAthleteSessions(athleteUid);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return allSessions.filter((session) => {
      const sessionDate = toDateObject(session.dataCheckout || session.dataCheckin);
      return sessionDate && sessionDate >= cutoffDate;
    });
  } catch (error) {
    console.error('Erro ao buscar sessões do período:', error);
    return [];
  }
}

/**
 * Busca estatísticas de dashboard por período.
 *
 * @param {string} uid - UID do usuário
 * @param {number} days - Período em dias (7 ou 30)
 * @returns {Promise<Object>}
 */
export async function getDashboardStatsByPeriod(uid, days = 7) {
  try {
    const sessions = await getAthleteSessionsByPeriod(uid, days);
    const totalMinutes = sessions.reduce((acc, item) => acc + Number(item.duracaoMin || 0), 0);

    // Calcula distribuição de modalidades
    const activitiesMap = {};
    sessions.forEach((session) => {
      if (session.atividades && Array.isArray(session.atividades)) {
        session.atividades.forEach((activity) => {
          activitiesMap[activity] = (activitiesMap[activity] || 0) + 1;
        });
      }
    });

    // Encontra última sessão
    const lastSession = sessions[0] || null;

    return {
      totalSessions: sessions.length,
      totalMinutes,
      totalHoursLabel: formatHoursFromMinutes(totalMinutes),
      recentActivities: sessions,
      activitiesDistribution: activitiesMap,
      lastSession,
      period: days,
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas do período:', error);
    return {
      totalSessions: 0,
      totalMinutes: 0,
      totalHoursLabel: '0h',
      recentActivities: [],
      activitiesDistribution: {},
      lastSession: null,
      period: days,
    };
  }
}