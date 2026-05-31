import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { createAccount, getAccount, listActivePlans, updateAccount } from '../../services/accountService.js';

const TYPE_OPTIONS = [
  { value: 'trainer_account', label: 'Conta de treinador' },
  { value: 'academy_account', label: 'Academia' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativa' },
  { value: 'inactive', label: 'Inativa' },
];

export default function AdminAccountFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { accountId } = useParams();
  const isEdit = Boolean(accountId);

  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({
    name: '',
    type: 'trainer_account',
    planId: '',
    athleteLimitOverride: '',
    status: 'active',
  });
  const [loadingData, setLoadingData] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [plansList, accountData] = await Promise.all([
          listActivePlans(),
          isEdit ? getAccount(accountId) : Promise.resolve(null),
        ]);
        setPlans(plansList);

        if (isEdit) {
          if (!accountData) {
            setError('Conta não encontrada.');
            return;
          }
          const override = accountData.athleteLimitOverride != null
            ? String(accountData.athleteLimitOverride)
            : '';
          setForm({
            name: accountData.name || '',
            type: accountData.type || 'trainer_account',
            planId: accountData.planId || (plansList[0]?.planId ?? ''),
            athleteLimitOverride: override,
            status: accountData.status || 'active',
          });
        } else {
          if (plansList.length > 0) {
            setForm((f) => ({ ...f, planId: plansList[0].planId }));
          }
        }
      } catch (err) {
        setError('Erro ao carregar dados.');
        console.error(err);
      } finally {
        setLoadingData(false);
      }
    }
    load();
  }, [accountId, isEdit]);

  async function handleSubmit() {
    if (!form.name.trim()) { setError('Nome da conta é obrigatório.'); return; }
    if (!form.planId) { setError('Selecione um plano.'); return; }

    let override = null;
    if (form.athleteLimitOverride !== '') {
      override = Number(form.athleteLimitOverride);
      if (!Number.isInteger(override) || override < 1) {
        setError('O limite override deve ser um número inteiro positivo.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updateAccount(
          accountId,
          {
            name: form.name.trim(),
            type: form.type,
            planId: form.planId,
            athleteLimitOverride: override,
            status: form.status,
          },
          user.uid
        );
      } else {
        await createAccount(
          {
            name: form.name.trim(),
            type: form.type,
            planId: form.planId,
            adminUid: null,
            athleteLimitOverride: override,
            status: 'active',
          },
          user.uid
        );
      }
      navigate('/admin/accounts');
    } catch (err) {
      setError(err.message || (isEdit ? 'Erro ao salvar conta.' : 'Erro ao criar conta.'));
    } finally {
      setSaving(false);
    }
  }

  const selectedPlan = plans.find((p) => p.planId === form.planId);

  if (loadingData) {
    return (
      <div style={styles.page}>
        <p style={styles.hint}>Carregando...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Administração</p>
          <h1 style={styles.title}>{isEdit ? 'Editar conta' : 'Nova conta'}</h1>
        </div>
      </div>

      <div style={styles.formCard}>
        <div style={styles.formGrid}>
          <label style={styles.fieldLabel}>
            Nome da conta *
            <input
              style={styles.input}
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={saving}
              placeholder="Ex: Academia Strong"
            />
          </label>

          <label style={styles.fieldLabel}>
            Tipo
            <select
              style={styles.input}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              disabled={saving}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label style={styles.fieldLabel}>
            Plano *
            <select
              style={styles.input}
              value={form.planId}
              onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))}
              disabled={saving}
            >
              <option value="">Selecione um plano...</option>
              {plans.map((p) => (
                <option key={p.planId} value={p.planId}>
                  {p.name} — até {p.activeAthleteLimit} atletas
                </option>
              ))}
            </select>
          </label>

          <label style={styles.fieldLabel}>
            Limite de atletas (override)
            <input
              style={styles.input}
              type="number"
              min="1"
              value={form.athleteLimitOverride}
              onChange={(e) => setForm((f) => ({ ...f, athleteLimitOverride: e.target.value }))}
              disabled={saving}
              placeholder={
                selectedPlan
                  ? `Padrão do plano: ${selectedPlan.activeAthleteLimit}`
                  : 'Deixe em branco para usar o padrão'
              }
            />
          </label>

          {isEdit && (
            <label style={styles.fieldLabel}>
              Status
              <select
                style={styles.input}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                disabled={saving}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {selectedPlan && (
          <p style={styles.planHint}>
            Plano <strong>{selectedPlan.name}</strong>: {selectedPlan.description}
          </p>
        )}

        {error && <p style={styles.errorText}>{error}</p>}

        <div style={styles.actions}>
          <button style={styles.btnPrimary} onClick={handleSubmit} disabled={saving}>
            {saving ? (isEdit ? 'Salvando…' : 'Criando…') : (isEdit ? 'Salvar alterações' : 'Criar conta')}
          </button>
          <button
            style={styles.btnSecondary}
            onClick={() => navigate('/admin/accounts')}
            disabled={saving}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'grid', gap: '20px', padding: '24px', maxWidth: '640px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  eyebrow: { margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569' },
  title: { margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' },
  hint: { color: '#64748b', fontSize: '14px' },
  formCard: {
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    display: 'grid',
    gap: '20px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '16px',
  },
  fieldLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#64748b',
  },
  input: {
    padding: '9px 10px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    fontSize: '14px',
    color: '#0f172a',
    width: '100%',
    boxSizing: 'border-box',
  },
  planHint: { margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 },
  errorText: { margin: 0, color: '#dc2626', fontSize: '14px' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  btnPrimary: {
    padding: '9px 20px',
    borderRadius: '8px',
    border: 'none',
    background: '#1d4ed8',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnSecondary: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#374151',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
