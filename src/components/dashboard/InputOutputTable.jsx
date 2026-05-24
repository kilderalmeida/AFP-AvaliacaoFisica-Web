function avg(values) {
  const nums = values.filter((v) => Number.isFinite(v) && v > 0);
  if (nums.length === 0) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

export function InputOutputTable({ sessions, periodDays }) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;

  const completed = sessions.filter((s) => s?.status === 'completed' || s?.dataCheckout);

  const avgPse = avg(completed.map((s) => Number(s?.pseFoster)));
  const avgDuration = avg(sessions.map((s) => Number(s?.duracaoMin)));
  const avgHydration = avg(sessions.map((s) => Number(s?.hidratacao)));
  const avgVfc = avg(sessions.map((s) => Number(s?.vfc)));
  const totalLoad = sessions.reduce((sum, s) => sum + (Number(s?.carga) || 0), 0);

  const rows = [
    { label: 'Sessões', value: sessions.length, unit: '' },
    { label: 'Duração média', value: avgDuration != null ? `${avgDuration.toFixed(0)}` : '—', unit: avgDuration != null ? 'min' : '' },
    { label: 'PSE médio', value: avgPse != null ? avgPse.toFixed(1) : '—', unit: '' },
    { label: 'Hidratação média', value: avgHydration != null ? avgHydration.toFixed(1) : '—', unit: '/8' },
    { label: 'VFC médio', value: avgVfc != null ? avgVfc.toFixed(0) : '—', unit: '' },
    { label: 'Carga total', value: totalLoad > 0 ? totalLoad.toFixed(0) : '—', unit: '' },
  ];

  return (
    <div style={styles.container}>
      <p style={styles.eyebrow}>Resumo quantitativo — {periodDays}d</p>
      <table style={styles.table}>
        <tbody>
          {rows.map(({ label, value, unit }) => (
            <tr key={label} style={styles.row}>
              <td style={styles.tdLabel}>{label}</td>
              <td style={styles.tdValue}>
                <strong>{value}</strong>
                {unit && <span style={styles.unit}> {unit}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  eyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: '#475569',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  row: {
    borderBottom: '1px solid #f1f5f9',
  },
  tdLabel: {
    padding: '8px 4px',
    fontSize: '13px',
    color: '#64748b',
    width: '60%',
  },
  tdValue: {
    padding: '8px 4px',
    fontSize: '14px',
    color: '#0f172a',
    textAlign: 'right',
  },
  unit: {
    fontSize: '12px',
    color: '#94a3b8',
  },
};
