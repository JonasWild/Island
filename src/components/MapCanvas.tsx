'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl, { type MapGeoJSONFeature, type MapMouseEvent, type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/store/mapStore';
import { alleStopps, tagNach } from '@/lib/reise';
import type { Pos } from '@/lib/schema';
import { iconsRegistrieren } from '@/map/icons';
import {
  aktivenTagSetzen,
  layerSetzen,
  LYR_STOPP,
  quellenSetzen,
  SRC_ORT,
} from '@/map/layers';
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

export function MapCanvas() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [karte, setKarte] = useState<MLMap | null>(null);

  const tagDatum = useMapStore((s) => s.tagDatum);
  const theme = useMapStore((s) => s.theme);
  const auswahl = useMapStore((s) => s.auswahl);
  const waehle = useMapStore((s) => s.waehle);

  /** Terrain, Himmel und eigene Layer — nach jedem Style-Wechsel erneut. */
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
    iconsRegistrieren(map);
    quellenSetzen(map);
    layerSetzen(map, datum);
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
      ...({ projection: { type: 'globe' } } as Record<string, unknown>),
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
      setKarte(null);
    };
  }, [styleAufbauen]);

  /** Klick auf einen Stopp, Klick auf leere Karte. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const zeiger = (an: boolean) => {
      map.getCanvas().style.cursor = an ? 'pointer' : '';
    };
    const drauf = () => zeiger(true);
    const weg = () => zeiger(false);

    const klickStopp = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
      const id = (e.features?.[0]?.properties as { id?: string } | undefined)?.id;
      if (!id) return;
      waehle(
        id.startsWith('unterkunft:')
          ? { art: 'unterkunft', id: id.slice('unterkunft:'.length) }
          : { art: 'stopp', id },
      );
    };

    /** Leere Karte → „Was ist hier?" mit Koordinate, Reisetag und nächstem Stopp. */
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
      waehle({ art: 'ort', pos });
    };

    map.on('mouseenter', LYR_STOPP, drauf);
    map.on('mouseleave', LYR_STOPP, weg);
    map.on('click', LYR_STOPP, klickStopp);
    map.on('click', klickKarte);
    return () => {
      map.off('mouseenter', LYR_STOPP, drauf);
      map.off('mouseleave', LYR_STOPP, weg);
      map.off('click', LYR_STOPP, klickStopp);
      map.off('click', klickKarte);
    };
  }, [karte, waehle]);

  /** Tageswechsel: Layer umschalten und hinfliegen. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    aktivenTagSetzen(map, tagDatum);
    const tag = tagNach(tagDatum);
    if (tag) fliegeZuTag(map, tag);
  }, [tagDatum, karte]);

  /** Theme = echter Style-Wechsel, kein CSS-Filter. */
  useEffect(() => {
    mapRef.current?.setStyle(STYLE_URL[theme], { diff: false });
  }, [theme]);

  /** Auswahl eines Stopps → hinfliegen. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || auswahl.art !== 'stopp') return;
    const pos = alleStopps.find((s) => s.id === auswahl.id)?.stopp.pos;
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
    </div>
  );
}
