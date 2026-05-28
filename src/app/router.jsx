import { useEffect, useState } from 'react';
import { createBrowserRouter, Navigate, NavLink, Outlet, useLocation, useRouteError } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import CheckInPage from '../pages/CheckInPage.jsx';
import CheckOutPage from '../pages/CheckOutPage.jsx';
import AvaliacaoPAFPPage from '../pages/AvaliacaoPAFPPage.jsx';
import ActivitiesListPage from '../pages/activities/ActivitiesListPage.tsx';
import ActivityDetailPage from '../pages/activities/ActivityDetailPage.tsx';
import AdminUsersPage from '../pages/admin/AdminUsersPage.jsx';
import AdminUserFormPage from '../pages/admin/AdminUserFormPage.jsx';
import TrainerAthletesPage from '../pages/trainer/TrainerAthletesPage.jsx';
import AccountAdminPage from '../pages/account/AccountAdminPage.jsx';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';
import { RoleRoute } from '../components/layout/RoleRoute.jsx';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/',
    element: <RootRedirect />,
    errorElement: <RouteErrorPage />,
  },
  {
    element: <ProtectedAppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/activities', element: <ActivitiesListPage /> },
      { path: '/activities/:activityId', element: <ActivityDetailPage /> },
      { path: '/checkin', element: <CheckInPage /> },
      { path: '/checkout', element: <CheckOutPage /> },
      { path: '/avaliacao-pafp', element: <AvaliacaoPAFPPage /> },
      {
        path: '/admin/users',
        element: (
          <RoleRoute allowedRoles={['platform_admin']} redirectTo="/dashboard">
            <AdminUsersPage />
          </RoleRoute>
        ),
      },
      {
        path: '/admin/users/new',
        element: (
          <RoleRoute allowedRoles={['platform_admin']} redirectTo="/dashboard">
            <AdminUserFormPage />
          </RoleRoute>
        ),
      },
      {
        path: '/admin/users/:userId',
        element: (
          <RoleRoute allowedRoles={['platform_admin']} redirectTo="/dashboard">
            <AdminUserFormPage />
          </RoleRoute>
        ),
      },
      {
        path: '/trainer/athletes',
        element: (
          <RoleRoute allowedRoles={['trainer', 'coach']} redirectTo="/dashboard">
            <TrainerAthletesPage />
          </RoleRoute>
        ),
      },
      {
        path: '/account',
        element: (
          <RoleRoute allowedRoles={['account_admin']} redirectTo="/dashboard">
            <AccountAdminPage />
          </RoleRoute>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
    errorElement: <RouteErrorPage />,
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
  const { role } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const isAdmin = role === 'platform_admin' || role === 'account_admin';
  const isTrainer = role === 'trainer' || role === 'coach';

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
          {isTrainer && <AppNavLink to="/trainer/athletes">Meus atletas</AppNavLink>}
          {role === 'platform_admin' && <AppNavLink to="/admin/users">Usuários</AppNavLink>}
          {role === 'account_admin' && <AppNavLink to="/account">Minha conta</AppNavLink>}
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

function RouteErrorPage() {
  const error = useRouteError();
  const isNotFound = error?.status === 404;
  const rawMessage = error?.statusText || error?.message || '';
  const cutIdx = rawMessage.indexOf('You can create it here:');
  const message = cutIdx !== -1 ? rawMessage.slice(0, cutIdx).trim() : rawMessage;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '2rem' }}>
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{isNotFound ? '🔍' : '⚠️'}</div>
        <h1 style={{ margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
          {isNotFound ? 'Página não encontrada' : 'Algo deu errado'}
        </h1>
        <p style={{ margin: '0 0 0.5rem', color: '#6b7280', fontSize: '1rem', lineHeight: 1.5 }}>
          {isNotFound
            ? 'A página que você procura não existe ou foi movida.'
            : 'Um erro inesperado ocorreu. Tente voltar ao Dashboard.'}
        </p>
        {!isNotFound && message ? (
          <p style={{ margin: '0 0 1.5rem', color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.4 }}>
            {message}
          </p>
        ) : (
          <div style={{ marginBottom: '1.5rem' }} />
        )}
        <a
          href="/dashboard"
          style={{ display: 'inline-block', padding: '0.75rem 1.5rem', background: '#4f46e5', color: '#fff', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '1rem' }}
        >
          Voltar ao Dashboard
        </a>
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
