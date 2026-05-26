export const HYDRATION_MIN = 1;
export const HYDRATION_MAX = 8;

export const HYDRATION_SCALE = [
  { level: 1, label: 'Muito clara',       description: 'Hidratação excelente',    bg: '#f0fdf4', text: '#166534' },
  { level: 2, label: 'Clara',             description: 'Bem hidratado',           bg: '#dcfce7', text: '#166534' },
  { level: 3, label: 'Amarelo claro',     description: 'Hidratação adequada',     bg: '#fef9c3', text: '#854d0e' },
  { level: 4, label: 'Amarelo moderado',  description: 'Levemente desidratado',   bg: '#fef08a', text: '#854d0e' },
  { level: 5, label: 'Amarelo forte',     description: 'Desidratação moderada',   bg: '#fde047', text: '#713f12' },
  { level: 6, label: 'Amarelo escuro',    description: 'Desidratado',             bg: '#facc15', text: '#713f12' },
  { level: 7, label: 'Âmbar',            description: 'Muito desidratado',        bg: '#f59e0b', text: '#78350f' },
  { level: 8, label: 'Muito escura',      description: 'Desidratação severa',     bg: '#b45309', text: '#fff7ed' },
];

export function getHydrationInterpretation(level) {
  const entry = HYDRATION_SCALE[Number(level) - 1];
  if (!entry) return { label: 'Sem registro', description: '', color: '#374151' };
  return { label: entry.label, description: entry.description, color: entry.text };
}
