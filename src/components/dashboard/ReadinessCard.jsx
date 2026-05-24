const WELL_BEING_LABELS = {
  sleep: 'Sono',
  mood: 'Humor',
  fatigue: 'Fadiga',
  pain: 'Dor',
  stress: 'Estresse',
};

function getVfcReadiness(vfc) {
  if (!vfc || vfc <= 0) return { label: 'Sem registro', color: '#6b7280', accent: '#f3f4f6' };
  if (vfc >= 70) return { label: 'Excelente', color: '#166534', accent: '#dcfce7' };
  if (vfc >= 50) return { label: 'Boa', color: '#1d4ed8', accent: '#dbeafe' };
  if (vfc >= 35) return { label: 'Moderada', color: '#b45309', accent: '#fef3c7' };
  return { label: 'Baixa', color: '#b91c1c', accent: '#fee2e2' };
}

export function ReadinessCard({ session }) {
  if (!session) return null;

  const vfc = Number(session?.vfc) || 0;
  const vfcReadiness = getVfcReadiness(vfc);
  const bemEstar = session?.bemEstar;

  const wellBeingEntries = Object.entries(WELL_BEING_LABELS)
    .map(([key, label]) => ({ key, label, value: Number(bemEstar?.[key]) || 0 }))
    .filter((e) => e.value > 0);

  if (vfc <= 0 && wellBeingEntries.length === 0) return null;

  return (
    <div style={styles.card}>
      <p style={styles.eyebrow}>Prontidão do atleta</p>
      <div style={styles.grid}>
        {vfc > 0 && (
          <div style={{ ...styles.cell, background: vfcReadiness.accent }}>
            <span style={styles.cellLabel}>VFC</span>
            <strong style={{ ...styles.cellValue, color: vfcReadiness.color }}>{vfc}</strong>
            <span style={styles.cellHelper}>{vfcReadiness.label}</span>
          </div>
        )}
        {wellBeingEntries.map(({ key, label, value }) => (
          <div key={key} style={styles.cell}>
            <span style={styles.cellLabel}>{label}</span>
            <strong style={styles.cellValue}>{value}/5</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    padding: '14px 16px',
    display: 'grid',
    gap: '10px',
  },
  eyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: '#166534',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  cell: {
    display: 'grid',
    gap: '2px',
    padding: '8px 10px',
    borderRadius: '8px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    minWidth: '70px',
  },
  cellLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  cellValue: {
    fontSize: '14px',
    color: '#111827',
  },
  cellHelper: {
    fontSize: '11px',
    color: '#475569',
  },
};
