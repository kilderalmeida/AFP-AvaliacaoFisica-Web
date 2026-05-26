import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config.js';

export function useAthleteTrainers(athleteUserId) {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!athleteUserId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const athleteSnap = await getDoc(doc(db, 'users', athleteUserId));
        const treinadorId = athleteSnap.data()?.treinador_id;

        if (!treinadorId) {
          if (!cancelled) setTrainers([]);
          return;
        }

        let displayName = treinadorId;
        try {
          const trainerSnap = await getDoc(doc(db, 'users', treinadorId));
          if (trainerSnap.exists()) {
            const td = trainerSnap.data();
            displayName = td.displayName || td.nome || td.email || treinadorId;
          }
        } catch {
          // rule may not allow reading trainer doc yet; fall back to uid
        }

        if (!cancelled) setTrainers([{ id: treinadorId, displayName, isPrimary: true }]);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [athleteUserId]);

  return { trainers, loading, error };
}
