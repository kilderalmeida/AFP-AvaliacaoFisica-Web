export const HYDRATION_MIN = 1;
export const HYDRATION_MAX = 8;

export const HYDRATION_SCALE = [
  { level: 1, label: 'Muito clara', bg: '#f0fdf4', text: '#166534' },
  { level: 2, label: 'Clara', bg: '#dcfce7', text: '#166534' },
  { level: 3, label: 'Amarelo claro', bg: '#fef9c3', text: '#854d0e' },
  { level: 4, label: 'Amarelo moderado', bg: '#fef08a', text: '#854d0e' },
  { level: 5, label: 'Amarelo forte', bg: '#fde047', text: '#713f12' },
  { level: 6, label: 'Amarelo escuro', bg: '#facc15', text: '#713f12' },
  { level: 7, label: 'Âmbar', bg: '#f59e0b', text: '#78350f' },
  { level: 8, label: 'Muito escura', bg: '#b45309', text: '#fff7ed' },
];

export function getHydrationInterpretation(level) {
  const entry = HYDRATION_SCALE[Number(level) - 1];
  if (!entry) return { label: 'Sem registro', helper: 'Nenhum dado de hidratação.' };
  return { label: entry.label, helper: entry.label };
}
