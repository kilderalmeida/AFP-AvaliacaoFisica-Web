import React, { useEffect, useMemo, useState } from 'react';
import { bodyBack, bodyFront, painMapBack, painMapFront } from '../../assets';
import {
  buildInteractiveSvgMarkup,
  resolvePainRegionIdFromEventTarget,
} from './painMapSvg';
import { getRegionBySvgId } from './usePainRegions';
import './PainMap.css';

export interface PainMapProps {
  selectedRegions: Record<string, boolean>;
  onSelect: (svgId: string) => void;
}

export const PainMap: React.FC<PainMapProps> = ({ selectedRegions, onSelect }) => {
  const [isBackView, setIsBackView] = useState(false);
  const [rawSvgMarkup, setRawSvgMarkup] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const svgUrl = isBackView ? painMapBack : painMapFront;

    let isMounted = true;

    setIsLoading(true);
    setLoadError(null);

    fetch(svgUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Erro ao carregar mapa: ${response.statusText}`);
        }
        return response.text();
      })
      .then((markup) => {
        if (isMounted) {
          setRawSvgMarkup(markup);
          setLoadError(null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setRawSvgMarkup('');
          setLoadError(err instanceof Error ? err.message : 'Erro desconhecido ao carregar mapa');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isBackView]);

  const interactiveSvgMarkup = useMemo(
    () =>
      buildInteractiveSvgMarkup(rawSvgMarkup, (svgId) => {
        const region = getRegionBySvgId(svgId);
        return Boolean(region && selectedRegions[region.code]);
      }),
    [rawSvgMarkup, selectedRegions],
  );

  const selectedCount = Object.keys(selectedRegions).length;

  return (
    <section className="pain-map" aria-label="Mapa de dor interativo">
      <div className="pain-map-hint" role="note">
        Clique nas áreas do corpo para marcar regiões de dor
      </div>

      <div
        className="pain-map-canvas"
        role="group"
        aria-label={isBackView ? 'Mapa corporal vista costas' : 'Mapa corporal vista frente'}
      >
        {isLoading && <div className="pain-map-loading">Carregando mapa...</div>}
        {loadError && (
          <div className="pain-map-error" role="alert">
            {loadError}
          </div>
        )}

        {!isLoading && !loadError && (
          <div className="pain-map-figure">
            <img
              className="pain-map-body-image"
              src={isBackView ? bodyBack : bodyFront}
              alt={isBackView ? 'Corpo humano vista costas' : 'Corpo humano vista frente'}
            />

            <div
              className="pain-map-overlay"
              aria-label="Regioes clicáveis para marcar dor"
              role="group"
              onClick={(event) => {
                const svgId = resolvePainRegionIdFromEventTarget(event.target);
                if (svgId) {
                  onSelect(svgId);
                }
              }}
              dangerouslySetInnerHTML={{ __html: interactiveSvgMarkup }}
            />
          </div>
        )}
      </div>

      <div className="pain-map-controls">
        <button
          type="button"
          className="pain-map-toggle-button"
          onClick={() => setIsBackView((current) => !current)}
          aria-label={isBackView ? 'Mostrar vista frontal' : 'Mostrar vista costas'}
          disabled={isLoading}
        >
          {isBackView ? 'Frente' : 'Costas'}
        </button>

        <span className="pain-map-selected-count" aria-live="polite" aria-atomic="true">
          {selectedCount === 0
            ? 'Nenhuma regiao selecionada'
            : selectedCount === 1
              ? '1 regiao selecionada'
              : `${selectedCount} regioes selecionadas`}
        </span>
      </div>
    </section>
  );
};
