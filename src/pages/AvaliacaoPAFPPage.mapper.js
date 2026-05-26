export class PafpMappingError extends Error {
  constructor(message = 'PAFP form mapping failed') {
    super(message);
    this.name = 'PafpMappingError';
  }
}

export function mapPafpFormToCreateInput(form, { academyId, trainerUid, athleteUid }) {
  if (!form) throw new PafpMappingError('Form data is required');
  if (!athleteUid) throw new PafpMappingError('athleteUid is required');

  return {
    athleteUserId: athleteUid,
    trainerUserId: trainerUid || null,
    academyId: academyId || null,
    activityDate: new Date(),
    formData: form,
  };
}
