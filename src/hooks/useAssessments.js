import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase/config.js';

export function useAssessments({ athleteUserId }) {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!athleteUserId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, 'activities'),
            where('athleteUserId', '==', athleteUserId),
            where('activityType', '==', 'assessment'),
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
  }, [athleteUserId]);

  return { assessments, loading, error };
}
