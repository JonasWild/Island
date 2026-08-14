'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl, { type MapGeoJSONFeature, type MapMouseEvent, type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/store/mapStore';
import { tagNach } from '@/lib/reise';
import { zielPos } from '@/lib/ziel';
import type { Pos } from '@/lib/schema';
import {
  aktivenTagSetzen,
  layerSetzen,
  LYR_STOPP,
  modellPunkte,
  quellenSetzen,
  SRC_ORT,
} from '@/map/layers';
import { LYR_MODELLE, modellLayer } from '@/map/modelle';
import { fliegeZuPunkt, fliegeZuTag } from '@/map/camera';
import {
  DEM_ATTRIBUTION,
  DEM_SOURCE_ID,
  DEM_TILES,
  SKY,
  START_KAMERA,
  STYLE_URL,
  TERRAIN_EXAGGERATION,
} from '@/map/style';
import { MiniInfo } from './MiniInfo';

type Modelle = ReturnType<typeof modellLayer>;

export function MapCanvas() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const modelle = useRef<Modelle | null>(null);
  const [karte, setKarte] = useState<MLMap | null>(null);

  const tagDatum = useMapStore((s) => s.tagDatum);
  const theme = useMapStore((s) => s.theme);
  const auswahl = useMapStore((s) => s.auswahl);
  const setFokus = useMapStore((s) => s.setFokus);

  /** Terrain, Himmel, Layer und 3D-Modelle — nach jedem Style-Wechsel erneut. */
  const styleAufbauen = useCallback((map: MLMap, datum: string, thema: 'hell' | 'dunkel') => {
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
    map.setTerrain({ source: DEM_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION });
    map.setSky(SKY[thema]);
    quellenSetzen(map);
    layerSetzen(map, datum);

    const schicht = modellLayer(
      () => modellPunkte(useMapStore.getState().tagDatum),
      // Die Modelle sollen auf dem Gelände stehen, nicht auf Meereshöhe.
      ([lng, lat]) => map.queryTerrainElevation({ lng, lat }) ?? 0,
    );
    modelle.current = schicht;
    map.addLayer(schicht);
  }, []);

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL[useMapStore.getState().theme],
      center: START_KAMERA.center,
      zoom: START_KAMERA.zoom,
      pitch: START_KAMERA.pitch,
      maxPitch: 80,
      attributionControl: { compact: true },
      // Mercator, nicht Globus: Custom-Layer rechnen in Mercator-Weltkoordinaten.
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    // Griff für E2E-Tests und die Konsole; die App selbst nutzt den Ref.
    (window as unknown as { __islandKarte?: MLMap }).__islandKarte = map;

    map.on('style.load', () => {
      const s = useMapStore.getState();
      styleAufbauen(map, s.tagDatum, s.theme);
      setKarte(map);
    });
    map.once('load', () => {
      const tag = tagNach(useMapStore.getState().tagDatum);
      if (tag) fliegeZuTag(map, tag);
    });

    return () => {
      delete (window as unknown as { __islandKarte?: MLMap }).__islandKarte;
      map.remove();
      mapRef.current = null;
      modelle.current = null;
      setKarte(null);
    };
  }, [styleAufbauen]);

  /** Klick auf einen Marker öffnet die Infobox, Klick ins Leere die Ortsfrage. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const zeiger = (an: boolean) => {
      map.getCanvas().style.cursor = an ? 'pointer' : '';
    };
    const drauf = () => zeiger(true);
    const weg = () => zeiger(false);

    const klickMarker = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
      const id = (e.features?.[0]?.properties as { id?: string } | undefined)?.id;
      if (!id) return;
      setFokus(
        id.startsWith('unterkunft:')
          ? { art: 'unterkunft', id: id.slice('unterkunft:'.length) }
          : { art: 'stopp', id },
      );
    };

    const klickKarte = (e: MapMouseEvent) => {
      if (map.queryRenderedFeatures(e.point, { layers: [LYR_STOPP] }).length > 0) return;
      const pos: Pos = [Number(e.lngLat.lat.toFixed(5)), Number(e.lngLat.lng.toFixed(5))];
      const src = map.getSource(SRC_ORT) as maplibregl.GeoJSONSource | undefined;
      src?.setData({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [pos[1], pos[0]] }, properties: {} },
        ],
      });
      setFokus({ art: 'ort', pos });
    };

    map.on('mouseenter', LYR_STOPP, drauf);
    map.on('mouseleave', LYR_STOPP, weg);
    map.on('click', LYR_STOPP, klickMarker);
    map.on('click', klickKarte);
    return () => {
      map.off('mouseenter', LYR_STOPP, drauf);
      map.off('mouseleave', LYR_STOPP, weg);
      map.off('click', LYR_STOPP, klickMarker);
      map.off('click', klickKarte);
    };
  }, [karte, setFokus]);

  /** Tageswechsel: Layer umschalten, Modelle neu einfärben, hinfliegen. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    aktivenTagSetzen(map, tagDatum);
    modelle.current?.aktualisieren();
    const tag = tagNach(tagDatum);
    if (tag) fliegeZuTag(map, tag);
  }, [tagDatum, karte]);

  /** Theme = echter Style-Wechsel, kein CSS-Filter. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer(LYR_MODELLE)) map.removeLayer(LYR_MODELLE);
    map.setStyle(STYLE_URL[theme], { diff: false });
  }, [theme]);

  /** Detailleiste offen → auf das Ziel zufliegen. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !auswahl) return;
    const pos = zielPos(auswahl);
    if (pos) fliegeZuPunkt(map, pos);
  }, [auswahl]);

  return (
    <div className="absolute inset-0">
      {/*
        Nicht `absolute inset-0`: maplibre-gl.css setzt auf .maplibregl-map ein
        `position: relative` und gewinnt, wodurch inset-0 wirkungslos wird und
        der Container auf Höhe 0 zusammenfällt.
      */}
      <div ref={container} className="h-full w-full" data-testid="map" />
      {karte && <MiniInfo map={karte} />}
    </div>
  );
}
