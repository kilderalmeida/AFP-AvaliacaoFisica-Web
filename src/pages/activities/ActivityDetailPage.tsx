import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config.js';
import { formatDateTimeForDisplay } from '../../services/sessionService.js';
import { getRegionByCode } from '../../components/pain-map/usePainRegions.js';
import { EmptyStateCard } from '../../components/feedback/EmptyStateCard.jsx';
import { ErrorStateCard } from '../../components/feedback/ErrorStateCard.jsx';

// ── Types ─────────────────────────────────────────────────────────────────────

type Activity = {
  id: string;
  athleteUserId: string;
  trainerUserId: string;
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
  notasCheckout?: string;
  dorRegioes?: unknown[];
  bemEstar?: Record<string, number>;
  status?: string;
};

// ── Normalization ─────────────────────────────────────────────────────────────

function normalizeFromFirestore(docSnap: { id: string; data: () => Record<string, unknown> }): Activity {
  const data = docSnap.data();
  const checkin = (data?.checkin as Record<string, unknown>) ?? {};
  const checkout = (data?.checkout as Record<string, unknown>) ?? {};

  const checkinAt = checkin?.createdAt || data?.activityDate || data?.createdAt || null;
  const checkoutAt = checkout?.createdAt || null;
  const pse = Number.isFinite(Number(checkout?.pse)) ? Number(checkout.pse) : null;
  const durationMinutes = Number(data?.durationMinutes) > 0 ? Number(data.durationMinutes) : 0;

  return {
    id: docSnap.id,
    athleteUserId: String(data?.athleteUserId || ''),
    trainerUserId: String(data?.trainerUserId || ''),
    activityDate: data?.activityDate || data?.createdAt || null,
    atividades: [data?.activityType, data?.modality].filter(Boolean) as string[],
    vfc: Number(checkin?.hrv) || 0,
    bemEstar: (checkin?.wellBeing as Record<string, number>) || {},
    recuperacao: String(checkout?.recovery || ''),
    notasCheckout: String(checkout?.notes || ''),
    dorRegioes: Array.isArray(checkin?.painRegions) ? (checkin.painRegions as unknown[]) : [],
    hidratacao: Number(checkin?.hydration) || 0,
    dataCheckin: checkinAt,
    dataCheckout: data?.status === 'open' ? null : checkoutAt,
    pseFoster: pse,
    duracaoMin: durationMinutes,
    carga: pse !== null && durationMinutes > 0 ? pse * durationMinutes : 0,
    status: String(data?.status || (checkoutAt ? 'completed' : 'open')),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getActivityLabel(activity: Activity): string {
  const list = Array.isArray(activity?.atividades) ? activity.atividades.filter(Boolean) : [];
  return list.length === 0 ? 'Sessão de treino' : list.join(' • ');
}

function resolvePainRegionName(region: unknown): string {
  if (!region) return '';
  if (typeof region === 'string') return (getRegionByCode(region) as { name?: string } | null)?.name || region;
  const r = region as { name?: string; code?: string };
  if (typeof r.name === 'string' && r.name.trim()) return r.name;
  if (typeof r.code === 'string') return (getRegionByCode(r.code) as { name?: string } | null)?.name || r.code;
  return '';
}

const HYDRATION_LABELS = [
  'Muito clara — bem hidratado',
  'Clara — bem hidratado',
  'Amarelo claro — hidratação adequada',
  'Amarelo moderado — hidratação adequada',
  'Amarelo forte — atenção',
  'Amarelo escuro — atenção',
  'Âmbar — possível desidratação',
  'Muito escura — possível desidratação',
];

function getHydrationLabel(level: number): string {
  if (level < 1 || level > 8) return `${level}/8`;
  return `${level}/8 — ${HYDRATION_LABELS[level - 1]}`;
}

const PSE_SCALE = [
  'Repouso', 'Muito leve', 'Muito leve', 'Leve', 'Leve',
  'Moderado', 'Moderado', 'Intenso', 'Intenso', 'Muito intenso', 'Máximo esforço',
];

function getPseLabel(pse: number | null | undefined): string {
  if (pse === null || pse === undefined) return '—';
  const n = Number(pse);
  if (!Number.isFinite(n) || n < 0 || n > 10) return String(pse);
  return `${n} • ${PSE_SCALE[n]}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  const currentUid = auth.currentUser?.uid || '';
  const canCloseSession =
    isOpen && (currentUid === activity.trainerUserId || currentUid === activity.athleteUserId);

  const wellBeingEntries = activity.bemEstar
    ? Object.entries({ Sono: 'sleep', Humor: 'mood', Fadiga: 'fatigue', Dor: 'pain', Estresse: 'stress' })
        .map(([label, key]) => ({ label, value: Number(activity.bemEstar![key]) || 0 }))
        .filter((e) => e.value > 0)
    : [];

  const painRegionNames = Array.isArray(activity.dorRegioes)
    ? [...new Set(activity.dorRegioes.map(resolvePainRegionName).filter(Boolean))]
    : [];

  return (
    <div style={styles.page}>
      <button type="button" style={styles.backButton} onClick={() => navigate('/activities')}>
        ← Voltar
      </button>

      {/* ── Header ── */}
      <header style={styles.header}>
        <p style={styles.eyebrow}>Detalhe da atividade</p>
        <h1 style={styles.title}>{getActivityLabel(activity)}</h1>
        <div style={styles.badgeRow}>
          <span
            style={{
              ...styles.badge,
              background: isOpen ? '#dbeafe' : '#dcfce7',
              color: isOpen ? '#1d4ed8' : '#166534',
            }}
          >
            {isOpen ? 'Aberta — sessão em andamento' : 'Finalizada'}
          </span>
        </div>
      </header>

      {/* ── Fechar sessão ── */}
      {canCloseSession && (
        <div style={styles.closeSessionBanner}>
          <p style={styles.closeSessionText}>
            Esta sessão está em andamento. Finalize o check-out para registrar o PSE e a duração.
          </p>
          <button
            type="button"
            style={styles.closeSessionButton}
            onClick={() => navigate('/checkout')}
          >
            Fechar sessão →
          </button>
        </div>
      )}

      {/* ── Check-in ── */}
      <section style={styles.section}>
        <p style={styles.sectionLabel}>Check-in</p>
        <div style={styles.grid}>
          <div style={styles.card}>
            <p style={styles.cardLabel}>Data / hora</p>
            <p style={styles.cardValue}>{formatDateTimeForDisplay(activity.dataCheckin)}</p>
          </div>

          {Number(activity.vfc) > 0 && (
            <div style={styles.card}>
              <p style={styles.cardLabel}>VFC (HRV)</p>
              <p style={styles.cardValue}>{activity.vfc}</p>
            </div>
          )}

          {Number(activity.hidratacao) > 0 && (
            <div style={{ ...styles.card, gridColumn: 'span 2' }}>
              <p style={styles.cardLabel}>Hidratação</p>
              <p style={styles.cardValue}>{getHydrationLabel(activity.hidratacao!)}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Bem-estar ── */}
      {wellBeingEntries.length > 0 && (
        <section style={styles.section}>
          <p style={styles.sectionLabel}>Bem-estar (check-in)</p>
          <div style={styles.wellBeingGrid}>
            {wellBeingEntries.map(({ label, value }) => (
              <div key={label} style={styles.wellBeingCell}>
                <span style={styles.wellBeingLabel}>{label}</span>
                <strong style={styles.wellBeingValue}>{value}/5</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Regiões de dor ── */}
      <section style={styles.section}>
        <p style={styles.sectionLabel}>Regiões de dor</p>
        {painRegionNames.length === 0 ? (
          <p style={styles.sectionText}>Sem dor registrada</p>
        ) : (
          <div style={styles.tagRow}>
            {painRegionNames.map((name) => (
              <span key={name} style={styles.painTag}>{name}</span>
            ))}
          </div>
        )}
      </section>

      {/* ── Check-out ── */}
      <section style={styles.section}>
        <p style={styles.sectionLabel}>Check-out</p>
        {isOpen ? (
          <p style={styles.sectionMuted}>Sessão em andamento — dados disponíveis após o check-out.</p>
        ) : (
          <div style={styles.grid}>
            <div style={styles.card}>
              <p style={styles.cardLabel}>Data / hora</p>
              <p style={styles.cardValue}>{formatDateTimeForDisplay(activity.dataCheckout)}</p>
            </div>

            <div style={styles.card}>
              <p style={styles.cardLabel}>Duração</p>
              <p style={styles.cardValue}>
                {Number(activity.duracaoMin) > 0 ? `${activity.duracaoMin} min` : 'N/D'}
              </p>
            </div>

            {activity.pseFoster !== null && activity.pseFoster !== undefined && (
              <div style={{ ...styles.card, gridColumn: 'span 2' }}>
                <p style={styles.cardLabel}>PSE (Foster)</p>
                <p style={styles.cardValue}>{getPseLabel(activity.pseFoster)}</p>
              </div>
            )}

            {Number(activity.carga) > 0 && (
              <div style={styles.card}>
                <p style={styles.cardLabel}>Carga (PSE × min)</p>
                <p style={styles.cardValue}>{activity.carga}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Recuperação / notas ── */}
      {(activity.recuperacao?.trim() || activity.notasCheckout?.trim()) && (
        <section style={styles.section}>
          <p style={styles.sectionLabel}>Observações do check-out</p>
          {activity.recuperacao?.trim() && (
            <p style={styles.sectionText}>
              <strong>Recuperação:</strong> {activity.recuperacao}
            </p>
          )}
          {activity.notasCheckout?.trim() && (
            <p style={styles.sectionText}>
              <strong>Notas:</strong> {activity.notasCheckout}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fb',
    padding: '24px 20px 48px',
    fontFamily: 'Arial, sans-serif',
    color: '#1f2937',
    display: 'grid',
    alignContent: 'start',
    gap: '16px',
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
  badgeRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
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
  closeSessionBanner: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  closeSessionText: {
    margin: 0,
    fontSize: '14px',
    color: '#1e40af',
    lineHeight: 1.5,
  },
  closeSessionButton: {
    alignSelf: 'start',
    padding: '9px 16px',
    background: '#1d4ed8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  section: {
    background: '#ffffff',
    borderRadius: '10px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
    display: 'grid',
    gap: '10px',
  },
  sectionLabel: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#6b7280',
  },
  sectionText: {
    margin: 0,
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.5,
  },
  sectionMuted: {
    margin: 0,
    fontSize: '13px',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '8px',
  },
  card: {
    background: '#f8fafc',
    borderRadius: '8px',
    padding: '12px 14px',
    border: '1px solid #e2e8f0',
    display: 'grid',
    gap: '4px',
  },
  cardLabel: {
    margin: 0,
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  cardValue: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827',
    lineHeight: 1.3,
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
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  painTag: {
    padding: '4px 10px',
    background: '#fee2e2',
    color: '#b91c1c',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
  },
};
