import type { ExpressionSpecification, LayerSpecification, Map as MLMap } from 'maplibre-gl';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { alleStopps, TAG_FARBE, tage, unterkuenfte } from '@/lib/reise';
import { kategorieVon } from '@/lib/kategorie';
import { zuLngLat } from '@/lib/geo';
import { iconName } from './icons';

export const SRC_STOPPS = 'stopps';
export const SRC_ROUTE = 'route';
export const SRC_ORT = 'ort-marke';

export const LYR_ROUTE = 'route-linie';
export const LYR_STOPP = 'stopp-symbol';
export const LYR_STOPP_LABEL = 'stopp-label';
export const LYR_ORT = 'ort-symbol';

export function stoppFeatures(): FeatureCollection<Point> {
  const stopps = alleStopps
    .filter((s) => s.stopp.pos !== null)
    .map((s) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: zuLngLat(s.stopp.pos!) },
      properties: {
        id: s.id,
        name: s.stopp.name,
        datum: s.datum,
        farbe: TAG_FARBE[tage.find((t) => t.datum === s.datum)?.typ ?? 'etappe'],
        icon: iconName(kategorieVon(s.stopp)),
      },
    }));

  // Unterkünfte liegen in derselben Quelle: ein Klickziel, ein Layer.
  const haeuser = unterkuenfte
    .filter((u) => u.pos !== null)
    .map((u) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: zuLngLat(u.pos!) },
      properties: {
        id: `unterkunft:${u.id}`,
        name: u.name,
        datum: u.von,
        farbe: '#0f766e',
        icon: iconName('unterkunft'),
      },
    }));

  return { type: 'FeatureCollection', features: [...stopps, ...haeuser] };
}

/**
 * Die Route ist eine durchgehende Linie über die ganze Reise: jeder Tag beginnt
 * beim letzten Stopp des Vortags, damit keine Lücke entsteht. Die Segmente
 * tragen die Farbe ihres Tages — so ist die Reise als Ganzes sichtbar und die
 * Etappen bleiben trotzdem unterscheidbar.
 */
export function routeFeatures(): FeatureCollection<LineString> {
  const features: FeatureCollection<LineString>['features'] = [];
  let vorheriger: [number, number] | null = null;

  for (const tag of tage) {
    const punkte = tag.highlights.filter((h) => h.pos !== null).map((h) => zuLngLat(h.pos!));
    const kette = vorheriger ? [vorheriger, ...punkte] : punkte;
    if (kette.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: kette },
        properties: { datum: tag.datum, farbe: TAG_FARBE[tag.typ] },
      });
    }
    vorheriger = punkte[punkte.length - 1] ?? vorheriger;
  }
  return { type: 'FeatureCollection', features };
}

const aktiv = (datum: string): ExpressionSpecification => ['==', ['get', 'datum'], datum];

export function quellenSetzen(map: MLMap): void {
  if (!map.getSource(SRC_STOPPS)) {
    map.addSource(SRC_STOPPS, { type: 'geojson', data: stoppFeatures() });
  }
  if (!map.getSource(SRC_ROUTE)) {
    map.addSource(SRC_ROUTE, { type: 'geojson', data: routeFeatures() });
  }
  if (!map.getSource(SRC_ORT)) {
    map.addSource(SRC_ORT, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
}

export function layerSetzen(map: MLMap, aktivesDatum: string): void {
  const add = (spec: LayerSpecification) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  };

  add({
    id: LYR_ROUTE,
    type: 'line',
    source: SRC_ROUTE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'farbe'],
      // Alle Tage bleiben sichtbar; der gewählte tritt nur hervor.
      'line-width': ['case', aktiv(aktivesDatum), 5, 2.5],
      'line-opacity': ['case', aktiv(aktivesDatum), 1, 0.55],
    },
  });

  add({
    id: LYR_STOPP,
    type: 'symbol',
    source: SRC_STOPPS,
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': ['case', aktiv(aktivesDatum), 0.7, 0.44],
      'icon-allow-overlap': true,
      'symbol-sort-key': ['case', aktiv(aktivesDatum), 0, 1],
    },
    paint: { 'icon-opacity': ['case', aktiv(aktivesDatum), 1, 0.72] },
  });

  add({
    id: LYR_STOPP_LABEL,
    type: 'symbol',
    source: SRC_STOPPS,
    filter: aktiv(aktivesDatum),
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 12,
      'text-offset': [0, 1.4],
      'text-anchor': 'top',
      'text-max-width': 12,
      'text-optional': true,
    },
    paint: {
      'text-color': '#0f172a',
      'text-halo-color': 'rgba(255,255,255,0.9)',
      'text-halo-width': 1.8,
      'text-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0, 7.5, 1],
    },
  });

  add({
    id: LYR_ORT,
    type: 'circle',
    source: SRC_ORT,
    paint: {
      'circle-radius': 7,
      'circle-color': '#2563eb',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });
}

/** Tageswechsel: nur die datumsabhängigen Ausdrücke neu setzen, kein Reload. */
export function aktivenTagSetzen(map: MLMap, datum: string): void {
  const f = aktiv(datum);
  if (map.getLayer(LYR_ROUTE)) {
    map.setPaintProperty(LYR_ROUTE, 'line-width', ['case', f, 5, 2.5]);
    map.setPaintProperty(LYR_ROUTE, 'line-opacity', ['case', f, 1, 0.55]);
  }
  if (map.getLayer(LYR_STOPP)) {
    map.setLayoutProperty(LYR_STOPP, 'icon-size', ['case', f, 0.7, 0.44]);
    map.setLayoutProperty(LYR_STOPP, 'symbol-sort-key', ['case', f, 0, 1]);
    map.setPaintProperty(LYR_STOPP, 'icon-opacity', ['case', f, 1, 0.72]);
  }
  if (map.getLayer(LYR_STOPP_LABEL)) map.setFilter(LYR_STOPP_LABEL, f);
}
