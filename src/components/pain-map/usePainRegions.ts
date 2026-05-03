import { useCallback, useMemo, useState } from 'react';

export interface PainRegion {
  code: string;
  name: string;
  /** ID do elemento no SVG (único por região — cada svgId pertence a apenas uma vista). */
  svgId: string;
  view: 'front' | 'back';
}

export interface SelectedRegionDetail {
  code: string;
  name: string;
}

/**
 * Mapeamento canônico entre svgId do arquivo SVG e região anatômica.
 *
 * Cada entrada corresponde a exatamente um elemento <ellipse>/<circle> no SVG
 * e a uma vista (frente ou costas). Não existe compartilhamento de código entre vistas.
 */
const REGION_MAP: PainRegion[] = [
  // ── Vista frontal ──────────────────────────────────────────────────────────
  { code: 'L',  name: 'Ombro esquerdo',               svgId: 'pain-L',  view: 'front' },
  { code: 'M',  name: 'Ombro direito',                svgId: 'pain-M',  view: 'front' },
  { code: '15', name: 'Peitoral esquerdo',            svgId: 'pain-15', view: 'front' },
  { code: '16', name: 'Peitoral direito',             svgId: 'pain-16', view: 'front' },
  { code: '19', name: 'Bíceps esquerdo',              svgId: 'pain-19', view: 'front' },
  { code: '20', name: 'Bíceps direito',               svgId: 'pain-20', view: 'front' },
  { code: 'N',  name: 'Punho esquerdo',               svgId: 'pain-N',  view: 'front' },
  { code: 'O',  name: 'Punho direito',                svgId: 'pain-O',  view: 'front' },
  { code: 'A',  name: 'Abdômen',                      svgId: 'pain-A',  view: 'front' },
  { code: '13', name: 'Quadril esquerdo',             svgId: 'pain-13', view: 'front' },
  { code: '14', name: 'Quadril direito',              svgId: 'pain-14', view: 'front' },
  { code: '3',  name: 'Adultor de coxa esquerda',     svgId: 'pain-3',  view: 'front' },
  { code: '4',  name: 'Adultor de coxa direita',      svgId: 'pain-4',  view: 'front' },
  { code: '1',  name: 'Coxa anterior esquerda',       svgId: 'pain-1',  view: 'front' },
  { code: '2',  name: 'Coxa anterior direita',        svgId: 'pain-2',  view: 'front' },
  { code: 'B',  name: 'Joelho esquerdo',              svgId: 'pain-B',  view: 'front' },
  { code: 'C',  name: 'Joelho direito',               svgId: 'pain-C',  view: 'front' },
  { code: '5',  name: 'Tibial anterior esquerda',      svgId: 'pain-5',  view: 'front' },
  { code: '6',  name: 'Tibial anterior direita',       svgId: 'pain-6',  view: 'front' },
  { code: 'D',  name: 'Tornozelo/Pé esquerdo',        svgId: 'pain-D',  view: 'front' },
  { code: 'E',  name: 'Tornozelo/Pé direito',         svgId: 'pain-E',  view: 'front' },

  // ── Vista posterior ────────────────────────────────────────────────────────
  { code: 'P',  name: 'Cervical',                       svgId: 'pain-P',  view: 'back' },
  { code: '17', name: 'Dorso esquerdo',                 svgId: 'pain-17', view: 'back' },
  { code: '18', name: 'Dorso direito',                  svgId: 'pain-18', view: 'back' },
  { code: '21', name: 'Tríceps esquerdo',               svgId: 'pain-21', view: 'back' },
  { code: '22', name: 'Tríceps direito',                svgId: 'pain-22', view: 'back' },
  { code: 'Q',  name: 'Cotovelo/Antebraço esquerdo',    svgId: 'pain-Q',  view: 'back' },
  { code: 'R',  name: 'Cotovelo/Antebraço direito',     svgId: 'pain-R',  view: 'back' },
  { code: 'F',  name: 'Lombar',                         svgId: 'pain-F',  view: 'back' },
  { code: '11', name: 'Glúteo esquerdo',                svgId: 'pain-11', view: 'back' },
  { code: '12', name: 'Glúteo direito',                 svgId: 'pain-12', view: 'back' },
  { code: '8',  name: 'Posterior de coxa esquerda',     svgId: 'pain-8',  view: 'back' },
  { code: '7',  name: 'Posterior de coxa direita',      svgId: 'pain-7',  view: 'back' },
  { code: 'G',  name: 'Joelho posterior esquerdo',      svgId: 'pain-G',  view: 'back' },
  { code: 'H',  name: 'Joelho posterior direito',       svgId: 'pain-H',  view: 'back' },
  { code: '10', name: 'Panturrilha esquerda',           svgId: 'pain-10', view: 'back' },
  { code: '9',  name: 'Panturrilha direita',            svgId: 'pain-9',  view: 'back' },
  { code: 'I',  name: 'Tornozelo/Calcâneo esquerdo',    svgId: 'pain-I',  view: 'back' },
  { code: 'J',  name: 'Tornozelo/Calcâneo direito',     svgId: 'pain-J',  view: 'back' },
];

/** Busca região pelo id exato do elemento SVG. */
export const getRegionBySvgId = (svgId: string): PainRegion | undefined =>
  REGION_MAP.find((region) => region.svgId === svgId);

/**
 * Monta a lista de regiões selecionadas para o payload final.
 * Retorna apenas code + name, sem intensidade.
 */
export const buildPainMapPayload = (
  selectedRegions: Record<string, boolean>,
): SelectedRegionDetail[] => {
  return Object.entries(selectedRegions)
    .flatMap(([code, isSelected]) => {
      if (!isSelected) return [];
      const region = REGION_MAP.find((item) => item.code === code);
      if (!region) return [];
      return [{ code: region.code, name: region.name }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const usePainRegions = () => {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Um clique seleciona; outro clique desmarca. Sem intensidade.
  const toggleRegion = useCallback((svgId: string) => {
    const region = getRegionBySvgId(svgId);
    if (!region) return;

    setSelected((prev) => {
      if (prev[region.code]) {
        const { [region.code]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [region.code]: true };
    });
  }, []);

  const selectedRegionDetails = useMemo<SelectedRegionDetail[]>(
    () => buildPainMapPayload(selected),
    [selected],
  );

  return {
    selected,
    toggleRegion,
    getRegionBySvgId,
    selectedRegionDetails,
    buildPainMapPayload: () => buildPainMapPayload(selected),
    REGION_MAP,
  };
};
