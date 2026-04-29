import React, { useState } from 'react';
import { PainMap, usePainRegions } from './pain-map';

export const AvaliacaoForm: React.FC = () => {
  const { selected, toggleRegion, selectedRegionDetails, buildPainMapPayload } = usePainRegions();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Construir payload completo com regiões de dor
      const painMapData = buildPainMapPayload();

      // Exemplo: integração com submit da avaliação
      const avaliationPayload = {
        painMap: painMapData,
        timestamp: new Date().toISOString(),
        // ... outros campos da avaliação
      };

      console.log('Payload de avaliação:', avaliationPayload);
      // await submitAvaliacao(avaliationPayload);
    } catch (err) {
      console.error('Erro ao submeter avaliação:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section style={{ display: 'grid', gap: 16, maxWidth: 640, margin: '0 auto' }}>
      <PainMap selectedRegions={selected} onSelect={toggleRegion} />

      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          padding: 16,
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Regioes selecionadas</h3>

        {selectedRegionDetails.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
            Nenhuma regiao marcada. Clique nas areas do mapa para indicar locais de dor.
          </p>
        ) : (
          <div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                display: 'grid',
                gap: 8,
                fontSize: 14,
              }}
            >
              {selectedRegionDetails.map((region) => (
                <li
                  key={region.code}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    <strong>{region.name}</strong> <code>({region.code})</code>
                  </span>
                  <span style={{ background: '#fee2e2', padding: '2px 8px', borderRadius: 4 }}>
                    intensidade {region.intensity}
                  </span>
                </li>
              ))}
            </ul>

            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  background: '#1976d2',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Avaliacao'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
