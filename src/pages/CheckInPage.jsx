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
  getCurrentUserProfile,
  formatDateTimeForDisplay,
} from '../services/sessionService.js';
import {
  formatTrainerAthleteOptionLabel,
  listTrainerAthleteOptions,
  resolveTrainerSelectedAthleteId,
  setStoredTrainerSelectedAthleteId,
} from '../services/trainer-athlete-context.service';
import { useNavigate } from 'react-router-dom';
import { PainMap, usePainRegions } from '../components/pain-map';
import {
  HYDRATION_SCALE,
  HYDRATION_MIN,
  HYDRATION_MAX,
  getHydrationInterpretation,
} from '../constants/hydration';
import {
  WELL_BEING_LABELS_PT,
  WELL_BEING_KEYS,
  WELL_BEING_MIN,
  WELL_BEING_MAX,
} from '../constants/well-being';
import { useUserDisplayNames } from '../hooks/useUserDisplayNames';
import { activityService } from '../services/activity.service';

const ELIGIBILITY_STATUS = {
  ELIGIBLE: 'eligible',
  BLOCKED_OPEN_SESSION: 'blocked_open_session',
  UNAVAILABLE: 'unavailable',
};

const ELIGIBILITY_CONTEXT = {
  NO_HISTORY: 'no_history',
  LAST_COMPLETED: 'last_completed',
  LAST_CANCELED: 'last_canceled',
  IN_PROGRESS: 'in_progress',
  UNKNOWN: 'unknown',
};

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
  wellBeing: {
    sleep: 3,
    mood: 3,
    fatigue: 3,
    pain: 3,
    stress: 3,
  },
  recuperacao: 'Boa',
  dorRegioes: [],
  hidratacao: 4,
};

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isValidWellBeingValue(v) {
  return Number.isFinite(v) && v >= WELL_BEING_MIN && v <= WELL_BEING_MAX;
}

function toggleSelection(list, item) {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}

function getFriendlyErrorMessage(error, fallbackMessage) {
  const rawMessage = String(error?.message || '').toLowerCase();
  const rawCode = String(error?.code || '').toLowerCase();

  if (
    rawCode.includes('permission-denied') ||
    rawMessage.includes('missing or insufficient permissions')
  ) {
    return 'Sem permissão para registrar Check-in neste ambiente. Verifique o acesso e tente novamente.';
  }

  return error?.message || fallbackMessage;
}

function getBlockedCheckInMessage() {
  return 'Você já possui uma sessão/atividade em aberto.';
}

function getEligibilityUnavailableMessage() {
  return 'Não foi possível validar sua elegibilidade para Check-in agora.';
}

function getEligibilityBusinessMessage(isTrainerProfile, contextState) {
  if (contextState === ELIGIBILITY_CONTEXT.IN_PROGRESS) {
    return isTrainerProfile
      ? 'Existe um treino em andamento para esta atleta.'
      : 'Existe um treino em andamento para você.';
  }

  if (contextState === ELIGIBILITY_CONTEXT.LAST_COMPLETED) {
    return isTrainerProfile
      ? 'Não há treino em andamento para esta atleta. Você pode iniciar um novo check-in.'
      : 'Não há treino em andamento para você. Você pode iniciar um novo check-in.';
  }

  if (contextState === ELIGIBILITY_CONTEXT.LAST_CANCELED) {
    return isTrainerProfile
      ? 'Não há treino em andamento para esta atleta. Você pode iniciar um novo check-in.'
      : 'Não há treino em andamento para você. Você pode iniciar um novo check-in.';
  }

  if (contextState === ELIGIBILITY_CONTEXT.NO_HISTORY) {
    return isTrainerProfile
      ? 'Não há treino em andamento para esta atleta. Você pode iniciar um novo check-in.'
      : 'Não há treino em andamento para você. Você pode iniciar um novo check-in.';
  }

  return isTrainerProfile
    ? 'Não há treino em andamento para esta atleta. Você pode iniciar um novo check-in.'
    : 'Não há treino em andamento para você. Você pode iniciar um novo check-in.';
}

function normalizeProfileType(profile) {
  return String(profile?.papel || '')
    .normalize('NFC')
    .trim()
    .toLowerCase();
}

export default function CheckInPage() {
  const navigate = useNavigate();
  const {
    selected,
    toggleRegion,
    selectedRegionDetails,
  } = usePainRegions();
  const [user, setUser] = useState(null);
  const [checkInData, setCheckInData] = useState(null);
  const [openActivity, setOpenActivity] = useState(null);
  const [eligibilityStatus, setEligibilityStatus] = useState(ELIGIBILITY_STATUS.ELIGIBLE);
  const [eligibilityContextState, setEligibilityContextState] = useState(ELIGIBILITY_CONTEXT.NO_HISTORY);
  const [eligibilitySource, setEligibilitySource] = useState('none');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
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
  const isTrainerProfile = profileType === 'treinador';
  const effectiveAthleteId = isTrainerProfile ? selectedAthleteId : user?.uid;
  const currentAthleteLabel = effectiveAthleteId
    ? userDisplayNames[effectiveAthleteId] || effectiveAthleteId
    : '';
  const athleteContextLabel = isTrainerProfile ? 'Atleta selecionado' : 'Atleta';
  const hasTrainerAthleteOptions = trainerAthletes.length > 0;
  const hasSelectedAthlete = Boolean(selectedAthleteId);
  const shouldShowTrainerEmptyState = isTrainerProfile && (!hasTrainerAthleteOptions || !hasSelectedAthlete);
  const isPageLoading = pageLoading || contextLoading;
  const hasOpenTraining = Boolean(openActivity);
  const isBlockedByOpenSession = eligibilityStatus === ELIGIBILITY_STATUS.BLOCKED_OPEN_SESSION;
  const isEligibilityUnavailable = eligibilityStatus === ELIGIBILITY_STATUS.UNAVAILABLE;
  const isCheckInBlocked =
    isBlockedByOpenSession ||
    isEligibilityUnavailable;

  const resolveEligibility = async (uid, context = {}) => {
    const actorUserId = context.actorUserId || user?.uid || '';
    const asTrainer = Boolean(context.asTrainer ?? isTrainerProfile);

    const openQuery = asTrainer && actorUserId
      ? activityService.listActivitiesByTrainer(actorUserId, {
          athleteUserId: uid,
          status: 'open',
          limit: 1,
          includeLinkedAthletes: false,
        })
      : activityService.listActivitiesByAthlete(uid, { status: 'open', limit: 1 });

    const latestQuery = asTrainer && actorUserId
      ? activityService.listActivitiesByTrainer(actorUserId, {
          athleteUserId: uid,
          limit: 1,
          includeLinkedAthletes: false,
        })
      : activityService.listActivitiesByAthlete(uid, { limit: 1 });

    const [openActivityResult, latestActivityResult] = await Promise.allSettled([
      openQuery,
      latestQuery,
    ]);

    const openActivities = openActivityResult.status === 'fulfilled' ? openActivityResult.value : [];
    const latestActivities = latestActivityResult.status === 'fulfilled' ? latestActivityResult.value : [];

    const activity = Array.isArray(openActivities) ? openActivities[0] || null : null;
    const latestActivity = Array.isArray(latestActivities) ? latestActivities[0] || null : null;
    const hasOpen = Boolean(activity);
    const hasReadFailure = openActivityResult.status === 'rejected';

    const failedSources = [];
    if (openActivityResult.status === 'rejected') failedSources.push('open-activity');
    if (latestActivityResult.status === 'rejected') failedSources.push('latest-activity');

    const openSources = [];
    if (activity) openSources.push('activity');

    let contextState = ELIGIBILITY_CONTEXT.NO_HISTORY;
    if (hasOpen) {
      contextState = ELIGIBILITY_CONTEXT.IN_PROGRESS;
    } else if (latestActivity?.status === 'completed') {
      contextState = ELIGIBILITY_CONTEXT.LAST_COMPLETED;
    } else if (latestActivity?.status === 'canceled') {
      contextState = ELIGIBILITY_CONTEXT.LAST_CANCELED;
    } else if (latestActivity) {
      contextState = ELIGIBILITY_CONTEXT.UNKNOWN;
    }

    let status = ELIGIBILITY_STATUS.ELIGIBLE;
    if (hasOpen) {
      status = ELIGIBILITY_STATUS.BLOCKED_OPEN_SESSION;
    } else if (hasReadFailure) {
      status = ELIGIBILITY_STATUS.UNAVAILABLE;
    }

    return {
      status,
      activity,
      contextState,
      source: hasOpen ? openSources.join('+') || 'unknown' : failedSources.join('+') || 'none',
      canStart: status === ELIGIBILITY_STATUS.ELIGIBLE,
    };
  };

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
        setContextLoading(true);
        setError('');
        setUser(currentUser);
        setProfileType('');
        setTrainerAthletes([]);
        setSelectedAthleteId('');

        if (!currentUser) {
          setOpenActivity(null);
          setEligibilityStatus(ELIGIBILITY_STATUS.ELIGIBLE);
          setEligibilityContextState(ELIGIBILITY_CONTEXT.NO_HISTORY);
          setEligibilitySource('none');
          return;
        }

        const profile = await getCurrentUserProfile(currentUser.uid);
        const normalizedProfileType = normalizeProfileType(profile);
        setProfileType(normalizedProfileType);

        let targetAthleteId = currentUser.uid;
        if (normalizedProfileType === 'treinador') {
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
          setEligibilityStatus(ELIGIBILITY_STATUS.ELIGIBLE);
          setEligibilityContextState(ELIGIBILITY_CONTEXT.NO_HISTORY);
          setEligibilitySource('none');
          return;
        }

        const eligibility = await resolveEligibility(targetAthleteId, {
          asTrainer: normalizedProfileType === 'treinador',
          actorUserId: currentUser.uid,
        });
        setOpenActivity(eligibility.activity);
        setEligibilityStatus(eligibility.status);
        setEligibilityContextState(eligibility.contextState);
        setEligibilitySource(eligibility.source);
      } catch (err) {
        console.error(err);
        setError('Erro ao verificar sessão ativa. Tente novamente.');
      } finally {
        setPageLoading(false);
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

    const syncEligibility = async () => {
      try {
        setPageLoading(true);
        setError('');

        const eligibility = await resolveEligibility(selectedAthleteId, {
          asTrainer: isTrainerProfile,
          actorUserId: user.uid,
        });
        setOpenActivity(eligibility.activity);
        setEligibilityStatus(eligibility.status);
        setEligibilityContextState(eligibility.contextState);
        setEligibilitySource(eligibility.source);
      } catch (err) {
        console.error(err);
        setError('Erro ao verificar sessão ativa. Tente novamente.');
      } finally {
        setPageLoading(false);
      }
    };

    void syncEligibility();
  }, [user, isTrainerProfile, selectedAthleteId]);

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

    if (step === 6 && (form.hidratacao < HYDRATION_MIN || form.hidratacao > HYDRATION_MAX)) {
      return `Selecione um nível de hidratação entre ${HYDRATION_MIN} e ${HYDRATION_MAX}.`;
    }

    return '';
  };

  const handleNext = () => {
    if (isCheckInBlocked) {
      setError(isBlockedByOpenSession ? getBlockedCheckInMessage() : getEligibilityUnavailableMessage());
      return;
    }

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

      if (!effectiveAthleteId) {
        throw new Error('Selecione um atleta para registrar o Check-in.');
      }

      const eligibility = await resolveEligibility(effectiveAthleteId);
      setOpenActivity(eligibility.activity);
      setEligibilityStatus(eligibility.status);
      setEligibilityContextState(eligibility.contextState);
      setEligibilitySource(eligibility.source);

      if (!eligibility.canStart) {
        throw new Error(
          eligibility.status === ELIGIBILITY_STATUS.BLOCKED_OPEN_SESSION
            ? getBlockedCheckInMessage()
            : getEligibilityUnavailableMessage()
        );
      }

      const wellBeingPayload = {};
      for (const key of WELL_BEING_KEYS) {
        const v = clampValue(Number(form.wellBeing[key]), WELL_BEING_MIN, WELL_BEING_MAX);
        if (isValidWellBeingValue(v)) {
          wellBeingPayload[key] = v;
        }
      }

      const payload = {
        atividades: form.atividades,
        vfc: Number(form.vfc) || 0,
        wellBeing: wellBeingPayload,
        recuperacao: form.recuperacao,
        dorRegioes: form.dorRegioes,
        hidratacao: clampValue(Number(form.hidratacao), HYDRATION_MIN, HYDRATION_MAX),
      };

      const primaryActivity = Array.isArray(payload.atividades) && payload.atividades.length > 0
        ? payload.atividades[0]
        : 'Treino';

      const activityPayload = {
        athleteUserId: effectiveAthleteId,
        recordedByUserId: user.uid,
        academyId: 'academy-1',
        trainerUserId: user.uid,
        activityDate: new Date(),
        activityType: primaryActivity,
        modality: primaryActivity,
        durationMinutes: 0,
        status: 'open',
        checkin: {
          createdAt: new Date(),
          hydration: payload.hidratacao,
          hrv: payload.vfc,
          painRegions: payload.dorRegioes,
          notes: `Recuperação: ${payload.recuperacao}.`,
          wellBeing: payload.wellBeing,
        },
      };

      const createdActivityId = await activityService.createActivity(activityPayload, user.uid);

      setCheckInData({
        id: createdActivityId,
        time: new Date(),
        status: 'sucesso',
      });
      setOpenActivity({
        id: createdActivityId,
        activityDate: new Date(),
        status: 'open',
        checkin: activityPayload.checkin,
      });
      setSuccess(true);
      setStep(6);
    } catch (err) {
      console.error(err);
      setError(getFriendlyErrorMessage(err, 'Erro ao registrar Check-in. Tente novamente.'));
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
            <p style={{ marginTop: 0, marginBottom: '2rem', color: '#555', fontSize: '1.1rem', maxWidth: '400px' }}>
              {isTrainerProfile ? 'Como o atleta está se sentindo?' : 'Como você está se sentindo?'}
            </p>
            <div className="checkin-wellbeing-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center', width: '100%', maxWidth: '500px' }}>
              {WELL_BEING_KEYS.map((key) => {
                const value = form.wellBeing?.[key] ?? null;
                return (
                  <div key={key} className="checkin-wellbeing-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', width: '100%' }}>
                    <label style={{ fontWeight: 600, color: '#333', fontSize: '1rem', textAlign: 'center' }}>{WELL_BEING_LABELS_PT[key]}</label>
                    <div className="checkin-scale-row" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }} role="radiogroup" aria-label={WELL_BEING_LABELS_PT[key]}>
                      {[WELL_BEING_MIN, 2, 3, 4, WELL_BEING_MAX].map((score) => {
                        const isSel = value === score;
                        return (
                          <button
                            key={score}
                            type="button"
                            role="radio"
                            aria-checked={isSel}
                            aria-label={`${WELL_BEING_LABELS_PT[key]} ${score}`}
                            className={`checkin-chip ${isSel ? 'selected' : ''}`}
                            style={{
                              width: '44px',
                              height: '44px',
                              padding: 0,
                              fontSize: '0.95rem',
                              borderRadius: '8px',
                              border: isSel ? '2px solid #1565c0' : '1px solid #ccc',
                              background: isSel ? '#1565c0' : '#fff',
                              color: isSel ? '#fff' : '#555',
                              cursor: 'pointer',
                              fontWeight: isSel ? 600 : 400,
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                wellBeing: { ...prev.wellBeing, [key]: score },
                              }))
                            }
                          >
                            {score}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
                        <strong>{region.name}</strong> ({region.code})
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
            <p style={{ marginTop: 0, marginBottom: '0.4rem', color: '#555', fontSize: '1rem', fontWeight: 600 }}>
              {isTrainerProfile ? 'Qual é a cor da urina do atleta hoje?' : 'Qual é a cor da sua urina hoje?'}
            </p>
            <p style={{ marginTop: 0, marginBottom: '1.5rem', color: '#888', fontSize: '0.85rem' }}>
              A cor indica seu nível de hidratação. Escolha a opção mais próxima.
            </p>
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
                Nível de hidratação por cor da urina (1 a 8)
              </legend>
              <div
                role="radiogroup"
                aria-label="Nível de hidratação por cor da urina"
                style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
              >
                {HYDRATION_SCALE.map(({ level, label, bg, text }) => {
                  const isSel = form.hidratacao === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      role="radio"
                      aria-checked={isSel}
                      aria-label={`Nível ${level}: ${label}`}
                      style={{
                        width: '48px',
                        height: '56px',
                        padding: 0,
                        fontSize: '0.95rem',
                        borderRadius: '8px',
                        border: isSel ? '3px solid #1565c0' : '2px solid rgba(0,0,0,0.08)',
                        background: bg,
                        color: text,
                        cursor: 'pointer',
                        fontWeight: isSel ? 700 : 500,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isSel ? '0 0 0 3px rgba(21,101,192,0.25)' : '0 1px 3px rgba(0,0,0,0.12)',
                        transform: isSel ? 'scale(1.1)' : 'scale(1)',
                      }}
                      onClick={() => setForm((prev) => ({ ...prev, hidratacao: level }))}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {(() => {
              const hv = form.hidratacao;
              if (typeof hv !== 'number' || hv < HYDRATION_MIN || hv > HYDRATION_MAX) return null;
              const entry = HYDRATION_SCALE[hv - 1];
              const interp = getHydrationInterpretation(hv);
              return (
                <p style={{ marginTop: '1.25rem', fontSize: '0.95rem', fontWeight: 600, color: interp.color, textAlign: 'center' }}>
                  {entry.label}{interp.description ? ` — ${interp.description}` : ''}
                </p>
              );
            })()}
          </div>
        );
      default:
        return null;
    }
  };

  const totalSteps = 6;
  const progressLabel = `Etapa ${step} de ${totalSteps}`;
  const isLastStep = step === totalSteps;

  if (isPageLoading) {
    return <div className="checkin-page">Carregando dados da sessão...</div>;
  }

  return (
    <div className="checkin-page" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem 1rem' }}>
      <div className="checkin-container" style={{ maxWidth: '700px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', color: '#1a237e', margin: '0 0 1rem 0', fontWeight: 700, letterSpacing: '-0.02em' }}>Check-in</h1>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#607d8b', fontWeight: 500 }}>
            {athleteContextLabel}: {currentAthleteLabel || 'Não definido'}
          </p>
          {isTrainerProfile && (
            <div style={{ marginBottom: '1rem', display: 'grid', gap: '0.5rem', justifyItems: 'center' }}>
              <label htmlFor="trainer-athlete-select-checkin" style={{ fontSize: '0.9rem', color: '#455a64', fontWeight: 600 }}>
                Selecione o atleta para este Check-in
              </label>
              <select
                id="trainer-athlete-select-checkin"
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
              ? 'Complete as informações para iniciar o treino do atleta selecionado.'
              : 'Complete as informações do seu check-in para iniciar o treino.'}
          </p>
        </header>

        <div className="checkin-card" style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '2.5rem', marginBottom: '2rem', border: '1px solid #e8eaf6' }}>
          {shouldShowTrainerEmptyState ? (
            <div className="warning-message" style={{ textAlign: 'center', padding: '2rem', background: 'linear-gradient(135deg, #fff9e6 0%, #ffeaa7 100%)', border: '1px solid #ffb74d', borderRadius: '12px', boxShadow: '0 4px 16px rgba(255,183,77,0.2)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>👥</div>
              <p style={{ margin: '0.5rem 0', fontWeight: 600, color: '#f57c00', fontSize: '1.2rem' }}>
                Nenhum atleta selecionado para Check-in.
              </p>
              <p style={{ fontSize: '1rem', marginTop: '1.25rem', color: '#bf360c', fontWeight: 500 }}>
                Selecione um atleta vinculado para iniciar o treino dele.
              </p>
            </div>
          ) : success && checkInData ? (
            <div className="success-message" style={{ textAlign: 'center', padding: '2rem', background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', border: '1px solid #4caf50', borderRadius: '12px', boxShadow: '0 4px 16px rgba(76,175,80,0.2)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ margin: '0 0 1rem 0', fontWeight: 700, color: '#2e7d32', fontSize: '1.5rem' }}>Check-in registrado com sucesso!</h2>
              <p style={{ margin: '0.5rem 0', color: '#388e3c', fontSize: '1.1rem', fontWeight: 500 }}>Horário: {checkInData.time.toLocaleTimeString('pt-BR')}</p>
              <p style={{ fontSize: '1rem', marginTop: '1.5rem', color: '#4caf50', fontWeight: 500 }}>
                {isTrainerProfile
                  ? 'A sessão do atleta está ativa. Finalize no Check-out ao encerrar o treino.'
                  : 'Sua sessão de treino está ativa. Finalize-a no Check-out.'}
              </p>
            </div>
          ) : isCheckInBlocked ? (
            <div
              className="warning-message"
              data-eligibility-status={eligibilityStatus}
              data-eligibility-source={eligibilitySource}
              style={{ textAlign: 'center', padding: '2rem', background: 'linear-gradient(135deg, #fff9e6 0%, #ffeaa7 100%)', border: '1px solid #ffb74d', borderRadius: '12px', boxShadow: '0 4px 16px rgba(255,183,77,0.2)' }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
              {isBlockedByOpenSession ? (
                <>
                  <p style={{ margin: '0.5rem 0', fontWeight: 600, color: '#f57c00', fontSize: '1.2rem' }}>
                    {getEligibilityBusinessMessage(isTrainerProfile, ELIGIBILITY_CONTEXT.IN_PROGRESS)}
                  </p>
                  <p style={{ margin: '0.5rem 0', color: '#e65100', fontSize: '1rem' }}>
                    Início: {formatDateTimeForDisplay(openActivity?.checkin?.createdAt || openActivity?.activityDate)}
                  </p>
                  <p style={{ fontSize: '0.95rem', marginTop: '1.5rem', color: '#bf360c', fontWeight: 500 }}>
                    {isTrainerProfile
                      ? 'Acesse o Check-out para finalizar o treino do atleta antes de iniciar um novo Check-in.'
                      : 'Acesse o Check-out para finalizar antes de iniciar um novo Check-in.'}
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: '0.5rem 0', fontWeight: 600, color: '#f57c00', fontSize: '1.2rem' }}>
                    {getEligibilityUnavailableMessage()}
                  </p>
                  <p style={{ fontSize: '0.95rem', marginTop: '1.5rem', color: '#bf360c', fontWeight: 500 }}>
                    O serviço de leitura não respondeu. Tente novamente em instantes.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '10px', background: '#eef7ff', border: '1px solid #bbdefb', color: '#0d47a1', fontWeight: 500, textAlign: 'center' }}>
                {getEligibilityBusinessMessage(isTrainerProfile, eligibilityContextState)}
              </div>

              <div style={{ minHeight: '250px', marginBottom: '2.5rem' }}>
                {stepContent()}
              </div>

              {error && <div className="error-message" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)', border: '1px solid #e57373', borderRadius: '8px', color: '#c62828', marginBottom: '2rem', fontSize: '1rem', fontWeight: 500, textAlign: 'center' }}>{error}</div>}

              <div className="checkin-actions step-nav-actions" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', width: '100%' }}>
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={step === 1 || loading}
                  className="secondary-button step-nav-button step-nav-secondary"
                  style={{ flex: '1 1 0', minWidth: 0, width: '100%', padding: '0.875rem 1rem', fontSize: '1rem', border: '2px solid #e0e0e0', background: '#fff', borderRadius: '8px', cursor: step === 1 || loading ? 'not-allowed' : 'pointer', opacity: step === 1 || loading ? 0.5 : 1, transition: 'all 0.3s ease', fontWeight: 600, color: '#616161', minHeight: '44px' }}
                >
                  ← Anterior
                </button>
                {isLastStep ? (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || success || !effectiveAthleteId}
                    className="checkin-button step-nav-button step-nav-primary"
                    style={{ flex: '1 1 0', minWidth: 0, width: '100%', padding: '0.875rem 1rem', fontSize: '1rem', background: loading || success || !effectiveAthleteId ? '#ccc' : 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: loading || success || !effectiveAthleteId ? 'not-allowed' : 'pointer', fontWeight: 700, transition: 'all 0.3s ease', boxShadow: loading || success || !effectiveAthleteId ? 'none' : '0 4px 15px rgba(76,175,80,0.3)', minHeight: '44px' }}
                  >
                    {loading ? '⏳ Registrando...' : success ? '✅ Registrado!' : 'Finalizar Check-in →'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={loading}
                    className="checkin-button step-nav-button step-nav-primary"
                    style={{ flex: '1 1 0', minWidth: 0, width: '100%', padding: '0.875rem 1rem', fontSize: '1rem', background: loading ? '#ccc' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, transition: 'all 0.3s ease', boxShadow: loading ? 'none' : '0 4px 15px rgba(25,118,210,0.3)', minHeight: '44px' }}
                  >
                    Próximo →
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {isBlockedByOpenSession && (
          <div className="checkin-info" style={{ background: '#fafafa', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '1.5rem', border: '1px solid #f0f0f0' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', color: '#424242', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>📊 Informações da Sessão</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e8eaf6' }}>
                <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Última entrada</strong>
                <p style={{ margin: '0.5rem 0', color: '#e65100', fontSize: '1rem' }}>
                  Início: {formatDateTimeForDisplay(openActivity?.checkin?.createdAt || openActivity?.activityDate)}
                </p>
              </div>
              <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e8eaf6' }}>
                <strong style={{ color: '#1976d2', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</strong>
                <p style={{ margin: '0.5rem 0 0 0', color: '#424242', fontSize: '0.95rem' }}>Sessão aberta</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

