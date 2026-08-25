import type { Map as MLMap } from 'maplibre-gl';

declare global {
  interface Window {
    /** Testgriff auf die Karte, gesetzt in MapCanvas. */
    __islandKarte?: MLMap;
  }
}

export {};
