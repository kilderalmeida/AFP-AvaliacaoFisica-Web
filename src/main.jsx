import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '2rem' }}>
          <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Algo deu errado</h1>
            <p style={{ margin: '0 0 1.5rem', color: '#6b7280', fontSize: '1rem', lineHeight: 1.5 }}>
              Um erro inesperado ocorreu. Tente voltar ao Dashboard.
            </p>
            <a href="/dashboard" style={{ display: 'inline-block', padding: '0.75rem 1.5rem', background: '#4f46e5', color: '#fff', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '1rem' }}>
              Voltar ao Dashboard
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
