import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getTrainerActiveAthletes } from '../../services/athleteLinkService.js';
import { getUserProfile } from '../../services/userService.js';

export default function TrainerAthletesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const links = await getTrainerActiveAthletes(user.uid);
        const settled = await Promise.allSettled(
          links.map((l) => getUserProfile(l.athleteId))
        );
        setAthletes(
          settled
            .filter((r) => r.status === 'fulfilled' && r.value)
            .map((r) => r.value)
        );
      } catch (err) {
        setError('Erro ao carregar atletas.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.uid]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <p style={styles.eyebrow}>Treinador</p>
        <h1 style={styles.title}>Meus atletas</h1>
        <p style={styles.subtitle}>Atletas vinculados à sua conta.</p>
      </div>

      {loading && <p style={styles.hint}>Carregando...</p>}
      {error && <p style={styles.errorText}>{error}</p>}

      {!loading && !error && athletes.length === 0 && (
        <p style={styles.hint}>Nenhum atleta vinculado a você no momento.</p>
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
                </div>
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
    </div>
  );
}

const styles = {
  page: { display: 'grid', gap: '20px', padding: '24px', maxWidth: '800px', margin: '0 auto' },
  header: { display: 'grid', gap: '4px' },
  eyebrow: { margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569' },
  title: { margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' },
  subtitle: { margin: 0, fontSize: '14px', color: '#64748b' },
  hint: { color: '#64748b', fontSize: '14px' },
  errorText: { color: '#dc2626', fontSize: '14px' },
  grid: { display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'grid',
    gap: '14px',
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
  name: { margin: 0, fontWeight: 600, fontSize: '14px', color: '#0f172a' },
  email: { margin: 0, fontSize: '12px', color: '#64748b' },
  cardActions: { display: 'flex', gap: '8px' },
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
