/**
 * Página de Check-out
 *
 * Responsabilidades:
 * - localizar a sessão ativa do atleta
 * - mostrar dados básicos da sessão em andamento
 * - finalizar a sessão com check-out
 * - exibir a duração calculada para o usuário
 */

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/config.js';
import {
  getActiveSession,
  finishCheckOut,
  formatDateTimeForDisplay,
  calculateDurationForDisplay,
} from '../services/sessionService.js';

function formatElapsed(minutes) {
  if (!minutes) return '0 min';

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
}

export default function CheckOutPage() {
  const [user, setUser] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [checkOutData, setCheckOutData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    /**
     * Ao abrir a tela, identifica o usuário atual e busca
     * a sessão ativa para decidir se o check-out pode ser feito.
     */
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setLoading(true);
        setError('');
        setUser(currentUser);

        if (!currentUser) {
          setSessionData(null);
          return;
        }

        const activeSession = await getActiveSession(currentUser.uid);
        setSessionData(activeSession);
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar sessão ativa.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Calcula o tempo decorrido apenas para exibição da UI.
   * A persistência final continua sendo feita no service.
   */
  const elapsedMinutes = useMemo(() => {
    if (!sessionData?.dataCheckin) return 0;
    return calculateDurationForDisplay(sessionData.dataCheckin);
  }, [sessionData]);

  const handleCheckOut = async () => {
    setCheckingOut(true);
    setError('');

    try {
      if (!user) {
        throw new Error('Usuário não autenticado.');
      }

      if (!sessionData?.id) {
        throw new Error('Nenhuma sessão ativa encontrada.');
      }

      /**
       * O service centraliza a atualização no Firestore
       * e o cálculo de duração persistido na sessão.
       */
      const result = await finishCheckOut(sessionData.id, sessionData.dataCheckin);

      setCheckOutData(result);
      setSuccess(true);
      setSessionData(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao registrar check-out. Tente novamente.');
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return <div className="checkout-page">Carregando...</div>;
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <h1>Check-out</h1>

        <div className="checkout-card">
          {success && checkOutData ? (
            <div className="success-message">
              <h2>✓ Check-out registrado com sucesso!</h2>
              <p>Hora: {checkOutData.time.toLocaleTimeString('pt-BR')}</p>
              <p>Duração registrada: {formatElapsed(checkOutData.durationMinutes)}</p>
            </div>
          ) : !sessionData ? (
            <div className="warning-message">
              <p>Nenhuma sessão ativa.</p>
              <p>Faça um check-in primeiro.</p>
            </div>
          ) : (
            <>
              <div className="session-info">
                <h2>Sessão Ativa</h2>
                <p>Hora de entrada: {formatDateTimeForDisplay(sessionData.dataCheckin)}</p>
                <p>Tempo decorrido: {formatElapsed(elapsedMinutes)}</p>
                <p>Atividade: {sessionData.atividades?.[0] || '-'}</p>
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                onClick={handleCheckOut}
                disabled={checkingOut || success}
                className="checkout-button"
              >
                {checkingOut ? 'Processando...' : success ? 'Concluído' : 'Fazer Check-out'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}