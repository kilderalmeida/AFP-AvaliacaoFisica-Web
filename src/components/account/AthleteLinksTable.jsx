import { useMemo, useState } from 'react';
import { EmptyStateCard } from '../feedback/EmptyStateCard.jsx';
import { StatusBadge } from '../ui/StatusBadge.jsx';

function tsSeconds(ts) {
  return ts?.seconds ?? 0;
}

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
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const visibleLinks = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? links.filter((link) => {
          const name = (link.athlete?.displayName || '').toLowerCase();
          const email = (link.athlete?.email || '').toLowerCase();
          return name.includes(term) || email.includes(term);
        })
      : links;

    const recencyField = isInactive ? 'unlinkedAt' : 'linkedAt';
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return String(a.athlete?.displayName || a.athlete?.email || '').localeCompare(
          String(b.athlete?.displayName || b.athlete?.email || ''),
          'pt-BR'
        );
      }
      return tsSeconds(b[recencyField]) - tsSeconds(a[recencyField]);
    });
  }, [links, search, sortBy, isInactive]);

  if (links.length === 0) {
    return isInactive ? (
      <EmptyStateCard
        title="Nenhum vínculo inativo"
        message="Não há vínculos inativos nesta conta."
      />
    ) : (
      <EmptyStateCard
        title="Nenhum atleta vinculado"
        message='Use o botão "Vincular atleta" acima para adicionar.'
      />
    );
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <input
          style={styles.search}
          type="text"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={styles.sortSelect}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="recent">Mais recente</option>
          <option value="name">Nome (A–Z)</option>
        </select>
        <span style={styles.count}>
          Mostrando {visibleLinks.length} de {links.length}
        </span>
      </div>

      {visibleLinks.length === 0 ? (
        <p style={styles.noMatch}>Nenhum atleta corresponde à busca.</p>
      ) : (
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
              {visibleLinks.map((link) => (
                <tr key={link.linkId} style={styles.tr}>
                  <td style={styles.td}>
                    <span style={styles.nameCell}>
                      {link.athlete?.displayName || '—'}
                      {link.athlete?.status === 'invited' && (
                        <StatusBadge kind="userStatus" value="invited" />
                      )}
                    </span>
                  </td>
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
      )}
    </div>
  );
}

const styles = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  search: {
    flex: '1 1 220px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
  },
  sortSelect: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    background: '#fff',
  },
  count: {
    fontSize: '13px',
    color: '#64748b',
    whiteSpace: 'nowrap',
  },
  noMatch: {
    padding: '24px 0',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '14px',
  },
  nameCell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
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
};
