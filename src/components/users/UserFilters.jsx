const PAPEL_OPTIONS = [
  { value: '', label: 'Todos os papéis' },
  { value: 'admin', label: 'Admin' },
  { value: 'treinador', label: 'Treinador' },
  { value: 'coach', label: 'Coach' },
  { value: 'atleta', label: 'Atleta' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'invited', label: 'Convidado' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

export function UserFilters({ filters, onChange }) {
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
        style={styles.select}
        value={filters.status || ''}
        onChange={(e) => onChange({ ...filters, status: e.target.value || undefined })}
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
};
