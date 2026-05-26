import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase/config.js';

export function useAssessments({ athleteUserId, trainerUserId = null }) {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!athleteUserId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // When trainerUserId is provided the query includes it so Firestore can
        // verify the trainerUserId == auth.uid rule condition at query evaluation time.
        const snap = await getDocs(
          query(
            collection(db, 'assessments'),
            where('athleteUserId', '==', athleteUserId),
            ...(trainerUserId ? [where('trainerUserId', '==', trainerUserId)] : []),
            orderBy('activityDate', 'desc')
          )
        );
        if (!cancelled) {
          setAssessments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [athleteUserId, trainerUserId]);

  return { assessments, loading, error };
}
