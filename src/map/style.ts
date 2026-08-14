import type { StyleSpecification } from 'maplibre-gl';
import type { Theme } from '@/store/mapStore';

/** Basiskarte: OpenFreeMap — kostenlos, kein Key, kein Load-Limit. Hell ist der Standard. */
export const STYLE_URL: Record<Theme, string> = {
  hell: 'https://tiles.openfreemap.org/styles/bright',
  dunkel: 'https://tiles.openfreemap.org/styles/dark',
};

/**
 * DEM: AWS Terrain Tiles (Terrarium-Kodierung), global und ohne Key.
 * Nicht demotiles.maplibre.org — dessen Terrain-Kachelsatz deckt nur einen
 * Ausschnitt der Alpen ab und liefert über Island gar nichts.
 */
export const DEM_SOURCE_ID = 'terrain-dem';
export const DEM_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'];
export const DEM_ATTRIBUTION =
  '<a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>';
export const TERRAIN_EXAGGERATION = 1.5;

export const SKY: Record<Theme, NonNullable<StyleSpecification['sky']>> = {
  hell: {
    'sky-color': '#9ec7e8',
    'sky-horizon-blend': 0.6,
    'horizon-color': '#e2eef7',
    'horizon-fog-blend': 0.6,
    'fog-color': '#eaf1f6',
    'fog-ground-blend': 0.1,
  },
  dunkel: {
    'sky-color': '#0b1626',
    'sky-horizon-blend': 0.6,
    'horizon-color': '#3f5d7a',
    'horizon-fog-blend': 0.6,
    'fog-color': '#0b1626',
    'fog-ground-blend': 0.15,
  },
};

export const ISLAND_BOUNDS: [number, number, number, number] = [-24.6, 63.2, -13.3, 66.6];

export const START_KAMERA = {
  center: [-18.9, 64.9] as [number, number],
  zoom: 5.4,
  pitch: 45,
};
