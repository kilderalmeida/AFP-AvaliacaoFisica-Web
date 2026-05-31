import { auth } from './firebase/config.js';

function resolveEndpoint() {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'afp-avaliacaofisica';
  const useEmulator = import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true';
  if (useEmulator) {
    return `http://127.0.0.1:5001/${projectId}/us-central1/coachAthletes`;
  }
  return `https://us-central1-${projectId}.cloudfunctions.net/coachAthletes`;
}

/**
 * Fetches all active athletes visible to the coach (across all their sub-trainers).
 * Returns [{uid, displayName, email, trainerUid, trainerName}].
 */
export async function fetchCoachAthletes(coachUid) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User must be authenticated to call coachAthletes');

  const token = await currentUser.getIdToken();
  const endpoint = resolveEndpoint();
  const url = `${endpoint}?coachUid=${encodeURIComponent(coachUid)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    throw new Error(`coachAthletes HTTP ${response.status}: ${payload}`);
  }

  const data = await response.json();
  return Array.isArray(data.athletes) ? data.athletes : [];
}
