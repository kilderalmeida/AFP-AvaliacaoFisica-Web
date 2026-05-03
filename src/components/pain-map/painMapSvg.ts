const PAIN_ID_PREFIX = 'pain-';

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
  isRegionSelected: (svgId: string) => boolean,
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

    regionElement.classList.add('pain-map-region');
    regionElement.setAttribute('role', 'button');
    regionElement.setAttribute('tabindex', '0');
    regionElement.setAttribute('fill', 'rgba(0,0,0,0.001)');
    regionElement.setAttribute('pointer-events', 'all');

    if (isRegionSelected(regionId) || isRegionSelected(code)) {
      regionElement.classList.add('pain-map-region--selected');
      regionElement.setAttribute('aria-pressed', 'true');
    } else {
      regionElement.setAttribute('aria-pressed', 'false');
    }
  });

  return svgElement.outerHTML;
};
