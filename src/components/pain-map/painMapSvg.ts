const PAIN_ID_PREFIX = 'pain-';

const clampOpacity = (intensity: number): number => {
  const minOpacity = 0.25;
  const maxOpacity = 0.8;
  const normalized = Math.max(0, Math.min(10, intensity)) / 10;
  return minOpacity + (maxOpacity - minOpacity) * normalized;
};

const isValidPainId = (id: string): boolean => {
  return id.startsWith(PAIN_ID_PREFIX) && id.length > PAIN_ID_PREFIX.length;
};

export const resolvePainRegionIdFromEventTarget = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) {
    return null;
  }

  const regionElement = target.closest('[id^="pain-"]');
  if (!regionElement) {
    return null;
  }

  const regionId = regionElement.getAttribute('id');
  return regionId && isValidPainId(regionId) ? regionId : null;
};

export const buildInteractiveSvgMarkup = (
  rawSvgMarkup: string,
  selectedRegions: Record<string, number>,
): string => {
  if (!rawSvgMarkup.trim()) {
    return '';
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvgMarkup, 'image/svg+xml');

  if (doc.querySelector('parsererror')) {
    return '';
  }

  const svgElement = doc.documentElement;
  svgElement.setAttribute('width', '100%');
  svgElement.setAttribute('height', '100%');
  svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svgElement.setAttribute('class', 'pain-map-svg');

  const selectableRegions = svgElement.querySelectorAll('[id^="pain-"]');

  selectableRegions.forEach((regionElement) => {
    const regionId = regionElement.getAttribute('id') || '';

    if (!isValidPainId(regionId)) {
      return;
    }

    const code = regionId.slice(PAIN_ID_PREFIX.length);
    const intensity = selectedRegions[code] || 0;

    regionElement.classList.add('pain-map-region');
    regionElement.setAttribute('role', 'button');
    regionElement.setAttribute('tabindex', '0');

    if (intensity > 0) {
      const opacity = clampOpacity(intensity).toFixed(2);
      regionElement.classList.add('pain-map-region--selected');
      regionElement.setAttribute('data-intensity', String(intensity));
      regionElement.setAttribute('aria-pressed', 'true');

      const baseStyle = regionElement.getAttribute('style')?.trim();
      const nextStyle = `${baseStyle ? `${baseStyle}; ` : ''}--pain-fill-opacity:${opacity};`;
      regionElement.setAttribute('style', nextStyle);
    } else {
      regionElement.removeAttribute('aria-pressed');
    }
  });

  return svgElement.outerHTML;
};
