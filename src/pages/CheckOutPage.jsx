/**
 * Página de Check-out
 *
 * Responsabilidades:
 * - localizar a sessão ativa do atleta
 * - mostrar dados básicos da sessão em andamento
 * - finalizar a sessão com check-out
 * - exibir a duração calculada para o usuário
 */

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/config.js';
import {
  getActiveSession,
  finishCheckOut,
  formatDateTimeForDisplay,
  calculateDurationForDisplay,
} from '../services/sessionService.js';

function formatElapsed(minutes) {
  if (!minutes) return '0 min';

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
}

const initialForm = {
  pseFoster: '',
  duracaoMin: '',
};

export default function CheckOutPage() {
  const [user, setUser] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [checkOutData, setCheckOutData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    /**
     * Ao abrir a tela, identifica o usuário atual e busca
     * a sessão ativa para decidir se o check-out pode ser feito.
     */
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setLoading(true);
        setError('');
        setUser(currentUser);

        if (!currentUser) {
          setSessionData(null);
          return;
        }

        const activeSession = await getActiveSession(currentUser.uid);
        setSessionData(activeSession);
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar sessão ativa.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Calcula o tempo decorrido apenas para exibição da UI.
   * A persistência final continua sendo feita no service.
   */
  const elapsedMinutes = useMemo(() => {
    if (!sessionData?.dataCheckin) return 0;
    return calculateDurationForDisplay(sessionData.dataCheckin);
  }, [sessionData]);

  const totalSteps = 3;
  const isLastStep = step === totalSteps;
  const progressLabel = `Etapa ${step} de ${totalSteps}`;

  const validateStep = () => {
    if (step === 2) {
      if (!/^[0-9]+$/.test(form.pseFoster)) {
        return 'Informe um valor de PSE Foster entre 0 e 10.';
      }
      const pseValue = Number(form.pseFoster);
      if (pseValue < 0 || pseValue > 10) {
        return 'PSE Foster deve estar entre 0 e 10.';
      }
    }

    if (step === 3) {
      if (!/^[0-9]+$/.test(form.duracaoMin)) {
        return 'Informe a duração em minutos.';
      }
      const minutes = Number(form.duracaoMin);
      if (minutes < 1 || minutes > 180) {
        return 'A duração deve ser entre 1 e 180 minutos.';
      }
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
    setStep((current) => Math.min(totalSteps, current + 1));
  };

  const handlePrevious = () => {
    setError('');
    setStep((current) => Math.max(1, current - 1));
  };

  const handleCheckOut = async () => {
    setCheckingOut(true);
    setError('');

    try {
      if (!user) {
        throw new Error('Usuário não autenticado.');
      }

      if (!sessionData?.id) {
        throw new Error('Nenhuma sessão ativa encontrada.');
      }

      const payload = {
        pseFoster: Number(form.pseFoster),
        duracaoMin: Number(form.duracaoMin),
      };

      const result = await finishCheckOut(sessionData.id, payload);

      setCheckOutData(result);
      setSuccess(true);
      setSessionData(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao registrar check-out. Tente novamente.');
    } finally {
      setCheckingOut(false);
    }
  };

  const renderSessionSummary = () => (
    <div className="session-info">
      <h2>Resumo da sessão</h2>
      <p>Hora de entrada: {formatDateTimeForDisplay(sessionData?.dataCheckin)}</p>
      <p>Atividades: {sessionData?.atividades?.length ? sessionData.atividades.join(', ') : '-'}</p>
      <p>VFC: {sessionData?.vfc ?? '-'}</p>
      <p>Recuperação: {sessionData?.recuperacao || '-'}</p>
      <p>Hidratação: {sessionData?.hidratacao ?? '-'}</p>
      <div className="checkin-wellbeing-grid">
        {sessionData?.bemEstar
          ? Object.entries(sessionData.bemEstar).map(([key, value]) => (
              <div key={key} className="checkin-wellbeing-item">
                <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {value ?? '-'}
              </div>
            ))
          : <p>Bem-estar: -</p>}
      </div>
      <p>Regiões de dor: {sessionData?.dorRegioes?.length ? sessionData.dorRegioes.join(', ') : '-'}</p>
      <p>Tempo decorrido: {formatElapsed(elapsedMinutes)}</p>
    </div>
  );

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <p>Confira as informações do seu check-in antes de finalizar.</p>
            {renderSessionSummary()}
          </div>
        );
      case 2:
        return (
          <div>
            <p>Informe o PSE Foster.</p>
            <label>
              Valor de 0 a 10
              <input
                type="text"
                value={form.pseFoster}
                maxLength={2}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '');
                  setForm((prev) => ({ ...prev, pseFoster: digits }));
                }}
                className="checkout-input"
              />
            </label>
          </div>
        );
      case 3:
        return (
          <div>
            <p>Informe a duração do treino em minutos.</p>
            <label>
              Duração (min)
              <input
                type="text"
                value={form.duracaoMin}
                maxLength={3}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '');
                  setForm((prev) => ({ ...prev, duracaoMin: digits }));
                }}
                className="checkout-input"
              />
            </label>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="checkout-page">Carregando...</div>;
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <h1>Check-out</h1>

        <div className="checkout-card">
          {success && checkOutData ? (
            <div className="success-message">
              <h2>✓ Check-out registrado com sucesso!</h2>
              <p>Hora: {checkOutData.time.toLocaleTimeString('pt-BR')}</p>
              <p>Duração registrada: {formatElapsed(checkOutData.durationMinutes)}</p>
            </div>
          ) : !sessionData ? (
            <div className="warning-message">
              <p>Nenhuma sessão ativa.</p>
              <p>Faça um check-in primeiro.</p>
            </div>
          ) : (
            <>
              <div className="checkout-step-header">
                <span>{progressLabel}</span>
                <p>Complete o processo para finalizar sua sessão.</p>
              </div>

              {renderStepContent()}

              {error && <div className="error-message">{error}</div>}

              <div className="checkout-actions">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={step === 1 || checkingOut}
                  className="secondary-button"
                >
                  Anterior
                </button>
                {isLastStep ? (
                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={checkingOut || success}
                    className="checkout-button"
                  >
                    {checkingOut ? 'Processando...' : success ? 'Concluído' : 'Finalizar Check-out'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={checkingOut}
                    className="checkout-button"
                  >
                    Próximo
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}