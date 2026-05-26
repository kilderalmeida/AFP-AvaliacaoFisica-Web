import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/config.js';

async function createAssessment(payload, createdByUid) {
  const docRef = await addDoc(collection(db, 'assessments'), {
    ...payload,
    createdAt: serverTimestamp(),
    createdBy: createdByUid,
  });
  return docRef.id;
}

export const assessmentService = { createAssessment };
