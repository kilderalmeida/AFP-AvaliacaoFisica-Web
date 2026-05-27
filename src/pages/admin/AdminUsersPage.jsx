import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listUsers, toggleUserStatus } from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { UsersTable } from '../../components/users/UsersTable.jsx';
import { UserFilters } from '../../components/users/UserFilters.jsx';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({});
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
    } catch (err) {
      alert('Erro ao atualizar status: ' + err.message);
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

      <UserFilters filters={filters} onChange={setFilters} />

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
};
