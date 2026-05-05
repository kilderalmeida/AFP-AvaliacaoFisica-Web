/**
 * Dashboard Refatorado
 *
 * Suporta 3 perfis com renderização otimizada:
 * - Coach: filtro de treinador + atleta + período
 * - Treinador: filtro de atleta + período
 * - Atleta: apenas período + seus dados
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/config.js';
import './DashboardPage.css';
import {
  getCurrentUserProfile,
  getDashboardStatsByPeriod,
  getAthletesByCoach,
  getAthletesByTrainer,
  getTrainersByCoach,
  formatDateTimeForDisplay,
  calculateDurationForDisplay,
} from '../services/sessionService.js';
import { getRegionByCode } from '../components/pain-map/usePainRegions';

const PROFILE_TYPES = {
  COACH: 'coach',
  TRAINER: 'treinador',
  ATHLETE: 'atleta',
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
    ['Sono', Number(bemEstar.sono) || 0],
    ['Humor', Number(bemEstar.humor) || 0],
    ['Fadiga', Number(bemEstar.fadiga) || 0],
    ['Dor', Number(bemEstar.dor) || 0],
    ['Estresse', Number(bemEstar.estresse) || 0],
  ].filter(([, value]) => value > 0);

  if (entries.length === 0) return null;

  const average = entries.reduce((sum, [, value]) => sum + value, 0) / entries.length;
  const details = entries.slice(0, 3).map(([label, value]) => `${label} ${value}`).join(' • ');

  return {
    label: `${average.toFixed(1)}/5`,
    helper: details,
  };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  
  // User/Auth
  const [userInfo, setUserInfo] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dashboard Data
  const [stats, setStats] = useState(null);
  
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

  // Main effect: load profile and initialize filters
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setLoading(true);

        if (!user) {
          setUserInfo(null);
          setProfile(null);
          return;
        }

        setUserInfo(user);
        const profileData = await getCurrentUserProfile(user.uid);
        setProfile(profileData);

        const profileType = normalizeProfileType(profileData);

        // Initialize filters based on profile
        if (profileType === PROFILE_TYPES.COACH) {
          await loadCoachFilters(user.uid);
        } else if (profileType === PROFILE_TYPES.TRAINER) {
          await loadTrainerFilters(user.uid);
        }
        
        // Load initial stats with explicit profile type
        await loadDashboardStats(user.uid, 7, profileType, null);
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Cascade loading: coach filters -> trainers
  const loadCoachFilters = async (coachUid) => {
    try {
      setLoadingFilters(true);
      const [trainersData, athletesByCoachData] = await Promise.all([
        getTrainersByCoach(coachUid),
        getAthletesByCoach(coachUid),
      ]);
      setTrainers(trainersData);
      setFilteredAthletesForTrainer(athletesByCoachData || []);
      
      if (trainersData?.length > 0) {
        const firstTrainerId = trainersData[0]?.id;
        setSelectedTrainer(firstTrainerId);
        if (firstTrainerId) {
          await loadAthletesForTrainer(firstTrainerId);
        }
      }
    } catch (error) {
      console.error('Error loading trainer filters:', error);
    } finally {
      setLoadingFilters(false);
    }
  };

  // Load athletes for trainer
  const loadTrainerFilters = async (trainerUid) => {
    try {
      setLoadingFilters(true);
      const athletesData = await getAthletesByTrainer(trainerUid);
      setAthletes(athletesData);
      
      if (athletesData?.length > 0) {
        setSelectedAthlete(athletesData[0]?.id);
      } else {
        setSelectedAthlete(null);
        setStats(null);
      }
    } catch (error) {
      console.error('Error loading athlete list:', error);
      setSelectedAthlete(null);
      setStats(null);
    } finally {
      setLoadingFilters(false);
    }
  };

  // Load athletes for specific trainer (called when trainer changes in coach view)
  const loadAthletesForTrainer = async (trainerId) => {
    try {
      const athletesData = await getAthletesByTrainer(trainerId);
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
    try {
      if (
        (profileType === PROFILE_TYPES.COACH || profileType === PROFILE_TYPES.TRAINER) &&
        !athleteId
      ) {
        setStats(null);
        return;
      }

      let targetUid = uid;

      if ((profileType === PROFILE_TYPES.COACH || profileType === PROFILE_TYPES.TRAINER) && athleteId) {
        targetUid = athleteId;
      }

      const statsData = await getDashboardStatsByPeriod(targetUid, period);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats(null);
    }
  };

  // Handle trainer change (for coach profile)
  const handleTrainerChange = async (newTrainerId) => {
    setSelectedAthlete(null);
    setStats(null);
    setFilteredAthletesForTrainer([]);
    setSelectedTrainer(newTrainerId);
    if (newTrainerId) {
      await loadAthletesForTrainer(newTrainerId);
    }
  };

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
                  {trainer.nome || 'Sem nome'}
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
                    {athlete.nome || 'Sem nome'}
                  </option>
                ))}
              </select>
            </div>
          )}

        {isTrainer && athletes.length > 0 && (
          <div style={styles.filterGroup} className="dashboard-filter-group">
            <label style={styles.filterLabel} className="dashboard-filter-label">Atleta</label>
            <select
              value={selectedAthlete || ''}
              onChange={(e) => setSelectedAthlete(e.target.value)}
              style={styles.filterSelect}
              className="dashboard-filter-select"
            >
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.nome || 'Sem nome'}
                </option>
              ))}
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
    return <div style={styles.page}>Carregando seu dashboard...</div>;
  }

  if (!profile) {
    return (
      <div style={styles.page}>
        <div>Erro ao carregar perfil. Por favor, recarregue a página.</div>
      </div>
    );
  }

  const displayName = profile?.nome || userInfo?.displayName || 'Usuário';
  const latestSessionCard = stats?.latestSessionCard || null;
  const latestSession = latestSessionCard?.session || null;
  const sourceSession = latestSessionCard?.sourceSession || latestSession;
  const latestStatus = getSessionStatusMeta(latestSession);
  const hydrationMeta = getHydrationMeta(sourceSession?.hidratacao);
  const painSummary = getPainSummary(sourceSession?.dorRegioes);
  const pseMeta = getPseMeta(sourceSession?.pseFoster, latestStatus.tone === 'open');
  const wellBeingSummary = getWellBeingSummary(sourceSession?.bemEstar);
  const sourceReferenceDate = latestSessionCard?.sourceType === 'fallback'
    ? formatDateTimeForDisplay(sourceSession?.dataCheckout || sourceSession?.dataCheckin)
    : null;
  const observationParts = [];

  if (latestSessionCard?.inheritedNotice) {
    observationParts.push(latestSessionCard.inheritedNotice);
  }

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

  return (
    <div style={styles.page}>
      <header style={styles.header} className="dashboard-header-section">
        <div>
          <p style={styles.eyebrow} className="dashboard-eyebrow">Painel do dashboard</p>
          <h1 style={styles.title} className="dashboard-title">Dashboard</h1>
          <p style={styles.subtitle} className="dashboard-subtitle">Olá, {displayName}</p>
        </div>
      </header>

      <main style={styles.content} className="dashboard-content-grid">
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

        {/* Latest Session */}
        {latestSession && (
          <section style={styles.lastActivitySection} className="dashboard-last-activity-section">
            <div style={styles.sectionHeader} className="dashboard-section-header">
              <h2 style={styles.sectionTitle} className="dashboard-section-title">Última sessão e sinais do atleta</h2>
            </div>
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
        )}

        {/* Stats */}
        {stats && (
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
        )}

        {/* Activities Distribution */}
        {stats?.activitiesDistribution && Object.keys(stats.activitiesDistribution).length > 0 && (
          <section style={styles.activitiesSection} className="dashboard-activities-section">
            <div style={styles.sectionHeader} className="dashboard-section-header">
              <h2 style={styles.sectionTitle} className="dashboard-section-title">Distribuição de atividades</h2>
            </div>
            <div style={styles.activitiesGrid} className="dashboard-activities-grid">
              {Object.entries(stats.activitiesDistribution).map(([activity, count]) => (
                <div key={activity} style={styles.activityItem} className="dashboard-activity-item">
                  <span style={styles.activityName} className="dashboard-activity-name">{activity}</span>
                  <span style={styles.activityCount} className="dashboard-activity-count">{count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Session History */}
        {stats?.recentActivities && (
          <section style={styles.sessionHistorySection} className="dashboard-session-history-section">
            <div style={styles.sectionHeader} className="dashboard-section-header">
              <h2 style={styles.sectionTitle} className="dashboard-section-title">Histórico de sessões</h2>
            </div>
            {stats.recentActivities.length === 0 ? (
              <div style={styles.emptyState}>
                Nenhuma sessão registrada neste período
              </div>
            ) : (
              <div style={styles.sessionList} className="dashboard-session-list">
                {stats.recentActivities.map((session, index) => (
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
        )}
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
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    cursor: 'pointer',
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
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.3s ease',
  },
  secondaryButton: {
    padding: '10px 16px',
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '14px',
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
