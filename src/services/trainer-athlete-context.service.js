/**
 * trainer-athlete-context.service.js
 *
 * Reads the list of athletes linked to the authenticated trainer via athlete_links
 * and persists the trainer's selection in localStorage.
 *
 * Data source: athlete_links WHERE trainerId == trainerUid AND status == 'active'
 * Requires:    composite index athlete_links(trainerId ASC, status ASC) — deployed.
 */
import { getTrainerActiveAthletes } from './athleteLinkService.js';
import { getUserProfile } from './userService.js';

const STORAGE_KEY_PREFIX = 'afp_trainer_selected_athlete_';

export async function listTrainerAthleteOptions(trainerUid, { includeSelfAthlete = false } = {}) {
  try {
    const links = await getTrainerActiveAthletes(trainerUid);
    const settled = await Promise.allSettled(
      links.map((link) => getUserProfile(link.athleteId))
    );
    return settled
      .filter((r) => r.status === 'fulfilled' && r.value)
      .map((r) => r.value)
      .map((a) => ({
        id: a.uid,
        displayName: a.displayName || a.nome || a.email || a.uid,
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
