/**
 * Exemplo de uso da LoginPage com React Router
 * 
 * Mostra como integrar a LoginPage com navegação e redirecionamento
 */

import { LoginPage } from '../pages/LoginPage.jsx';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth/authService.js';

/**
 * Wrapper da LoginPage com navegação integrada
 * Use isto se quiser redirecionar após login bem-sucedido
 */
export function LoginPageWithNavigation() {
  const navigate = useNavigate();

  const handleLoginSuccess = (user) => {
    console.log('Login bem-sucedido, redirecionando...');
    // Redirecionar para o dashboard
    navigate('/dashboard');
  };

  // Modificar a LoginPage para chamar handleLoginSuccess após login bem-sucedido
  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}

/**
 * Versão melhorada da LoginPage com suporte a onLoginSuccess
 * Substitua o componente LoginPage atual por este para ter navegação automática
 */
export function LoginPageEnhanced({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await authService.login(email, password);
      console.log('Login bem-sucedido:', user);

      // Chamar callback customizado
      if (onLoginSuccess) {
        onLoginSuccess(user);
      } else {
        // Ou redirecionar automaticamente
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Erro ao fazer login. Tente novamente.');
      console.error('Erro no login:', err);
    } finally {
      setLoading(false);
    }
  };

  // ... resto do JSX igual ao LoginPage.jsx
}

/**
 * Exemplo de como adicionar a LoginPage ao router:
 * 
 * import { createBrowserRouter } from 'react-router-dom';
 * import LoginPage from '../pages/LoginPage.jsx';
 * import DashboardPage from '../pages/DashboardPage.jsx';
 * 
 * export const router = createBrowserRouter([
 *   {
 *     path: '/login',
 *     element: <LoginPage />,
 *   },
 *   {
 *     path: '/dashboard',
 *     element: <DashboardPage />,
 *     // Adicionar loader para verificar autenticação
 *     loader: async () => {
 *       const user = authService.getCurrentUser();
 *       if (!user) {
 *         throw new Error('Não autenticado');
 *       }
 *       return user;
 *     },
 *   },
 * ]);
 */

/**
 * Proteção de rota para páginas que requerem autenticação
 */
export function ProtectedRoute({ children }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se usuário está autenticado
    const unsubscribe = authService.onAuthStateChange((user) => {
      if (!user) {
        // Usuário não autenticado, redirecionar para login
        navigate('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return <div>Carregando...</div>;
  }

  return children;
}

/**
 * Uso da ProtectedRoute:
 * 
 * <ProtectedRoute>
 *   <DashboardPage />
 * </ProtectedRoute>
 */

export default LoginPageEnhanced;
