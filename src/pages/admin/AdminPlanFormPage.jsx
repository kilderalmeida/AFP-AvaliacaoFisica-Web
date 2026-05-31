import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPlan, getPlan, updatePlan } from '../../services/accountService.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminPlanFormPage() {
  const { planId } = useParams();
  const isEdit = Boolean(planId);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: '',
    activeAthleteLimit: '',
    description: '',
    isActive: true,
  });
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    getPlan(planId)
      .then((plan) => {
        if (!plan) { setLoadError('Plano não encontrado.'); return; }
        setForm({
          name: plan.name || '',
          activeAthleteLimit: String(plan.activeAthleteLimit ?? ''),
          description: plan.description || '',
          isActive: plan.isActive !== false,
        });
      })
      .catch(() => setLoadError('Erro ao carregar plano.'));
  }, [planId, isEdit]);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaveError(null);

    if (!form.name.trim()) {
      setSaveError('Nome é obrigatório.');
      return;
    }
    const limit = parseInt(form.activeAthleteLimit, 10);
    if (!form.activeAthleteLimit || isNaN(limit) || limit < 1) {
      setSaveError('Limite de atletas deve ser um número inteiro maior ou igual a 1.');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        activeAthleteLimit: limit,
        description: form.description.trim(),
        isActive: form.isActive,
      };
      if (isEdit) {
        await updatePlan(planId, data, user.uid);
      } else {
        await createPlan(data, user.uid);
      }
      navigate('/admin/plans');
    } catch (err) {
      setSaveError('Erro ao salvar plano: ' + err.message);
      setSaving(false);
    }
  }

  if (isEdit && loadError) {
    return (
      <div style={styles.page}>
        <p style={styles.errorText}>{loadError}</p>
        <button style={styles.btnSecondary} onClick={() => navigate('/admin/plans')}>
          ← Voltar
        </button>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Administração / Planos</p>
          <h1 style={styles.title}>{isEdit ? 'Editar plano' : 'Novo plano'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.fieldGroup}>
          <label style={styles.label} htmlFor="plan-name">Nome *</label>
          <input
            id="plan-name"
            style={styles.input}
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Ex.: Pro Plus"
            maxLength={80}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label} htmlFor="plan-limit">Limite de atletas ativos *</label>
          <input
            id="plan-limit"
            style={{ ...styles.input, maxWidth: '160px' }}
            type="number"
            min="1"
            step="1"
            value={form.activeAthleteLimit}
            onChange={(e) => handleChange('activeAthleteLimit', e.target.value)}
            placeholder="Ex.: 50"
          />
          <p style={styles.fieldHint}>
            Número máximo de atletas ativos por conta neste plano. Contas com override ignoram este valor.
          </p>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label} htmlFor="plan-desc">Descrição (opcional)</label>
          <textarea
            id="plan-desc"
            style={styles.textarea}
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Breve descrição do plano para exibição interna."
            rows={3}
            maxLength={300}
          />
        </div>

        {isEdit && (
          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="plan-status">Status</label>
            <select
              id="plan-status"
              style={styles.select}
              value={form.isActive ? 'active' : 'inactive'}
              onChange={(e) => handleChange('isActive', e.target.value === 'active')}
            >
              <option value="active">Ativo — disponível para novas contas</option>
              <option value="inactive">Inativo — não aparece em novos cadastros</option>
            </select>
            <p style={styles.fieldHint}>
              Desativar não afeta contas já existentes vinculadas a este plano.
            </p>
          </div>
        )}

        {saveError && <p style={styles.errorText}>{saveError}</p>}

        <div style={styles.formActions}>
          <button
            type="button"
            style={styles.btnSecondary}
            onClick={() => navigate('/admin/plans')}
            disabled={saving}
          >
            Cancelar
          </button>
          <button type="submit" style={styles.btnPrimary} disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar plano'}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  page: { display: 'grid', gap: '20px', padding: '24px', maxWidth: '600px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  eyebrow: { margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569' },
  title: { margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' },
  form: { display: 'grid', gap: '20px' },
  fieldGroup: { display: 'grid', gap: '6px' },
  label: { fontSize: '13px', fontWeight: 600, color: '#374151' },
  fieldHint: { margin: 0, fontSize: '12px', color: '#64748b' },
  input: {
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    color: '#0f172a',
    background: '#fff',
  },
  textarea: {
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    color: '#0f172a',
    background: '#fff',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  select: {
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    color: '#0f172a',
    background: '#fff',
    cursor: 'pointer',
  },
  errorText: { color: '#dc2626', fontSize: '14px', margin: 0 },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' },
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
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#475569',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
