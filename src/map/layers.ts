import type {
  ExpressionSpecification,
  HillshadeLayerSpecification,
  LayerSpecification,
  Map as MLMap,
} from 'maplibre-gl';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { alleStopps, TAG_FARBE, tage, unterkuenfte } from '@/lib/reise';
import { routeNach } from '@/lib/route';
import { DEM_ATTRIBUTION, DEM_SOURCE_ID, DEM_TILES } from './style';
import { kategorieVon } from '@/lib/kategorie';
import { gruppeVon, type Gruppe } from '@/lib/gruppe';
import { zuLngLat } from '@/lib/geo';
import { ICON_FUSSWEG, ICON_PFEIL, iconName, unterkunftIconName } from './icons';

export const SRC_STOPPS = 'stopps';
export const SRC_ROUTE = 'route';
export const SRC_ORT = 'ort-marke';

export const LYR_ROUTE = 'route-linie';
export const LYR_ROUTE_WAHL = 'route-wahlweise';
export const LYR_ROUTE_PFEIL = 'route-pfeil';
export const LYR_ROUTE_LUFT = 'route-luftlinie';
export const LYR_STOPP = 'stopp-symbol';
export const LYR_WANDERUNG = 'stopp-wanderung';
export const LYR_STOPP_LABEL = 'stopp-label';
export const LYR_ORT = 'ort-symbol';
export const LYR_RELIEF = 'relief';

/**
 * Alle Tage ausser dem gewählten. Die Tagesfarbe bedeutet etwas — Anreise,
 * Standtag, Tagesausflug, Etappe, Abreise —, aber fünfzehn bunte Linien
 * gleichzeitig bedeuten nichts mehr. Deshalb trägt die Farbe nur der gewählte
 * Tag; der Rest bleibt neutral als Zusammenhang stehen.
 */
const NEUTRAL = '#94a3b8';

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
        // Ein Stopp gilt genau an seinem Tag. `datumBis` gleich `datum` macht
        // die Regel für Stopps und Unterkünfte identisch — siehe stoppFilter.
        datumBis: s.datum,
        farbe: TAG_FARBE[tage.find((t) => t.datum === s.datum)?.typ ?? 'etappe'],
        icon: iconName(kategorieVon(s.stopp)),
        gruppe: gruppeVon(kategorieVon(s.stopp)) ?? '',
        // Wandern ist keine Zielart, sondern eine Eigenschaft: Dettifoss
        // bleibt ein Wasserfall, auch wenn man 2,8 km hinläuft. Deshalb ein
        // eigenes Abzeichen statt einer eigenen Kategorie.
        wanderung: s.stopp.wanderung !== undefined,
      },
    }));

  /*
    Unterkünfte liegen in derselben Quelle: ein Klickziel, ein Layer. Sie
    tragen aber ein eigenes Bild mit der Anzahl Nächte — wo man schläft und wie
    lange ist die wichtigste Angabe des Tages und gehört auf den Marker, nicht
    erst ins Kontextblatt.

    `datum` ist der Anreisetag, `datumBis` der Abreisetag. Über diese Spanne
    bleibt die Unterkunft sichtbar, auch wenn nur ein Tag gezeigt wird: man
    schläft am 28.08. in dem Haus, das man am 27.08. bezogen hat. Ohne das
    verschwände der Anker des Tages genau dann, wenn man aufräumt.
  */
  const haeuser = unterkuenfte
    .filter((u) => u.pos !== null)
    .map((u) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: zuLngLat(u.pos!) },
      properties: {
        id: `unterkunft:${u.id}`,
        name: u.name,
        datum: u.von,
        datumBis: u.bis,
        naechte: u.naechte,
        farbe: '#be123c',
        icon: unterkunftIconName(u.naechte),
        // Kein Gruppenschlüssel: Unterkünfte lassen sich nicht wegfiltern.
        gruppe: '',
        wanderung: false,
      },
    }));

  return { type: 'FeatureCollection', features: [...stopps, ...haeuser] };
}


/**
 * Die Route je Tag, gefahren über echte Straßen. Die Geometrie kommt aus
 * `data/route.json` und damit von `pnpm route` zur Build-Zeit — zur Laufzeit
 * geht keine Anfrage an einen Routing-Dienst.
 *
 * Ein Feature je **Abschnitt**, nicht je Tag: die Pipeline trennt, was auf der
 * direkten Etappe liegt (`pflicht`) von den Abstechern zu den vorgeschlagenen
 * Zielen (`optional`). Die Reihenfolge der Koordinaten ist die Fahrtrichtung —
 * darauf setzen die Richtungspfeile auf.
 *
 * Die Kette über alle Tage bleibt durchgehend: jeder Tag beginnt dort, wo der
 * Vortag geendet hat; die Pipeline routet genau so.
 */
export function routeFeatures(): FeatureCollection<LineString> {
  const features: FeatureCollection<LineString>['features'] = [];
  let vorheriger: [number, number] | null = null;

  for (const tag of tage) {
    const gefahren = routeNach(tag.datum);
    const farbe = TAG_FARBE[tag.typ];

    const abschnitte: Array<{ art: string; punkte: [number, number][] }> = gefahren
      ? gefahren.abschnitte.map((a) => ({
          art: gefahren.art === 'luftlinie' ? 'luftlinie' : a.art,
          punkte: a.punkte.map(([lon, lat]): [number, number] => [lon, lat]),
        }))
      : // Ohne Eintrag in route.json bleibt die Schematik über die Stopps —
        // dann aber ebenfalls als Luftlinie gekennzeichnet.
        [
          {
            art: 'luftlinie',
            punkte: tag.highlights.filter((h) => h.pos !== null).map((h) => zuLngLat(h.pos!)),
          },
        ];

    abschnitte.forEach((abschnitt, index) => {
      // Der erste Punkt eines Tages ist normalerweise schon der letzte des
      // Vortags — die Pipeline routet so. Weicht er ab (Rückfall auf die
      // Schematik), wird der Übergang ergänzt, damit keine Lücke entsteht.
      const anfang = abschnitt.punkte[0];
      const punkte: [number, number][] =
        index === 0 &&
        vorheriger &&
        anfang &&
        (vorheriger[0] !== anfang[0] || vorheriger[1] !== anfang[1])
          ? [vorheriger, ...abschnitt.punkte]
          : abschnitt.punkte;
      if (punkte.length < 2) return;

      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: punkte },
        properties: {
          datum: tag.datum,
          farbe,
          art: abschnitt.art,
          km: gefahren?.km ?? null,
          fahrzeitMin: gefahren?.fahrzeitMin ?? null,
        },
      });
      vorheriger = punkte[punkte.length - 1] ?? vorheriger;
    });
  }
  return { type: 'FeatureCollection', features };
}

const aktiv = (datum: string): ExpressionSpecification => ['==', ['get', 'datum'], datum];

/**
 * Was auf der Karte sichtbar bleibt. 128 Symbole gleichzeitig sind auf einem
 * Handy keine Karte mehr, sondern ein Teppich.
 *
 * Zwei Achsen, beide optional:
 * - **Gruppen**: eine leere Liste heißt *alle* — der Normalfall braucht keinen
 *   Zustand. Unterkünfte tragen keinen Gruppenschlüssel und bleiben deshalb
 *   immer stehen: wo man schläft, ist der Anker des Tages.
 * - **Nur dieser Tag**: blendet die Ziele der anderen vierzehn Tage aus.
 */
export function stoppFilter(
  gruppen: readonly Gruppe[],
  nurTag: boolean,
  datum: string,
): ExpressionSpecification {
  const bedingungen: ExpressionSpecification[] = [];
  if (gruppen.length > 0) {
    bedingungen.push([
      'any',
      ['==', ['get', 'gruppe'], ''],
      ['in', ['get', 'gruppe'], ['literal', [...gruppen]]],
    ]);
  }
  if (nurTag) {
    // Gilt der Eintrag an diesem Tag? Für Stopps ist die Spanne ein Tag lang,
    // für Unterkünfte die ganze Standzeit.
    bedingungen.push([
      'all',
      ['<=', ['get', 'datum'], datum],
      ['>=', ['get', 'datumBis'], datum],
    ]);
  }
  if (bedingungen.length === 0) return ['literal', true];
  return bedingungen.length === 1 ? bedingungen[0]! : ['all', ...bedingungen];
}

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

export function layerSetzen(
  map: MLMap,
  aktivesDatum: string,
  gruppen: readonly Gruppe[],
  nurTag: boolean,
): void {
  const add = (spec: LayerSpecification) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  };

  /*
    Drei Routen-Layer mit drei Aussagen, dazu die Richtungspfeile. Die
    Reihenfolge im Style ist die Zeichenreihenfolge: Luftlinie unten, Kür
    darüber, Pflicht darüber, Pfeile zuletzt.

    Farbe trägt nur der gewählte Tag. Fünfzehn bunte Linien gleichzeitig sind
    Konfetti, in dem die Farbe nichts mehr bedeutet; die anderen Tage bleiben
    neutral als Zusammenhang stehen. Was die Farbe des gewählten Tages
    aussagt, benennt der Tagesstreifen daneben.

    `line-sort-key` hebt den gewählten Tag innerhalb des Layers nach oben.
    Keine Zoom-Ausdrücke darin — die wären an dieser Stelle ungültig und der
    Layer würde still verschwinden.
  */
  const obenAuf = (datum: string): ExpressionSpecification => ['case', aktiv(datum), 1, 0];
  const tagesFarbe = (datum: string): ExpressionSpecification => [
    'case',
    aktiv(datum),
    ['get', 'farbe'],
    NEUTRAL,
  ];

  /*
    Nicht sauber routbar: Schematik, keine Fahrempfehlung. Immer neutral —
    eine Luftlinie ist keine Eigenschaft des Tages, sondern eine der Daten.
  */
  add({
    id: LYR_ROUTE_LUFT,
    type: 'line',
    source: SRC_ROUTE,
    filter: ['==', ['get', 'art'], 'luftlinie'],
    layout: { 'line-cap': 'butt', 'line-join': 'round', 'line-sort-key': obenAuf(aktivesDatum) },
    paint: {
      'line-color': '#64748b',
      'line-width': ['case', aktiv(aktivesDatum), 3, 2],
      'line-opacity': ['case', aktiv(aktivesDatum), 0.9, 0.35],
      'line-dasharray': [1, 2],
    },
  });

  /*
    Abstecher: gepunktet. Dieselbe Farbe wie die Pflichtstrecke, aber sichtbar
    unterbrochen — man kann sie weglassen und kommt trotzdem ins Bett. Runde
    Enden mit sehr kurzem Strich ergeben Punkte statt Striche und halten den
    Abstecher von der gestrichelten Luftlinie auseinander.
  */
  add({
    id: LYR_ROUTE_WAHL,
    type: 'line',
    source: SRC_ROUTE,
    filter: ['==', ['get', 'art'], 'optional'],
    layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': obenAuf(aktivesDatum) },
    paint: {
      'line-color': tagesFarbe(aktivesDatum),
      'line-width': ['case', aktiv(aktivesDatum), 3.5, 1.8],
      'line-opacity': ['case', aktiv(aktivesDatum), 0.95, 0.4],
      'line-dasharray': [0.1, 1.8],
    },
  });

  // Pflichtstrecke: durchgezogen und kräftig. Das ist der Weg zum Bett.
  add({
    id: LYR_ROUTE,
    type: 'line',
    source: SRC_ROUTE,
    filter: ['==', ['get', 'art'], 'pflicht'],
    layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': obenAuf(aktivesDatum) },
    paint: {
      'line-color': tagesFarbe(aktivesDatum),
      'line-width': ['case', aktiv(aktivesDatum), 5, 2.5],
      'line-opacity': ['case', aktiv(aktivesDatum), 1, 0.45],
    },
  });

  /*
    Fahrtrichtung. Ohne sie ist eine Rundstrecke nicht von einer Hin- und
    Rückfahrt zu unterscheiden, und an einem Standtag sieht man nicht, wo der
    Tag anfängt. Die Pfeile folgen der Koordinatenreihenfolge, und die ist in
    route.json die Fahrtrichtung.

    Nur für den gewählten Tag — auf allen fünfzehn wären es hunderte Pfeile.

    `icon-allow-overlap` muss an sein: die 128 Stopp-Symbole werden mit
    `icon-allow-overlap: true` gesetzt und beanspruchen ihren Platz zuerst.
    Ein Pfeil, der ausweichen muss, weicht bis zur Unsichtbarkeit aus — ohne
    diese Zeile wird **kein einziger** gezeichnet. `icon-ignore-placement`
    sorgt umgekehrt dafür, dass die Pfeile keine Ortsnamen verdrängen.
  */
  add({
    id: LYR_ROUTE_PFEIL,
    type: 'symbol',
    source: SRC_ROUTE,
    filter: ['all', aktiv(aktivesDatum), ['!=', ['get', 'art'], 'luftlinie']],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 110,
      'icon-image': ICON_PFEIL,
      'icon-size': 0.5,
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': 0.95 },
  });

  add({
    id: LYR_STOPP,
    type: 'symbol',
    source: SRC_STOPPS,
    filter: stoppFilter(gruppen, nurTag, aktivesDatum),
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': ['case', aktiv(aktivesDatum), 0.7, 0.44],
      'icon-allow-overlap': true,
      'symbol-sort-key': ['case', aktiv(aktivesDatum), 0, 1],
    },
    paint: { 'icon-opacity': ['case', aktiv(aktivesDatum), 1, 0.72] },
  });

  /*
    Abzeichen für Stopps, an denen gewandert wird — 16 der 128. Es sitzt
    versetzt am Zielsymbol, überdeckt es also nicht. `icon-offset` wird mit
    `icon-size` multipliziert, deshalb wandert das Abzeichen beim
    Tageswechsel automatisch mit.

    Was die Karte **nicht** zeigt, ist der Verlauf des Wanderwegs: der steht
    in keiner Quelle dieses Projekts. Gehzeit, Distanz und Höhenmeter stehen
    im Kontextblatt, der Weg selbst wird nicht erfunden.
  */
  add({
    id: LYR_WANDERUNG,
    type: 'symbol',
    source: SRC_STOPPS,
    filter: ['all', ['==', ['get', 'wanderung'], true], stoppFilter(gruppen, nurTag, aktivesDatum)],
    layout: {
      'icon-image': ICON_FUSSWEG,
      'icon-size': ['case', aktiv(aktivesDatum), 0.4, 0.26],
      'icon-offset': [40, -40],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': ['case', aktiv(aktivesDatum), 1, 0.72] },
  });

  add({
    id: LYR_STOPP_LABEL,
    type: 'symbol',
    source: SRC_STOPPS,
    // Beschriftet wird nur der gewählte Tag, und auch dort nur, was der
    // Filter stehen lässt.
    filter: ['all', aktiv(aktivesDatum), stoppFilter(gruppen, nurTag, aktivesDatum)],
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
export function aktivenTagSetzen(
  map: MLMap,
  datum: string,
  gruppen: readonly Gruppe[],
  nurTag: boolean,
): void {
  const f = aktiv(datum);
  const tagesFarbe: ExpressionSpecification = ['case', f, ['get', 'farbe'], NEUTRAL];
  const obenAuf: ExpressionSpecification = ['case', f, 1, 0];

  if (map.getLayer(LYR_ROUTE)) {
    map.setPaintProperty(LYR_ROUTE, 'line-color', tagesFarbe);
    map.setPaintProperty(LYR_ROUTE, 'line-width', ['case', f, 5, 2.5]);
    map.setPaintProperty(LYR_ROUTE, 'line-opacity', ['case', f, 1, 0.45]);
    map.setLayoutProperty(LYR_ROUTE, 'line-sort-key', obenAuf);
  }
  if (map.getLayer(LYR_ROUTE_WAHL)) {
    map.setPaintProperty(LYR_ROUTE_WAHL, 'line-color', tagesFarbe);
    map.setPaintProperty(LYR_ROUTE_WAHL, 'line-width', ['case', f, 3.5, 1.8]);
    map.setPaintProperty(LYR_ROUTE_WAHL, 'line-opacity', ['case', f, 0.95, 0.4]);
    map.setLayoutProperty(LYR_ROUTE_WAHL, 'line-sort-key', obenAuf);
  }
  if (map.getLayer(LYR_ROUTE_LUFT)) {
    map.setPaintProperty(LYR_ROUTE_LUFT, 'line-width', ['case', f, 3, 2]);
    map.setPaintProperty(LYR_ROUTE_LUFT, 'line-opacity', ['case', f, 0.9, 0.35]);
    map.setLayoutProperty(LYR_ROUTE_LUFT, 'line-sort-key', obenAuf);
  }
  if (map.getLayer(LYR_ROUTE_PFEIL)) {
    map.setFilter(LYR_ROUTE_PFEIL, ['all', f, ['!=', ['get', 'art'], 'luftlinie']]);
  }
  if (map.getLayer(LYR_STOPP)) {
    map.setLayoutProperty(LYR_STOPP, 'icon-size', ['case', f, 0.7, 0.44]);
    map.setLayoutProperty(LYR_STOPP, 'symbol-sort-key', ['case', f, 0, 1]);
    map.setPaintProperty(LYR_STOPP, 'icon-opacity', ['case', f, 1, 0.72]);
  }
  if (map.getLayer(LYR_WANDERUNG)) {
    map.setLayoutProperty(LYR_WANDERUNG, 'icon-size', ['case', f, 0.4, 0.26]);
    map.setPaintProperty(LYR_WANDERUNG, 'icon-opacity', ['case', f, 1, 0.72]);
  }
  sichtbarkeitSetzen(map, gruppen, nurTag, datum);
}

/**
 * Filterwechsel. Bewusst getrennt vom Tageswechsel: ein Filter darf die Kamera
 * nicht bewegen. Wer nach Wasserfällen filtert, will nicht, dass die Karte
 * dabei wegspringt.
 */
export function sichtbarkeitSetzen(
  map: MLMap,
  gruppen: readonly Gruppe[],
  nurTag: boolean,
  datum: string,
): void {
  const sichtbar = stoppFilter(gruppen, nurTag, datum);
  if (map.getLayer(LYR_STOPP)) map.setFilter(LYR_STOPP, sichtbar);
  if (map.getLayer(LYR_WANDERUNG)) {
    map.setFilter(LYR_WANDERUNG, ['all', ['==', ['get', 'wanderung'], true], sichtbar]);
  }
  if (map.getLayer(LYR_STOPP_LABEL)) {
    map.setFilter(LYR_STOPP_LABEL, ['all', aktiv(datum), sichtbar]);
  }
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
