// Badge de status reutilizável (H-26 — Wave 7).
// API semântica por domínio: <StatusBadge kind="userStatus" value="active" />
// O componente conhece o label pt-BR e o tom de cor de cada valor, evitando
// que as telas repitam textos e cores inline.

const TONES = {
  success: { background: '#dcfce7', color: '#166534' },
  neutral: { background: '#f1f5f9', color: '#475569' },
  info: { background: '#dbeafe', color: '#1d4ed8' },
  warning: { background: '#fef9c3', color: '#854d0e' },
  accent: { background: '#ede9fe', color: '#7c3aed' },
};

// kind → value → { label (pt-BR), tone }
const BADGE_MAP = {
  userStatus: {
    invited: { label: 'Convidado', tone: 'warning' },
    active: { label: 'Ativo', tone: 'success' },
    inactive: { label: 'Inativo', tone: 'neutral' },
  },
  role: {
    trainer: { label: 'Trainer', tone: 'info' },
    coach: { label: 'Coach', tone: 'accent' },
  },
  activity: {
    open: { label: 'Em andamento', tone: 'info' },
    completed: { label: 'Concluída', tone: 'success' },
  },
};

const baseStyle = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

export function StatusBadge({ kind, value, fallbackTone = 'neutral' }) {
  const entry = BADGE_MAP[kind]?.[value];
  const label = entry?.label ?? (value || '—');
  const tone = entry?.tone ?? fallbackTone;
  return <span style={{ ...baseStyle, ...TONES[tone] }}>{label}</span>;
}
