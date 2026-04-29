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
import { useNavigate } from 'react-router-dom';
import { PainMap, usePainRegions } from '../components/pain-map';

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
  const navigate = useNavigate();
  const {
    selected,
    toggleRegion,
    selectedRegionDetails,
    buildPainMapPayload,
  } = usePainRegions();
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
    // Mantem o estado global do wizard alinhado com o novo mapa de dor.
    setForm((prev) => ({
      ...prev,
      dorRegioes: selectedRegionDetails,
    }));
  }, [selectedRegionDetails]);

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
        setError('Erro ao verificar sessão ativa. Tente novamente.');
      } finally {
        setPageLoading(false);
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
        dorRegioes: buildPainMapPayload(),
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
            <p style={{ marginTop: 0, marginBottom: '1.5rem', color: '#555', fontSize: '1rem' }}>Selecione as atividades realizadas:</p>
            <div className="checkin-options-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {activityOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`checkin-chip ${form.atividades.includes(option) ? 'selected' : ''}`}
                  style={{
                    padding: '0.75rem 1.25rem',
                    fontSize: '0.95rem',
                    borderRadius: '20px',
                    border: form.atividades.includes(option) ? '2px solid #1565c0' : '1px solid #ccc',
                    background: form.atividades.includes(option) ? '#1565c0' : '#fff',
                    color: form.atividades.includes(option) ? '#fff' : '#555',
                    cursor: 'pointer',
                    fontWeight: form.atividades.includes(option) ? 600 : 400,
                    transition: 'all 0.2s',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      atividades: toggleSelection(prev.atividades, option),
                    }))
                  }
                  aria-pressed={form.atividades.includes(option)}
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
            <p style={{ marginTop: 0, marginBottom: '1.5rem', color: '#555', fontSize: '1rem' }}>Informe o VFC:</p>
            <label htmlFor="vfc-input" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#333' }}>
              VFC em ms
            </label>
            <input
              id="vfc-input"
              type="text"
              value={form.vfc}
              maxLength={4}
              aria-label="Frequência variabilidade cardíaca em milissegundos"
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '');
                setForm((prev) => ({ ...prev, vfc: digits }));
              }}
              className="checkin-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                maxWidth: '200px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        );
      case 3:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <p style={{ marginTop: 0, marginBottom: '2rem', color: '#555', fontSize: '1.1rem', maxWidth: '400px' }}>Como você está se sentindo?</p>
            <div className="checkin-wellbeing-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center', width: '100%', maxWidth: '500px' }}>
              {Object.entries(form.bemEstar).map(([key, value]) => (
                <div key={key} className="checkin-wellbeing-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', width: '100%' }}>
                  <label style={{ fontWeight: 600, color: '#333', fontSize: '1rem', textAlign: 'center' }}>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                  <div className="checkin-scale-row" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        className={`checkin-chip ${value === score ? 'selected' : ''}`}
                        style={{
                          width: '44px',
                          height: '44px',
                          padding: 0,
                          fontSize: '0.95rem',
                          borderRadius: '8px',
                          border: value === score ? '2px solid #1565c0' : '1px solid #ccc',
                          background: value === score ? '#1565c0' : '#fff',
                          color: value === score ? '#fff' : '#555',
                          cursor: 'pointer',
                          fontWeight: value === score ? 600 : 400,
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
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
            <p style={{ marginTop: 0, marginBottom: '1.5rem', color: '#555', fontSize: '1rem' }}>Selecione a recuperação:</p>
            <div className="checkin-options-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {recoveryOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`checkin-chip ${form.recuperacao === option ? 'selected' : ''}`}
                  style={{
                    padding: '0.75rem 1.25rem',
                    fontSize: '0.95rem',
                    borderRadius: '20px',
                    border: form.recuperacao === option ? '2px solid #1565c0' : '1px solid #ccc',
                    background: form.recuperacao === option ? '#1565c0' : '#fff',
                    color: form.recuperacao === option ? '#fff' : '#555',
                    cursor: 'pointer',
                    fontWeight: form.recuperacao === option ? 600 : 400,
                    transition: 'all 0.2s',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
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
            <p style={{ marginTop: 0, marginBottom: '1.5rem', color: '#555', fontSize: '1rem' }}>
              Selecione as regiões de dor no mapa corporal:
            </p>

            <div style={{ display: 'grid', gap: '1rem', justifyItems: 'center' }}>
              <PainMap selectedRegions={selected} onSelect={toggleRegion} />

              <div style={{ width: '100%', maxWidth: '560px' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#333' }}>
                  Regiões selecionadas
                </h3>

                {selectedRegionDetails.length === 0 ? (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.95rem' }}>
                    Nenhuma região marcada. Clique nas áreas do corpo para indicar dor.
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.5rem' }}>
                    {selectedRegionDetails.map((region) => (
                      <li key={region.code} style={{ fontSize: '0.95rem', color: '#333' }}>
                        <strong>{region.name}</strong> ({region.code}) - intensidade {region.intensity}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      case 6:
        return (
          <div>
            <p style={{ marginTop: 0, marginBottom: '1.5rem', color: '#555', fontSize: '1rem' }}>Escolha seu nível de hidratação:</p>
            <div className="checkin-scale-row" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`checkin-chip ${form.hidratacao === value ? 'selected' : ''}`}
                  style={{
                    width: '44px',
                    height: '44px',
                    padding: 0,
                    fontSize: '0.95rem',
                    borderRadius: '6px',
                    border: form.hidratacao === value ? '2px solid #1565c0' : '1px solid #ccc',
                    background: form.hidratacao === value ? '#1565c0' : '#fff',
                    color: form.hidratacao === value ? '#fff' : '#555',
                    cursor: 'pointer',
                    fontWeight: form.hidratacao === value ? 600 : 400,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
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
    return <div className="checkin-page">Carregando dados da sessão...</div>;
  }

  return (
    <div className="checkin-page" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem 1rem' }}>
      <div className="checkin-container" style={{ maxWidth: '700px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', color: '#1a237e', margin: '0 0 1rem 0', fontWeight: 700, letterSpacing: '-0.02em' }}>Check-in</h1>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: '#fff', padding: '0.5rem 1rem', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1976d2', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{progressLabel}</span>
          </div>
          <p style={{ margin: '0', fontSize: '1.1rem', color: '#546e7a', fontWeight: 400, maxWidth: '500px', margin: '0 auto' }}>Complete as informações do seu check-in para iniciar o treino.</p>
        </header>

        <div className="checkin-card" style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '2.5rem', marginBottom: '2rem', border: '1px solid #e8eaf6' }}>
          {success && checkInData ? (
            <div className="success-message" style={{ textAlign: 'center', padding: '2rem', background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', border: '1px solid #4caf50', borderRadius: '12px', boxShadow: '0 4px 16px rgba(76,175,80,0.2)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ margin: '0 0 1rem 0', fontWeight: 700, color: '#2e7d32', fontSize: '1.5rem' }}>Check-in registrado com sucesso!</h2>
              <p style={{ margin: '0.5rem 0', color: '#388e3c', fontSize: '1.1rem', fontWeight: 500 }}>Horário: {checkInData.time.toLocaleTimeString('pt-BR')}</p>
              <p style={{ fontSize: '1rem', marginTop: '1.5rem', color: '#4caf50', fontWeight: 500 }}>Sua sessão de treino está ativa. Finalize-a no Check-out.</p>
            </div>
          ) : activeSession ? (
            <div className="warning-message" style={{ textAlign: 'center', padding: '2rem', background: 'linear-gradient(135deg, #fff9e6 0%, #ffeaa7 100%)', border: '1px solid #ffb74d', borderRadius: '12px', boxShadow: '0 4px 16px rgba(255,183,77,0.2)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
              <p style={{ margin: '0.5rem 0', fontWeight: 600, color: '#f57c00', fontSize: '1.2rem' }}>Você já possui um treino em andamento.</p>
              <p style={{ margin: '0.5rem 0', color: '#e65100', fontSize: '1rem' }}>Início: {formatDateTimeForDisplay(activeSession.dataCheckin)}</p>
              <p style={{ fontSize: '0.95rem', marginTop: '1.5rem', color: '#bf360c', fontWeight: 500 }}>Finalize no Check-out antes de iniciar um novo.</p>
            </div>
          ) : (
            <>
              <div style={{ minHeight: '250px', marginBottom: '2.5rem' }}>
                {stepContent()}
              </div>

              {error && <div className="error-message" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)', border: '1px solid #e57373', borderRadius: '8px', color: '#c62828', marginBottom: '2rem', fontSize: '1rem', fontWeight: 500, textAlign: 'center' }}>{error}</div>}

              <div className="checkin-actions" style={{ display: 'flex', gap: '1.25rem', marginTop: '2.5rem' }}>
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={step === 1 || loading}
                  className="secondary-button"
                  style={{ flex: 1, padding: '1rem 2rem', fontSize: '1.1rem', border: '2px solid #e0e0e0', background: '#fff', borderRadius: '8px', cursor: step === 1 || loading ? 'not-allowed' : 'pointer', opacity: step === 1 || loading ? 0.5 : 1, transition: 'all 0.3s ease', fontWeight: 600, color: '#616161' }}
                >
                  ← Anterior
                </button>
                {isLastStep ? (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || success}
                    className="checkin-button"
                    style={{ flex: 1, padding: '1rem 2rem', fontSize: '1.1rem', background: loading || success ? '#ccc' : 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: loading || success ? 'not-allowed' : 'pointer', fontWeight: 700, transition: 'all 0.3s ease', boxShadow: loading || success ? 'none' : '0 4px 15px rgba(76,175,80,0.3)' }}
                  >
                    {loading ? '⏳ Registrando...' : success ? '✅ Registrado!' : 'Finalizar Check-in →'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={loading}
                    className="checkin-button"
                    style={{ flex: 1, padding: '1rem 2rem', fontSize: '1.1rem', background: loading ? '#ccc' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, transition: 'all 0.3s ease', boxShadow: loading ? 'none' : '0 4px 15px rgba(25,118,210,0.3)' }}
                  >
                    Próximo →
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {activeSession && (
          <div className="checkin-info" style={{ background: '#fafafa', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '1.5rem', border: '1px solid #f0f0f0' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', color: '#424242', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>📊 Informações da Sessão</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e8eaf6' }}>
                <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Última entrada</strong>
                <p style={{ margin: '0.5rem 0 0 0', color: '#424242', fontSize: '0.95rem' }}>{activeSession ? formatDateTimeForDisplay(activeSession.dataCheckin) : '-'}</p>
              </div>
              <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e8eaf6' }}>
                <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</strong>
                <p style={{ margin: '0.5rem 0 0 0', color: '#424242', fontSize: '0.95rem' }}>{activeSession ? 'Sessão aberta' : 'Sem sessão ativa'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

