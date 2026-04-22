/**
 * Página de Check-in
 *
 * Responsabilidades:
 * - identificar o usuário autenticado
 * - verificar se já existe sessão ativa
 * - permitir abertura de nova sessão
 * - exibir feedback de sucesso/erro para a UI
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/config.js';
import {
  createCheckIn,
  getActiveSession,
  formatDateTimeForDisplay,
} from '../services/sessionService.js';

const activityOptions = [
  'Musculação',
  'Funcional',
  'Bike',
  'Corrida',
  'Tênis',
  'Futebol',
  'Futvolei',
  'Natação piscina',
  'Natação mar',
];

const recoveryOptions = ['Excelente', 'Muito boa', 'Boa', 'Regular', 'Ruim'];

const painRegions = [
  'Costas',
  'Pernas',
  'Ombros',
  'Pescoço',
  'Joelhos',
  'Pé',
  'Braços',
  'Quadril',
];

const initialForm = {
  atividades: [],
  vfc: '',
  bemEstar: {
    fadiga: 3,
    sono: 3,
    dor: 3,
    estresse: 3,
    humor: 3,
  },
  recuperacao: 'Boa',
  dorRegioes: [],
  hidratacao: 4,
};

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toggleSelection(list, item) {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}

export default function CheckInPage() {
  const [user, setUser] = useState(null);
  const [checkInData, setCheckInData] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    /**
     * Ao carregar a página, observa autenticação e consulta
     * se já existe uma sessão em aberto para o atleta logado.
     */
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setPageLoading(true);
        setError('');
        setUser(currentUser);

        if (!currentUser) {
          setActiveSession(null);
          return;
        }

        const session = await getActiveSession(currentUser.uid);
        setActiveSession(session);
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar sessão atual.');
      } finally {
        setPageLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const validateStep = () => {
    if (step === 1 && form.atividades.length === 0) {
      return 'Selecione ao menos uma atividade.';
    }

    if (step === 2 && !/^[0-9]+$/.test(form.vfc)) {
      return 'Informe um valor de VFC válido em ms.';
    }

    if (step === 4 && !recoveryOptions.includes(form.recuperacao)) {
      return 'Selecione um tipo de recuperação.';
    }

    if (step === 6 && (form.hidratacao < 1 || form.hidratacao > 8)) {
      return 'Selecione um nível de hidratação entre 1 e 8.';
    }

    return '';
  };

  const handleNext = () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setStep((current) => Math.min(6, current + 1));
  };

  const handlePrevious = () => {
    setError('');
    setStep((current) => Math.max(1, current - 1));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!user) {
        throw new Error('Usuário não autenticado.');
      }

      if (activeSession) {
        throw new Error('Já existe uma sessão aberta. Finalize-a antes de iniciar um novo check-in.');
      }

      const payload = {
        atividades: form.atividades,
        vfc: Number(form.vfc) || 0,
        bemEstar: {
          fadiga: clampValue(Number(form.bemEstar.fadiga), 1, 5),
          sono: clampValue(Number(form.bemEstar.sono), 1, 5),
          dor: clampValue(Number(form.bemEstar.dor), 1, 5),
          estresse: clampValue(Number(form.bemEstar.estresse), 1, 5),
          humor: clampValue(Number(form.bemEstar.humor), 1, 5),
        },
        recuperacao: form.recuperacao,
        dorRegioes: form.dorRegioes,
        hidratacao: clampValue(Number(form.hidratacao), 1, 8),
      };

      const createdSession = await createCheckIn(user.uid, payload);

      setCheckInData({
        id: createdSession.id,
        time: createdSession.dataCheckin,
        status: 'sucesso',
      });
      setActiveSession(createdSession);
      setSuccess(true);
      setStep(6);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao registrar check-in. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const stepContent = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <p>Selecione as atividades realizadas:</p>
            <div className="checkin-options-list">
              {activityOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`checkin-chip ${form.atividades.includes(option) ? 'selected' : ''}`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      atividades: toggleSelection(prev.atividades, option),
                    }))
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div>
            <p>Informe o VFC:</p>
            <label>
              Valor em ms
              <input
                type="text"
                value={form.vfc}
                maxLength={4}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '');
                  setForm((prev) => ({ ...prev, vfc: digits }));
                }}
                className="checkin-input"
              />
            </label>
          </div>
        );
      case 3:
        return (
          <div>
            <p>Como você está se sentindo?</p>
            <div className="checkin-wellbeing-grid">
              {Object.entries(form.bemEstar).map(([key, value]) => (
                <div key={key} className="checkin-wellbeing-item">
                  <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                  <div className="checkin-scale-row">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        className={`checkin-chip ${value === score ? 'selected' : ''}`}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            bemEstar: { ...prev.bemEstar, [key]: score },
                          }))
                        }
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div>
            <p>Selecione a recuperação:</p>
            <div className="checkin-options-list">
              {recoveryOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`checkin-chip ${form.recuperacao === option ? 'selected' : ''}`}
                  onClick={() => setForm((prev) => ({ ...prev, recuperacao: option }))}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      case 5:
        return (
          <div>
            <p>Selecione as regiões de dor:</p>
            <div className="checkin-options-list">
              {painRegions.map((region) => (
                <button
                  key={region}
                  type="button"
                  className={`checkin-chip ${form.dorRegioes.includes(region) ? 'selected' : ''}`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      dorRegioes: toggleSelection(prev.dorRegioes, region),
                    }))
                  }
                >
                  {region}
                </button>
              ))}
            </div>
          </div>
        );
      case 6:
        return (
          <div>
            <p>Escolha seu nível de hidratação:</p>
            <div className="checkin-scale-row">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`checkin-chip ${form.hidratacao === value ? 'selected' : ''}`}
                  onClick={() => setForm((prev) => ({ ...prev, hidratacao: value }))}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const totalSteps = 6;
  const progressLabel = `Etapa ${step} de ${totalSteps}`;
  const isLastStep = step === totalSteps;

  if (pageLoading) {
    return <div className="checkin-page">Carregando...</div>;
  }

  return (
    <div className="checkin-page">
      <div className="checkin-container">
        <h1>Check-in</h1>

        <div className="checkin-card">
          {activeSession ? (
            <div className="success-message">
              <p>Você já possui uma sessão aberta.</p>
              <p>Início: {formatDateTimeForDisplay(activeSession.dataCheckin)}</p>
            </div>
          ) : (
            <>
              <div className="checkin-step-header">
                <span>{progressLabel}</span>
                <p>Complete as informações do seu check-in.</p>
              </div>

              {stepContent()}

              {error && <div className="error-message">{error}</div>}

              <div className="checkin-actions">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={step === 1 || loading}
                  className="secondary-button"
                >
                  Anterior
                </button>
                {isLastStep ? (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || success}
                    className="checkin-button"
                  >
                    {loading ? 'Processando...' : success ? 'Concluído' : 'Finalizar Check-in'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={loading}
                    className="checkin-button"
                  >
                    Próximo
                  </button>
                )}
              </div>
            </>
          )}

          {success && checkInData && (
            <div className="success-message">
              <p>✓ Check-in registrado com sucesso!</p>
              <p>{checkInData.time.toLocaleTimeString('pt-BR')}</p>
            </div>
          )}
        </div>

        <div className="checkin-info">
          <h3>Informações</h3>
          <ul>
            <li>
              Última entrada: {activeSession ? formatDateTimeForDisplay(activeSession.dataCheckin) : '-'}
            </li>
            <li>Status: {activeSession ? 'Sessão aberta' : 'Sem sessão ativa'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

