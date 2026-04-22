/**
 * Modelo de sessão de treino (sessao_treino)
 * Representa o estado de check-in / check-out e dados de avaliação.
 */

export class Session {
  constructor({
    id,
    athleteId,
    dataCheckin,
    dataCheckout = null,
    atividades = [],
    vfc = 0,
    bemEstar = {},
    recuperacao = '',
    bodyMap = {},
    hidratacao = 1,
    pseFoster = null,
    duracaoMin = null,
    cargaTreino = null,
    status = dataCheckout ? 'fechada' : 'aberta',
    createdAt = new Date(),
  }) {
    this.id = id || `${athleteId}_${Date.now()}`;
    this.athleteId = athleteId;
    this.dataCheckin = dataCheckin;
    this.dataCheckout = dataCheckout;
    this.atividades = atividades;
    this.vfc = vfc;
    this.bemEstar = bemEstar;
    this.recuperacao = recuperacao;
    this.bodyMap = bodyMap;
    this.hidratacao = hidratacao;
    this.pseFoster = pseFoster;
    this.duracaoMin = duracaoMin;
    this.cargaTreino = cargaTreino;
    this.status = status;
    this.createdAt = createdAt;
  }

  isOpen() {
    return this.status === 'aberta';
  }

  getDurationMinutes() {
    if (!this.dataCheckout || !this.dataCheckin) return null;
    const duration = (new Date(this.dataCheckout) - new Date(this.dataCheckin)) / 60000;
    return Math.round(duration);
  }

  toJSON() {
    return {
      id: this.id,
      athleteId: this.athleteId,
      dataCheckin: this.dataCheckin,
      dataCheckout: this.dataCheckout,
      atividades: this.atividades,
      vfc: this.vfc,
      bemEstar: this.bemEstar,
      recuperacao: this.recuperacao,
      bodyMap: this.bodyMap,
      hidratacao: this.hidratacao,
      pseFoster: this.pseFoster,
      duracaoMin: this.duracaoMin,
      cargaTreino: this.cargaTreino,
      status: this.status,
      createdAt: this.createdAt,
    };
  }
}

/**
 * Cria a sessão de treino básica com valores iniciais.
 * @param {object} params
 * @param {string} params.athleteId
 * @param {Date|string} [params.dataCheckin=new Date()]
 * @returns {Session}
 */
export function createSession({ athleteId, dataCheckin = new Date() }) {
  return new Session({
    athleteId,
    dataCheckin: dataCheckin instanceof Date ? dataCheckin : new Date(dataCheckin),
    dataCheckout: null,
    atividades: [],
    vfc: 0,
    bemEstar: {
      fadiga: 3,
      sono: 3,
      dor: 3,
      estresse: 3,
      humor: 3,
    },
    recuperacao: '',
    bodyMap: {},
    hidratacao: 1,
    pseFoster: null,
    duracaoMin: null,
    cargaTreino: null,
    status: 'aberta',
    createdAt: new Date(),
  });
}

export default {
  Session,
  createSession,
};