import type { ExpressionSpecification, LayerSpecification, Map as MLMap } from 'maplibre-gl';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { alleStopps, TAG_FARBE, tage, unterkuenfte } from '@/lib/reise';
import { kategorieVon } from '@/lib/kategorie';
import { zuLngLat } from '@/lib/geo';
import { DEM_SOURCE_ID } from './style';
import type { Modellpunkt } from './modelle';

export const SRC_STOPPS = 'stopps';
export const SRC_ROUTE = 'route';
export const SRC_ORT = 'ort-marke';

export const LYR_HILLSHADE = 'relief';
export const LYR_ROUTE = 'route-linie';
export const LYR_STOPP = 'stopp-treffer';
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
        kategorie: kategorieVon(s.stopp),
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
        kategorie: 'unterkunft' as const,
      },
    }));

  return { type: 'FeatureCollection', features: [...stopps, ...haeuser] };
}

/** Dieselben Punkte als Eingabe für den 3D-Layer. */
export function modellPunkte(aktivesDatum: string): Modellpunkt[] {
  return stoppFeatures().features.map((f) => ({
    id: f.properties!.id as string,
    lngLat: f.geometry.coordinates as [number, number],
    kategorie: f.properties!.kategorie as Modellpunkt['kategorie'],
    aktiv: f.properties!.datum === aktivesDatum,
  }));
}

/**
 * Die Route ist eine durchgehende Linie über die ganze Reise: jeder Tag beginnt
 * beim letzten Stopp des Vortags, damit keine Lücke entsteht. Die Farbe eines
 * Segments steht für die Art des Tages, nicht für den Tag selbst.
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

/** Erste Beschriftungsebene des Basisstils — darunter kommt das Relief. */
function ersteLabelEbene(map: MLMap): string | undefined {
  return map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
}

export function layerSetzen(map: MLMap, aktivesDatum: string): void {
  const add = (spec: LayerSpecification, vor?: string) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec, vor);
  };

  // Ohne Schummerung ist das Terrain praktisch unsichtbar: die Geländeverformung
  // fällt bei Landesmaßstab nicht auf, die Schattierung dagegen schon.
  add(
    {
      id: LYR_HILLSHADE,
      type: 'hillshade',
      source: DEM_SOURCE_ID,
      paint: {
        'hillshade-exaggeration': 0.55,
        'hillshade-shadow-color': '#3f4a5a',
        'hillshade-highlight-color': '#ffffff',
        'hillshade-accent-color': '#5b6472',
      },
    },
    ersteLabelEbene(map),
  );

  add({
    id: LYR_ROUTE,
    type: 'line',
    source: SRC_ROUTE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'farbe'],
      // Alle Tage bleiben sichtbar; der gewählte tritt nur hervor.
      'line-width': ['case', aktiv(aktivesDatum), 5, 2.5],
      'line-opacity': ['case', aktiv(aktivesDatum), 1, 0.5],
    },
  });

  // Unsichtbarer Trefferbereich: die sichtbaren Marker sind 3D-Modelle in einem
  // Custom-Layer, den queryRenderedFeatures nicht kennt. Dieser Kreis ist das
  // Klick- und Hover-Ziel dazu.
  add({
    id: LYR_STOPP,
    type: 'circle',
    source: SRC_STOPPS,
    paint: {
      'circle-radius': ['case', aktiv(aktivesDatum), 18, 12],
      'circle-opacity': 0,
      'circle-stroke-opacity': 0,
    },
  });

  add({
    id: LYR_STOPP_LABEL,
    type: 'symbol',
    source: SRC_STOPPS,
    filter: aktiv(aktivesDatum),
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 12,
      'text-offset': [0, 1.9],
      'text-anchor': 'top',
      'text-max-width': 12,
      'text-optional': true,
    },
    paint: {
      'text-color': '#0f172a',
      'text-halo-color': 'rgba(255,255,255,0.92)',
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
    map.setPaintProperty(LYR_ROUTE, 'line-opacity', ['case', f, 1, 0.5]);
  }
  if (map.getLayer(LYR_STOPP)) {
    map.setPaintProperty(LYR_STOPP, 'circle-radius', ['case', f, 18, 12]);
  }
  if (map.getLayer(LYR_STOPP_LABEL)) map.setFilter(LYR_STOPP_LABEL, f);
}
