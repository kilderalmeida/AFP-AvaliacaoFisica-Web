/**
 * Exemplos de uso - React Router e ProtectedRoute
 */

// ============================================
// 1. ESTRUTURA DO ROUTER
// ============================================

/*
Rotas Públicas:
  /login     - Página de login (sem autenticação)
  /          - Redireciona para /login

Rotas Protegidas (requerem autenticação):
  /dashboard - Dashboard principal
  /checkin   - Página de check-in
  /checkout  - Página de check-out
  /*         - Página 404 não encontrada
*/

// ============================================
// 2. FLUXO DE AUTENTICAÇÃO
// ============================================

/*
1. Usuário acessa a app
   ↓
2. App.jsx renderiza con RouterProvider
   ↓
3. Se não autenticado → redireciona para /login
   ↓
4. Usuário faz login na LoginPage
   ↓
5. authService.login() conecta ao Firebase
   ↓
6. onAuthStateChange() atualiza estado global
   ↓
7. ProtectedRoute permite acesso ao /dashboard
*/

// ============================================
// 3. USAR O ROUTER NA APP
// ============================================

/*
// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
*/

// src/App.jsx já está configurado com RouterProvider

// ============================================
// 4. NAVEGAR ENTRE ROTAS
// ============================================

/*
import { useNavigate } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();

  return (
    <button onClick={() => navigate('/dashboard')}>
      Ir para Dashboard
    </button>
  );
}
*/

// ============================================
// 5. PROTEGER UMA ROTA
// ============================================

/*
import { ProtectedRoute } from '../components/layout/ProtectedRoute.jsx';
import MyPage from '../pages/MyPage.jsx';

// No router.jsx:
{
  path: '/minhas-avaliacoes',
  element: (
    <ProtectedRoute>
      <MyPage />
    </ProtectedRoute>
  ),
}
*/

// ============================================
// 6. OBTER INFORMAÇÕES DO USUÁRIO AUTENTICADO
// ============================================

/*
import { useEffect, useState } from 'react';
import { authService } from '../services/auth/authService.js';

function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Obter usuário atual
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);

    // Observar mudanças (ex: logout)
    const unsubscribe = authService.onAuthStateChange((authenticatedUser) => {
      setUser(authenticatedUser);
    });

    return () => unsubscribe();
  }, []);

  if (!user) return <p>Carregando...</p>;

  return <h1>Bem-vindo, {user.email}</h1>;
}
*/

// ============================================
// 7. FAZER LOGOUT
// ============================================

/*
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth/authService.js';

function Header() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  return <button onClick={handleLogout}>Sair</button>;
}
*/

// ============================================
// 8. REDIRECIONAR APÓS LOGIN
// ============================================

/*
No LoginPage.jsx, após login bem-sucedido:

import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await authService.login(email, password);
      navigate('/dashboard'); // Redirecionar após login
    } catch (err) {
      setError(err.message);
    }
  };

  // ...
}
*/

// ============================================
// 9. ESTRUTURA DE ARQUIVOS
// ============================================

/*
src/
  ├── app/
  │   └── router.jsx          ← Definição de rotas
  ├── components/
  │   └── layout/
  │       └── ProtectedRoute.jsx  ← Proteção de rota
  ├── pages/
  │   ├── LoginPage.jsx
  │   ├── DashboardPage.jsx
  │   ├── CheckInPage.jsx
  │   └── CheckOutPage.jsx
  ├── services/
  │   └── auth/
  │       └── authService.js
  ├── styles/
  │   └── globals.css
  ├── App.jsx                 ← Componente raiz
  └── main.jsx
*/

// ============================================
// 10. CONFIGURAÇÃO NECESSÁRIA
// ============================================

/*
1. Instalar React Router:
   npm install react-router-dom

2. Configurar Firebase (já feito em firebaseConfig.js)

3. Importar estilos globais em App.jsx:
   import './styles/globals.css';

4. Usar no main.jsx:
   import App from './App.jsx';
   ReactDOM.createRoot(document.getElementById('root')).render(<App />);
*/

export default {};
