/**
 * Página de Login - Autenticação do usuário
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Erro ao fazer login. Tente novamente.');
      console.error('Erro no login:', err);
    } finally {
      setLoading(false);
    }
  };

  const isBusy = loading || authLoading;
  const errorMessageId = error ? 'login-error-message' : undefined;

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-hero" aria-hidden="true">
          <span className="login-badge">AFP Platform</span>
          <h1>Entre e acompanhe a sua rotina de performance.</h1>
          <p className="login-hero-copy">
            Um acesso direto ao dashboard, check-ins e acompanhamento da evolucao dos atletas.
          </p>
          <div className="login-hero-metrics">
            <div className="hero-metric">
              <strong>Dashboard</strong>
              <span>Resumo claro de sessoes e indicadores</span>
            </div>
            <div className="hero-metric">
              <strong>Fluxo rapido</strong>
              <span>Entrar, registrar treino e seguir a rotina</span>
            </div>
          </div>
        </section>

        <div className="login-container">
          <div className="login-header">
            <span className="login-eyebrow">Acesso seguro</span>
            <h2>Entrar na plataforma</h2>
            <p className="subtitle">Use o e-mail cadastrado para acessar seu painel.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form" aria-busy={isBusy}>
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="username"
                inputMode="email"
                required
                disabled={isBusy}
                aria-invalid={Boolean(error)}
                aria-describedby={errorMessageId}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Senha</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  required
                  disabled={isBusy}
                  aria-invalid={Boolean(error)}
                  aria-describedby={errorMessageId}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={isBusy}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <a className="field-link" href="/reset-password">
                Esqueceu sua senha?
              </a>
            </div>

            <div className="form-status" aria-live="polite">
              {error ? (
                <div id={errorMessageId} className="error-message" role="alert">
                  {error}
                </div>
              ) : isBusy ? (
                <div className="info-message" role="status">
                  Validando suas credenciais...
                </div>
              ) : (
                <div className="helper-message">Preencha seus dados para continuar.</div>
              )}
            </div>

            <button
              type="submit"
              disabled={isBusy || !email || !password}
              className="submit-button"
            >
              {isBusy && <span className="button-spinner" aria-hidden="true" />}
              <span>{isBusy ? 'Entrando...' : 'Entrar'}</span>
            </button>
          </form>

          <div className="login-footer">
            <p>
              Não tem conta? <a href="/signup">Crie uma conta</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
