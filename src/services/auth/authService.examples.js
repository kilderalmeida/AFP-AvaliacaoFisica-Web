/**
 * Exemplos de uso do authService
 * 
 * Este arquivo mostra como usar as funções do authService em componentes React
 */

// ============================================
// 1. LOGIN
// ============================================

import { authService } from '../services/auth/authService.js';

async function handleLogin() {
  try {
    const user = await authService.login('user@example.com', 'password123');
    console.log('Login bem-sucedido:', user);
    // { uid: 'abc123', email: 'user@example.com' }
  } catch (error) {
    console.error('Erro no login:', error.message);
    // 'Usuário não encontrado.' ou 'Senha incorreta.'
  }
}

// ============================================
// 2. SIGNUP
// ============================================

async function handleSignup() {
  try {
    const user = await authService.signup('newuser@example.com', 'securePassword123');
    console.log('Conta criada:', user);
  } catch (error) {
    console.error('Erro ao criar conta:', error.message);
    // 'Este email já está em uso.' ou 'Senha fraca...'
  }
}

// ============================================
// 3. LOGOUT
// ============================================

async function handleLogout() {
  try {
    await authService.logout();
    console.log('Logout realizado');
  } catch (error) {
    console.error('Erro ao fazer logout:', error.message);
  }
}

// ============================================
// 4. OBTER USUÁRIO ATUAL
// ============================================

function checkCurrentUser() {
  const user = authService.getCurrentUser();
  if (user) {
    console.log('Usuário autenticado:', user.email);
  } else {
    console.log('Nenhum usuário autenticado');
  }
}

// ============================================
// 5. OBSERVAR MUDANÇAS DE AUTENTICAÇÃO (importante para React!)
// ============================================

function setupAuthListener() {
  // Este unsubscribe deve ser chamado quando o componente desmontar
  const unsubscribe = authService.onAuthStateChange((user) => {
    if (user) {
      console.log('Usuário logado:', user.email);
      // Atualizar estado do componente, redirecionar, etc.
    } else {
      console.log('Usuário deslogado');
    }
  });

  return unsubscribe; // Retornar para parar de observar depois
}

// ============================================
// 6. EXEMPLO DE HOOK REACT (useAuth)
// ============================================

/*
import { useEffect, useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Se houver usuário logado ao carregar, atualizar Estado
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);

    // Observar mudanças de autenticação
    const unsubscribe = authService.onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}

// Uso no componente:
function MyComponent() {
  const { user, loading } = useAuth();

  if (loading) return <div>Carregando...</div>;

  return (
    <div>
      {user ? (
        <>
          <p>Bem-vindo, {user.email}</p>
          <button onClick={() => authService.logout()}>Sair</button>
        </>
      ) : (
        <p>Você não está autenticado</p>
      )}
    </div>
  );
}
*/

// ============================================
// 7. RESET DE SENHA
// ============================================

async function handlePasswordReset() {
  try {
    await authService.resetPassword('user@example.com');
    console.log('Email de reset enviado!');
  } catch (error) {
    console.error('Erro ao enviar email:', error.message);
  }
}

export {
  handleLogin,
  handleSignup,
  handleLogout,
  checkCurrentUser,
  setupAuthListener,
  handlePasswordReset,
};
