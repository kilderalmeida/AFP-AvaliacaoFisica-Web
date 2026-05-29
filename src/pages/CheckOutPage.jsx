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
  getCurrentUserProfile,
  formatDateTimeForDisplay,
  calculateDurationForDisplay,
} from '../services/sessionService.js';
import {
  formatTrainerAthleteOptionLabel,
  listTrainerAthleteOptions,
  resolveTrainerSelectedAthleteId,
  setStoredTrainerSelectedAthleteId,
} from '../services/trainer-athlete-context.service';
import { useNavigate } from 'react-router-dom';
import { REGION_MAP } from '../components/pain-map/usePainRegions';
import { useUserDisplayNames } from '../hooks/useUserDisplayNames';
import { activityService } from '../services/activity.service';
import {
  FOSTER_PSE_SCALE,
  FOSTER_PSE_MIN,
  FOSTER_PSE_MAX,
  FOSTER_PSE_BANDS,
  getFosterPseLabel,
  getFosterPseColor,
} from '../constants/foster-pse';
import {
  WELL_BEING_LABELS_PT,
} from '../constants/well-being';

function formatElapsed(minutes) {
  if (!minutes) return '0 min';

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
}

const initialForm = {
  pseFoster: null,
  duracaoMin: '',
};

function getFriendlyErrorMessage(error, fallbackMessage) {
  const rawMessage = String(error?.message || '').toLowerCase();
  const rawCode = String(error?.code || '').toLowerCase();

  if (
    rawCode.includes('permission-denied') ||
    rawMessage.includes('missing or insufficient permissions')
  ) {
    return 'Sem permissão para registrar Check-out neste ambiente. Verifique o acesso e tente novamente.';
  }

  return error?.message || fallbackMessage;
}

export default function CheckOutPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [openActivity, setOpenActivity] = useState(null);
  const [checkOutData, setCheckOutData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [profileType, setProfileType] = useState('');
  const [trainerAthletes, setTrainerAthletes] = useState([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState('');
  const [contextLoading, setContextLoading] = useState(true);
  const userDisplayNames = useUserDisplayNames([
    user?.uid,
    selectedAthleteId,
    ...trainerAthletes.map((athlete) => athlete.id),
  ]);
  const isTrainerProfile = profileType === 'trainer' || profileType === 'coach';
  const effectiveAthleteId = isTrainerProfile ? selectedAthleteId : user?.uid;
  const currentAthleteLabel = effectiveAthleteId
    ? userDisplayNames[effectiveAthleteId] || effectiveAthleteId
    : '';
  const athleteContextLabel = isTrainerProfile ? 'Atleta selecionado' : 'Atleta';
  const hasTrainerAthleteOptions = trainerAthletes.length > 0;
  const hasSelectedAthlete = Boolean(selectedAthleteId);
  const shouldShowTrainerEmptyState = isTrainerProfile && (!hasTrainerAthleteOptions || !hasSelectedAthlete);
  const isPageLoading = loading || contextLoading;

  useEffect(() => {
    /**
     * Ao abrir a tela, identifica o usuário atual e busca
     * a sessão ativa para decidir se o check-out pode ser feito.
     */
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setLoading(true);
        setContextLoading(true);
        setError('');
        setUser(currentUser);
        setProfileType('');
        setTrainerAthletes([]);
        setSelectedAthleteId('');

        if (!currentUser) {
          setOpenActivity(null);
          return;
        }

        const profile = await getCurrentUserProfile(currentUser.uid);
        const normalizedProfileType = normalizeProfileType(profile);
        setProfileType(normalizedProfileType);

        let targetAthleteId = currentUser.uid;
        if (normalizedProfileType === 'trainer' || normalizedProfileType === 'coach') {
          const userTypes = Array.isArray(profile?.userTypes) ? profile.userTypes : [];
          const includeSelfAthlete = userTypes.includes('athlete');
          const athletes = await listTrainerAthleteOptions(currentUser.uid, {
            includeSelfAthlete,
          });
          setTrainerAthletes(Array.isArray(athletes) ? athletes : []);

          const initialAthleteId = resolveTrainerSelectedAthleteId(currentUser.uid, athletes);
          setSelectedAthleteId(initialAthleteId);
          setStoredTrainerSelectedAthleteId(currentUser.uid, initialAthleteId);
          targetAthleteId = initialAthleteId;
        }

        if (!targetAthleteId) {
          setOpenActivity(null);
          return;
        }

        const activities = await activityService.listActivitiesByAthlete(targetAthleteId, {
          status: 'open',
          limit: 1,
        });
        setOpenActivity(Array.isArray(activities) ? activities[0] || null : null);
      } catch (err) {
        console.error(err);
        setError('Erro ao verificar sua atividade em aberto. Tente novamente.');
      } finally {
        setLoading(false);
        setContextLoading(false);
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

  useEffect(() => {
    if (!user || !isTrainerProfile || !selectedAthleteId) {
      return;
    }

    const syncOpenActivity = async () => {
      try {
        setLoading(true);
        setError('');

        const activities = await activityService.listActivitiesByAthlete(selectedAthleteId, {
          status: 'open',
          limit: 1,
        });
        setOpenActivity(Array.isArray(activities) ? activities[0] || null : null);
      } catch (err) {
        console.error(err);
        setError('Erro ao verificar sua atividade em aberto. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    void syncOpenActivity();
  }, [user, isTrainerProfile, selectedAthleteId]);

  /**
   * Calcula o tempo decorrido apenas para exibição da UI.
   * A persistência final continua sendo feita no service.
   */
  const elapsedMinutes = useMemo(() => {
    const startedAt = openActivity?.checkin?.createdAt || openActivity?.activityDate;
    if (!startedAt) return 0;
    return calculateDurationForDisplay(startedAt);
  }, [openActivity]);

  const totalSteps = 3;
  const isLastStep = step === totalSteps;
  const progressLabel = `Etapa ${step} de ${totalSteps}`;

  const validateStep = () => {
    if (step === 2) {
      const pseValue = form.pseFoster;
      if (typeof pseValue !== 'number' || !Number.isInteger(pseValue)) {
        return `Informe um valor de PSE Foster entre ${FOSTER_PSE_MIN} e ${FOSTER_PSE_MAX}.`;
      }
      if (pseValue < FOSTER_PSE_MIN || pseValue > FOSTER_PSE_MAX) {
        return `PSE Foster deve estar entre ${FOSTER_PSE_MIN} e ${FOSTER_PSE_MAX}.`;
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

      if (!effectiveAthleteId) {
        throw new Error('Selecione um atleta para registrar o Check-out.');
      }

      if (!openActivity?.id) {
        throw new Error('Nenhuma atividade em aberto encontrada.');
      }

      const duracaoMin = Number(form.duracaoMin);
      if (!Number.isFinite(duracaoMin) || duracaoMin < 1) {
        throw new Error('Informe a duração em minutos (mínimo 1 minuto).');
      }

      const payload = {
        pseFoster: form.pseFoster,
        duracaoMin,
      };

      await activityService.setActivityCheckout(
        openActivity.id,
        {
          createdAt: new Date(),
          pse: payload.pseFoster,
          recovery: 'Check-out concluído',
          notes: '',
        },
        user.uid
      );
      await activityService.updateActivity(
        openActivity.id,
        { durationMinutes: payload.duracaoMin, status: 'completed' },
        user.uid
      );

      const result = {
        time: new Date(),
        durationMinutes: payload.duracaoMin,
        pseFoster: payload.pseFoster,
        carga: payload.pseFoster * payload.duracaoMin,
        status: 'sucesso',
      };

      setCheckOutData(result);
      setSuccess(true);
      setOpenActivity(null);
    } catch (err) {
      console.error(err);
      setError(getFriendlyErrorMessage(err, 'Erro ao registrar Check-out. Tente novamente.'));
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
            <p style={{ margin: '0.25rem 0 0 0', color: '#495057', fontSize: '0.95rem', fontWeight: 500 }}>{formatDateTimeForDisplay(openActivity?.checkin?.createdAt || openActivity?.activityDate)}</p>
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
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem', lineHeight: '1.4' }}>{openActivity?.activityType || 'Nenhuma atividade registrada'}</p>
          </div>

          <div className="session-summary-card" style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef', minWidth: 0 }}>
            <strong className="session-summary-label" style={{ color: '#1976d2', marginBottom: '0.5rem' }}>VFC</strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem' }}>{openActivity?.checkin?.hrv ? `${openActivity.checkin.hrv} ms` : 'Não informado'}</p>
          </div>
        </div>

        <div className="session-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
          <div className="session-summary-card" style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef', minWidth: 0 }}>
            <strong className="session-summary-label" style={{ color: '#1976d2', marginBottom: '0.5rem' }}>
              <span className="label-full">Recuperação</span>
              <span className="label-short">Recup.</span>
            </strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem' }}>Será informada no check-out</p>
          </div>

          <div className="session-summary-card" style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef', minWidth: 0 }}>
            <strong className="session-summary-label" style={{ color: '#1976d2', marginBottom: '0.5rem' }}>Hidratação</strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem' }}>{openActivity?.checkin?.hydration ? `${openActivity.checkin.hydration}/8` : 'Não informado'}</p>
          </div>
        </div>

        {openActivity?.checkin?.wellBeing && Object.keys(openActivity.checkin.wellBeing).length > 0 && (
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            <strong className="session-summary-label" style={{ color: '#1976d2', marginBottom: '0.75rem' }}>Bem-estar (pré-treino)</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              {Object.entries(openActivity.checkin.wellBeing).map(([key, value]) => (
                <div key={key} style={{ textAlign: 'center' }}>
                  <span style={{ color: '#6c757d', fontSize: '0.8rem' }}>{WELL_BEING_LABELS_PT[key] || key}</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#495057', marginTop: '0.25rem' }}>{value ?? '-'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {openActivity?.checkin?.painRegions?.length > 0 && (
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem' }}>Regiões de dor</strong>
            <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem', lineHeight: '1.4' }}>
              {openActivity.checkin.painRegions
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
            <p>
              {isTrainerProfile
                ? 'Confira as informações do check-in do atleta antes de finalizar.'
                : 'Confira as informações do seu check-in antes de finalizar.'}
            </p>
            {renderSessionSummary()}
          </div>
        );
      case 2:
        return (
          <div>
            <p style={{ marginTop: 0, marginBottom: '1.5rem', color: '#546e7a', fontSize: '1.1rem', fontWeight: 400 }}>
              {isTrainerProfile
                ? 'Como foi o esforço percebido pelo atleta durante o treino?'
                : 'Como foi o esforço percebido durante o treino?'}
            </p>
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
                Escala Foster de PSE (0 a 10)
              </legend>
              <div
                role="radiogroup"
                aria-label="Escala Foster de PSE"
                style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}
              >
                {FOSTER_PSE_SCALE.map(({ level, label, color }) => {
                  const isSel = form.pseFoster === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      role="radio"
                      aria-checked={isSel}
                      aria-label={`PSE ${level}: ${label}`}
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
                      onClick={() => setForm((prev) => ({ ...prev, pseFoster: level }))}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {(() => {
              const pv = form.pseFoster;
              if (typeof pv !== 'number' || pv < FOSTER_PSE_MIN || pv > FOSTER_PSE_MAX) return null;
              const pseLabel = getFosterPseLabel(pv);
              const pseColor = getFosterPseColor(pv);
              return (
                <p style={{ textAlign: 'center', margin: '0.25rem 0 1rem', fontSize: '1rem', fontWeight: 600, color: pseColor }}>
                  {pv} — {pseLabel}
                </p>
              );
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.4rem', marginTop: '1rem', background: '#f8f9fa', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', color: '#546e7a' }}>
              {FOSTER_PSE_BANDS.map(({ min, max, label }) => (
                <div key={`${min}-${max}`} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, minWidth: '28px', color: '#37474f' }}>{min === max ? `${min}` : `${min}-${max}`}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div>
            <p style={{ marginTop: 0, marginBottom: '2rem', color: '#546e7a', fontSize: '1.1rem', fontWeight: 400 }}>
              {isTrainerProfile
                ? 'Quanto tempo o atleta treinou efetivamente?'
                : 'Quanto tempo você treinou efetivamente?'}
            </p>
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

  if (isPageLoading) {
    return <div className="checkout-page" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando sua sessão...</div>;
  }

  return (
    <div className="checkout-page" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem 1rem' }}>
      <div className="checkout-container" style={{ maxWidth: '700px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', color: '#1a237e', margin: '0 0 1rem 0', fontWeight: 700, letterSpacing: '-0.02em' }}>Check-out</h1>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#607d8b', fontWeight: 500 }}>
            {athleteContextLabel}: {currentAthleteLabel || 'Não definido'}
          </p>
          {isTrainerProfile && (
            <div style={{ marginBottom: '1rem', display: 'grid', gap: '0.5rem', justifyItems: 'center' }}>
              <label htmlFor="trainer-athlete-select-checkout" style={{ fontSize: '0.9rem', color: '#455a64', fontWeight: 600 }}>
                Selecione o atleta para este Check-out
              </label>
              <select
                id="trainer-athlete-select-checkout"
                value={selectedAthleteId}
                onChange={(event) => {
                  const nextAthleteId = event.target.value;
                  setSelectedAthleteId(nextAthleteId);
                  if (user?.uid) {
                    setStoredTrainerSelectedAthleteId(user.uid, nextAthleteId);
                  }
                }}
                style={{ minHeight: '44px', borderRadius: '8px', border: '1px solid #cfd8dc', padding: '0 0.75rem', minWidth: '260px', maxWidth: '100%' }}
              >
                {!hasTrainerAthleteOptions ? (
                  <option value="">Nenhum atleta vinculado</option>
                ) : (
                  trainerAthletes.map((athlete) => (
                    <option key={athlete.id} value={athlete.id}>
                      {formatTrainerAthleteOptionLabel(
                        athlete.id,
                        userDisplayNames[athlete.id] || athlete.id,
                        trainerAthletes
                      )}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: '#fff', padding: '0.5rem 1rem', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1976d2', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{progressLabel}</span>
          </div>
          <p style={{ margin: '0', fontSize: '1.1rem', color: '#546e7a', fontWeight: 400, maxWidth: '500px', margin: '0 auto' }}>
            {isTrainerProfile
              ? 'Finalize o treino do atleta selecionado com as informações necessárias.'
              : 'Finalize sua sessão de treino com as informações necessárias.'}
          </p>
        </header>

        <div className="checkout-card" style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '2.5rem', marginBottom: '2rem', border: '1px solid #e8eaf6' }}>
          {shouldShowTrainerEmptyState ? (
            <div className="warning-message" style={{ textAlign: 'center', padding: '2rem', background: 'linear-gradient(135deg, #fff9e6 0%, #ffeaa7 100%)', border: '1px solid #ffb74d', borderRadius: '12px', boxShadow: '0 4px 16px rgba(255,183,77,0.2)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>👥</div>
              <p style={{ margin: '0.5rem 0', fontWeight: 600, color: '#f57c00', fontSize: '1.2rem' }}>Nenhum atleta selecionado para Check-out.</p>
              <p style={{ fontSize: '1rem', marginTop: '1.5rem', color: '#bf360c', fontWeight: 500 }}>
                Selecione um atleta vinculado para consultar e finalizar o treino dele.
              </p>
            </div>
          ) : success && checkOutData ? (
            <div className="success-message" style={{ textAlign: 'center', padding: '2rem', background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', border: '1px solid #4caf50', borderRadius: '12px', boxShadow: '0 4px 16px rgba(76,175,80,0.2)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ margin: '0 0 1rem 0', fontWeight: 700, color: '#2e7d32', fontSize: '1.5rem' }}>Check-out concluído com sucesso!</h2>
              <p style={{ margin: '0.5rem 0', color: '#388e3c', fontSize: '1.1rem', fontWeight: 500 }}>Horário: {checkOutData.time.toLocaleTimeString('pt-BR')}</p>
              <p style={{ margin: '0.5rem 0', color: '#388e3c', fontSize: '1.1rem', fontWeight: 500 }}>Duração: {formatElapsed(checkOutData.durationMinutes)}</p>
              <p style={{ fontSize: '1rem', marginTop: '1.5rem', color: '#4caf50', fontWeight: 500 }}>PSE Foster: {checkOutData.pseFoster} | Carga: {checkOutData.carga}</p>
            </div>
          ) : !openActivity ? (
            <div className="warning-message" style={{ textAlign: 'center', padding: '2rem', background: 'linear-gradient(135deg, #fff9e6 0%, #ffeaa7 100%)', border: '1px solid #ffb74d', borderRadius: '12px', boxShadow: '0 4px 16px rgba(255,183,77,0.2)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
              <p style={{ margin: '0.5rem 0', fontWeight: 600, color: '#f57c00', fontSize: '1.2rem' }}>Nenhuma atividade em aberto encontrada.</p>
              <p style={{ fontSize: '1rem', marginTop: '1.5rem', color: '#bf360c', fontWeight: 500 }}>
                {isTrainerProfile
                  ? 'Inicie o treino do atleta no Check-in para depois concluir aqui no Check-out.'
                  : 'Faça Check-in para iniciar um treino antes de finalizar.'}
              </p>
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

function normalizeProfileType(profile) {
  return String(profile?.papel || '')
    .normalize('NFC')
    .trim()
    .toLowerCase();
}