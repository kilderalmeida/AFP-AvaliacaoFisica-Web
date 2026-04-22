/**
 * Componente ProtectedRoute
 * Valida autenticação antes de renderizar uma página
 * Redireciona usuários não autenticados para /login
 */

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../../services/auth/authService.js';

export function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se há usuário autenticado ao carregar
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setLoading(false);
      return;
    }

    // Observar mudanças de autenticação
    const unsubscribe = authService.onAuthStateChange((authenticatedUser) => {
      setUser(authenticatedUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Enquanto carrega, mostrar um componente neutro
  if (loading) {
    return (
      <div className="loading-container">
        <p>Carregando...</p>
      </div>
    );
  }

  // Se não há usuário, redirecionar para login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se há usuário, renderizar o componente protegido
  return children;
}

export default ProtectedRoute;
