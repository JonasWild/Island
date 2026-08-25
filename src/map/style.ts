import type { Theme } from '@/store/mapStore';

/** Basiskarte: OpenFreeMap — kostenlos, kein Key, kein Load-Limit. Hell ist der Standard. */
export const STYLE_URL: Record<Theme, string> = {
  hell: 'https://tiles.openfreemap.org/styles/bright',
  dunkel: 'https://tiles.openfreemap.org/styles/dark',
};

/**
 * DEM: AWS Terrain Tiles (Terrarium-Kodierung), global und ohne Key.
 * Nicht demotiles.maplibre.org — dessen Kachelsatz deckt nur einen Ausschnitt
 * der Alpen ab und liefert über Island gar nichts.
 *
 * Die Quelle trägt **nur noch die Schummerung**. `setTerrain` ist raus: das
 * 3D-Mesh war der teure Teil (Mesh-Aufbau, Depth-Buffer, je Bild eine
 * Höhenabfrage pro Marker) und sah dabei nicht gut aus. Ein Hillshade-Layer
 * liest dieselben Kacheln, ohne Geometrie daraus zu bauen.
 *
 * Die Quelle wird erst angelegt, wenn der Nutzer auf Relief umschaltet — im
 * Normalmodus geht keine einzige Anfrage an s3.amazonaws.com.
 */
export const DEM_SOURCE_ID = 'terrain-dem';
export const DEM_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'];
export const DEM_ATTRIBUTION =
  '<a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>';

export const ISLAND_BOUNDS: [number, number, number, number] = [-24.6, 63.2, -13.3, 66.6];

export const START_KAMERA = {
  center: [-18.9, 64.9] as [number, number],
  zoom: 5.4,
};
