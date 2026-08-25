import type {
  ExpressionSpecification,
  HillshadeLayerSpecification,
  LayerSpecification,
  Map as MLMap,
} from 'maplibre-gl';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { alleStopps, TAG_FARBE, tage, unterkuenfte } from '@/lib/reise';
import { DEM_ATTRIBUTION, DEM_SOURCE_ID, DEM_TILES } from './style';
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
export const LYR_RELIEF = 'relief';

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

/**
 * Schummerung ohne 3D. Liest dieselben DEM-Kacheln wie früher `setTerrain`,
 * baut daraus aber kein Mesh: kein Depth-Buffer, keine Höhenabfrage je Bild
 * und Marker. Quelle und Layer entstehen erst beim Einschalten und
 * verschwinden beim Ausschalten wieder — im Normalmodus stellt die App keine
 * einzige Anfrage an den DEM-Host.
 *
 * Die Farben sind bewusst weich: eine Schummerung soll das Gelände andeuten,
 * nicht die Basiskarte überschreiben. Harte Schatten machen Islands Hochland
 * zu einer schwarzen Fläche, in der die Route verschwindet.
 */
type ReliefPaint = NonNullable<HillshadeLayerSpecification['paint']>;

const RELIEF_FARBE: Record<'hell' | 'dunkel', ReliefPaint> = {
  hell: {
    'hillshade-shadow-color': '#8a93a3',
    'hillshade-highlight-color': '#ffffff',
    'hillshade-accent-color': '#aab3c0',
    'hillshade-exaggeration': 0.3,
  },
  dunkel: {
    'hillshade-shadow-color': '#050a12',
    'hillshade-highlight-color': '#6d7f94',
    'hillshade-accent-color': '#16202f',
    'hillshade-exaggeration': 0.36,
  },
};

/**
 * Unter die Beschriftungen der Basiskarte: der erste Symbol-Layer des Styles
 * ist die Grenze zwischen Flächen und Schrift. Ohne das läge die Schummerung
 * über den Ortsnamen.
 */
function unterDenBeschriftungen(map: MLMap): string | undefined {
  return map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
}

export function reliefSetzen(map: MLMap, an: boolean, thema: 'hell' | 'dunkel'): void {
  if (!an) {
    if (map.getLayer(LYR_RELIEF)) map.removeLayer(LYR_RELIEF);
    if (map.getSource(DEM_SOURCE_ID)) map.removeSource(DEM_SOURCE_ID);
    return;
  }
  if (!map.getSource(DEM_SOURCE_ID)) {
    map.addSource(DEM_SOURCE_ID, {
      type: 'raster-dem',
      tiles: DEM_TILES,
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 13,
      attribution: DEM_ATTRIBUTION,
    });
  }
  if (!map.getLayer(LYR_RELIEF)) {
    map.addLayer(
      {
        id: LYR_RELIEF,
        type: 'hillshade',
        source: DEM_SOURCE_ID,
        paint: RELIEF_FARBE[thema],
      },
      unterDenBeschriftungen(map),
    );
  } else {
    for (const [k, v] of Object.entries(RELIEF_FARBE[thema])) {
      map.setPaintProperty(LYR_RELIEF, k, v);
    }
  }
}
