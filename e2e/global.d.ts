import type { Map as MLMap } from 'maplibre-gl';

// Die App legt die Kartenreferenz für Tests und Konsole auf window.
declare global {
  interface Window {
    __islandKarte?: MLMap;
  }
}

export {};
