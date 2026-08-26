import type { Theme } from '@/store/mapStore';

/**
 * Basiskarte: OpenFreeMap — kostenlos, kein Key, kein Load-Limit. Hell ist der
 * Standard.
 *
 * Mehr lädt die Karte nicht. Es gab einmal eine DEM-Quelle für eine
 * zuschaltbare Schummerung; sie ist wieder raus, weil sie niemand gebraucht
 * hat. Damit ist `tiles.openfreemap.org` der einzige Kartenhost, den die CSP
 * öffnen muss.
 */
export const STYLE_URL: Record<Theme, string> = {
  hell: 'https://tiles.openfreemap.org/styles/bright',
  dunkel: 'https://tiles.openfreemap.org/styles/dark',
};

export const ISLAND_BOUNDS: [number, number, number, number] = [-24.6, 63.2, -13.3, 66.6];

export const START_KAMERA = {
  center: [-18.9, 64.9] as [number, number],
  zoom: 5.4,
};
