/**
 * Dashboard Refatorado
 *
 * Suporta 3 perfis com renderização otimizada:
 * - Coach: filtro de treinador + atleta + período
 * - Treinador: filtro de atleta + período
 * - Atleta: apenas período + seus dados
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/config.js';
import { authService } from '../services/auth/authService.js';
import './DashboardPage.css';
import { EmptyStateCard } from '../components/feedback/EmptyStateCard';
import { ErrorStateCard } from '../components/feedback/ErrorStateCard';
import {
  getCurrentUserProfile,
  getDashboardStatsByPeriod,
  getTrainerDashboardStatsByPeriod,
  getAthleteDashboardStats,
  getAthletesByCoach,
  getTrainersByCoach,
  formatDateTimeForDisplay,
  calculateDurationForDisplay,
} from '../services/sessionService.js';
import {
  formatTrainerAthleteOptionLabel,
  listTrainerAthleteOptions,
  resolveTrainerSelectedAthleteId,
  setStoredTrainerSelectedAthleteId,
} from '../services/trainer-athlete-context.service';
import { getRegionByCode } from '../components/pain-map/usePainRegions';
import { useUserDisplayNames } from '../hooks/useUserDisplayNames';
import { ReadinessCard } from '../components/dashboard/ReadinessCard';
import { WellBeingPeriodSummary } from '../components/dashboard/WellBeingPeriodSummary';
import { InputOutputTable } from '../components/dashboard/InputOutputTable';

const PROFILE_TYPES = {
  COACH: 'coach',
  TRAINER: 'trainer',
  ATHLETE: 'athlete',
};

const PERIOD_OPTIONS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
];

function normalizeProfileType(profileData) {
  return String(profileData?.papel || '')
    .normalize('NFC')
    .trim()
    .toLowerCase();
}

const HYDRATION_SCALE = [
  'Muito clara',
  'Clara',
  'Amarelo claro',
  'Amarelo moderado',
  'Amarelo forte',
  'Amarelo escuro',
  'Âmbar',
  'Muito escura',
];

const PSE_SCALE = [
  'Repouso',
  'Muito leve',
  'Muito leve',
  'Leve',
  'Leve',
  'Moderado',
  'Moderado',
  'Intenso',
  'Intenso',
  'Muito intenso',
  'Máximo esforço',
];

function getPrimaryActivityLabel(session) {
  const activities = Array.isArray(session?.atividades) ? session.atividades.filter(Boolean) : [];
  if (activities.length === 0) return 'Sessão de treino';
  return activities.join(' • ');
}

function getSessionStatusMeta(session) {
  if (!session) {
    return {
      label: 'Sem sessão no período',
      tone: 'none',
    };
  }

  const isOpen = !session?.dataCheckout;
  return {
    label: isOpen ? 'Aberta' : 'Finalizada',
    tone: isOpen ? 'open' : 'closed',
  };
}

function getDurationLabel(session) {
  if (!session?.dataCheckin) return 'N/D';

  if (Number(session?.duracaoMin) > 0) {
    return `${Number(session.duracaoMin)} min`;
  }

  const elapsed = calculateDurationForDisplay(session.dataCheckin, session.dataCheckout || new Date());
  if (elapsed > 0) {
    return `${elapsed} min`;
  }

  return session?.dataCheckout ? 'N/D' : 'Em andamento';
}

function getHydrationMeta(level) {
  const hydration = Number(level);

  if (!hydration || hydration < 1 || hydration > 8) {
    return {
      label: 'Sem registro',
      helper: 'Nenhum dado recente de hidratação.',
      color: '#6b7280',
      accent: '#e5e7eb',
    };
  }

  if (hydration <= 2) {
    return {
      label: HYDRATION_SCALE[hydration - 1],
      helper: 'Bem hidratado',
      color: '#166534',
      accent: '#dcfce7',
    };
  }

  if (hydration <= 4) {
    return {
      label: HYDRATION_SCALE[hydration - 1],
      helper: 'Hidratação adequada',
      color: '#1d4ed8',
      accent: '#dbeafe',
    };
  }

  if (hydration <= 6) {
    return {
      label: HYDRATION_SCALE[hydration - 1],
      helper: 'Atenção à hidratação',
      color: '#b45309',
      accent: '#fef3c7',
    };
  }

  return {
    label: HYDRATION_SCALE[hydration - 1],
    helper: 'Possível desidratação',
    color: '#b91c1c',
    accent: '#fee2e2',
  };
}

function getPseMeta(value, isOpenSession) {
  if (value === null || value === undefined || value === '') {
    return {
      label: isOpenSession ? 'Check-out pendente' : 'Sem registro',
      helper: isOpenSession ? 'O PSE aparece após o check-out.' : 'Nenhum PSE disponível.',
      color: '#6b7280',
      accent: '#f3f4f6',
    };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 10) {
    return {
      label: 'Sem registro',
      helper: 'Nenhum PSE disponível.',
      color: '#6b7280',
      accent: '#f3f4f6',
    };
  }

  return {
    label: `${numericValue} • ${PSE_SCALE[numericValue]}`,
    helper: 'Escala de percepção subjetiva de esforço.',
    color: numericValue >= 7 ? '#b91c1c' : numericValue >= 5 ? '#c2410c' : '#166534',
    accent: numericValue >= 7 ? '#fee2e2' : numericValue >= 5 ? '#ffedd5' : '#dcfce7',
  };
}

function resolvePainRegionName(region) {
  if (!region) return '';
  if (typeof region === 'string') return getRegionByCode(region)?.name || region;
  if (typeof region?.name === 'string' && region.name.trim()) return region.name;
  if (typeof region?.code === 'string') return getRegionByCode(region.code)?.name || region.code;
  return '';
}

function getPainSummary(regions) {
  const names = Array.isArray(regions)
    ? [...new Set(regions.map(resolvePainRegionName).filter(Boolean))]
    : [];

  if (names.length === 0) {
    return {
      label: 'Sem dor registrada',
      helper: 'Nenhuma região de dor informada.',
    };
  }

  return {
    label: names.join(', '),
    helper: `${names.length} região${names.length > 1 ? 'ões' : ''} registrada${names.length > 1 ? 's' : ''}.`,
  };
}

function getWellBeingSummary(bemEstar) {
  if (!bemEstar || typeof bemEstar !== 'object') return null;

  const entries = [
    ['Sono', Number(bemEstar.sleep) || 0],
    ['Humor', Number(bemEstar.mood) || 0],
    ['Fadiga', Number(bemEstar.fatigue) || 0],
    ['Dor', Number(bemEstar.pain) || 0],
    ['Estresse', Number(bemEstar.stress) || 0],
  ].filter(([, value]) => value > 0);

  if (entries.length === 0) return null;

  const average = entries.reduce((sum, [, value]) => sum + value, 0) / entries.length;
  const details = entries.slice(0, 3).map(([label, value]) => `${label} ${value}`).join(' • ');

  return {
    label: `${average.toFixed(1)}/5`,
    helper: details,
  };
}

function toFriendlyDashboardErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase();

  if (message.includes('endpoint is not configured')) {
    return 'O endpoint do dashboard do treinador não foi configurado no frontend.';
  }

  if (message.includes('must be authenticated')) {
    return 'A sessão do usuário não estava pronta para consultar o dashboard. Recarregue a página e tente novamente.';
  }

  if (message.includes('permission-denied')) {
    return 'Seu perfil atual não possui permissão para consultar este dashboard.';
  }

  if (message.includes('no active trainer-athlete link')) {
    return 'Não existe vínculo ativo entre treinador e atleta para esta consulta.';
  }

  if (message.includes('network')) {
    return 'Sem conexão no momento. Verifique sua internet e tente novamente.';
  }

  if (message.includes('failed to fetch') || message.includes('load failed')) {
    return 'Não foi possível conectar ao serviço de dashboard. Verifique sua conexão e tente novamente.';
  }

  if (message.includes('backend trainer dashboard request failed') || error?.status) {
    return 'A UI não conseguiu carregar o endpoint trainerDashboardStats. Verifique a requisição no DevTools > Network.';
  }

  return 'Não foi possível carregar o dashboard agora. Tente novamente em instantes.';
}

function getNextStepSummary({
  isAthlete,
  isTrainer,
  isCoach,
  selectedAthlete,
  latestStatusTone,
}) {
  if (isAthlete) {
    if (latestStatusTone === 'open') {
      return {
        title: 'Próximo passo recomendado',
        text: 'Você possui uma atividade aberta. Finalize no Check-out para concluir os registros.',
        primaryLabel: 'Ir para Check-out',
        primaryRoute: '/checkout',
        secondaryLabel: 'Ver atividades',
        secondaryRoute: '/activities',
      };
    }

    return {
      title: 'Próximo passo recomendado',
      text: 'Não há atividade aberta agora. Inicie um novo ciclo de treino pelo Check-in.',
      primaryLabel: 'Ir para Check-in',
      primaryRoute: '/checkin',
      secondaryLabel: 'Ver atividades',
      secondaryRoute: '/activities',
    };
  }

  if ((isTrainer || isCoach) && !selectedAthlete) {
    return {
      title: 'Próximo passo recomendado',
      text: 'Selecione um atleta nos filtros para visualizar dados, últimas sessões e prioridades de acompanhamento.',
      primaryLabel: null,
      primaryRoute: null,
      secondaryLabel: null,
      secondaryRoute: null,
    };
  }

  if (isCoach) {
    return {
      title: 'Próximo passo recomendado',
      text: 'Revise as sessões recentes e coordene com o treinador as prioridades da próxima semana.',
      primaryLabel: 'Ver atividades',
      primaryRoute: '/activities',
      secondaryLabel: null,
      secondaryRoute: null,
    };
  }

  return {
    title: 'Próximo passo recomendado',
    text: 'Use os filtros e o histórico para identificar o que acompanhar no próximo treino.',
    primaryLabel: 'Ver atividades',
    primaryRoute: '/activities',
    secondaryLabel: null,
    secondaryRoute: null,
  };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // User/Auth
  const [userInfo, setUserInfo] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(null);
  const [filtersError, setFiltersError] = useState(null);
  
  // Dashboard Data
  const [stats, setStats] = useState(null);
    // Race condition guard: only the latest request may commit stats
    const statsLoadGenRef = useRef(0);
  
  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  
  // Filter Options
  const [trainers, setTrainers] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [filteredAthletesForTrainer, setFilteredAthletesForTrainer] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(false);

  const profileType = useMemo(() => normalizeProfileType(profile), [profile]);
  const isCoach = profileType === PROFILE_TYPES.COACH;
  const isTrainer = profileType === PROFILE_TYPES.TRAINER;
  const isAthlete = profileType === PROFILE_TYPES.ATHLETE;
  const publicNameLookupIds = useMemo(
    () => [
      userInfo?.uid,
      selectedTrainer,
      selectedAthlete,
      ...trainers.map((trainer) => trainer.id),
      ...athletes.map((athlete) => athlete.id),
      ...filteredAthletesForTrainer.map((athlete) => athlete.id),
    ],
    [athletes, filteredAthletesForTrainer, selectedAthlete, selectedTrainer, trainers, userInfo?.uid]
  );
  const userDisplayNames = useUserDisplayNames(publicNameLookupIds);

  // Main effect: load profile and initialize filters
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setLoading(true);
        setDashboardError(null);

        if (!user) {
          setUserInfo(null);
          setProfile(null);
          return;
        }

        setUserInfo(user);
        const profileData = await getCurrentUserProfile(user.uid);
        setProfile(profileData);

        const profileType = normalizeProfileType(profileData);
        const urlAthleteId = searchParams.get('athleteId') || null;

        // Initialize filters based on profile
        if (profileType === PROFILE_TYPES.COACH) {
          await loadCoachFilters(user.uid, urlAthleteId);
        } else if (profileType === PROFILE_TYPES.TRAINER) {
          await loadTrainerFilters(user.uid, profileData, urlAthleteId);
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
        setDashboardError(error instanceof Error ? error : new Error('Erro ao carregar dashboard'));
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Cascade loading: coach filters -> trainers
  const loadCoachFilters = async (coachUid, urlAthleteId = null) => {
    try {
      setLoadingFilters(true);
      setFiltersError(null);
      // athlete_links are queried with coachUid as trainerId — Firestore only allows
      // reading links where resource.data.trainerId == auth.uid, so we must use the
      // coach's own uid here (not a supervised trainer's uid).
      const [trainersData, athletesData] = await Promise.all([
        getTrainersByCoach(coachUid),
        listTrainerAthleteOptions(coachUid),
      ]);
      setTrainers(trainersData);
      setFilteredAthletesForTrainer(athletesData || []);

      if (trainersData?.length > 0) {
        setSelectedTrainer(trainersData[0]?.id);
      }
      // Prefer URL param if it belongs to this coach's athlete list; fall back to localStorage.
      const list = athletesData || [];
      const initialAthleteId =
        (urlAthleteId && list.some((a) => a.id === urlAthleteId))
          ? urlAthleteId
          : resolveTrainerSelectedAthleteId(coachUid, list);
      if (initialAthleteId) {
        setSelectedAthlete(initialAthleteId);
        setStoredTrainerSelectedAthleteId(coachUid, initialAthleteId);
      }
    } catch (error) {
      console.error('Error loading trainer filters:', error);
      setFiltersError(error instanceof Error ? error : new Error('Erro ao carregar filtros'));
    } finally {
      setLoadingFilters(false);
    }
  };

  // Load athletes for trainer
  const loadTrainerFilters = async (trainerUid, profileData = null, urlAthleteId = null) => {
    try {
      setLoadingFilters(true);
      setFiltersError(null);
      // Use profileData parameter to avoid reading stale React state from closure
      const userTypes = Array.isArray(profileData?.userTypes) ? profileData.userTypes : [];
      const includeSelfAthlete = userTypes.includes('athlete');
      const athletesData = await listTrainerAthleteOptions(trainerUid, { includeSelfAthlete });

      setAthletes(athletesData);

      // Prefer URL param if it belongs to this trainer's athlete list; fall back to localStorage.
      const initialAthleteId =
        (urlAthleteId && athletesData.some((a) => a.id === urlAthleteId))
          ? urlAthleteId
          : resolveTrainerSelectedAthleteId(trainerUid, athletesData);
      setSelectedAthlete(initialAthleteId || null);
      setStoredTrainerSelectedAthleteId(trainerUid, initialAthleteId);

      if (!initialAthleteId) setStats(null);
    } catch (error) {
      console.error('Error loading athlete list:', error);
      setFiltersError(error instanceof Error ? error : new Error('Erro ao carregar filtros'));
      setSelectedAthlete(null);
      setStats(null);
    } finally {
      setLoadingFilters(false);
    }
  };

  // Load athletes for specific trainer (called when trainer changes in coach view)
  const loadAthletesForTrainer = async (trainerId) => {
    try {
      const athletesData = await listTrainerAthleteOptions(trainerId);
      setFilteredAthletesForTrainer(athletesData);
      
      if (athletesData?.length > 0) {
        setSelectedAthlete(athletesData[0]?.id);
      } else {
        setSelectedAthlete(null);
        setStats(null);
      }
    } catch (error) {
      console.error('Error loading athletes for trainer:', error);
      setFilteredAthletesForTrainer([]);
      setSelectedAthlete(null);
      setStats(null);
    }
  };

  // Load dashboard stats
  const loadDashboardStats = async (uid, period, profileType, athleteId) => {
    const gen = ++statsLoadGenRef.current;
    try {
      setDashboardError(null);
      
      // For trainer/coach: require athlete selection
      if (
        (profileType === PROFILE_TYPES.COACH || profileType === PROFILE_TYPES.TRAINER) &&
        !athleteId
      ) {
        if (statsLoadGenRef.current === gen) setStats(null);
        return;
      }

      const isTrainerOrCoach =
        profileType === PROFILE_TYPES.COACH || profileType === PROFILE_TYPES.TRAINER;

      let statsData;
      if (isTrainerOrCoach) {
        statsData = await getTrainerDashboardStatsByPeriod(
          uid,
          athleteId,
          period
        );
      } else {
        statsData = await getAthleteDashboardStats(uid, period);
      }

      if (statsLoadGenRef.current === gen) {
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      if (statsLoadGenRef.current === gen) {
        setDashboardError(error instanceof Error ? error : new Error('Erro ao carregar estatisticas'));
        setStats(null);
      }
    }
  };

  const handleRetryDashboard = async () => {
    if (!userInfo) return;
    await loadDashboardStats(userInfo.uid, selectedPeriod, profileType, selectedAthlete);
  };

  // Handle trainer change (for coach profile)
  const handleTrainerChange = async (newTrainerId) => {
    setSelectedAthlete(null);
    setStats(null);
    setSelectedTrainer(newTrainerId);
    // Coach cannot read athlete_links for another trainer's uid (Firestore rule requires
    // resource.data.trainerId == auth.uid). Athlete list stays as coach's own links.
  };

  // Keep selected athlete valid when trainer athlete options refresh.
  useEffect(() => {
    if (!isTrainer) return;
    if (!Array.isArray(athletes) || athletes.length === 0) {
      if (selectedAthlete !== null) {
        setSelectedAthlete(null);
      }
      return;
    }

    if (!selectedAthlete || !athletes.some((athlete) => athlete.id === selectedAthlete)) {
      const fallbackAthleteId = athletes[0]?.id || null;
      setSelectedAthlete(fallbackAthleteId);
      if (userInfo?.uid) {
        setStoredTrainerSelectedAthleteId(userInfo.uid, fallbackAthleteId || '');
      }
    }
  }, [athletes, isTrainer, selectedAthlete, userInfo?.uid]);

  // Handle filter/period changes
  useEffect(() => {
    if (userInfo) {
      loadDashboardStats(
        userInfo.uid,
        selectedPeriod,
        profileType,
        selectedAthlete
      );
    }
  }, [userInfo, selectedPeriod, selectedAthlete, profileType]);

  // periodSessions precisa ser declarado antes de qualquer early return
  // para respeitar as regras de hooks (mesma ordem em todo render).
  const periodSessions = useMemo(() => {
    const list = Array.isArray(stats?.recentActivities) ? stats.recentActivities : [];
    if (list.length === 0) return [];
    const cutoff = Date.now() - (Number(selectedPeriod) || 7) * 24 * 60 * 60 * 1000;
    return list
      .filter((s) => {
        const ref = s?.activityDate || s?.dataCheckin || null;
        if (!ref) return false;
        const ts = ref instanceof Date ? ref.getTime() : new Date(ref).getTime();
        return Number.isFinite(ts) && ts >= cutoff;
      });
  }, [stats?.recentActivities, selectedPeriod]);

  // Render filters based on profile
  const renderFilters = () => {
    return (
      <div style={styles.filterBar} className="dashboard-filter-bar">
        {/* Trainer filter for Coach */}
        {isCoach && trainers.length > 0 && (
          <div style={styles.filterGroup} className="dashboard-filter-group">
            <label style={styles.filterLabel} className="dashboard-filter-label">Treinador</label>
            <select
              value={selectedTrainer || ''}
              onChange={(e) => handleTrainerChange(e.target.value)}
              style={styles.filterSelect}
              className="dashboard-filter-select"
              disabled={loadingFilters}
            >
              {trainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {userDisplayNames[trainer.id] || trainer.id}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Athlete filter for Coach or Trainer */}
        {isCoach &&
          filteredAthletesForTrainer.length > 0 && (
            <div style={styles.filterGroup} className="dashboard-filter-group">
              <label style={styles.filterLabel} className="dashboard-filter-label">Atleta</label>
              <select
                value={selectedAthlete || ''}
                onChange={(e) => setSelectedAthlete(e.target.value)}
                style={styles.filterSelect}
                className="dashboard-filter-select"
              >
                {filteredAthletesForTrainer.map((athlete) => (
                  <option key={athlete.id} value={athlete.id}>
                    {userDisplayNames[athlete.id] || athlete.id}
                  </option>
                ))}
              </select>
            </div>
          )}

        {isTrainer && (
          <div style={styles.filterGroup} className="dashboard-filter-group">
            <label style={styles.filterLabel} className="dashboard-filter-label">Atleta</label>
            <select
              value={selectedAthlete || ''}
              onChange={(e) => {
                const nextAthleteId = e.target.value;
                setSelectedAthlete(nextAthleteId || null);
                if (userInfo?.uid) {
                  setStoredTrainerSelectedAthleteId(userInfo.uid, nextAthleteId);
                }
              }}
              style={styles.filterSelect}
              className="dashboard-filter-select"
              disabled={loadingFilters || athletes.length === 0}
            >
              {athletes.length === 0 ? (
                <option value="">Nenhum atleta vinculado</option>
              ) : (
                athletes.map((athlete) => (
                  <option key={athlete.id} value={athlete.id}>
                    {formatTrainerAthleteOptionLabel(
                      athlete.id,
                      userDisplayNames[athlete.id] || athlete.id,
                      athletes
                    )}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {/* Period filter for all profiles */}
        <div style={styles.filterGroup} className="dashboard-filter-group">
          <label style={styles.filterLabel} className="dashboard-filter-label">Período</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            style={styles.filterSelect}
            className="dashboard-filter-select"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <EmptyStateCard
          title="Carregando dashboard"
          message="Estamos preparando seu resumo de treino."
          hint="Em geral, esse processo leva poucos segundos."
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={styles.page}>
        <ErrorStateCard
          title="Não foi possível carregar seu perfil"
          message="Recarregue o dashboard para continuar. Se o problema persistir, tente entrar novamente."
          onAction={() => {
            window.location.reload();
          }}
        />
      </div>
    );
  }

  const displayName = (userInfo?.uid && userDisplayNames[userInfo.uid]) || userInfo?.uid || 'Usuário';
  const selectedAthleteLabel = selectedAthlete
    ? userDisplayNames[selectedAthlete] || selectedAthlete
    : 'Nenhum atleta selecionado';
  // recentActivities contains ALL sessions (not period-filtered) — used for history and last session
  const hasAnySession = Array.isArray(stats?.recentActivities) && stats.recentActivities.length > 0;
  const latestSessionCard = hasAnySession ? stats?.latestSessionCard || null : null;
  const latestSession = hasAnySession ? (stats?.recentActivities[0] || null) : null;
  const sourceSession = latestSession;
  const latestStatus = getSessionStatusMeta(latestSession);
  const hydrationMeta = getHydrationMeta(sourceSession?.hidratacao);
  const painSummary = getPainSummary(sourceSession?.dorRegioes);
  const pseMeta = getPseMeta(sourceSession?.pseFoster, latestStatus.tone === 'open');
  const wellBeingSummary = getWellBeingSummary(sourceSession?.bemEstar);
  const sourceReferenceDate = null;
  const observationParts = [];

  if (typeof sourceSession?.recuperacao === 'string' && sourceSession.recuperacao.trim()) {
    observationParts.push(`Recuperação: ${sourceSession.recuperacao.trim()}`);
  }

  if (Number(sourceSession?.carga) > 0) {
    observationParts.push(`Carga: ${Number(sourceSession.carga)}`);
  }

  if (wellBeingSummary) {
    observationParts.push(`Bem-estar: ${wellBeingSummary.label}`);
  }

  const compactObservation = observationParts.join(' • ');
  const nextStep = getNextStepSummary({
    isAthlete,
    isTrainer,
    isCoach,
    selectedAthlete,
    latestStatusTone: latestStatus.tone,
  });

  return (
    <div style={styles.page}>
      <header style={styles.header} className="dashboard-header-section">
        <div>
          <p style={styles.eyebrow} className="dashboard-eyebrow">Painel</p>
          <h1 style={styles.title} className="dashboard-title">Dashboard</h1>
          <p style={styles.subtitle} className="dashboard-subtitle">Olá, {displayName}</p>
        </div>
        <button
          onClick={async () => {
            await authService.logout();
            navigate('/login');
          }}
          style={{
            background: 'none',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: '#6b7280',
            alignSelf: 'flex-start',
          }}
        >
          Sair
        </button>
      </header>

      <main style={styles.content} className="dashboard-content-grid">
        {dashboardError ? (
          <ErrorStateCard
            title="Não foi possível atualizar o dashboard"
            message={toFriendlyDashboardErrorMessage(dashboardError)}
            onAction={() => {
              void handleRetryDashboard();
            }}
          />
        ) : null}

        {filtersError ? (
          <ErrorStateCard
            title="Não foi possível carregar os filtros"
            message="Os filtros de treinador/atleta podem estar incompletos no momento. Tente novamente para continuar."
            onAction={() => {
              if (!userInfo) return;
              if (isCoach) {
                void loadCoachFilters(userInfo.uid);
                return;
              }
              if (isTrainer) {
                void loadTrainerFilters(userInfo.uid, profile);
              }
            }}
          />
        ) : null}

        <section style={styles.nextStepSection} className="dashboard-next-step-section">
          <div style={styles.sectionHeader} className="dashboard-section-header">
            <h2 style={styles.sectionTitle} className="dashboard-section-title">{nextStep.title}</h2>
          </div>
          <p style={styles.nextStepText} className="dashboard-next-step-text">{nextStep.text}</p>
          <div style={styles.nextStepActions} className="dashboard-next-step-actions">
            {nextStep.primaryLabel && nextStep.primaryRoute ? (
              <button
                style={styles.primaryButton}
                className="dashboard-button"
                onClick={() => navigate(nextStep.primaryRoute)}
              >
                {nextStep.primaryLabel}
              </button>
            ) : null}
            {nextStep.secondaryLabel && nextStep.secondaryRoute ? (
              <button
                style={styles.secondaryButton}
                className="dashboard-button"
                onClick={() => navigate(nextStep.secondaryRoute)}
              >
                {nextStep.secondaryLabel}
              </button>
            ) : null}
          </div>
        </section>

        {/* Quick Actions - Only for Athletes */}
        {isAthlete && (
          <section style={styles.actionsSection} className="dashboard-actions-section">
            <div style={styles.sectionHeader} className="dashboard-section-header">
              <h2 style={styles.sectionTitle} className="dashboard-section-title">Ações rápidas</h2>
            </div>
            <div style={styles.actionsGrid} className="dashboard-actions-grid">
              <button
                style={styles.primaryButton}
                className="dashboard-button"
                onClick={() => navigate('/checkin')}
              >
                Check-in
              </button>
              <button
                style={styles.secondaryButton}
                className="dashboard-button"
                onClick={() => navigate('/checkout')}
              >
                Check-out
              </button>
              <button
                style={styles.secondaryButton}
                className="dashboard-button"
                onClick={() => navigate('/avaliacao-pafp')}
              >
                Avaliação
              </button>
            </div>
          </section>
        )}
        
        {/* Filters */}
        {renderFilters()}

        <section
          key={`period-${selectedAthlete || userInfo?.uid || 'none'}-${selectedPeriod}`}
          style={{ ...styles.groupSection, ...styles.groupSectionPeriod }}
          className="dashboard-group-section"
        >
          <div style={styles.groupHeader} className="dashboard-group-header">
            <p style={styles.groupEyebrow}>Período selecionado</p>
            <h2 style={styles.groupTitle}>Desempenho no período</h2>
            <p style={styles.groupDescription}>Sessões, volume e sinais de bem-estar dos últimos {selectedPeriod} dias.</p>
            {(isTrainer || isCoach) && selectedAthlete && (
              <p style={styles.groupContextText}>Atleta em foco: {selectedAthleteLabel}</p>
            )}
          </div>

          {/* Stats */}
          {stats ? (
            <section style={styles.statsSection} className="dashboard-stats-section">
              <div style={styles.sectionHeader} className="dashboard-section-header">
                <h2 style={styles.sectionTitle} className="dashboard-section-title">Estatísticas ({stats.period}d)</h2>
              </div>
              <div style={styles.statsGrid} className="dashboard-stats-grid">
                <div style={styles.statCard} className="dashboard-stat-card">
                  <span style={styles.statLabel} className="dashboard-stat-label">Sessões</span>
                  <strong style={styles.statValue} className="dashboard-stat-value">{stats.totalSessions}</strong>
                </div>
                <div style={styles.statCard} className="dashboard-stat-card">
                  <span style={styles.statLabel} className="dashboard-stat-label">Horas</span>
                  <strong style={styles.statValue} className="dashboard-stat-value">{stats.totalHoursLabel}</strong>
                </div>
                <div style={styles.statCard} className="dashboard-stat-card">
                  <span style={styles.statLabel} className="dashboard-stat-label">Minutos</span>
                  <strong style={styles.statValue} className="dashboard-stat-value">{stats.totalMinutes}</strong>
                </div>
              </div>
            </section>
          ) : (
            <EmptyStateCard
              title="Resumo indisponível"
              message="Não há estatísticas para o contexto selecionado agora."
              hint={isTrainer || isCoach
                ? 'Selecione um atleta para visualizar o resumo do período.'
                : 'Registre uma atividade para ver seus números consolidados.'}
            />
          )}

          {/* Activities Distribution */}
          {stats?.activitiesDistribution && Object.keys(stats.activitiesDistribution).length > 0 ? (
            <section style={styles.activitiesSection} className="dashboard-activities-section">
              <div style={styles.sectionHeader} className="dashboard-section-header">
                <h2 style={styles.sectionTitle} className="dashboard-section-title">Distribuição de atividades ({stats.period}d)</h2>
              </div>
              <div style={styles.activitiesGrid} className="dashboard-activities-grid">
                {Object.entries(stats.activitiesDistribution)
                  .map(([activity, count]) => (
                    <div key={activity} style={styles.activityItem} className="dashboard-activity-item">
                      <span style={styles.activityName} className="dashboard-activity-name">{activity}</span>
                      <span style={styles.activityCount} className="dashboard-activity-count">{count}</span>
                    </div>
                  ))}
              </div>
            </section>
          ) : stats ? (
            <EmptyStateCard
              title="Distribuição ainda vazia"
              message="Quando houver atividades no período, a distribuição por tipo aparece aqui."
            />
          ) : null}

          {/* Readiness analytics no período */}
          <WellBeingPeriodSummary sessions={periodSessions} periodDays={selectedPeriod} />
          <InputOutputTable sessions={periodSessions} periodDays={selectedPeriod} />
        </section>

        {(isAthlete || selectedAthlete) && <section
          key={`history-${selectedAthlete || userInfo?.uid || 'none'}`}
          style={{ ...styles.groupSection, ...styles.groupSectionHistory }}
          className="dashboard-group-section"
        >
          <div style={styles.groupHeader} className="dashboard-group-header">
            <p style={styles.groupEyebrow}>Histórico</p>
            <h2 style={styles.groupTitle}>Histórico do atleta</h2>
            <p style={styles.groupDescription}>Todas as sessões registradas, sem filtro de período.</p>
            {(isTrainer || isCoach) && selectedAthlete && (
              <p style={styles.groupContextText}>Histórico completo de: {selectedAthleteLabel}</p>
            )}
          </div>

          {/* Latest Session */}
          {latestSession ? (
            <section style={styles.lastActivitySection} className="dashboard-last-activity-section">
              <div style={styles.sectionHeader} className="dashboard-section-header">
                <div style={styles.sectionHeadingBlock}>
                  <h2 style={styles.sectionTitle} className="dashboard-section-title">Última sessão registrada</h2>
                  <p style={styles.sectionHelperText}>Sinais do check-in e dados de desempenho do treino mais recente.</p>
                </div>
              </div>
              <ReadinessCard session={latestSession} />
              <article style={styles.recentSessionCard} className="dashboard-recent-session-card">
                <div style={styles.compactHeader} className="dashboard-recent-header">
                  <div style={styles.compactHeaderCopy}>
                    <p style={styles.recentSessionEyebrow}>Sessão mais recente</p>
                    <h3 style={styles.recentSessionName} className="dashboard-recent-title">{getPrimaryActivityLabel(latestSession)}</h3>
                  </div>
                  <div style={styles.compactChipWrap} className="dashboard-recent-chips">
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...(latestStatus.tone === 'open' ? styles.statusBadgeOpen : styles.statusBadgeClosed),
                      }}
                    >
                      {latestStatus.label}
                    </span>
                    <span
                      style={{
                        ...styles.sourceBadge,
                        ...(latestSessionCard?.sourceType === 'fallback'
                          ? styles.sourceBadgeFallback
                          : styles.sourceBadgeCurrent),
                      }}
                    >
                      {latestSessionCard?.sourceLabel || 'dados da atividade atual'}
                    </span>
                    {sourceReferenceDate && (
                      <span style={styles.referenceBadge}>Base em {sourceReferenceDate}</span>
                    )}
                  </div>
                </div>

                <div style={styles.compactQuickGrid} className="dashboard-recent-grid">
                  <div style={styles.quickSignalCard} className="dashboard-recent-cell">
                    <span style={styles.signalLabel}>Data/hora</span>
                    <strong style={styles.compactSignalValue}>{formatDateTimeForDisplay(latestSession.dataCheckin)}</strong>
                  </div>

                  <div style={styles.quickSignalCard} className="dashboard-recent-cell">
                    <span style={styles.signalLabel}>Duração</span>
                    <strong style={styles.compactSignalValue}>{getDurationLabel(latestSession)}</strong>
                  </div>

                  <div style={{ ...styles.quickSignalCard, background: hydrationMeta.accent }} className="dashboard-recent-cell">
                    <span style={styles.signalLabel}>Hidratação</span>
                    <strong style={{ ...styles.compactSignalValue, color: hydrationMeta.color }}>{hydrationMeta.label}</strong>
                    <p style={styles.compactSignalHelper}>{hydrationMeta.helper}</p>
                  </div>

                  <div style={{ ...styles.quickSignalCard, background: pseMeta.accent }} className="dashboard-recent-cell">
                    <span style={styles.signalLabel} className="dashboard-mini-label">
                      <span className="dashboard-label-full">PSE / Check-out</span>
                      <span className="dashboard-label-short">PSE</span>
                    </span>
                    <strong style={{ ...styles.compactSignalValue, color: pseMeta.color }}>{pseMeta.label}</strong>
                    <p style={styles.compactSignalHelper}>{pseMeta.helper}</p>
                  </div>
                </div>

                <div style={styles.compactLineList}>
                  <p style={styles.compactLineText}><strong>Dor:</strong> {painSummary.label}</p>
                  <p style={styles.compactLineText}>
                    <strong>VFC:</strong> {Number(sourceSession?.vfc) > 0 ? Number(sourceSession.vfc) : 'sem registro'}
                  </p>
                  {compactObservation && (
                    <p style={styles.compactLineNote}>
                      <strong>Observações:</strong> {compactObservation}
                    </p>
                  )}
                  {!compactObservation && latestSessionCard?.sourceType === 'fallback' && (
                    <p style={styles.compactLineNote}>Dados herdados do último registro válido.</p>
                  )}
                  {!compactObservation && latestSessionCard?.sourceType !== 'fallback' && (
                    <p style={styles.compactLineMuted}>{painSummary.helper}</p>
                  )}
                </div>
              </article>
            </section>
          ) : (
            <EmptyStateCard
              title="Sem histórico de sessões"
              message="Nenhuma sessão foi encontrada para este atleta até o momento."
              hint={
                isAthlete
                  ? 'Inicie um novo Check-in para começar seu histórico.'
                  : 'Registre um novo treino para começar o histórico deste atleta.'
              }
              action={isAthlete ? (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  className="dashboard-button"
                  onClick={() => navigate('/checkin')}
                >
                  Iniciar Check-in
                </button>
              ) : null}
            />
          )}

          {/* Session History */}
          {stats?.recentActivities ? (
            <section style={styles.sessionHistorySection} className="dashboard-session-history-section">
              <div style={styles.sectionHeader} className="dashboard-section-header">
                <h2 style={styles.sectionTitle} className="dashboard-section-title">Histórico total de sessões</h2>
              </div>
              {stats.recentActivities.length === 0 ? (
                <div style={styles.emptyState}>
                  Nenhuma sessão registrada até o momento.
                </div>
              ) : (
                <div style={styles.sessionList} className="dashboard-session-list">
                  {stats.recentActivities
                    .map((session, index) => (
                      <article key={index} style={styles.sessionItem} className="dashboard-session-item">
                        <div style={styles.sessionInfo}>
                          <p style={styles.sessionActivity} className="dashboard-session-activity">
                            {session.atividades?.[0] || 'Sessão de treino'}
                          </p>
                          <p style={styles.sessionDate} className="dashboard-session-date">
                            {formatDateTimeForDisplay(session.dataCheckin)}
                          </p>
                        </div>
                        <span style={styles.sessionDuration} className="dashboard-session-duration">
                          {session.duracaoMin ? `${session.duracaoMin}m` : 'N/D'}
                        </span>
                      </article>
                    ))}
                </div>
              )}
            </section>
          ) : (
            <EmptyStateCard
              title="Histórico indisponível"
              message="Não foi possível montar o histórico de sessões com os filtros atuais."
              hint="Ajuste o período ou selecione outro atleta para continuar."
            />
          )}
        </section>}
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fb',
    padding: '32px 20px 48px',
    fontFamily: 'Arial, sans-serif',
    color: '#1f2937',
  },
  header: {
    maxWidth: '1200px',
    margin: '0 auto 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  title: {
    margin: '8px 0 4px',
    fontSize: '48px',
    lineHeight: 1.1,
  },
  subtitle: {
    margin: 0,
    fontSize: '18px',
    color: '#4b5563',
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gap: '24px',
  },
  nextStepSection: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    display: 'grid',
    gap: '10px',
  },
  nextStepText: {
    margin: 0,
    color: '#374151',
    fontSize: '15px',
    lineHeight: 1.5,
  },
  nextStepActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  filterBar: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '16px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  filterLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  filterSelect: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    minHeight: '44px',
  },
  groupSection: {
    display: 'grid',
    gap: '16px',
    padding: '20px',
    borderRadius: '16px',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
  },
  groupSectionPeriod: {
    borderColor: '#c7d2fe',
    background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
  },
  groupSectionHistory: {
    borderColor: '#cbd5e1',
    background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
  },
  groupHeader: {
    display: 'grid',
    gap: '4px',
  },
  groupEyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#475569',
  },
  groupTitle: {
    margin: 0,
    fontSize: '24px',
    lineHeight: 1.2,
    color: '#0f172a',
  },
  groupDescription: {
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#475569',
  },
  groupContextText: {
    margin: 0,
    fontSize: '13px',
    lineHeight: 1.4,
    color: '#1d4ed8',
    fontWeight: 600,
  },
  lastActivitySection: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    gap: '12px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
  },
  sectionHeadingBlock: {
    display: 'grid',
    gap: '2px',
  },
  sectionHelperText: {
    margin: 0,
    fontSize: '12px',
    color: '#64748b',
    lineHeight: 1.35,
  },
  recentSessionCard: {
    display: 'grid',
    gap: '10px',
    padding: '12px',
    borderRadius: '12px',
    background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
    border: '1px solid #dbeafe',
  },
  compactHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  compactHeaderCopy: {
    display: 'grid',
    gap: '2px',
  },
  recentSessionEyebrow: {
    margin: 0,
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  recentSessionName: {
    margin: 0,
    fontSize: '20px',
    lineHeight: 1.2,
    color: '#0f172a',
  },
  compactChipWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'fit-content',
    padding: '4px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statusBadgeOpen: {
    background: '#dbeafe',
    color: '#1d4ed8',
  },
  statusBadgeClosed: {
    background: '#dcfce7',
    color: '#166534',
  },
  sourceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    padding: '4px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
  },
  sourceBadgeCurrent: {
    background: '#e0f2fe',
    color: '#0369a1',
  },
  sourceBadgeFallback: {
    background: '#fef3c7',
    color: '#b45309',
  },
  referenceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    padding: '4px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 500,
    color: '#475569',
    background: '#f1f5f9',
  },
  compactQuickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px',
  },
  quickSignalCard: {
    display: 'grid',
    gap: '3px',
    padding: '8px 9px',
    borderRadius: '8px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
  },
  signalLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#64748b',
  },
  compactSignalValue: {
    fontSize: '13px',
    lineHeight: 1.3,
    color: '#111827',
  },
  compactSignalHelper: {
    margin: 0,
    fontSize: '11px',
    color: '#475569',
    lineHeight: 1.35,
  },
  compactLineList: {
    display: 'grid',
    gap: '4px',
    paddingTop: '2px',
  },
  compactLineText: {
    margin: 0,
    fontSize: '12px',
    lineHeight: 1.35,
    color: '#334155',
  },
  compactLineNote: {
    margin: 0,
    fontSize: '12px',
    lineHeight: 1.35,
    color: '#92400e',
  },
  compactLineMuted: {
    margin: 0,
    fontSize: '11px',
    color: '#64748b',
    lineHeight: 1.35,
  },
  statsSection: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
  },
  statCard: {
    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
    color: '#ffffff',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
  },
  statLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#b3d9ff',
    marginBottom: '4px',
  },
  statValue: {
    fontSize: '24px',
    lineHeight: 1.2,
  },
  activitiesSection: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  activitiesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: '12px',
  },
  activityItem: {
    background: '#f3f4f6',
    padding: '12px',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
  },
  activityName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#1f2937',
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    lineHeight: 1.3,
  },
  activityCount: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#1976d2',
    background: '#e3f2fd',
    padding: '4px 8px',
    borderRadius: '4px',
    marginLeft: '8px',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  sessionHistorySection: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  sessionList: {
    display: 'grid',
    gap: '12px',
  },
  sessionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#f9fafb',
    borderRadius: '8px',
    borderLeft: '4px solid #1976d2',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionActivity: {
    margin: '0 0 4px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
  },
  sessionDate: {
    margin: 0,
    fontSize: '12px',
    color: '#6b7280',
  },
  sessionDuration: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#1976d2',
    marginLeft: '16px',
  },
  actionsSection: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  actionsGrid: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '14px',
    minHeight: '46px',
    transition: 'all 0.3s ease',
  },
  secondaryButton: {
    padding: '12px 16px',
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '14px',
    minHeight: '46px',
    transition: 'all 0.3s ease',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center',
    borderRadius: '8px',
    background: '#f9fafb',
    color: '#6b7280',
  },
};
