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
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
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
        setError('Erro ao verificar sua sessão. Tente novamente.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate('/dashboard');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

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
      if (minutes < 1) {
        return 'A duração deve ser pelo menos 1 minuto.';
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
    <div className="session-info" style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #e9ecef', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 600, color: '#495057', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>📋 Resumo da Sessão</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#fff', borderRadius: '6px', border: '1px solid #e9ecef' }}>
          <div>
            <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hora de entrada</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#495057', fontSize: '0.95rem', fontWeight: 500 }}>{formatDateTimeForDisplay(sessionData?.dataCheckin)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tempo decorrido</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#495057', fontSize: '0.95rem', fontWeight: 500 }}>{formatElapsed(elapsedMinutes)}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem' }}>Atividades</strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem', lineHeight: '1.4' }}>{sessionData?.atividades?.length ? sessionData.atividades.join(', ') : 'Nenhuma atividade registrada'}</p>
          </div>

          <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem' }}>VFC</strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem' }}>{sessionData?.vfc ? `${sessionData.vfc} ms` : 'Não informado'}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem' }}>Recuperação</strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem' }}>{sessionData?.recuperacao || 'Não informado'}</p>
          </div>

          <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem' }}>Hidratação</strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem' }}>{sessionData?.hidratacao ? `${sessionData.hidratacao}/10` : 'Não informado'}</p>
          </div>
        </div>

        {sessionData?.bemEstar && (
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.75rem' }}>Bem-estar</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              {Object.entries(sessionData.bemEstar).map(([key, value]) => (
                <div key={key} style={{ textAlign: 'center' }}>
                  <span style={{ color: '#6c757d', fontSize: '0.8rem', textTransform: 'capitalize' }}>{key}</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#495057', marginTop: '0.25rem' }}>{value ?? '-'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sessionData?.dorRegioes?.length > 0 && (
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem' }}>Regiões de dor</strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem', lineHeight: '1.4' }}>{sessionData.dorRegioes.join(', ')}</p>
          </div>
        )}
      </div>
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
            <p style={{ marginTop: 0, marginBottom: '2rem', color: '#546e7a', fontSize: '1.1rem', fontWeight: 400 }}>Avalie seu nível de percepção subjetiva de esforço (PSE Foster) após o treino.</p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="pse-foster-input" style={{ display: 'block', marginBottom: '1rem', fontWeight: 600, color: '#37474f', fontSize: '1.1rem' }}>
                PSE Foster (0-10)
              </label>
              <input
                id="pse-foster-input"
                type="text"
                value={form.pseFoster}
                maxLength={2}
                aria-label="PSE Foster de 0 a 10"
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '');
                  setForm((prev) => ({ ...prev, pseFoster: digits }));
                }}
                className="checkout-input"
                style={{
                  width: '100%',
                  padding: '1.25rem',
                  fontSize: '1.2rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  maxWidth: '200px',
                  boxSizing: 'border-box',
                  textAlign: 'center',
                  fontWeight: 600,
                  color: '#37474f',
                  background: '#fff',
                  transition: 'border-color 0.3s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1976d2'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.9rem', color: '#78909c' }}>Escala de 0 (muito leve) a 10 (máximo esforço)</p>
            </div>
          </div>
        );
      case 3:
        return (
          <div>
            <p style={{ marginTop: 0, marginBottom: '2rem', color: '#546e7a', fontSize: '1.1rem', fontWeight: 400 }}>Quanto tempo você treinou efetivamente?</p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="duracao-input" style={{ display: 'block', marginBottom: '1rem', fontWeight: 600, color: '#37474f', fontSize: '1.1rem' }}>
                Duração em minutos
              </label>
              <input
                id="duracao-input"
                type="text"
                value={form.duracaoMin}
                maxLength={3}
                aria-label="Duração do treino em minutos"
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '');
                  setForm((prev) => ({ ...prev, duracaoMin: digits }));
                }}
                className="checkout-input"
                style={{
                  width: '100%',
                  padding: '1.25rem',
                  fontSize: '1.2rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  maxWidth: '200px',
                  boxSizing: 'border-box',
                  textAlign: 'center',
                  fontWeight: 600,
                  color: '#37474f',
                  background: '#fff',
                  transition: 'border-color 0.3s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1976d2'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.9rem', color: '#78909c' }}>Tempo efetivo de atividade física</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="checkout-page" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando sua sessão...</div>;
  }

  return (
    <div className="checkout-page" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem 1rem' }}>
      <div className="checkout-container" style={{ maxWidth: '700px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', color: '#1a237e', margin: '0 0 1rem 0', fontWeight: 700, letterSpacing: '-0.02em' }}>Check-out</h1>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: '#fff', padding: '0.5rem 1rem', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1976d2', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{progressLabel}</span>
          </div>
          <p style={{ margin: '0', fontSize: '1.1rem', color: '#546e7a', fontWeight: 400, maxWidth: '500px', margin: '0 auto' }}>Finalize sua sessão de treino com as informações necessárias.</p>
        </header>

        <div className="checkout-card" style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '2.5rem', marginBottom: '2rem', border: '1px solid #e8eaf6' }}>
          {success && checkOutData ? (
            <div className="success-message" style={{ textAlign: 'center', padding: '2rem', background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', border: '1px solid #4caf50', borderRadius: '12px', boxShadow: '0 4px 16px rgba(76,175,80,0.2)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ margin: '0 0 1rem 0', fontWeight: 700, color: '#2e7d32', fontSize: '1.5rem' }}>Check-out concluído com sucesso!</h2>
              <p style={{ margin: '0.5rem 0', color: '#388e3c', fontSize: '1.1rem', fontWeight: 500 }}>Horário: {checkOutData.time.toLocaleTimeString('pt-BR')}</p>
              <p style={{ margin: '0.5rem 0', color: '#388e3c', fontSize: '1.1rem', fontWeight: 500 }}>Duração: {formatElapsed(checkOutData.durationMinutes)}</p>
              <p style={{ fontSize: '1rem', marginTop: '1.5rem', color: '#4caf50', fontWeight: 500 }}>PSE Foster: {checkOutData.pseFoster} | Carga: {checkOutData.carga}</p>
            </div>
          ) : !sessionData ? (
            <div className="warning-message" style={{ textAlign: 'center', padding: '2rem', background: 'linear-gradient(135deg, #fff9e6 0%, #ffeaa7 100%)', border: '1px solid #ffb74d', borderRadius: '12px', boxShadow: '0 4px 16px rgba(255,183,77,0.2)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
              <p style={{ margin: '0.5rem 0', fontWeight: 600, color: '#f57c00', fontSize: '1.2rem' }}>Nenhuma sessão ativa encontrada.</p>
              <p style={{ fontSize: '1rem', marginTop: '1.5rem', color: '#bf360c', fontWeight: 500 }}>Comece um treino no Check-in antes de finalizar.</p>
            </div>
          ) : (
            <>
              <div style={{ minHeight: '300px', marginBottom: '2.5rem' }}>
                {renderStepContent()}
              </div>

              {error && <div className="error-message" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)', border: '1px solid #e57373', borderRadius: '8px', color: '#c62828', marginBottom: '2rem', fontSize: '1rem', fontWeight: 500, textAlign: 'center' }}>{error}</div>}

              <div className="checkout-actions" style={{ display: 'flex', gap: '1.25rem', marginTop: '2.5rem' }}>
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={step === 1 || checkingOut}
                  className="secondary-button"
                  style={{ flex: 1, padding: '1rem 2rem', fontSize: '1.1rem', border: '2px solid #e0e0e0', background: '#fff', borderRadius: '8px', cursor: step === 1 || checkingOut ? 'not-allowed' : 'pointer', opacity: step === 1 || checkingOut ? 0.5 : 1, transition: 'all 0.3s ease', fontWeight: 600, color: '#616161' }}
                >
                  ← Anterior
                </button>
                {isLastStep ? (
                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={checkingOut || success}
                    className="checkout-button"
                    style={{ flex: 1, padding: '1rem 2rem', fontSize: '1.1rem', background: checkingOut || success ? '#ccc' : 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: checkingOut || success ? 'not-allowed' : 'pointer', fontWeight: 700, transition: 'all 0.3s ease', boxShadow: checkingOut || success ? 'none' : '0 4px 15px rgba(76,175,80,0.3)' }}
                  >
                    {checkingOut ? '⏳ Finalizando...' : success ? '✅ Finalizado!' : 'Finalizar Check-out →'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={checkingOut}
                    className="checkout-button"
                    style={{ flex: 1, padding: '1rem 2rem', fontSize: '1.1rem', background: checkingOut ? '#ccc' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: checkingOut ? 'not-allowed' : 'pointer', fontWeight: 700, transition: 'all 0.3s ease', boxShadow: checkingOut ? 'none' : '0 4px 15px rgba(25,118,210,0.3)' }}
                  >
                    Próximo →
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