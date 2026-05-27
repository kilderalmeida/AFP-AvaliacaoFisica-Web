import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '../../services/authService.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      await resetPassword(email.trim());
      setStatus('success');
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao enviar email de recuperação.');
      setStatus('error');
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Recuperar senha</h1>
        <p style={styles.subtitle}>
          Informe seu email cadastrado e enviaremos um link para você redefinir a senha.
        </p>

        {status === 'success' ? (
          <div style={styles.successBox}>
            <p style={styles.successText}>
              Email enviado! Verifique sua caixa de entrada (e o spam).
            </p>
            <Link to="/login" style={styles.link}>Voltar para o login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                style={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                disabled={status === 'loading'}
                autoFocus
              />
            </div>

            {status === 'error' && (
              <p style={styles.errorText}>{errorMsg}</p>
            )}

            <button
              type="submit"
              style={styles.btn}
              disabled={status === 'loading' || !email.trim()}
            >
              {status === 'loading' ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>

            <Link to="/login" style={styles.link}>Voltar para o login</Link>
          </form>
        )}
      </div>
    </div>
  );
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
    width: '100%',
    maxWidth: '400px',
    background: '#fff',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'grid',
    gap: '20px',
  },
  title: { margin: 0, fontSize: '22px', fontWeight: 700, color: '#0f172a' },
  subtitle: { margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.5 },
  form: { display: 'grid', gap: '14px' },
  fieldGroup: { display: 'grid', gap: '5px' },
  label: { fontSize: '13px', fontWeight: 600, color: '#334155' },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    color: '#1e293b',
    width: '100%',
    boxSizing: 'border-box',
  },
  btn: {
    padding: '11px',
    borderRadius: '8px',
    border: 'none',
    background: '#1d4ed8',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
  link: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#1d4ed8',
    textDecoration: 'none',
    display: 'block',
  },
  errorText: { margin: 0, fontSize: '13px', color: '#dc2626' },
  successBox: { display: 'grid', gap: '14px' },
  successText: {
    margin: 0,
    fontSize: '14px',
    color: '#166534',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    padding: '12px',
  },
};
