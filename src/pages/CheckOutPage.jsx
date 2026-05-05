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
import { REGION_MAP } from '../components/pain-map/usePainRegions';

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
        <div className="session-summary-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: '0.75rem', padding: '1rem', background: '#fff', borderRadius: '6px', border: '1px solid #e9ecef' }}>
          <div className="session-summary-row-item">
            <strong className="session-summary-label" style={{ color: '#1976d2' }}>
              <span className="label-full">Hora de entrada</span>
              <span className="label-short">Entrada</span>
            </strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#495057', fontSize: '0.95rem', fontWeight: 500 }}>{formatDateTimeForDisplay(sessionData?.dataCheckin)}</p>
          </div>
          <div className="session-summary-row-item" style={{ textAlign: 'right' }}>
            <strong className="session-summary-label" style={{ color: '#1976d2' }}>
              <span className="label-full">Tempo decorrido</span>
              <span className="label-short">Tempo</span>
            </strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#495057', fontSize: '0.95rem', fontWeight: 500 }}>{formatElapsed(elapsedMinutes)}</p>
          </div>
        </div>

        <div className="session-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
          <div className="session-summary-card" style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef', minWidth: 0 }}>
            <strong className="session-summary-label" style={{ color: '#1976d2', marginBottom: '0.5rem' }}>Atividades</strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem', lineHeight: '1.4' }}>{sessionData?.atividades?.length ? sessionData.atividades.join(', ') : 'Nenhuma atividade registrada'}</p>
          </div>

          <div className="session-summary-card" style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef', minWidth: 0 }}>
            <strong className="session-summary-label" style={{ color: '#1976d2', marginBottom: '0.5rem' }}>VFC</strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem' }}>{sessionData?.vfc ? `${sessionData.vfc} ms` : 'Não informado'}</p>
          </div>
        </div>

        <div className="session-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
          <div className="session-summary-card" style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef', minWidth: 0 }}>
            <strong className="session-summary-label" style={{ color: '#1976d2', marginBottom: '0.5rem' }}>
              <span className="label-full">Recuperação</span>
              <span className="label-short">Recup.</span>
            </strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem' }}>{sessionData?.recuperacao || 'Não informado'}</p>
          </div>

          <div className="session-summary-card" style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef', minWidth: 0 }}>
            <strong className="session-summary-label" style={{ color: '#1976d2', marginBottom: '0.5rem' }}>Hidratação</strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem' }}>{sessionData?.hidratacao ? `${sessionData.hidratacao}/10` : 'Não informado'}</p>
          </div>
        </div>

        {sessionData?.bemEstar && (
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            <strong className="session-summary-label" style={{ color: '#1976d2', marginBottom: '0.75rem' }}>Bem-estar</strong>
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
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem', lineHeight: '1.4' }}>
              {sessionData.dorRegioes
                .map((item) =>
                  typeof item === 'string'
                    ? (REGION_MAP.find((r) => r.code === item)?.name ?? item)
                    : item.name
                )
                .join(', ')}
            </p>
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
            <p style={{ marginTop: 0, marginBottom: '1.5rem', color: '#546e7a', fontSize: '1.1rem', fontWeight: 400 }}>
              Como foi o esforço percebido durante o treino?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {[
                { value: 0,  label: 'Repouso',       color: '#2e7d32' },
                { value: 1,  label: 'Muito leve',     color: '#388e3c' },
                { value: 2,  label: 'Muito leve',     color: '#558b2f' },
                { value: 3,  label: 'Leve',           color: '#827717' },
                { value: 4,  label: 'Leve',           color: '#f9a825' },
                { value: 5,  label: 'Moderado',       color: '#ef6c00' },
                { value: 6,  label: 'Moderado',       color: '#e64a19' },
                { value: 7,  label: 'Intenso',        color: '#d32f2f' },
                { value: 8,  label: 'Intenso',        color: '#c62828' },
                { value: 9,  label: 'Muito intenso',  color: '#b71c1c' },
                { value: 10, label: 'Máximo esforço', color: '#880e4f' },
              ].map(({ value, label, color }) => {
                const isSel = String(form.pseFoster) === String(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isSel}
                    aria-label={`PSE ${value}: ${label}`}
                    style={{
                      width: '44px',
                      height: '44px',
                      padding: 0,
                      fontSize: '0.95rem',
                      borderRadius: '8px',
                      border: isSel ? `3px solid ${color}` : '1px solid #ddd',
                      background: isSel ? color : '#fff',
                      color: isSel ? '#fff' : '#546e7a',
                      cursor: 'pointer',
                      fontWeight: isSel ? 700 : 500,
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isSel ? `0 0 0 3px ${color}33` : '0 1px 2px rgba(0,0,0,0.08)',
                      transform: isSel ? 'scale(1.12)' : 'scale(1)',
                    }}
                    onClick={() => setForm((prev) => ({ ...prev, pseFoster: String(value) }))}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            {(() => {
              const PSE_LABELS = ['Repouso','Muito leve','Muito leve','Leve','Leve','Moderado','Moderado','Intenso','Intenso','Muito intenso','Máximo esforço'];
              const PSE_COLORS = ['#2e7d32','#388e3c','#558b2f','#827717','#f9a825','#ef6c00','#e64a19','#d32f2f','#c62828','#b71c1c','#880e4f'];
              const pv = form.pseFoster !== '' ? Number(form.pseFoster) : null;
              return pv !== null && !isNaN(pv) && pv >= 0 && pv <= 10 ? (
                <p style={{ textAlign: 'center', margin: '0.25rem 0 1rem', fontSize: '1rem', fontWeight: 600, color: PSE_COLORS[pv] }}>
                  {pv} — {PSE_LABELS[pv]}
                </p>
              ) : null;
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.4rem', marginTop: '1rem', background: '#f8f9fa', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', color: '#546e7a' }}>
              {[['0','Repouso'],['1–2','Muito leve'],['3–4','Leve'],['5–6','Moderado'],['7–8','Intenso'],['9','Muito intenso'],['10','Máximo esforço']].map(([range, desc]) => (
                <div key={range} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, minWidth: '28px', color: '#37474f' }}>{range}</span>
                  <span>{desc}</span>
                </div>
              ))}
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

              <div className="checkout-actions step-nav-actions" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', width: '100%' }}>
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={step === 1 || checkingOut}
                  className="secondary-button step-nav-button step-nav-secondary"
                  style={{ flex: '1 1 0', minWidth: 0, width: '100%', padding: '0.875rem 1rem', fontSize: '1rem', border: '2px solid #e0e0e0', background: '#fff', borderRadius: '8px', cursor: step === 1 || checkingOut ? 'not-allowed' : 'pointer', opacity: step === 1 || checkingOut ? 0.5 : 1, transition: 'all 0.3s ease', fontWeight: 600, color: '#616161', minHeight: '44px' }}
                >
                  ← Anterior
                </button>
                {isLastStep ? (
                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={checkingOut || success}
                    className="checkout-button step-nav-button step-nav-primary"
                    style={{ flex: '1 1 0', minWidth: 0, width: '100%', padding: '0.875rem 1rem', fontSize: '1rem', background: checkingOut || success ? '#ccc' : 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: checkingOut || success ? 'not-allowed' : 'pointer', fontWeight: 700, transition: 'all 0.3s ease', boxShadow: checkingOut || success ? 'none' : '0 4px 15px rgba(76,175,80,0.3)', minHeight: '44px' }}
                  >
                    {checkingOut ? '⏳ Finalizando...' : success ? '✅ Finalizado!' : 'Finalizar Check-out →'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={checkingOut}
                    className="checkout-button step-nav-button step-nav-primary"
                    style={{ flex: '1 1 0', minWidth: 0, width: '100%', padding: '0.875rem 1rem', fontSize: '1rem', background: checkingOut ? '#ccc' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: checkingOut ? 'not-allowed' : 'pointer', fontWeight: 700, transition: 'all 0.3s ease', boxShadow: checkingOut ? 'none' : '0 4px 15px rgba(25,118,210,0.3)', minHeight: '44px' }}
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