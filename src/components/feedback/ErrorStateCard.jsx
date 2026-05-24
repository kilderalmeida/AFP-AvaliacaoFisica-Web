export function ErrorStateCard({ title, message, onAction }) {
  return (
    <div style={styles.container}>
      <p style={styles.title}>{title}</p>
      {message && <p style={styles.message}>{message}</p>}
      {onAction && (
        <button type="button" style={styles.button} onClick={onAction}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '12px',
    padding: '20px',
    display: 'grid',
    gap: '10px',
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#991b1b',
  },
  message: {
    margin: 0,
    fontSize: '14px',
    color: '#b91c1c',
    lineHeight: 1.5,
  },
  button: {
    alignSelf: 'start',
    padding: '8px 16px',
    background: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
