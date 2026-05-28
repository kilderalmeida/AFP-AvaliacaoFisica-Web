const TYPE_LABELS = {
  trainer_account: 'Conta de treinador',
  academy_account: 'Academia',
};

export function AccountSummaryCard({ account, plan, limitInfo }) {
  const count = limitInfo?.count ?? 0;
  const limit = limitInfo?.limit ?? 0;
  const pct = limit > 0 ? Math.round((count / limit) * 100) : 0;
  const atLimit = limit > 0 && count >= limit;

  return (
    <div style={styles.card}>
      <div style={styles.grid}>
        <Field label="Nome da conta" value={account.name} />
        <Field label="Tipo" value={TYPE_LABELS[account.type] || account.type} />
        <Field label="Plano" value={plan?.name || account.planId} />
        <div>
          <p style={styles.label}>Atletas ativos</p>
          <p style={{ ...styles.value, color: atLimit ? '#dc2626' : '#0f172a' }}>
            {count} / {limit}
            {atLimit && <span style={styles.limitTag}> limite atingido</span>}
          </p>
        </div>
      </div>

      <div style={styles.barTrack}>
        <div
          style={{
            ...styles.barFill,
            width: `${Math.min(pct, 100)}%`,
            background: atLimit ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#1d4ed8',
          }}
        />
      </div>
      <p style={styles.barLabel}>
        {atLimit
          ? 'Limite atingido — não é possível vincular novos atletas'
          : `${limit - count} vaga${limit - count !== 1 ? 's' : ''} restante${limit - count !== 1 ? 's' : ''}`}
      </p>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p style={styles.label}>{label}</p>
      <p style={styles.value}>{value || '—'}</p>
    </div>
  );
}

const styles = {
  card: {
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    display: 'grid',
    gap: '16px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
  },
  label: {
    margin: '0 0 4px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#64748b',
  },
  value: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#0f172a',
  },
  limitTag: {
    marginLeft: '6px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#dc2626',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  barTrack: {
    height: '6px',
    borderRadius: '3px',
    background: '#e2e8f0',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  barLabel: {
    margin: 0,
    fontSize: '12px',
    color: '#64748b',
  },
};
