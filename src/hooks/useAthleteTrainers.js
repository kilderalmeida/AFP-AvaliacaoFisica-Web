import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
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
        const snap = await getDocs(
          query(collection(db, 'users'), where('role', '==', 'treinador'))
        );
        const linked = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => u.athletes?.includes(athleteUserId) || u.coach_id === athleteUserId);
        if (!cancelled) setTrainers(linked);
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
