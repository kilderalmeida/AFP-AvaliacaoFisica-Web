/**
 * trainer-athlete-context.service.js
 *
 * Reads the list of athletes linked to the authenticated trainer/coach via athlete_links
 * and persists the trainer's selection in localStorage.
 *
 * Trainer: athlete_links WHERE trainerId == trainerUid AND status == 'active'
 * Coach: Cloud Function coachAthletes (aggregates all sub-trainer links via Admin SDK)
 */
import { getTrainerActiveAthletes } from './athleteLinkService.js';
import { getUserProfile } from './userService.js';
import { fetchCoachAthletes } from './coach-athletes-backend.service.js';

const STORAGE_KEY_PREFIX = 'afp_trainer_selected_athlete_';

export async function listTrainerAthleteOptions(uid, { includeSelfAthlete = false, role = 'trainer' } = {}) {
  if (role === 'coach') {
    try {
      const athletes = await fetchCoachAthletes(uid);
      console.debug('[listTrainerAthleteOptions] coach path, atletas:', athletes.length);
      return athletes.map((a) => ({
        id: a.uid,
        displayName: a.displayName || a.email || a.uid,
        trainerUid: a.trainerUid,
        trainerName: a.trainerName,
      }));
    } catch (error) {
      console.error('[listTrainerAthleteOptions] coach path error:', error);
      return [];
    }
  }

  // trainer path
  try {
    const links = await getTrainerActiveAthletes(uid);
    console.debug('[listTrainerAthleteOptions] links:', links.length, 'for uid:', uid);
    const settled = await Promise.allSettled(
      links.map((link) => getUserProfile(link.athleteId))
    );
    const resolved = settled
      .filter((r) => r.status === 'fulfilled' && r.value)
      .map((r) => r.value);
    const rejected = settled.filter((r) => r.status === 'rejected');
    if (rejected.length > 0) {
      console.warn('[listTrainerAthleteOptions] getUserProfile falhou para', rejected.length, 'atletas:', rejected.map((r) => r.reason?.message || r.reason));
    }
    console.debug('[listTrainerAthleteOptions] atletas resolvidos:', resolved.length);
    return resolved.map((a) => ({
      id: a.uid,
      displayName: a.displayName || a.nome || a.email || a.uid,
    }));
  } catch (error) {
    console.error('[listTrainerAthleteOptions] erro crítico:', error);
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
