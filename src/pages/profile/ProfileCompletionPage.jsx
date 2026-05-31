import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { updateUserProfile } from '../../services/userService.js';

export default function ProfileCompletionPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    displayName: profile?.displayName || '',
    phone: profile?.phone || '',
    birthDate: profile?.birthDate || '',
    sex: profile?.sex || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.displayName.trim()) {
      setError('Nome é obrigatório.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateUserProfile(
        user.uid,
        { ...form, profileCompleted: true, status: 'active' },
        user.uid
      );
      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Erro ao salvar perfil. Tente novamente.');
      setSaving(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <p style={styles.eyebrow}>AFP Web</p>
          <h1 style={styles.title}>Complete seu perfil</h1>
          <p style={styles.subtitle}>
            Antes de continuar, preencha seus dados básicos.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Nome *</label>
            <input
              style={inputStyle(!form.displayName.trim() && !!error)}
              type="text"
              value={form.displayName}
              onChange={(e) => setField('displayName', e.target.value)}
              placeholder="Seu nome completo"
              disabled={saving}
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Telefone</label>
            <input
              style={inputStyle()}
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="(11) 91234-5678"
              disabled={saving}
            />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Data de nascimento</label>
              <input
                style={inputStyle()}
                type="date"
                value={form.birthDate}
                onChange={(e) => setField('birthDate', e.target.value)}
                disabled={saving}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Sexo</label>
              <select
                style={inputStyle()}
                value={form.sex}
                onChange={(e) => setField('sex', e.target.value)}
                disabled={saving}
              >
                <option value="">Não informado</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          {error && <p style={styles.errorText}>{error}</p>}

          <button type="submit" style={styles.btnSubmit} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar e continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}

function inputStyle(hasError = false) {
  return {
    padding: '9px 12px',
    borderRadius: '8px',
    border: `1px solid ${hasError ? '#fca5a5' : '#cbd5e1'}`,
    fontSize: '14px',
    color: '#1e293b',
    background: hasError ? '#fff5f5' : '#fff',
    width: '100%',
    boxSizing: 'border-box',
  };
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    padding: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '32px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'grid',
    gap: '24px',
  },
  header: {
    display: 'grid',
    gap: '6px',
  },
  eyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#4f46e5',
  },
  title: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 700,
    color: '#0f172a',
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#64748b',
    lineHeight: 1.5,
  },
  form: {
    display: 'grid',
    gap: '16px',
  },
  row: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  field: {
    display: 'grid',
    gap: '4px',
    flex: 1,
    minWidth: '140px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#475569',
  },
  btnSubmit: {
    padding: '11px 20px',
    borderRadius: '8px',
    border: 'none',
    background: '#1d4ed8',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '4px',
  },
  errorText: {
    color: '#dc2626',
    fontSize: '14px',
    margin: 0,
  },
};
