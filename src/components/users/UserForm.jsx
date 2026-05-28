import { useState } from 'react';

const PAPEL_OPTIONS = [
  { value: 'athlete', label: 'Atleta' },
  { value: 'trainer', label: 'Treinador' },
  { value: 'coach', label: 'Coach' },
  { value: 'account_admin', label: 'Admin de conta' },
  { value: 'platform_admin', label: 'Admin da plataforma' },
];

const STATUS_OPTIONS = [
  { value: 'invited', label: 'Convidado' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

const EMPTY_FORM = {
  email: '',
  displayName: '',
  papel: 'athlete',
  status: 'invited',
  phone: '',
  birthDate: '',
  sex: '',
  gymId: '',
  treinador_id: '',
};

export function UserForm({ initialValues = {}, mode = 'create', trainers = [], onSubmit, onCancel, loading = false }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initialValues });
  const [errors, setErrors] = useState({});

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const errs = {};
    if (mode === 'create' && !form.email.trim()) errs.email = 'Email obrigatório';
    if (!form.displayName.trim()) errs.displayName = 'Nome obrigatório';
    if (!form.papel) errs.papel = 'Papel obrigatório';
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={styles.form}>
      {mode === 'create' && (
        <Field label="Email *" error={errors.email}>
          <input
            style={inputStyle(errors.email)}
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="usuario@email.com"
            disabled={loading}
          />
        </Field>
      )}

      <Field label="Nome *" error={errors.displayName}>
        <input
          style={inputStyle(errors.displayName)}
          type="text"
          value={form.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          placeholder="Nome completo"
          disabled={loading}
        />
      </Field>

      <div style={styles.row}>
        <Field label="Papel *" error={errors.papel}>
          <select style={inputStyle(errors.papel)} value={form.papel} onChange={(e) => set('papel', e.target.value)} disabled={loading}>
            {PAPEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        <Field label="Status" error={errors.status}>
          <select style={inputStyle()} value={form.status} onChange={(e) => set('status', e.target.value)} disabled={loading}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>

      {form.papel === 'athlete' && trainers.length > 0 && (
        <Field label="Treinador responsável">
          <select style={inputStyle()} value={form.treinador_id || ''} onChange={(e) => set('treinador_id', e.target.value)} disabled={loading}>
            <option value="">Sem treinador</option>
            {trainers.map((t) => <option key={t.uid} value={t.uid}>{t.displayName || t.email}</option>)}
          </select>
        </Field>
      )}

      <div style={styles.row}>
        <Field label="Telefone">
          <input style={inputStyle()} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(11) 91234-5678" disabled={loading} />
        </Field>

        <Field label="Data de nascimento">
          <input style={inputStyle()} type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} disabled={loading} />
        </Field>
      </div>

      <div style={styles.row}>
        <Field label="Sexo">
          <select style={inputStyle()} value={form.sex} onChange={(e) => set('sex', e.target.value)} disabled={loading}>
            <option value="">Não informado</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
            <option value="outro">Outro</option>
          </select>
        </Field>

        <Field label="Gym ID">
          <input style={inputStyle()} type="text" value={form.gymId} onChange={(e) => set('gymId', e.target.value)} placeholder="ID da academia" disabled={loading} />
        </Field>
      </div>

      <div style={styles.actions}>
        <button type="button" style={styles.btnCancel} onClick={onCancel} disabled={loading}>
          Cancelar
        </button>
        <button type="submit" style={styles.btnSubmit} disabled={loading}>
          {loading ? 'Salvando...' : mode === 'create' ? 'Criar usuário' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }) {
  return (
    <div style={{ display: 'grid', gap: '4px', flex: 1 }}>
      <label style={styles.label}>{label}</label>
      {children}
      {error && <span style={styles.error}>{error}</span>}
    </div>
  );
}

function inputStyle(error) {
  return {
    padding: '8px 10px',
    borderRadius: '8px',
    border: `1px solid ${error ? '#fca5a5' : '#cbd5e1'}`,
    fontSize: '14px',
    color: '#1e293b',
    background: error ? '#fff5f5' : '#fff',
    width: '100%',
    boxSizing: 'border-box',
  };
}

const styles = {
  form: { display: 'grid', gap: '14px' },
  row: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  label: { fontSize: '12px', fontWeight: 600, color: '#475569' },
  error: { fontSize: '11px', color: '#dc2626' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' },
  btnCancel: {
    padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1',
    background: '#f8fafc', color: '#334155', fontSize: '14px', cursor: 'pointer',
  },
  btnSubmit: {
    padding: '8px 18px', borderRadius: '8px', border: 'none',
    background: '#1d4ed8', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
};
