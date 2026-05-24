import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase/config.js';

const STORAGE_KEY_PREFIX = 'afp_trainer_selected_athlete_';

function normalizeAthleteRole(userTypes) {
  const types = Array.isArray(userTypes) ? userTypes : [];
  return types.some((t) => {
    const normalized = String(t || '').toLowerCase().trim();
    return normalized === 'athlete' || normalized === 'atleta';
  });
}

export async function listTrainerAthleteOptions(trainerUid, { includeSelfAthlete = false } = {}) {
  try {
    const snap = await getDocs(
      query(collection(db, 'users'), where('treinador_id', '==', trainerUid))
    );
    const athletes = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u) => normalizeAthleteRole(u.userTypes));

    return athletes.map((a) => ({
      id: a.id,
      displayName: a.displayName || a.nome || a.email || a.id,
    }));
  } catch (error) {
    console.error('Erro ao listar atletas do treinador:', error);
    return [];
  }
}

export function resolveTrainerSelectedAthleteId(trainerUid, athletes) {
  const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${trainerUid}`);
  if (stored && Array.isArray(athletes) && athletes.some((a) => a.id === stored)) {
    return stored;
  }
  return Array.isArray(athletes) && athletes.length > 0 ? athletes[0].id : null;
}

export function setStoredTrainerSelectedAthleteId(trainerUid, athleteId) {
  const key = `${STORAGE_KEY_PREFIX}${trainerUid}`;
  if (athleteId) {
    localStorage.setItem(key, athleteId);
  } else {
    localStorage.removeItem(key);
  }
}

export function formatTrainerAthleteOptionLabel(athleteId, name, athletes) {
  if (!Array.isArray(athletes) || athletes.length <= 1) return name;
  return name || athleteId;
}
