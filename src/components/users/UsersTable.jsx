const PAPEL_LABELS = {
  admin: 'Admin',
  treinador: 'Treinador',
  coach: 'Coach',
  atleta: 'Atleta',
};

const STATUS_LABELS = {
  invited: 'Convidado',
  active: 'Ativo',
  inactive: 'Inativo',
};

const STATUS_COLORS = {
  invited: { color: '#92400e', background: '#fef3c7' },
  active: { color: '#166534', background: '#dcfce7' },
  inactive: { color: '#6b7280', background: '#f3f4f6' },
};

export function UsersTable({ users, onEdit, onToggleStatus }) {
  if (!users || users.length === 0) {
    return <p style={styles.empty}>Nenhum usuário encontrado.</p>;
  }

  return (
    <div style={styles.wrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Nome</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Papel</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const statusStyle = STATUS_COLORS[u.status] || STATUS_COLORS.inactive;
            const isActive = u.status === 'active';
            return (
              <tr key={u.uid} style={styles.row}>
                <td style={styles.td}>{u.displayName || '—'}</td>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}>{PAPEL_LABELS[u.papel] || u.papel}</td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, ...statusStyle }}>
                    {STATUS_LABELS[u.status] || u.status}
                  </span>
                </td>
                <td style={styles.tdActions}>
                  <button style={styles.btnEdit} onClick={() => onEdit(u.uid)}>
                    Editar
                  </button>
                  <button
                    style={isActive ? styles.btnDeactivate : styles.btnActivate}
                    onClick={() => onToggleStatus(u.uid, isActive ? 'inactive' : 'active')}
                  >
                    {isActive ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  wrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '2px solid #e2e8f0',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#475569',
    whiteSpace: 'nowrap',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#1e293b', verticalAlign: 'middle' },
  tdActions: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', whiteSpace: 'nowrap', display: 'flex', gap: '6px' },
  row: {},
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
  },
  btnEdit: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#334155',
    fontSize: '12px',
    cursor: 'pointer',
  },
  btnActivate: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #bbf7d0',
    background: '#f0fdf4',
    color: '#166534',
    fontSize: '12px',
    cursor: 'pointer',
  },
  btnDeactivate: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: '12px',
    cursor: 'pointer',
  },
  empty: { color: '#64748b', fontSize: '14px', padding: '16px 0' },
};
