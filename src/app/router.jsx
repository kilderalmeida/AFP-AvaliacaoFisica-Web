/**
 * Configuração de Rotas da Aplicação
 * Define rotas públicas e protegidas do AFP Web
 */

import { useEffect, useState } from 'react';
import { createBrowserRouter, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import CheckInPage from '../pages/CheckInPage.jsx';
import CheckOutPage from '../pages/CheckOutPage.jsx';
import AvaliacaoPAFPPage from '../pages/AvaliacaoPAFPPage.jsx';
import ActivitiesListPage from '../pages/activities/ActivitiesListPage.tsx';
import ActivityDetailPage from '../pages/activities/ActivityDetailPage.tsx';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';

/**
 * Configuração do router com React Router v6
 * 
 * Rotas Públicas:
 * - /login      - Página de login
 * 
 * Rotas Protegidas (requerem autenticação):
 * - /dashboard  - Dashboard principal
 * - /checkin    - Página de check-in
 * - /checkout   - Página de check-out
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    element: <ProtectedAppLayout />,
    children: [
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/activities',
        element: <ActivitiesListPage />,
      },
      {
        path: '/activities/:activityId',
        element: <ActivityDetailPage />,
      },
      {
        path: '/checkin',
        element: <CheckInPage />,
      },
      {
        path: '/checkout',
        element: <CheckOutPage />,
      },
      {
        path: '/avaliacao-pafp',
        element: <AvaliacaoPAFPPage />,
      },
    ],
  },

  // Página não encontrada (404)
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

function ProtectedAppLayout() {
  return (
    <ProtectedRoute>
      <AppShell />
    </ProtectedRoute>
  );
}

function AppShell() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div style={styles.shell}>
      <header style={styles.header} className="app-shell-header">
        <div style={styles.headerTopRow} className="app-shell-header-top-row">
          <div>
            <p style={styles.kicker}>AFP Web</p>
            <h1 style={styles.brand}>Painel</h1>
          </div>

          <button
            type="button"
            style={styles.menuButton}
            className="app-shell-menu-button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="app-shell-navigation"
            aria-label={isMobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
            onClick={() => setIsMobileMenuOpen((current) => !current)}
          >
            {isMobileMenuOpen ? 'Fechar' : 'Menu'}
          </button>
        </div>

        <nav
          id="app-shell-navigation"
          style={{
            ...styles.nav,
            ...(isMobileMenuOpen ? styles.navMobileOpen : null),
          }}
          className={`app-shell-nav ${isMobileMenuOpen ? 'is-open' : ''}`}
          aria-label="Navegação principal"
        >
          <AppNavLink to="/dashboard">Painel</AppNavLink>
          <AppNavLink to="/activities">Atividades</AppNavLink>
          <AppNavLink to="/checkin">Check-in</AppNavLink>
          <AppNavLink to="/checkout">Check-out</AppNavLink>
          <AppNavLink to="/avaliacao-pafp">Avaliação PAFP</AppNavLink>
        </nav>
      </header>

      <div style={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}

function AppNavLink({ to, children }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...styles.navLink,
        ...(isActive ? styles.navLinkActive : null),
      })}
    >
      {children}
    </NavLink>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <p>Carregando...</p>
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function sanitizePathname(pathname) {
  const value = String(pathname || '').trim();
  if (!value) return '/';

  const cleaned = value.replace(/[\.;:,!?]+$/, '');
  return cleaned || '/';
}

/**
 * Página 404 - Recurso não encontrado
 */
function NotFoundPage() {
  const location = useLocation();
  const cleanedPathname = sanitizePathname(location.pathname);

  if (cleanedPathname !== location.pathname) {
    return <Navigate to={`${cleanedPathname}${location.search}${location.hash}`} replace />;
  }

  return (
    <div className="not-found-page">
      <div className="not-found-container">
        <h1>404</h1>
        <p>Página não encontrada</p>
        <a href="/dashboard">Voltar ao Dashboard</a>
      </div>
    </div>
  );
}

const styles = {
  shell: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'grid',
    gap: '1rem',
    padding: '1rem 1.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid #e5e7eb',
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  kicker: {
    margin: 0,
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#4f46e5',
  },
  brand: {
    margin: '0.25rem 0 0',
    fontSize: '1.25rem',
    color: '#111827',
  },
  menuButton: {
    display: 'none',
    minHeight: '44px',
    padding: '0.7rem 0.95rem',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  nav: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  navMobileOpen: {
    display: 'grid',
  },
  navLink: {
    padding: '0.65rem 0.95rem',
    borderRadius: 999,
    color: '#4b5563',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.95rem',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLinkActive: {
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
  },
  content: {
    padding: '0 0 2rem',
  },
};

export default router;
