import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../services/firebase/config.js';
import {
  getCurrentUserProfile,
  getAthleteDashboardStats,
  getTrainerDashboardStatsByPeriod,
  formatDateTimeForDisplay,
} from '../../services/sessionService.js';
import {
  listTrainerAthleteOptions,
  resolveTrainerSelectedAthleteId,
  setStoredTrainerSelectedAthleteId,
} from '../../services/trainer-athlete-context.service.js';
import { EmptyStateCard } from '../../components/feedback/EmptyStateCard.jsx';
import { ErrorStateCard } from '../../components/feedback/ErrorStateCard.jsx';

type Activity = {
  id: string;
  athleteId?: string;
  activityDate?: unknown;
  atividades?: string[];
  dataCheckin?: unknown;
  dataCheckout?: unknown;
  duracaoMin?: number;
  pseFoster?: number | null;
  status?: string;
};

type AthleteOption = { id: string; displayName: string };

function normalizeRole(profileData: unknown): string {
  return String((profileData as { papel?: string })?.papel || '')
    .normalize('NFC')
    .trim()
    .toLowerCase();
}

function getActivityLabel(activity: Activity): string {
  const atividades = Array.isArray(activity?.atividades) ? activity.atividades.filter(Boolean) : [];
  if (atividades.length === 0) return 'Sessão de treino';
  return atividades.join(' • ');
}

function getStatusMeta(activity: Activity): { label: string; color: string; bg: string } {
  const isOpen = !activity?.dataCheckout;
  return isOpen
    ? { label: 'Aberta', color: '#1d4ed8', bg: '#dbeafe' }
    : { label: 'Finalizada', color: '#166534', bg: '#dcfce7' };
}

export default function ActivitiesListPage() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [profile, setProfile] = useState<unknown>(null);
  const [userInfo, setUserInfo] = useState<{ uid: string } | null>(null);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [loadingActivities, setLoadingActivities] = useState(false);

  async function loadActivities(role: string, uid: string, athleteId?: string | null) {
    setLoadingActivities(true);
    setError(null);
    try {
      if (role === 'treinador' || role === 'coach') {
        if (!athleteId) {
          setActivities([]);
          return;
        }
        const stats = await getTrainerDashboardStatsByPeriod(uid, athleteId, 7);
        setActivities(Array.isArray(stats?.recentActivities) ? stats.recentActivities : []);
      } else {
        // atleta: usa o mesmo endpoint do dashboard — remove leitura direta do Firestore
        const stats = await getAthleteDashboardStats(uid, 7);
        setActivities(Array.isArray(stats?.recentActivities) ? stats.recentActivities : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar atividades'));
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      setUserInfo({ uid: user.uid });

      try {
        const profileData = await getCurrentUserProfile(user.uid);
        setProfile(profileData);
        const role = normalizeRole(profileData);

        if (role === 'treinador' || role === 'coach') {
          const options = await listTrainerAthleteOptions(user.uid);
          setAthletes(options);
          const initialId = resolveTrainerSelectedAthleteId(user.uid, options);
          setSelectedAthlete(initialId);
          await loadActivities(role, user.uid, initialId);
        } else {
          await loadActivities(role, user.uid);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao inicializar página'));
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAthleteChange(athleteId: string) {
    if (!userInfo) return;
    const role = normalizeRole(profile);
    setSelectedAthlete(athleteId);
    setStoredTrainerSelectedAthleteId(userInfo.uid, athleteId);
    await loadActivities(role, userInfo.uid, athleteId);
  }

  const role = normalizeRole(profile);
  const isTrainer = role === 'treinador' || role === 'coach';

  if (loading) {
    return (
      <div style={styles.page}>
        <EmptyStateCard
          title="Carregando atividades"
          message="Aguarde enquanto buscamos seus dados."
        />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Histórico</p>
        <h1 style={styles.title}>Atividades</h1>
      </header>

      {isTrainer && athletes.length > 0 && (
        <div style={styles.filterBar}>
          <label style={styles.filterLabel}>Atleta</label>
          <select
            value={selectedAthlete || ''}
            onChange={(e) => handleAthleteChange(e.target.value)}
            style={styles.filterSelect}
            disabled={loadingActivities}
          >
            {athletes.length === 0 ? (
              <option value="">Nenhum atleta vinculado</option>
            ) : (
              athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {error && (
        <ErrorStateCard
          title="Erro ao carregar atividades"
          message={error.message}
          onAction={() => {
            if (!userInfo) return;
            void loadActivities(role, userInfo.uid, selectedAthlete);
          }}
        />
      )}

      {!error && !loadingActivities && isTrainer && !selectedAthlete && (
        <EmptyStateCard
          title="Nenhum atleta selecionado"
          message="Selecione um atleta para ver as atividades."
        />
      )}

      {!error && loadingActivities && (
        <EmptyStateCard title="Carregando..." message="Buscando atividades." />
      )}

      {!error && !loadingActivities && activities.length === 0 && (!isTrainer || selectedAthlete) && (
        <EmptyStateCard
          title="Nenhuma atividade encontrada"
          message="Ainda não há atividades registradas para este contexto."
          hint={!isTrainer ? 'Inicie um Check-in para registrar sua primeira atividade.' : undefined}
          action={
            !isTrainer ? (
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => navigate('/checkin')}
              >
                Iniciar Check-in
              </button>
            ) : undefined
          }
        />
      )}

      {!error && !loadingActivities && activities.length > 0 && (
        <section style={styles.list}>
          {activities.map((activity, index) => {
            const status = getStatusMeta(activity);
            return (
              <article
                key={activity.id || index}
                style={styles.card}
                onClick={() => activity.id && navigate(`/activities/${activity.id}`)}
                role={activity.id ? 'button' : undefined}
                tabIndex={activity.id ? 0 : undefined}
              >
                <div style={styles.cardMain}>
                  <div style={styles.cardInfo}>
                    <p style={styles.activityName}>{getActivityLabel(activity)}</p>
                    <p style={styles.activityDate}>
                      {formatDateTimeForDisplay(activity.dataCheckin)}
                    </p>
                  </div>
                  <div style={styles.cardRight}>
                    <span style={{ ...styles.statusBadge, background: status.bg, color: status.color }}>
                      {status.label}
                    </span>
                    {Number(activity.duracaoMin) > 0 && (
                      <span style={styles.duration}>{activity.duracaoMin}min</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fb',
    padding: '32px 20px 48px',
    fontFamily: 'Arial, sans-serif',
    color: '#1f2937',
    display: 'grid',
    alignContent: 'start',
    gap: '20px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {},
  eyebrow: {
    margin: 0,
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  title: {
    margin: '4px 0 0',
    fontSize: '36px',
    lineHeight: 1.1,
    color: '#111827',
  },
  filterBar: {
    background: '#ffffff',
    borderRadius: '10px',
    padding: '14px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  filterLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    flexShrink: 0,
  },
  filterSelect: {
    flex: 1,
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  list: {
    display: 'grid',
    gap: '10px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '10px',
    padding: '14px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
    cursor: 'pointer',
    borderLeft: '4px solid #6366f1',
    transition: 'box-shadow 0.15s',
  },
  cardMain: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  activityName: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
  },
  activityDate: {
    margin: '3px 0 0',
    fontSize: '12px',
    color: '#6b7280',
  },
  cardRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
    flexShrink: 0,
  },
  statusBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  duration: {
    fontSize: '12px',
    color: '#4b5563',
    fontWeight: 600,
  },
  primaryButton: {
    padding: '10px 16px',
    background: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '14px',
  },
};
