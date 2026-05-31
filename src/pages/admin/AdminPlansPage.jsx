import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAllPlans, updatePlan } from '../../services/accountService.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminPlansPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlans(await listAllPlans());
    } catch (err) {
      setError('Erro ao carregar planos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggleActive(plan) {
    setTogglingId(plan.planId);
    try {
      const newActive = !plan.isActive;
      await updatePlan(plan.planId, { isActive: newActive }, user.uid);
      setPlans((prev) =>
        prev.map((p) => p.planId === plan.planId ? { ...p, isActive: newActive } : p)
      );
    } catch (err) {
      alert('Erro ao atualizar plano: ' + err.message);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Administração</p>
          <h1 style={styles.title}>Planos</h1>
        </div>
        <button style={styles.btnNew} onClick={() => navigate('/admin/plans/new')}>
          + Novo plano
        </button>
      </div>

      {loading && <p style={styles.hint}>Carregando...</p>}
      {error && <p style={styles.errorText}>{error}</p>}

      {!loading && !error && plans.length === 0 && (
        <p style={styles.hint}>Nenhum plano criado ainda.</p>
      )}

      {!loading && !error && plans.length > 0 && (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Nome</th>
                <th style={styles.th}>Descrição</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Limite de atletas</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.planId} style={styles.tr}>
                  <td style={styles.td}>
                    <span style={styles.planName}>{plan.name}</span>
                    <span style={styles.planId}>{plan.planId}</span>
                  </td>
                  <td style={{ ...styles.td, color: '#64748b' }}>
                    {plan.description || <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                    {plan.activeAthleteLimit ?? '—'}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <span style={plan.isActive ? styles.badgeActive : styles.badgeInactive}>
                      {plan.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <div style={styles.actions}>
                      <button
                        style={styles.btnEdit}
                        onClick={() => navigate(`/admin/plans/${plan.planId}/edit`)}
                      >
                        Editar
                      </button>
                      <button
                        style={plan.isActive ? styles.btnDeactivate : styles.btnActivate}
                        onClick={() => handleToggleActive(plan)}
                        disabled={togglingId === plan.planId}
                      >
                        {togglingId === plan.planId
                          ? '...'
                          : plan.isActive ? 'Desativar' : 'Ativar'}
                      </button>
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
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
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
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 14px', color: '#0f172a', verticalAlign: 'middle' },
  planName: { display: 'block', fontWeight: 600 },
  planId: { display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '2px' },
  badgeActive: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
    background: '#dcfce7',
    color: '#166534',
  },
  badgeInactive: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
    background: '#f1f5f9',
    color: '#475569',
  },
  actions: { display: 'inline-flex', gap: '8px', alignItems: 'center' },
  btnEdit: {
    padding: '5px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnDeactivate: {
    padding: '5px 12px',
    borderRadius: '6px',
    border: '1px solid #fca5a5',
    background: '#fff',
    color: '#dc2626',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnActivate: {
    padding: '5px 12px',
    borderRadius: '6px',
    border: '1px solid #86efac',
    background: '#fff',
    color: '#166534',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
