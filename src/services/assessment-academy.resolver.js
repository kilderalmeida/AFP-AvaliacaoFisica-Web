import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from './firebase/config.js';

export class AssessmentAcademyUnresolvedError extends Error {
  constructor(message = 'Could not resolve assessment academy') {
    super(message);
    this.name = 'AssessmentAcademyUnresolvedError';
  }
}

export async function resolveAssessmentAcademyId({ trainerUid, athleteUid }) {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'academies'),
        where('trainerUid', '==', trainerUid),
        limit(1)
      )
    );
    if (snap.empty) {
      throw new AssessmentAcademyUnresolvedError(
        `No academy found for trainer ${trainerUid}`
      );
    }
    return { academyId: snap.docs[0].id };
  } catch (err) {
    if (err instanceof AssessmentAcademyUnresolvedError) throw err;
    throw new AssessmentAcademyUnresolvedError(err.message);
  }
}
