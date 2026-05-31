const PLAN_FEATURES = {
  starter: [
    'Até 10 atletas ativos',
    'CheckIn / CheckOut',
    'Dashboard de treinos',
    'Registro de sessões',
  ],
  pro: [
    'Até 30 atletas ativos',
    'CheckIn / CheckOut',
    'Dashboard de treinos',
    'Registro de sessões',
    'Avaliação PAFP',
  ],
  academy: [
    'Até 100 atletas ativos',
    'Múltiplos treinadores',
    'CheckIn / CheckOut',
    'Dashboard de treinos',
    'Registro de sessões',
    'Avaliação PAFP',
  ],
};

const TYPE_LABELS = {
  trainer_account: 'Conta de treinador',
  academy_account: 'Academia',
};

export function AccountSummaryCard({ account, plan, limitInfo, upgradeUrl }) {
  const count = limitInfo?.count ?? 0;
  const limit = limitInfo?.limit ?? 0;
  const pct = limit > 0 ? Math.round((count / limit) * 100) : 0;
  const atLimit = limit > 0 && count >= limit;
  const nearLimit = !atLimit && pct >= 80;

  const features = plan?.planId ? (PLAN_FEATURES[plan.planId] ?? []) : [];
  const ctaUrl = upgradeUrl || plan?.upgradeUrl || '';

  return (
    <div style={{ ...styles.card, ...(atLimit ? styles.cardAtLimit : {}) }}>
      <div style={styles.grid}>
        <Field label="Nome da conta" value={account.name} />
        <Field label="Tipo" value={TYPE_LABELS[account.type] || account.type} />
        <Field label="Plano" value={plan?.name || account.planId} />
        <div>
          <p style={styles.label}>Atletas ativos</p>
          <p style={{ ...styles.value, color: atLimit ? '#dc2626' : '#0f172a' }}>
            {count} de {limit}
            {atLimit && <span style={styles.limitTag}> limite atingido</span>}
          </p>
        </div>
      </div>

      <div>
        <div style={styles.barTrack}>
          <div
            style={{
              ...styles.barFill,
              width: `${Math.min(pct, 100)}%`,
              background: atLimit ? '#dc2626' : nearLimit ? '#f59e0b' : '#1d4ed8',
            }}
          />
        </div>
        <p style={styles.barLabel}>
          {atLimit
            ? `${count} de ${limit} — limite atingido`
            : `${count} de ${limit} — ${limit - count} vaga${limit - count !== 1 ? 's' : ''} restante${limit - count !== 1 ? 's' : ''}`}
        </p>
      </div>

      {atLimit && (
        <div style={styles.limitBanner}>
          <p style={styles.limitBannerTitle}>Limite do plano atingido</p>
          <p style={styles.limitBannerText}>
            Este plano permite até <strong>{limit}</strong> atleta{limit !== 1 ? 's' : ''} ativo{limit !== 1 ? 's' : ''}.
            Para vincular novos atletas, faça upgrade ou desative um vínculo existente.
          </p>
          {ctaUrl && (
            <a href={ctaUrl} target="_blank" rel="noopener noreferrer" style={styles.upgradeBtn}>
              Ver planos de upgrade
            </a>
          )}
        </div>
      )}

      {features.length > 0 && (
        <div>
          <p style={styles.featuresTitle}>Recursos incluídos no plano {plan?.name}</p>
          <ul style={styles.featuresList}>
            {features.map((f) => (
              <li key={f} style={styles.featuresItem}>
                <span style={styles.checkmark}>✓</span>
                {f}
              </li>
            ))}
          </ul>
          {!atLimit && ctaUrl && (
            <a href={ctaUrl} target="_blank" rel="noopener noreferrer" style={styles.upgradeLink}>
              Ampliar plano →
            </a>
          )}
        </div>
      )}
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
    gap: '20px',
    transition: 'border-color 0.2s',
  },
  cardAtLimit: {
    borderColor: '#fca5a5',
    background: '#fff8f8',
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
    height: '8px',
    borderRadius: '4px',
    background: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: '6px',
  },
  barFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  barLabel: {
    margin: 0,
    fontSize: '12px',
    color: '#64748b',
  },
  limitBanner: {
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid #fca5a5',
    background: '#fef2f2',
    display: 'grid',
    gap: '8px',
  },
  limitBannerTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 700,
    color: '#991b1b',
  },
  limitBannerText: {
    margin: 0,
    fontSize: '13px',
    color: '#7f1d1d',
    lineHeight: 1.5,
  },
  upgradeBtn: {
    display: 'inline-block',
    padding: '7px 14px',
    borderRadius: '8px',
    background: '#dc2626',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    textDecoration: 'none',
    width: 'fit-content',
  },
  featuresTitle: {
    margin: '0 0 10px',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#64748b',
  },
  featuresList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'grid',
    gap: '6px',
  },
  featuresItem: {
    display: 'flex',
    gap: '8px',
    alignItems: 'baseline',
    fontSize: '13px',
    color: '#374151',
  },
  checkmark: {
    color: '#16a34a',
    fontWeight: 700,
    flexShrink: 0,
  },
  upgradeLink: {
    display: 'inline-block',
    marginTop: '12px',
    fontSize: '13px',
    color: '#1d4ed8',
    fontWeight: 600,
    textDecoration: 'none',
  },
};
