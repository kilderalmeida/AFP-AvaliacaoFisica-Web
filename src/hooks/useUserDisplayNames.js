import { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config.js';

export function useUserDisplayNames(uids) {
  const [names, setNames] = useState({});
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    const validUids = [...new Set((Array.isArray(uids) ? uids : []).filter(Boolean))];
    const toFetch = validUids.filter((uid) => !fetchedRef.current.has(uid));
    if (toFetch.length === 0) return;

    let cancelled = false;

    async function fetchAll() {
      const result = {};
      await Promise.all(
        toFetch.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
              const data = snap.data();
              result[uid] = data.displayName || data.nome || data.email || uid;
            }
            fetchedRef.current.add(uid);
          } catch {
            // silently ignore — UI falls back to uid
          }
        })
      );
      if (!cancelled) {
        setNames((prev) => ({ ...prev, ...result }));
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [uids]);

  return names;
}
