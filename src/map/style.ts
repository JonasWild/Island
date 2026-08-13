import type { StyleSpecification } from 'maplibre-gl';
import type { Theme } from '@/store/mapStore';

/**
 * Basiskarte: OpenFreeMap (kostenlos, kein Key, kein Load-Limit).
 * Hell/dunkel wird über einen echten Style-Wechsel gelöst, nicht über einen
 * CSS-Filter — sonst kippen auch die Labels und die eigenen Layer mit.
 */
export const STYLE_URL: Record<Theme, string> = {
  hell: 'https://tiles.openfreemap.org/styles/positron',
  dunkel: 'https://tiles.openfreemap.org/styles/dark',
};

/** DEM für setTerrain. Start: MapLibre-Demotiles (frei, weltweit, grob). */
export const DEM_SOURCE_ID = 'terrain-dem';
export const DEM_URL = 'https://demotiles.maplibre.org/terrain-tiles/tiles.json';
export const TERRAIN_EXAGGERATION = 1.4;

export const SKY: NonNullable<StyleSpecification['sky']> = {
  'sky-color': '#0b1626',
  'sky-horizon-blend': 0.6,
  'horizon-color': '#4a6b8a',
  'horizon-fog-blend': 0.6,
  'fog-color': '#0b1626',
  'fog-ground-blend': 0.15,
};

export const SKY_HELL: NonNullable<StyleSpecification['sky']> = {
  'sky-color': '#9ec7e8',
  'sky-horizon-blend': 0.6,
  'horizon-color': '#dbe9f4',
  'horizon-fog-blend': 0.6,
  'fog-color': '#e8eef3',
  'fog-ground-blend': 0.1,
};

/** Island komplett im Bild. */
export const ISLAND_BOUNDS: [number, number, number, number] = [-24.6, 63.2, -13.3, 66.6];

export const START_KAMERA = {
  center: [-18.9, 64.9] as [number, number],
  zoom: 5.4,
  pitch: 45,
  bearing: 0,
};
