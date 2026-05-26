import { auth } from './firebase/config.js';

function resolveEndpoint() {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'afp-avaliacaofisica';
  const useEmulator = import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true';
  if (useEmulator) {
    return import.meta.env.VITE_ATHLETE_DASHBOARD_ENDPOINT
      || `http://127.0.0.1:5001/${projectId}/us-central1/athleteDashboardStats`;
  }
  return `https://us-central1-${projectId}.cloudfunctions.net/athleteDashboardStats`;
}

export async function getAthleteDashboardStatsFromBackend({ athleteUid, days = 7 }) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User must be authenticated to call athleteDashboardStats');

  const token = await currentUser.getIdToken();
  const endpoint = resolveEndpoint();
  const url = `${endpoint}?athleteUid=${encodeURIComponent(athleteUid)}&days=${encodeURIComponent(days)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    const err = new Error(`Backend athlete dashboard request failed: ${response.status}`);
    err.status = response.status;
    err.endpoint = endpoint;
    err.responsePayload = payload;
    throw err;
  }

  return response.json();
}
