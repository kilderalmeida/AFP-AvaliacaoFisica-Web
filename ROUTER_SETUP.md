# Sistema de Roteamento - AFP Web

## Visão Geral

O projeto usa **React Router v6** para gerenciar as rotas da aplicação, com um sistema de proteção de rotas baseado em autenticação Firebase.

## Rotas

### Públicas (sem autenticação)
- **`/login`** - Página de login
- **`/`** - Redireciona para login

### Protegidas (requerem autenticação)
- **`/dashboard`** - Dashboard principal
- **`/checkin`** - Página de check-in
- **`/checkout`** - Página de check-out
- **`/*`** - Página 404 (não encontrada)

## Arquivos Principais

### `src/app/router.jsx`
Define todas as rotas e sua estrutura.

```javascript
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { 
    path: '/dashboard', 
    element: <ProtectedRoute><DashboardPage /></ProtectedRoute>
  },
  // ...
]);
```

### `src/components/layout/ProtectedRoute.jsx`
Componente que protege rotas verificando autenticação.

```javascript
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>
```

Funcionalidades:
- ✅ Verifica se usuário está autenticado
- ✅ Redireciona para `/login` se não estiver autenticado
- ✅ Mostra "Carregando..." enquanto verifica autenticação
- ✅ Observa mudanças de autenticação em tempo real

### `src/App.jsx`
Componente raiz que renderiza o `RouterProvider`.

```javascript
function App() {
  return <RouterProvider router={router} />;
}
```

## Fluxo de Autenticação

```
1. Usuário acessa /dashboard (rota protegida)
   ↓
2. ProtectedRoute verifica getCurrentUser()
   ↓
3. Se não há usuário, aguarda onAuthStateChange()
   ↓
4. Se não autenticado → redireciona para /login
   ↓
5. Usuário faz login via LoginPage
   ↓
6. authService.login() conecta ao Firebase
   ↓
7. onAuthStateChange() atualiza estado
   ↓
8. ProtectedRoute permite acesso
   ↓
9. useNavigate('/dashboard') ao final do login
```

## Como Usar

### Navegar entre rotas

```javascript
import { useNavigate } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();
  
  return (
    <button onClick={() => navigate('/dashboard')}>
      Ir para Dashboard
    </button>
  );
}
```

### Obter usuário autenticado

```javascript
import { authService } from '../services/auth/authService.js';

function MyComponent() {
  const user = authService.getCurrentUser();
  
  if (user) {
    console.log('Logado como:', user.email);
  }
}
```

### Fazer logout

```javascript
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
```

## Adicionar Nova Rota Protegida

```javascript
// src/app/router.jsx
{
  path: '/minhas-avaliacoes',
  element: (
    <ProtectedRoute>
      <MinhasAvaliações />
    </ProtectedRoute>
  ),
}
```

## Dependências Necessárias

```bash
npm install react-router-dom firebase
```

## Configuração em `main.jsx`

```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

## Próximas Etapas

1. ✅ Router configurado
2. ⏭️ Adicionar redirecionamento após login no LoginPage.jsx
3. ⏭️ Implementar logout em um Header/Navbar
4. ⏭️ Adicionar mais rotas conforme necessário
5. ⏭️ Implementar error boundaries para melhor tratamento de erros

## Referências

- [React Router Documentation](https://reactrouter.com/)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
