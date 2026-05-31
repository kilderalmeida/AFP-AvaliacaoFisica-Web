export function AthleteLinksTable({
  links,
  unlinkingId,
  onDeactivate,
  mode = 'active',
  reactivatingId,
  onReactivate,
  resendingEmail,
  onResendInvite,
  onTransfer,
}) {
  const isInactive = mode === 'inactive';

  if (links.length === 0) {
    return (
      <p style={styles.empty}>
        {isInactive
          ? 'Nenhum vínculo inativo.'
          : 'Nenhum atleta vinculado. Use o botão "Vincular atleta" para adicionar.'}
      </p>
    );
  }

  return (
    <div style={styles.wrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Atleta</th>
            <th style={styles.th}>E-mail</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <tr key={link.linkId} style={styles.tr}>
              <td style={styles.td}>{link.athlete?.displayName || '—'}</td>
              <td style={{ ...styles.td, color: '#64748b' }}>
                {link.athlete?.email || link.athleteId}
              </td>
              <td style={{ ...styles.td, textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                  {!isInactive && link.athlete?.status === 'invited' && onResendInvite && (
                    <button
                      style={styles.btnResend}
                      onClick={() => onResendInvite(link.athlete.email)}
                      disabled={resendingEmail === link.athlete.email}
                    >
                      {resendingEmail === link.athlete.email ? 'Enviando…' : 'Reenviar convite'}
                    </button>
                  )}
                  {!isInactive && onTransfer && (
                    <button
                      style={styles.btnTransfer}
                      onClick={() => onTransfer(link)}
                    >
                      Transferir
                    </button>
                  )}
                  {isInactive ? (
                    <button
                      style={styles.btnReactivate}
                      onClick={() => onReactivate(link)}
                      disabled={reactivatingId === link.linkId}
                    >
                      {reactivatingId === link.linkId ? 'Reativando…' : 'Reativar'}
                    </button>
                  ) : (
                    <button
                      style={styles.btnDeactivate}
                      onClick={() => onDeactivate(link)}
                      disabled={unlinkingId === link.linkId}
                    >
                      {unlinkingId === link.linkId ? 'Desvinculando…' : 'Desvincular'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  wrapper: {
    overflowX: 'auto',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  th: {
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#64748b',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '12px 14px',
    color: '#0f172a',
    verticalAlign: 'middle',
  },
  btnDeactivate: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #fca5a5',
    background: '#fff',
    color: '#dc2626',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnReactivate: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #86efac',
    background: '#fff',
    color: '#16a34a',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnResend: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #fde68a',
    background: '#fff',
    color: '#92400e',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnTransfer: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #93c5fd',
    background: '#fff',
    color: '#1d4ed8',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  empty: {
    padding: '32px 0',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '14px',
  },
};
