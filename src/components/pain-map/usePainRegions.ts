import { useCallback, useMemo, useState } from 'react';

export interface PainRegion {
  code: string;
  name: string;
  svgIdFront: string;
  svgIdBack: string;
}

export interface SelectedRegionDetail {
  code: string;
  name: string;
  intensity: number;
}

const REGION_MAP: PainRegion[] = [
  { code: 'P', name: 'Cervical', svgIdFront: 'pain-P', svgIdBack: 'pain-P' },
  { code: '17', name: 'Ombro Esquerdo', svgIdFront: 'pain-17', svgIdBack: 'pain-17' },
  { code: '18', name: 'Ombro Direito', svgIdFront: 'pain-18', svgIdBack: 'pain-18' },
  { code: '21', name: 'Peito Esquerdo', svgIdFront: 'pain-21', svgIdBack: 'pain-21' },
  { code: '22', name: 'Peito Direito', svgIdFront: 'pain-22', svgIdBack: 'pain-22' },
  { code: 'Q', name: 'Braco Esquerdo', svgIdFront: 'pain-Q', svgIdBack: 'pain-Q' },
  { code: 'R', name: 'Braco Direito', svgIdFront: 'pain-R', svgIdBack: 'pain-R' },
  { code: 'F', name: 'Lombar', svgIdFront: 'pain-F', svgIdBack: 'pain-F' },
  { code: '11', name: 'Coxa Esquerda', svgIdFront: 'pain-11', svgIdBack: 'pain-11' },
  { code: '12', name: 'Coxa Direita', svgIdFront: 'pain-12', svgIdBack: 'pain-12' },
  { code: '8', name: 'Panturrilha Esquerda', svgIdFront: 'pain-8', svgIdBack: 'pain-8' },
  { code: '7', name: 'Panturrilha Direita', svgIdFront: 'pain-7', svgIdBack: 'pain-7' },
  { code: 'G', name: 'Gluteo Esquerdo', svgIdFront: 'pain-G', svgIdBack: 'pain-G' },
  { code: 'H', name: 'Gluteo Direito', svgIdFront: 'pain-H', svgIdBack: 'pain-H' },
  { code: '10', name: 'Perna Esquerda', svgIdFront: 'pain-10', svgIdBack: 'pain-10' },
  { code: '9', name: 'Perna Direita', svgIdFront: 'pain-9', svgIdBack: 'pain-9' },
  { code: 'I', name: 'Tornozelo Esquerdo', svgIdFront: 'pain-I', svgIdBack: 'pain-I' },
  { code: 'J', name: 'Tornozelo Direito', svgIdFront: 'pain-J', svgIdBack: 'pain-J' },
];

export const getRegionBySvgId = (svgId: string): PainRegion | undefined =>
  REGION_MAP.find((region) => region.svgIdFront === svgId || region.svgIdBack === svgId);

export const buildPainMapPayload = (
  selectedRegions: Record<string, number>,
): SelectedRegionDetail[] => {
  return Object.entries(selectedRegions)
    .map(([code, intensity]) => {
      const region = REGION_MAP.find((item) => item.code === code);

      if (!region) {
        return null;
      }

      return {
        code: region.code,
        name: region.name,
        intensity,
      };
    })
    .filter((item): item is SelectedRegionDetail => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const usePainRegions = () => {
  const [selected, setSelected] = useState<Record<string, number>>({});

  const toggleRegion = useCallback((svgId: string) => {
    const region = getRegionBySvgId(svgId);

    if (!region) {
      return;
    }

    setSelected((prev) => {
      const current = prev[region.code] || 0;
      const next = current < 10 ? current + 1 : 0;

      if (next === 0) {
        const { [region.code]: _removed, ...rest } = prev;
        return rest;
      }

      return { ...prev, [region.code]: next };
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
