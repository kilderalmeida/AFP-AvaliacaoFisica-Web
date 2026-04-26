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
import {
  getCurrentUserProfile,
  getDashboardStatsByPeriod,
  getAthletesByCoach,
  getAthletesByTrainer,
  getTrainersByCoach,
  formatDateTimeForDisplay,
} from '../services/sessionService.js';

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
  return String(profileData?.papel || profileData?.perfil || '')
    .normalize('NFC')
    .trim()
    .toLowerCase();
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
        console.log('[Dashboard][debug] profileType:', profileType);

        // Initialize filters based on profile
        if (profileType === PROFILE_TYPES.COACH) {
          await loadCoachFilters(user.uid);
        } else if (profileType === PROFILE_TYPES.TRAINER) {
          await loadTrainerFilters(user.uid);
        }
        
        // Load initial stats with explicit profile type
        await loadDashboardStats(user.uid, 7, profileType, null, null);
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
      const trainersData = await getTrainersByCoach(coachUid);
      setTrainers(trainersData);
      console.log('[Dashboard][debug] trainers loaded:', trainersData.length);
      
      if (trainersData?.length > 0) {
        const firstTrainerId = trainersData[0]?.id;
        setSelectedTrainer(firstTrainerId);
        console.log('[Dashboard][debug] selected trainerId:', firstTrainerId);
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
      console.log('[Dashboard][debug] athletes loaded:', athletesData.length);
      
      if (athletesData?.length > 0) {
        setSelectedAthlete(athletesData[0]?.id);
      }
    } catch (error) {
      console.error('Error loading athlete list:', error);
    } finally {
      setLoadingFilters(false);
    }
  };

  // Load athletes for specific trainer (called when trainer changes in coach view)
  const loadAthletesForTrainer = async (trainerId) => {
    try {
      const athletesData = await getAthletesByTrainer(trainerId);
      setFilteredAthletesForTrainer(athletesData);
      console.log('[Dashboard][debug] selected trainerId:', trainerId);
      console.log('[Dashboard][debug] filteredAthletesForTrainer loaded:', athletesData.length);
      
      if (athletesData?.length > 0) {
        setSelectedAthlete(athletesData[0]?.id);
      }
    } catch (error) {
      console.error('Error loading athletes for trainer:', error);
    }
  };

  // Load dashboard stats
  const loadDashboardStats = async (uid, period, profileType, trainerId, athleteId) => {
    try {
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
        selectedTrainer,
        selectedAthlete
      );
    }
  }, [selectedPeriod, selectedAthlete, selectedTrainer, profileType]);

  // Render filters based on profile
  const renderFilters = () => {
    return (
      <div style={styles.filterBar}>
        {/* Trainer filter for Coach */}
        {isCoach && trainers.length > 0 && (
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Treinador</label>
            <select
              value={selectedTrainer || ''}
              onChange={(e) => handleTrainerChange(e.target.value)}
              style={styles.filterSelect}
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
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Atleta</label>
              <select
                value={selectedAthlete || ''}
                onChange={(e) => setSelectedAthlete(e.target.value)}
                style={styles.filterSelect}
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
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Atleta</label>
            <select
              value={selectedAthlete || ''}
              onChange={(e) => setSelectedAthlete(e.target.value)}
              style={styles.filterSelect}
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
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Período</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            style={styles.filterSelect}
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
  
  // Get the target name for display          
  let targetDisplayName = displayName;
  if (!isAthlete && selectedAthlete) {
    // Find the athlete name from filtered lists
    if (isCoach) {
      const athlete = filteredAthletesForTrainer.find((a) => a.id === selectedAthlete);
      targetDisplayName = athlete?.nome || displayName;
    } else if (isTrainer) {
      const athlete = athletes.find((a) => a.id === selectedAthlete);
      targetDisplayName = athlete?.nome || displayName;
    }
  }
  // console.log('profile:', profile);
  // console.log('isAthlete:', isAthlete);
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Painel do dashboard</p>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.subtitle}>Olá, {displayName}</p>
        </div>
      </header>

      <main style={styles.content}>
        {/* Quick Actions - Only for Athletes */}
        {isAthlete && (
          <section style={styles.actionsSection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Ações rápidas</h2>
            </div>
            <div style={styles.actionsGrid}>
              <button
                style={styles.primaryButton}
                onClick={() => navigate('/checkin')}
              >
                Check-in
              </button>
              <button
                style={styles.secondaryButton}
                onClick={() => navigate('/checkout')}
              >
                Check-out
              </button>
              <button
                style={styles.secondaryButton}
                onClick={() => navigate('/avaliacao-pafp')}
              >
                Avaliação
              </button>
            </div>
          </section>
        )}
        
        {/* Filters */}
        {renderFilters()}

        {/* Last Activity */}
        {stats?.lastSession && (
          <section style={styles.lastActivitySection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Última atividade</h2>
            </div>
            <div style={styles.lastActivityContent}>
              <div>
                <span style={styles.activityLabel}>Atividade</span>
                <p style={styles.activityValue}>
                  {stats.lastSession.atividades?.[0] || 'Sessão de treino'}
                </p>
              </div>
              <div>
                <span style={styles.activityLabel}>Data</span>
                <p style={styles.activityValue}>
                  {formatDateTimeForDisplay(stats.lastSession.dataCheckin)}
                </p>
              </div>
              <div>
                <span style={styles.activityLabel}>Duração</span>
                <p style={styles.activityValue}>
                  {stats.lastSession.duracaoMin ? `${stats.lastSession.duracaoMin}m` : 'N/D'}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Stats */}
        {stats && (
          <section style={styles.statsSection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Estatísticas ({stats.period}d)</h2>
            </div>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <span style={styles.statLabel}>Sessões</span>
                <strong style={styles.statValue}>{stats.totalSessions}</strong>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statLabel}>Horas</span>
                <strong style={styles.statValue}>{stats.totalHoursLabel}</strong>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statLabel}>Minutos</span>
                <strong style={styles.statValue}>{stats.totalMinutes}</strong>
              </div>
            </div>
          </section>
        )}

        {/* Activities Distribution */}
        {stats?.activitiesDistribution && stats.activitiesDistribution.size > 0 && (
          <section style={styles.activitiesSection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Distribuição de atividades</h2>
            </div>
            <div style={styles.activitiesGrid}>
              {Array.from(stats.activitiesDistribution.entries()).map(([activity, count]) => (
                <div key={activity} style={styles.activityItem}>
                  <span style={styles.activityName}>{activity}</span>
                  <span style={styles.activityCount}>{count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Session History */}
        {stats?.recentActivities && (
          <section style={styles.sessionHistorySection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Histórico de sessões</h2>
            </div>
            {stats.recentActivities.length === 0 ? (
              <div style={styles.emptyState}>
                Nenhuma sessão registrada neste período
              </div>
            ) : (
              <div style={styles.sessionList}>
                {stats.recentActivities.map((session, index) => (
                  <article key={index} style={styles.sessionItem}>
                    <div style={styles.sessionInfo}>
                      <p style={styles.sessionActivity}>
                        {session.atividades?.[0] || 'Sessão de treino'}
                      </p>
                      <p style={styles.sessionDate}>
                        {formatDateTimeForDisplay(session.dataCheckin)}
                      </p>
                    </div>
                    <span style={styles.sessionDuration}>
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
  lastActivityContent: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '16px',
  },
  activityLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
  },
  activityValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1f2937',
    margin: 0,
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
  },
  activityName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#1f2937',
  },
  activityCount: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#1976d2',
    background: '#e3f2fd',
    padding: '4px 8px',
    borderRadius: '4px',
    marginLeft: '8px',
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
