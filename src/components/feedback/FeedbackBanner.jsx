// Banner de feedback pós-ação, dispensável e sem auto-hide (H-32 — Wave 7).
// Variantes: success / error. Contextual de página — não é modal, não rouba foco.
// <FeedbackBanner kind="error" message="..." onClose={() => setFeedback(null)} />

export function FeedbackBanner({ kind, message, onClose }) {
  const tone = kind === 'success' ? TONES.success : TONES.error;
  return (
    <div
      style={{ ...styles.banner, ...tone }}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span style={styles.message}>{message}</span>
      <button
        type="button"
        style={{ ...styles.close, color: tone.color }}
        onClick={onClose}
        aria-label="Fechar mensagem"
      >
        ✕
      </button>
    </div>
  );
}

const TONES = {
  success: { background: '#dcfce7', borderColor: '#86efac', color: '#166534' },
  error: { background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' },
};

const styles = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid',
    fontSize: '14px',
  },
  message: {
    lineHeight: 1.4,
  },
  close: {
    flexShrink: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    padding: '2px 4px',
  },
};
