/**
 * Componente raiz da aplicação
 * Integra o React Router e define o ponto de entrada
 */

import { RouterProvider } from 'react-router-dom';
import { router } from './app/router.jsx';
import './styles/globals.css';

function App() {
  return <RouterProvider router={router} />;
}

export default App;
