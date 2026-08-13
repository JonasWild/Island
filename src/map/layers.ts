import type {
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSourceSpecification,
  LayerSpecification,
  Map as MLMap,
} from 'maplibre-gl';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { alleStopps, TAG_FARBE, tage, unterkuenfte } from '@/lib/reise';
import { zuLngLat } from '@/lib/geo';

export const SRC_STOPPS = 'stopps';
export const SRC_ETAPPEN = 'etappen';
export const SRC_UNTERKUENFTE = 'unterkuenfte';
export const SRC_ORT = 'ort-marke';

export const LYR_ETAPPE = 'etappe-linie';
export const LYR_ETAPPE_LABEL = 'etappe-label';
export const LYR_STOPP_GLOW = 'stopp-glow';
export const LYR_STOPP = 'stopp-symbol';
export const LYR_STOPP_LABEL = 'stopp-label';
export const LYR_UNTERKUNFT = 'unterkunft-symbol';
export const LYR_ORT = 'ort-symbol';

export type StoppProps = {
  id: string;
  name: string;
  datum: string;
  tagTyp: string;
  index: number;
  genauigkeit: 'punkt' | 'bereich' | 'unbelegt';
  buchen: boolean;
  farbe: string;
};

function tagTypVon(datum: string): string {
  return tage.find((t) => t.datum === datum)?.typ ?? 'etappe';
}

export function stoppFeatures(): FeatureCollection<Point, StoppProps> {
  return {
    type: 'FeatureCollection',
    features: alleStopps
      .filter((s) => s.stopp.pos !== null)
      .map((s) => {
        const typ = tagTypVon(s.datum);
        return {
          type: 'Feature' as const,
          id: `${s.datum.replace(/-/g, '')}${String(s.index).padStart(2, '0')}`,
          geometry: { type: 'Point' as const, coordinates: zuLngLat(s.stopp.pos!) },
          properties: {
            id: s.id,
            name: s.stopp.name,
            datum: s.datum,
            tagTyp: typ,
            index: s.index,
            genauigkeit: s.stopp.posMeta?.genauigkeit ?? 'unbelegt',
            buchen: s.stopp.buchen === true,
            farbe: TAG_FARBE[typ as keyof typeof TAG_FARBE] ?? '#f8fafc',
          },
        };
      }),
  };
}

export function unterkunftFeatures(): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: unterkuenfte
      .filter((u) => u.pos !== null)
      .map((u) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: zuLngLat(u.pos!) },
        properties: {
          id: u.id,
          name: u.name,
          von: u.von,
          bis: u.bis,
          genauigkeit: u.posMeta?.genauigkeit ?? 'unbelegt',
        },
      })),
  };
}

/**
 * Etappenlinien sind bewusst nur Verbindungslinien zwischen den Stopps eines
 * Tages — keine Navigationsroute. Deshalb gestrichelt und am Weg beschriftet.
 */
export function etappenFeatures(): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: tage
      .map((t) => {
        const punkte = t.highlights.filter((h) => h.pos !== null).map((h) => zuLngLat(h.pos!));
        if (punkte.length < 2) return null;
        return {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: punkte },
          properties: {
            datum: t.datum,
            tagTyp: t.typ,
            farbe: TAG_FARBE[t.typ],
            label: 'schematisch — keine Route',
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null),
  };
}

const leer: GeoJSONSourceSpecification = {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: [] },
};

/**
 * Nur der aktive Tag ist voll sichtbar, der Rest bleibt als Kontext blass.
 * Derselbe Ausdruck dient als Layer-Filter und als Bedingung in `case`.
 */
function aktivAusdruck(datum: string): ExpressionSpecification {
  return ['==', ['get', 'datum'], datum];
}
function aktivFilter(datum: string): FilterSpecification {
  return aktivAusdruck(datum);
}

export function quellenSetzen(map: MLMap): void {
  if (!map.getSource(SRC_STOPPS)) {
    map.addSource(SRC_STOPPS, { type: 'geojson', data: stoppFeatures() });
  }
  if (!map.getSource(SRC_ETAPPEN)) {
    map.addSource(SRC_ETAPPEN, { type: 'geojson', data: etappenFeatures() });
  }
  if (!map.getSource(SRC_UNTERKUENFTE)) {
    map.addSource(SRC_UNTERKUENFTE, { type: 'geojson', data: unterkunftFeatures() });
  }
  if (!map.getSource(SRC_ORT)) map.addSource(SRC_ORT, leer);
}

export function layerSetzen(map: MLMap, aktivesDatum: string): void {
  const add = (spec: LayerSpecification) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  };

  add({
    id: LYR_ETAPPE,
    type: 'line',
    source: SRC_ETAPPEN,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'farbe'],
      'line-width': ['case', aktivAusdruck(aktivesDatum), 3, 1.2],
      'line-opacity': ['case', aktivAusdruck(aktivesDatum), 0.9, 0.12],
      'line-dasharray': [2, 1.6],
    },
  });

  add({
    id: LYR_ETAPPE_LABEL,
    type: 'symbol',
    source: SRC_ETAPPEN,
    filter: aktivFilter(aktivesDatum),
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'label'],
      'text-size': 10,
      'text-letter-spacing': 0.12,
      'text-max-angle': 40,
      'symbol-spacing': 260,
    },
    paint: {
      'text-color': ['get', 'farbe'],
      'text-halo-color': 'rgba(0,0,0,0.65)',
      'text-halo-width': 1.2,
      'text-opacity': 0.85,
    },
  });

  add({
    id: LYR_UNTERKUNFT,
    type: 'symbol',
    source: SRC_UNTERKUENFTE,
    layout: {
      'icon-image': 'unterkunft',
      'icon-size': 0.5,
      'icon-allow-overlap': true,
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: {
      'text-color': '#34d399',
      'text-halo-color': 'rgba(0,0,0,0.8)',
      'text-halo-width': 1.4,
      'icon-opacity': 0.95,
    },
  });

  // Farbring unter dem Symbol: er trägt die Tagesfarbe. `icon-halo-*` täte das
  // nicht — das wirkt nur auf SDF-Icons, und die hier sind farbig gezeichnet.
  add({
    id: LYR_STOPP_GLOW,
    type: 'circle',
    source: SRC_STOPPS,
    filter: aktivFilter(aktivesDatum),
    paint: {
      'circle-color': ['get', 'farbe'],
      'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 17, 12],
      'circle-opacity': 0.28,
      'circle-blur': 0.45,
      'circle-pitch-alignment': 'map',
    },
  });

  add({
    id: LYR_STOPP,
    type: 'symbol',
    source: SRC_STOPPS,
    layout: {
      'icon-image': [
        'case',
        ['get', 'buchen'],
        'stopp-buchen',
        ['==', ['get', 'genauigkeit'], 'bereich'],
        'stopp-bereich',
        'stopp-punkt',
      ],
      // Layout-Eigenschaft: hier ist kein feature-state erlaubt. Die
      // Hover-Hervorhebung macht der Kreis-Layer darunter (paint).
      'icon-size': ['case', aktivAusdruck(aktivesDatum), 0.48, 0.3],
      'icon-allow-overlap': true,
      'symbol-sort-key': ['case', aktivAusdruck(aktivesDatum), 0, 1],
    },
    paint: {
      'icon-opacity': ['case', aktivAusdruck(aktivesDatum), 1, 0.22],
    },
  });

  add({
    id: LYR_STOPP_LABEL,
    type: 'symbol',
    source: SRC_STOPPS,
    filter: aktivFilter(aktivesDatum),
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-max-width': 12,
      'text-optional': true,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#f8fafc',
      'text-halo-color': 'rgba(2,6,23,0.85)',
      'text-halo-width': 1.6,
      // MapLibre erlaubt `zoom` nur als direkte Eingabe eines top-level
      // interpolate/step — nicht verschachtelt. Die Labels blenden deshalb rein
      // über den Zoom ein; die Hover-Hervorhebung trägt der Kreis-Layer und der
      // HTML-Tooltip mit Name und Höhe.
      'text-opacity': ['interpolate', ['linear'], ['zoom'], 7.5, 0, 8.5, 1],
    },
  });

  add({
    id: LYR_ORT,
    type: 'symbol',
    source: SRC_ORT,
    layout: { 'icon-image': 'ort-frage', 'icon-size': 0.55, 'icon-allow-overlap': true },
  });
}

/** Tageswechsel: nur die datumsabhängigen Ausdrücke neu setzen, kein Reload. */
export function aktivenTagSetzen(map: MLMap, datum: string): void {
  const f = aktivAusdruck(datum);
  if (map.getLayer(LYR_ETAPPE)) {
    map.setPaintProperty(LYR_ETAPPE, 'line-width', ['case', f, 3, 1.2]);
    map.setPaintProperty(LYR_ETAPPE, 'line-opacity', ['case', f, 0.9, 0.12]);
  }
  if (map.getLayer(LYR_ETAPPE_LABEL)) map.setFilter(LYR_ETAPPE_LABEL, f);
  if (map.getLayer(LYR_STOPP)) {
    map.setLayoutProperty(LYR_STOPP, 'icon-size', ['case', f, 0.48, 0.3]);
    map.setLayoutProperty(LYR_STOPP, 'symbol-sort-key', ['case', f, 0, 1]);
    map.setPaintProperty(LYR_STOPP, 'icon-opacity', ['case', f, 1, 0.22]);
  }
  if (map.getLayer(LYR_STOPP_GLOW)) map.setFilter(LYR_STOPP_GLOW, f);
  if (map.getLayer(LYR_STOPP_LABEL)) map.setFilter(LYR_STOPP_LABEL, f);
}
