import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase/config.js';
import { formatDateTimeForDisplay } from '../../services/sessionService.js';
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
  carga?: number;
  vfc?: number;
  hidratacao?: number;
  recuperacao?: string;
  dorRegioes?: unknown[];
  bemEstar?: Record<string, number>;
  status?: string;
};

function normalizeFromFirestore(docSnap: { id: string; data: () => Record<string, unknown> }): Activity {
  const data = docSnap.data();
  const checkinAt = (data?.checkin as Record<string, unknown>)?.createdAt || data?.activityDate || data?.createdAt || null;
  const checkoutAt = (data?.checkout as Record<string, unknown>)?.createdAt || null;
  const pse = Number.isFinite(Number((data?.checkout as Record<string, unknown>)?.pse))
    ? Number((data?.checkout as Record<string, unknown>)?.pse)
    : null;
  const durationMinutes = Number(data?.durationMinutes) > 0 ? Number(data.durationMinutes) : 0;

  return {
    id: docSnap.id,
    athleteId: String(data?.athleteUserId || ''),
    activityDate: data?.activityDate || data?.createdAt || null,
    atividades: [data?.activityType, data?.modality].filter(Boolean) as string[],
    vfc: Number((data?.checkin as Record<string, unknown>)?.hrv) || 0,
    bemEstar: ((data?.checkin as Record<string, unknown>)?.wellBeing as Record<string, number>) || {},
    recuperacao: String((data?.checkout as Record<string, unknown>)?.recovery || ''),
    dorRegioes: Array.isArray((data?.checkin as Record<string, unknown>)?.painRegions)
      ? ((data?.checkin as Record<string, unknown>)?.painRegions as unknown[])
      : [],
    hidratacao: Number((data?.checkin as Record<string, unknown>)?.hydration) || 0,
    dataCheckin: checkinAt,
    dataCheckout: data?.status === 'open' ? null : checkoutAt,
    pseFoster: pse,
    duracaoMin: durationMinutes,
    carga: pse !== null && durationMinutes > 0 ? pse * durationMinutes : 0,
    status: String(data?.status || (checkoutAt ? 'completed' : 'open')),
  };
}

function getActivityLabel(activity: Activity): string {
  const atividades = Array.isArray(activity?.atividades) ? activity.atividades.filter(Boolean) : [];
  if (atividades.length === 0 || atividades[0] === 'assessment') return 'Sessão de treino';
  return atividades.join(' • ');
}

export default function ActivityDetailPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!activityId) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const snap = await getDoc(doc(db, 'activities', activityId!));
        if (!snap.exists()) {
          setError(new Error('Atividade não encontrada'));
        } else {
          setActivity(normalizeFromFirestore({ id: snap.id, data: snap.data.bind(snap) }));
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao carregar atividade'));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [activityId]);

  if (loading) {
    return (
      <div style={styles.page}>
        <EmptyStateCard title="Carregando..." message="Buscando dados da atividade." />
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div style={styles.page}>
        <ErrorStateCard
          title="Atividade não encontrada"
          message={error?.message || 'Não foi possível carregar esta atividade.'}
          onAction={() => navigate('/activities')}
        />
      </div>
    );
  }

  const isOpen = !activity.dataCheckout;
  const wellBeingEntries = activity.bemEstar
    ? Object.entries({ Sono: 'sleep', Humor: 'mood', Fadiga: 'fatigue', Dor: 'pain', Estresse: 'stress' })
        .map(([label, key]) => ({ label, value: Number(activity.bemEstar![key]) || 0 }))
        .filter((e) => e.value > 0)
    : [];

  return (
    <div style={styles.page}>
      <button type="button" style={styles.backButton} onClick={() => navigate('/activities')}>
        ← Voltar
      </button>

      <header style={styles.header}>
        <p style={styles.eyebrow}>Detalhe da atividade</p>
        <h1 style={styles.title}>{getActivityLabel(activity)}</h1>
        <span
          style={{
            ...styles.badge,
            background: isOpen ? '#dbeafe' : '#dcfce7',
            color: isOpen ? '#1d4ed8' : '#166534',
          }}
        >
          {isOpen ? 'Aberta' : 'Finalizada'}
        </span>
      </header>

      <div style={styles.grid}>
        <div style={styles.card}>
          <p style={styles.cardLabel}>Check-in</p>
          <p style={styles.cardValue}>{formatDateTimeForDisplay(activity.dataCheckin)}</p>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Check-out</p>
          <p style={styles.cardValue}>
            {activity.dataCheckout ? formatDateTimeForDisplay(activity.dataCheckout) : 'Em andamento'}
          </p>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Duração</p>
          <p style={styles.cardValue}>
            {Number(activity.duracaoMin) > 0 ? `${activity.duracaoMin} min` : 'N/D'}
          </p>
        </div>

        {activity.pseFoster !== null && activity.pseFoster !== undefined && (
          <div style={styles.card}>
            <p style={styles.cardLabel}>PSE</p>
            <p style={styles.cardValue}>{activity.pseFoster}</p>
          </div>
        )}

        {Number(activity.vfc) > 0 && (
          <div style={styles.card}>
            <p style={styles.cardLabel}>VFC</p>
            <p style={styles.cardValue}>{activity.vfc}</p>
          </div>
        )}

        {Number(activity.hidratacao) > 0 && (
          <div style={styles.card}>
            <p style={styles.cardLabel}>Hidratação</p>
            <p style={styles.cardValue}>{activity.hidratacao}/8</p>
          </div>
        )}

        {Number(activity.carga) > 0 && (
          <div style={styles.card}>
            <p style={styles.cardLabel}>Carga</p>
            <p style={styles.cardValue}>{activity.carga}</p>
          </div>
        )}
      </div>

      {typeof activity.recuperacao === 'string' && activity.recuperacao.trim() && (
        <div style={styles.section}>
          <p style={styles.sectionLabel}>Recuperação</p>
          <p style={styles.sectionText}>{activity.recuperacao}</p>
        </div>
      )}

      {wellBeingEntries.length > 0 && (
        <div style={styles.section}>
          <p style={styles.sectionLabel}>Bem-estar</p>
          <div style={styles.wellBeingGrid}>
            {wellBeingEntries.map(({ label, value }) => (
              <div key={label} style={styles.wellBeingCell}>
                <span style={styles.wellBeingLabel}>{label}</span>
                <strong style={styles.wellBeingValue}>{value}/5</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fb',
    padding: '24px 20px 48px',
    fontFamily: 'Arial, sans-serif',
    color: '#1f2937',
    display: 'grid',
    alignContent: 'start',
    gap: '20px',
    maxWidth: '700px',
    margin: '0 auto',
  },
  backButton: {
    alignSelf: 'start',
    padding: '8px 14px',
    background: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 600,
  },
  header: {
    display: 'grid',
    gap: '6px',
  },
  eyebrow: {
    margin: 0,
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    lineHeight: 1.2,
    color: '#111827',
  },
  badge: {
    display: 'inline-block',
    width: 'fit-content',
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '10px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '10px',
    padding: '14px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
    display: 'grid',
    gap: '4px',
  },
  cardLabel: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  cardValue: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
  },
  section: {
    background: '#ffffff',
    borderRadius: '10px',
    padding: '14px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
    display: 'grid',
    gap: '8px',
  },
  sectionLabel: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  sectionText: {
    margin: 0,
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.5,
  },
  wellBeingGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  wellBeingCell: {
    display: 'grid',
    gap: '2px',
    padding: '8px 12px',
    background: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  wellBeingLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  wellBeingValue: {
    fontSize: '14px',
    color: '#0f172a',
  },
};
