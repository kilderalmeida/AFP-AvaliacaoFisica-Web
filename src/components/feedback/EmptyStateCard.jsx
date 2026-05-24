export function EmptyStateCard({ title, message = null, hint = null, action = null }) {
  return (
    <div style={styles.container}>
      <p style={styles.title}>{title}</p>
      {message && <p style={styles.message}>{message}</p>}
      {hint && <p style={styles.hint}>{hint}</p>}
      {action && <div style={styles.action}>{action}</div>}
    </div>
  );
}

const styles = {
  container: {
    background: '#f9fafb',
    border: '1px dashed #d1d5db',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    display: 'grid',
    gap: '8px',
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#374151',
  },
  message: {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: 1.5,
  },
  hint: {
    margin: 0,
    fontSize: '13px',
    color: '#9ca3af',
    lineHeight: 1.4,
  },
  action: {
    marginTop: '8px',
    display: 'flex',
    justifyContent: 'center',
  },
};
