const PAPEL_OPTIONS = [
  { value: '', label: 'Todos os papéis' },
  { value: 'platform_admin', label: 'Admin da plataforma' },
  { value: 'account_admin', label: 'Admin de conta' },
  { value: 'trainer', label: 'Treinador' },
  { value: 'coach', label: 'Coach' },
  { value: 'athlete', label: 'Atleta' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'invited', label: 'Convidado' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

export function UserFilters({ filters, onChange, disableStatus = false }) {
  return (
    <div style={styles.row}>
      <select
        style={styles.select}
        value={filters.papel || ''}
        onChange={(e) => onChange({ ...filters, papel: e.target.value || undefined })}
      >
        {PAPEL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        style={{ ...styles.select, ...(disableStatus ? styles.selectDisabled : {}) }}
        value={filters.status || ''}
        onChange={(e) => !disableStatus && onChange({ ...filters, status: e.target.value || undefined })}
        disabled={disableStatus}
        title={disableStatus ? 'Filtro de status indisponível ao filtrar por conta' : undefined}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

const styles = {
  row: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  select: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    color: '#334155',
    background: '#fff',
    cursor: 'pointer',
  },
  selectDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
};
