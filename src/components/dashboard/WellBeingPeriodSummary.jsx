const METRICS = [
  { key: 'sleep', label: 'Sono' },
  { key: 'mood', label: 'Humor' },
  { key: 'fatigue', label: 'Fadiga' },
  { key: 'pain', label: 'Dor' },
  { key: 'stress', label: 'Estresse' },
];

function averageMetric(sessions, key) {
  const values = sessions
    .map((s) => Number(s?.bemEstar?.[key]))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function WellBeingPeriodSummary({ sessions, periodDays }) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;

  const metrics = METRICS.map(({ key, label }) => ({
    key,
    label,
    avg: averageMetric(sessions, key),
  })).filter((m) => m.avg !== null);

  if (metrics.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <p style={styles.eyebrow}>Bem-estar médio — {periodDays}d</p>
        <p style={styles.description}>
          Média de sono, humor, fadiga, dor e estresse informados nos check-ins do período.
        </p>
      </div>
      <div style={styles.grid}>
        {metrics.map(({ key, label, avg }) => (
          <div key={key} style={styles.cell}>
            <span style={styles.cellLabel}>{label}</span>
            <strong style={styles.cellValue}>{avg.toFixed(1)}/5</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'grid',
    gap: '12px',
  },
  header: {
    display: 'grid',
    gap: '3px',
  },
  eyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: '#475569',
  },
  description: {
    margin: 0,
    fontSize: '12px',
    color: '#64748b',
    lineHeight: 1.45,
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  cell: {
    display: 'grid',
    gap: '2px',
    padding: '8px 12px',
    borderRadius: '8px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    minWidth: '72px',
  },
  cellLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  cellValue: {
    fontSize: '14px',
    color: '#0f172a',
  },
};
