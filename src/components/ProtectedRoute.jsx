/**
 * Componente de rota protegida.
 * Usa o contexto de autenticação para validar acesso.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin =
    profile?.papel === 'platform_admin' || profile?.papel === 'account_admin';

  if (profile && !isAdmin && profile.profileCompleted === false) {
    return <Navigate to="/perfil/completar" replace />;
  }

  return children;
}

export default ProtectedRoute;
