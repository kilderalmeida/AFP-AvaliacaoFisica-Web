/**
 * Página de Check-in
 *
 * Responsabilidades:
 * - identificar o usuário autenticado
 * - verificar se já existe sessão ativa
 * - permitir abertura de nova sessão
 * - exibir feedback de sucesso/erro para a UI
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/config.js';
import {
  createCheckIn,
  getActiveSession,
  formatDateTimeForDisplay,
} from '../services/sessionService.js';

export default function CheckInPage() {
  const [user, setUser] = useState(null);
  const [checkInData, setCheckInData] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    /**
     * Ao carregar a página, observa autenticação e consulta
     * se já existe uma sessão em aberto para o atleta logado.
     */
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setPageLoading(true);
        setError('');
        setUser(currentUser);

        if (!currentUser) {
          setActiveSession(null);
          return;
        }

        const session = await getActiveSession(currentUser.uid);
        setActiveSession(session);
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar sessão atual.');
      } finally {
        setPageLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleCheckIn = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Segurança extra: a tela depende de autenticação.
      if (!user) {
        throw new Error('Usuário não autenticado.');
      }

      /**
       * A regra de sessão única fica centralizada no service,
       * mas mantemos o retorno aqui para atualizar a UI imediatamente.
       */
      const createdSession = await createCheckIn(user.uid);

      setCheckInData({
        id: createdSession.id,
        time: createdSession.dataCheckin,
        status: 'sucesso',
      });

      setActiveSession(createdSession);
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao registrar check-in. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return <div className="checkin-page">Carregando...</div>;
  }

  return (
    <div className="checkin-page">
      <div className="checkin-container">
        <h1>Check-in</h1>

        <div className="checkin-card">
          <p>Clique no botão abaixo para registrar seu check-in</p>

          {success && checkInData && (
            <div className="success-message">
              <p>✓ Check-in registrado com sucesso!</p>
              <p>{checkInData.time.toLocaleTimeString('pt-BR')}</p>
            </div>
          )}

          {activeSession && (
            <div className="success-message">
              <p>Você já possui uma sessão aberta.</p>
              <p>Início: {formatDateTimeForDisplay(activeSession.dataCheckin)}</p>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button
            onClick={handleCheckIn}
            disabled={loading || !!activeSession}
            className="checkin-button"
          >
            {loading
              ? 'Processando...'
              : activeSession
              ? 'Sessão em andamento'
              : 'Fazer Check-in'}
          </button>
        </div>

        <div className="checkin-info">
          <h3>Informações</h3>
          <ul>
            <li>
              Última entrada: {activeSession ? formatDateTimeForDisplay(activeSession.dataCheckin) : '-'}
            </li>
            <li>Status: {activeSession ? 'Sessão aberta' : 'Sem sessão ativa'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}