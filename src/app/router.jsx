/**
 * Configuração de Rotas da Aplicação
 * Define rotas públicas e protegidas do AFP Web
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import CheckInPage from '../pages/CheckInPage.jsx';
import CheckOutPage from '../pages/CheckOutPage.jsx';
import AvaliacaoPAFPPage from '../pages/AvaliacaoPAFPPage.jsx';
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
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },

  {
    path: '/checkin',
    element: (
      <ProtectedRoute>
        <CheckInPage />
      </ProtectedRoute>
    ),
  },

  {
    path: '/checkout',
    element: (
      <ProtectedRoute>
        <CheckOutPage />
      </ProtectedRoute>
    ),
  },

  {
    path: '/avaliacao-pafp',
    element: (
      <ProtectedRoute>
        <AvaliacaoPAFPPage />
      </ProtectedRoute>
    ),
  },

  // Página não encontrada (404)
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

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

/**
 * Página 404 - Recurso não encontrado
 */
function NotFoundPage() {
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

export default router;
