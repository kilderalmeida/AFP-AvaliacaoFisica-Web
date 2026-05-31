import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAccounts, listActivePlans } from '../../services/accountService.js';
import { getAccountActiveAthleteCount } from '../../services/athleteLinkService.js';

const TYPE_LABELS = {
  trainer_account: 'Treinador',
  academy_account: 'Academia',
};

export default function AdminAccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [filterPlanId, setFilterPlanId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountsList, plansList] = await Promise.all([
        listAccounts(),
        listActivePlans(),
      ]);
      const planMap = Object.fromEntries(plansList.map((p) => [p.planId, p]));

      const enriched = await Promise.all(
        accountsList.map(async (acc) => {
          const plan = planMap[acc.planId] || null;
          const count = await getAccountActiveAthleteCount(acc.accountId);
          const limit = acc.athleteLimitOverride != null
            ? Number(acc.athleteLimitOverride)
            : Number(plan?.activeAthleteLimit) || 0;
          return { ...acc, plan, count, limit };
        })
      );
      setAccounts(enriched);
      setPlans(plansList);
    } catch (err) {
      setError('Erro ao carregar contas.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (search && !acc.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterPlanId && acc.planId !== filterPlanId) return false;
      if (filterStatus) {
        const s = acc.status || 'active';
        if (s !== filterStatus) return false;
      }
      return true;
    });
  }, [accounts, search, filterPlanId, filterStatus]);

  const hasFilters = search !== '' || filterPlanId !== '' || filterStatus !== '';

  function handleRowClick(acc) {
    navigate(`/admin/users?accountId=${acc.accountId}&accountName=${encodeURIComponent(acc.name)}`);
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Administração</p>
          <h1 style={styles.title}>Contas</h1>
        </div>
        <button style={styles.btnNew} onClick={() => navigate('/admin/accounts/new')}>
          + Nova conta
        </button>
      </div>

      <div style={styles.filterBar}>
        <input
          style={styles.searchInput}
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={styles.filterSelect}
          value={filterPlanId}
          onChange={(e) => setFilterPlanId(e.target.value)}
        >
          <option value="">Todos os planos</option>
          {plans.map((p) => (
            <option key={p.planId} value={p.planId}>{p.name}</option>
          ))}
        </select>
        <select
          style={styles.filterSelect}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
        {hasFilters && (
          <button
            style={styles.btnClearFilters}
            onClick={() => { setSearch(''); setFilterPlanId(''); setFilterStatus(''); }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {loading && <p style={styles.hint}>Carregando...</p>}
      {error && <p style={styles.errorText}>{error}</p>}

      {!loading && !error && accounts.length === 0 && (
        <p style={styles.hint}>Nenhuma conta criada ainda.</p>
      )}

      {!loading && !error && accounts.length > 0 && filteredAccounts.length === 0 && (
        <p style={styles.hint}>Nenhuma conta corresponde aos filtros.</p>
      )}

      {!loading && !error && filteredAccounts.length > 0 && (
        <>
          {hasFilters && (
            <p style={styles.resultCount}>
              {filteredAccounts.length} de {accounts.length} conta{accounts.length !== 1 ? 's' : ''}
            </p>
          )}
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nome</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Plano</th>
                  <th style={styles.th}>Uso</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((acc) => (
                  <tr
                    key={acc.accountId}
                    style={styles.trClickable}
                    onClick={() => handleRowClick(acc)}
                    title={`Ver usuários de "${acc.name}"`}
                  >
                    <td style={styles.td}>
                      <span style={styles.accountName}>{acc.name}</span>
                    </td>
                    <td style={{ ...styles.td, color: '#64748b' }}>
                      {TYPE_LABELS[acc.type] || acc.type}
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: '#64748b' }}>{acc.plan?.name || acc.planId}</span>
                      {acc.athleteLimitOverride != null && (
                        <span style={styles.overrideBadge}> override: {acc.athleteLimitOverride}</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <UsageBar count={acc.count} limit={acc.limit} />
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                        <span style={statusStyle(acc.status)}>
                          {statusLabel(acc.status)}
                        </span>
                        <button
                          style={styles.btnEdit}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/accounts/${acc.accountId}/edit`);
                          }}
                        >
                          Editar
                        </button>
                        <span style={styles.rowCta}>Ver →</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function UsageBar({ count, limit }) {
  const pct = limit > 0 ? Math.round((count / limit) * 100) : 0;
  const atLimit = limit > 0 && count >= limit;
  const nearLimit = !atLimit && pct >= 80;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
      <p style={{ margin: 0, fontSize: '13px', color: atLimit ? '#dc2626' : '#0f172a', fontWeight: atLimit ? 600 : 400 }}>
        {count} / {limit}
      </p>
      <div style={{ height: '4px', borderRadius: '2px', background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          borderRadius: '2px',
          width: `${Math.min(pct, 100)}%`,
          background: atLimit ? '#dc2626' : nearLimit ? '#f59e0b' : '#1d4ed8',
        }} />
      </div>
    </div>
  );
}

function statusLabel(status) {
  if (status === 'inactive') return 'Inativo';
  return 'Ativo';
}

function statusStyle(status) {
  const base = { padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 };
  if (status === 'inactive') return { ...base, background: '#f1f5f9', color: '#475569' };
  return { ...base, background: '#dcfce7', color: '#166534' };
}

const styles = {
  page: { display: 'grid', gap: '20px', padding: '24px', maxWidth: '960px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  eyebrow: { margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569' },
  title: { margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' },
  btnNew: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#1d4ed8',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  filterBar: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchInput: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    color: '#334155',
    background: '#fff',
    minWidth: '200px',
    flex: '1 1 200px',
  },
  filterSelect: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    color: '#334155',
    background: '#fff',
    cursor: 'pointer',
  },
  btnClearFilters: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  resultCount: {
    margin: 0,
    fontSize: '13px',
    color: '#64748b',
  },
  hint: { color: '#64748b', fontSize: '14px' },
  errorText: { color: '#dc2626', fontSize: '14px' },
  tableWrapper: {
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
  trClickable: {
    borderBottom: '1px solid #f1f5f9',
    cursor: 'pointer',
  },
  td: { padding: '12px 14px', color: '#0f172a', verticalAlign: 'middle' },
  accountName: {
    fontWeight: 600,
  },
  overrideBadge: {
    marginLeft: '4px',
    fontSize: '11px',
    color: '#d97706',
    fontWeight: 700,
  },
  rowCta: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: 500,
  },
  btnEdit: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#374151',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
