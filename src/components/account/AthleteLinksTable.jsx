export function AthleteLinksTable({ links, unlinkingId, onDeactivate }) {
  if (links.length === 0) {
    return (
      <p style={styles.empty}>
        Nenhum atleta vinculado. Use o botão "Vincular atleta" para adicionar.
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
                <button
                  style={styles.btnDeactivate}
                  onClick={() => onDeactivate(link)}
                  disabled={unlinkingId === link.linkId}
                >
                  {unlinkingId === link.linkId ? 'Desvinculando…' : 'Desvincular'}
                </button>
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
  empty: {
    padding: '32px 0',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '14px',
  },
};
