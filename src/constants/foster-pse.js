export const FOSTER_PSE_MIN = 0;
export const FOSTER_PSE_MAX = 10;

export const FOSTER_PSE_SCALE = [
  { level: 0, label: 'Repouso', color: '#6b7280' },
  { level: 1, label: 'Muito leve', color: '#22c55e' },
  { level: 2, label: 'Muito leve', color: '#22c55e' },
  { level: 3, label: 'Leve', color: '#84cc16' },
  { level: 4, label: 'Leve', color: '#84cc16' },
  { level: 5, label: 'Moderado', color: '#eab308' },
  { level: 6, label: 'Moderado', color: '#eab308' },
  { level: 7, label: 'Intenso', color: '#f97316' },
  { level: 8, label: 'Intenso', color: '#f97316' },
  { level: 9, label: 'Muito intenso', color: '#ef4444' },
  { level: 10, label: 'Máximo esforço', color: '#dc2626' },
];

export const FOSTER_PSE_BANDS = [
  { min: 0, max: 2, label: 'Leve', color: '#22c55e' },
  { min: 3, max: 5, label: 'Moderado', color: '#eab308' },
  { min: 6, max: 8, label: 'Intenso', color: '#f97316' },
  { min: 9, max: 10, label: 'Muito intenso', color: '#ef4444' },
];

export function getFosterPseLabel(value) {
  const entry = FOSTER_PSE_SCALE[Number(value)];
  return entry ? entry.label : 'Sem registro';
}

export function getFosterPseColor(value) {
  const entry = FOSTER_PSE_SCALE[Number(value)];
  return entry ? entry.color : '#6b7280';
}
