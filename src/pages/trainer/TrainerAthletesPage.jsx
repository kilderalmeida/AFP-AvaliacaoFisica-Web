import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  getTrainerActiveAthletes,
  getTrainerInactiveAthletes,
} from '../../services/athleteLinkService.js';
import { getUserProfile } from '../../services/userService.js';
import { activityService } from '../../services/activity.service.js';
import { fetchCoachAthletes } from '../../services/coach-athletes-backend.service.js';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { EmptyStateCard } from '../../components/feedback/EmptyStateCard.jsx';
import { ErrorStateCard } from '../../components/feedback/ErrorStateCard.jsx';

export default function TrainerAthletesPage() {
  const { user, role } = useAuth();
  const isCoach = role === 'coach';
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState([]);
  const [inactiveAthletes, setInactiveAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingInactive, setLoadingInactive] = useState(false);
  const [inactiveLoaded, setInactiveLoaded] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      let athleteList;

      if (isCoach) {
        // Coach: fetch from Cloud Function (Admin SDK, bypasses Firestore rules)
        const coachAthletes = await fetchCoachAthletes(user.uid);
        const settled = await Promise.allSettled(
          coachAthletes.map(async (a) => {
            const activityResult = await Promise.allSettled([
              activityService.listActivitiesByAthlete(a.uid, { limit: 1 }),
            ]);
            const lastActivity =
              activityResult[0].status === 'fulfilled' ? activityResult[0].value?.[0] ?? null : null;
            return {
              uid: a.uid,
              displayName: a.displayName,
              email: a.email,
              trainerUid: a.trainerUid,
              trainerName: a.trainerName,
              link: { athleteId: a.uid, trainerId: a.trainerUid, status: 'active' },
              lastActivity,
            };
          })
        );
        athleteList = settled
          .filter((r) => r.status === 'fulfilled' && r.value)
          .map((r) => r.value);
      } else {
        // Trainer: existing path via Firestore client SDK
        const links = await getTrainerActiveAthletes(user.uid);
        const settled = await Promise.allSettled(
          links.map(async (link) => {
            const [profileResult, activityResult] = await Promise.allSettled([
              getUserProfile(link.athleteId),
              activityService.listActivitiesByAthlete(link.athleteId, { limit: 1 }),
            ]);
            const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
            const lastActivity =
              activityResult.status === 'fulfilled' ? activityResult.value?.[0] ?? null : null;
            return profile ? { ...profile, link, lastActivity } : null;
          })
        );
        athleteList = settled
          .filter((r) => r.status === 'fulfilled' && r.value)
          .map((r) => r.value)
          .sort((a, b) =>
            String(a.displayName || a.email || '').localeCompare(
              String(b.displayName || b.email || ''),
              'pt-BR'
            )
          );
      }

      setAthletes(athleteList);
    } catch (err) {
      setError('Erro ao carregar atletas.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, isCoach]);

  useEffect(() => { load(); }, [load]);

  async function handleToggleInactive() {
    const next = !showInactive;
    setShowInactive(next);
    if (next && !inactiveLoaded) {
      setLoadingInactive(true);
      try {
        const links = await getTrainerInactiveAthletes(user.uid);
        const settled = await Promise.allSettled(
          links.map(async (link) => {
            const profile = await getUserProfile(link.athleteId);
            return profile ? { ...profile, link } : null;
          })
        );
        setInactiveAthletes(
          settled
            .filter((r) => r.status === 'fulfilled' && r.value)
            .map((r) => r.value)
            .sort((a, b) => {
              const tA = a.link?.unlinkedAt?.seconds ?? 0;
              const tB = b.link?.unlinkedAt?.seconds ?? 0;
              return tB - tA;
            })
        );
        setInactiveLoaded(true);
      } catch (err) {
        console.error('Erro ao carregar inativos:', err);
      } finally {
        setLoadingInactive(false);
      }
    }
  }

  const inactiveLabel = inactiveLoaded
    ? `${showInactive ? 'Ocultar' : 'Mostrar'} inativos (${inactiveAthletes.length})`
    : `${showInactive ? 'Ocultar' : 'Mostrar'} inativos`;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <p style={styles.eyebrow}>Treinador</p>
        <h1 style={styles.title}>Meus atletas</h1>
        <p style={styles.subtitle}>Atletas vinculados à sua conta.</p>
      </div>

      {loading && (
        <EmptyStateCard title="Carregando..." message="Buscando seus atletas." />
      )}
      {!loading && error && (
        <ErrorStateCard title="Erro ao carregar atletas" message={error} onAction={load} />
      )}

      {!loading && !error && athletes.length === 0 && (
        <EmptyStateCard
          title="Nenhum atleta vinculado"
          message="Você ainda não tem atletas vinculados no momento."
        />
      )}

      {!loading && !error && athletes.length > 0 && (
        <div style={styles.grid}>
          {athletes.map((a) => (
            <div key={a.uid} style={styles.card}>
              <div style={styles.cardTop}>
                <span style={styles.avatar}>
                  {(a.displayName || a.email || '?')[0].toUpperCase()}
                </span>
                <div>
                  <p style={styles.name}>{a.displayName || '—'}</p>
                  <p style={styles.email}>{a.email}</p>
                  {isCoach && a.trainerName && (
                    <p style={styles.trainerLabel}>Treinador: {a.trainerName}</p>
                  )}
                </div>
              </div>
              <div style={styles.activitySummary}>
                {a.lastActivity ? (
                  <>
                    <span style={styles.activityDate}>
                      Último check-in: {formatDate(a.lastActivity.activityDate)}
                    </span>
                    <StatusBadge kind="activity" value={a.lastActivity.status} />
                    {daysSince(a.lastActivity.activityDate) > INACTIVITY_DAYS && (
                      <span style={styles.inactivityLabel}>
                        Sem atividade há {daysSince(a.lastActivity.activityDate)} dias
                      </span>
                    )}
                  </>
                ) : (
                  <span style={styles.activityNone}>Sem atividades registradas</span>
                )}
              </div>
              <div style={styles.cardActions}>
                <button
                  style={styles.btnDashboard}
                  onClick={() => navigate(`/dashboard?athleteId=${a.uid}`)}
                >
                  Ver painel
                </button>
                <button
                  style={styles.btnAssess}
                  onClick={() => navigate('/avaliacao-pafp')}
                >
                  Avaliar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && !isCoach && (
        <div style={styles.inactiveSection}>
          <button style={styles.btnToggleInactive} onClick={handleToggleInactive}>
            {inactiveLabel}
          </button>

          {showInactive && (
            <>
              {loadingInactive && <p style={styles.hint}>Carregando histórico...</p>}

              {!loadingInactive && inactiveLoaded && inactiveAthletes.length === 0 && (
                <EmptyStateCard
                  title="Nenhum vínculo inativo"
                  message="Não há vínculos inativos no histórico."
                />
              )}

              {!loadingInactive && inactiveAthletes.length > 0 && (
                <div style={styles.grid}>
                  {inactiveAthletes.map((a) => (
                    <div key={`${a.uid}-${a.link?.linkId}`} style={styles.cardInactive}>
                      <div style={styles.cardTop}>
                        <span style={{ ...styles.avatar, ...styles.avatarInactive }}>
                          {(a.displayName || a.email || '?')[0].toUpperCase()}
                        </span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <p style={{ ...styles.name, color: '#94a3b8' }}>{a.displayName || '—'}</p>
                            <StatusBadge kind="userStatus" value="inactive" />
                          </div>
                          <p style={styles.email}>{a.email}</p>
                        </div>
                      </div>
                      {a.link?.unlinkedAt && (
                        <p style={styles.unlinkedDate}>
                          Desvinculado em: {formatDate(a.link.unlinkedAt)}
                        </p>
                      )}
                      <div style={styles.cardActions}>
                        <button
                          style={styles.btnAssess}
                          onClick={() => navigate('/avaliacao-pafp')}
                        >
                          Avaliar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const INACTIVITY_DAYS = 14;

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysSince(ts) {
  if (!ts) return 0;
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

const styles = {
  page: { display: 'grid', gap: '20px', padding: '24px', maxWidth: '800px', margin: '0 auto' },
  header: { display: 'grid', gap: '4px' },
  eyebrow: { margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569' },
  title: { margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' },
  subtitle: { margin: 0, fontSize: '14px', color: '#64748b' },
  hint: { color: '#64748b', fontSize: '14px' },
  grid: { display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'grid',
    gap: '14px',
  },
  cardInactive: {
    background: '#f8fafc',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #e2e8f0',
    display: 'grid',
    gap: '12px',
  },
  cardTop: { display: 'flex', gap: '12px', alignItems: 'center' },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#dbeafe',
    color: '#1d4ed8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '16px',
    flexShrink: 0,
  },
  avatarInactive: {
    background: '#f1f5f9',
    color: '#94a3b8',
  },
  name: { margin: 0, fontWeight: 600, fontSize: '14px', color: '#0f172a' },
  email: { margin: 0, fontSize: '12px', color: '#64748b' },
  trainerLabel: { margin: 0, fontSize: '11px', color: '#94a3b8', marginTop: '2px' },
  activitySummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    fontSize: '12px',
    color: '#475569',
  },
  activityDate: { color: '#475569' },
  activityNone: { color: '#94a3b8', fontStyle: 'italic' },
  inactivityLabel: {
    padding: '2px 8px',
    borderRadius: '999px',
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '11px',
    fontWeight: 600,
  },
  cardActions: { display: 'flex', gap: '8px' },
  unlinkedDate: {
    margin: 0,
    fontSize: '12px',
    color: '#94a3b8',
  },
  inactiveSection: {
    display: 'grid',
    gap: '16px',
  },
  btnToggleInactive: {
    justifySelf: 'start',
    padding: '7px 14px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#475569',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnDashboard: {
    flex: 1,
    padding: '7px',
    borderRadius: '7px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#334155',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  btnAssess: {
    flex: 1,
    padding: '7px',
    borderRadius: '7px',
    border: 'none',
    background: '#1d4ed8',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 600,
  },
};
