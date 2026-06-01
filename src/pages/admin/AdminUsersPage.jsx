import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listUsers, toggleUserStatus } from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { UsersTable } from '../../components/users/UsersTable.jsx';
import { UserFilters } from '../../components/users/UserFilters.jsx';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Initialize from URL params — supports ?accountId=xxx&accountName=... from /admin/accounts
  const [filters, setFilters] = useState(() => {
    const accountId = searchParams.get('accountId');
    return accountId ? { accountId } : {};
  });
  const [accountName] = useState(searchParams.get('accountName') || '');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingUid, setTogglingUid] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers(filters);
      setUsers(result);
    } catch (err) {
      setError('Erro ao carregar usuários.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function handleToggleStatus(uid, newStatus) {
    setTogglingUid(uid);
    try {
      await toggleUserStatus(uid, newStatus, user.uid);
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status: newStatus } : u))
      );
    } catch {
      alert('Não foi possível atualizar o status. Tente novamente.');
    } finally {
      setTogglingUid(null);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Administração</p>
          <h1 style={styles.title}>Usuários</h1>
        </div>
        <button style={styles.btnNew} onClick={() => navigate('/admin/users/new')}>
          + Novo usuário
        </button>
      </div>

      {filters.accountId && (
        <div style={styles.accountBanner}>
          <span style={styles.accountBannerText}>
            Conta: <strong>{accountName || filters.accountId}</strong>
          </span>
          <button
            style={styles.btnClearAccount}
            onClick={() => setFilters((f) => { const { accountId: _, ...rest } = f; return rest; })}
          >
            ✕ Limpar
          </button>
          <button style={styles.btnBack} onClick={() => navigate('/admin/accounts')}>
            ← Contas
          </button>
        </div>
      )}

      <UserFilters
        filters={filters}
        onChange={setFilters}
        disableStatus={!!filters.accountId}
      />

      {loading && <p style={styles.hint}>Carregando...</p>}
      {error && <p style={styles.errorText}>{error}</p>}
      {!loading && !error && (
        <UsersTable
          users={users}
          onEdit={(uid) => navigate(`/admin/users/${uid}`)}
          onToggleStatus={togglingUid ? () => {} : handleToggleStatus}
        />
      )}
    </div>
  );
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
  hint: { color: '#64748b', fontSize: '14px' },
  errorText: { color: '#dc2626', fontSize: '14px' },
  accountBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    padding: '10px 14px',
    borderRadius: '8px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
  },
  accountBannerText: {
    fontSize: '13px',
    color: '#1e40af',
    flex: 1,
  },
  btnClearAccount: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #bfdbfe',
    background: '#fff',
    color: '#1e40af',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnBack: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #bfdbfe',
    background: '#fff',
    color: '#1e40af',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
