import { auth } from './firebase/config.js';

function resolveEndpoint() {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'afp-avaliacaofisica';
  const useEmulator = import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true';
  if (useEmulator) {
    return import.meta.env.VITE_TRAINER_DASHBOARD_ENDPOINT
      || `http://127.0.0.1:5001/${projectId}/us-central1/trainerDashboardStats`;
  }
  return `https://us-central1-${projectId}.cloudfunctions.net/trainerDashboardStats`;
}

export async function getTrainerDashboardStatsFromBackend({ trainerUid, athleteUid, days = 7 }) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User must be authenticated to call trainerDashboardStats');

  const token = await currentUser.getIdToken();
  const endpoint = resolveEndpoint();
  const url = `${endpoint}?trainerUid=${encodeURIComponent(trainerUid)}&athleteUid=${encodeURIComponent(athleteUid)}&days=${encodeURIComponent(days)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    const err = new Error(`Backend trainer dashboard request failed: ${response.status}`);
    err.status = response.status;
    err.endpoint = endpoint;
    err.runtimeConfig = { trainerUid, athleteUid, days };
    err.responsePayload = payload;
    throw err;
  }

  return response.json();
}
