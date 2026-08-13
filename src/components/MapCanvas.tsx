'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl, { type MapMouseEvent, type MapGeoJSONFeature, type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/store/mapStore';
import { alleStopps, tagNach } from '@/lib/reise';
import type { Pos } from '@/lib/schema';
import { distanzKm } from '@/lib/geo';
import { iconsRegistrieren } from '@/map/icons';
import {
  aktivenTagSetzen,
  layerSetzen,
  LYR_STOPP,
  LYR_STOPP_LABEL,
  LYR_UNTERKUNFT,
  quellenSetzen,
  SRC_ORT,
  SRC_STOPPS,
} from '@/map/layers';
import { fliegeZuPunkt, fliegeZuTag, tourSchritt, zeigeInsel } from '@/map/camera';
import {
  DEM_SOURCE_ID,
  DEM_URL,
  SKY,
  SKY_HELL,
  START_KAMERA,
  STYLE_URL,
  TERRAIN_EXAGGERATION,
} from '@/map/style';
import { DrawControl } from './DrawControl';

type Tooltip = { x: number; y: number; name: string; hoehe: number | null; genauigkeit: string };

export function MapCanvas() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const hoverId = useRef<string | number | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [karte, setKarte] = useState<MLMap | null>(null);

  const tagDatum = useMapStore((s) => s.tagDatum);
  const theme = useMapStore((s) => s.theme);
  const auswahl = useMapStore((s) => s.auswahl);
  const waehle = useMapStore((s) => s.waehle);
  const setHover = useMapStore((s) => s.setHover);
  const setKartenBereit = useMapStore((s) => s.setKartenBereit);
  const zeichenModus = useMapStore((s) => s.zeichenModus);
  const tourLaeuft = useMapStore((s) => s.tourLaeuft);

  /** Terrain + Sky + eigene Layer — nach jedem Style-Wechsel erneut. */
  const styleAufbauen = useCallback((map: MLMap, aktuellesDatum: string, hell: boolean) => {
    if (!map.getSource(DEM_SOURCE_ID)) {
      map.addSource(DEM_SOURCE_ID, { type: 'raster-dem', url: DEM_URL, tileSize: 256 });
    }
    map.setTerrain({ source: DEM_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION });
    map.setSky(hell ? SKY_HELL : SKY);
    iconsRegistrieren(map);
    quellenSetzen(map);
    layerSetzen(map, aktuellesDatum);
  }, []);

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL[useMapStore.getState().theme],
      center: START_KAMERA.center,
      zoom: START_KAMERA.zoom,
      pitch: START_KAMERA.pitch,
      bearing: START_KAMERA.bearing,
      maxPitch: 80,
      attributionControl: { compact: true },
      // Globus zeigt Island als das, was es ist: eine Insel weit im Norden.
      // MapLibre v5 kennt die Projektion; ältere Versionen ignorieren sie.
      ...({ projection: { type: 'globe' } } as Record<string, unknown>),
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    // Griff für E2E-Tests und Debugging in der Konsole. Die App selbst liest
    // ihn nie — sie hätte den Ref.
    (window as unknown as { __islandKarte?: MLMap }).__islandKarte = map;

    map.on('style.load', () => {
      const s = useMapStore.getState();
      styleAufbauen(map, s.tagDatum, s.theme === 'hell');
      setKartenBereit(true);
      setKarte(map);
    });

    map.once('load', () => {
      const tag = tagNach(useMapStore.getState().tagDatum);
      if (tag) fliegeZuTag(map, tag);
      else zeigeInsel(map);
    });

    return () => {
      delete (window as unknown as { __islandKarte?: MLMap }).__islandKarte;
      map.remove();
      mapRef.current = null;
      setKarte(null);
      setKartenBereit(false);
    };
  }, [styleAufbauen, setKartenBereit]);

  /** Interaktion: Hover-Label, Klick auf Stopp, Klick auf leere Karte. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const hoverSetzen = (id: string | number | null) => {
      if (hoverId.current !== null) {
        map.setFeatureState({ source: SRC_STOPPS, id: hoverId.current }, { hover: false });
      }
      hoverId.current = id;
      if (id !== null) map.setFeatureState({ source: SRC_STOPPS, id }, { hover: true });
    };

    const aufStopp = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const props = f.properties as { id: string; name: string; genauigkeit: string };
      if (f.id !== undefined) hoverSetzen(f.id);
      setHover(props.id);
      map.getCanvas().style.cursor = 'pointer';
      setTooltip({
        x: e.point.x,
        y: e.point.y,
        name: props.name,
        // queryTerrainElevation liefert die DEM-Höhe an der Stelle — echtes
        // Höhenprofil ohne zusätzlichen Dienst.
        hoehe: map.queryTerrainElevation(e.lngLat) ?? null,
        genauigkeit: props.genauigkeit,
      });
    };

    const verlassen = () => {
      hoverSetzen(null);
      setHover(null);
      map.getCanvas().style.cursor = '';
      setTooltip(null);
    };

    const klickStopp = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      waehle({ art: 'stopp', id: (f.properties as { id: string }).id });
    };

    const klickUnterkunft = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      waehle({ art: 'unterkunft', id: (f.properties as { id: string }).id });
    };

    /** Leere Karte → „Was ist hier?" mit Koordinate, Tag und nächstem Stopp. */
    const klickKarte = (e: MapMouseEvent) => {
      if (useMapStore.getState().zeichenModus) return;
      const treffer = map.queryRenderedFeatures(e.point, {
        layers: [LYR_STOPP, LYR_STOPP_LABEL, LYR_UNTERKUNFT].filter((l) => map.getLayer(l)),
      });
      if (treffer.length > 0) return;
      const pos: Pos = [Number(e.lngLat.lat.toFixed(5)), Number(e.lngLat.lng.toFixed(5))];
      const src = map.getSource(SRC_ORT);
      if (src && 'setData' in src) {
        (src as maplibregl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [pos[1], pos[0]] }, properties: {} },
          ],
        });
      }
      waehle({ art: 'ort', pos });
    };

    map.on('mousemove', LYR_STOPP, aufStopp);
    map.on('mouseleave', LYR_STOPP, verlassen);
    map.on('click', LYR_STOPP, klickStopp);
    map.on('click', LYR_UNTERKUNFT, klickUnterkunft);
    map.on('click', klickKarte);

    return () => {
      map.off('mousemove', LYR_STOPP, aufStopp);
      map.off('mouseleave', LYR_STOPP, verlassen);
      map.off('click', LYR_STOPP, klickStopp);
      map.off('click', LYR_UNTERKUNFT, klickUnterkunft);
      map.off('click', klickKarte);
    };
  }, [karte, setHover, waehle]);

  /** Tageswechsel: Layer umschalten und hinfliegen. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    aktivenTagSetzen(map, tagDatum);
    const tag = tagNach(tagDatum);
    if (tag && !useMapStore.getState().tourLaeuft) fliegeZuTag(map, tag);
  }, [tagDatum, karte]);

  /**
   * Kamera-Tour: easeTo-Kette entlang der Stopps des Tages. Sie ersetzt jede
   * Textliste — wer wissen will, wie der Tag aussieht, lässt ihn abfahren.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tourLaeuft) return;
    const tag = tagNach(tagDatum);
    const punkte = (tag?.highlights ?? []).map((h) => h.pos).filter((p): p is Pos => p !== null);
    if (punkte.length === 0) {
      useMapStore.getState().tourStop();
      return;
    }

    let abgebrochen = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schritt = (i: number) => {
      if (abgebrochen) return;
      if (i >= punkte.length) {
        useMapStore.getState().tourStop();
        const t = tagNach(useMapStore.getState().tagDatum);
        if (t) fliegeZuTag(map, t);
        return;
      }
      useMapStore.getState().setTourIndex(i);
      const dauer = tourSchritt(map, punkte, i);
      timer = setTimeout(() => schritt(i + 1), Math.max(dauer, 400));
    };
    schritt(0);

    return () => {
      abgebrochen = true;
      if (timer) clearTimeout(timer);
      map.stop();
    };
  }, [tourLaeuft, tagDatum]);

  /** Theme = echter Style-Wechsel, danach Terrain und Layer wieder aufbauen. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const aktuell = map.getStyle()?.name;
    if (aktuell === undefined && !map.isStyleLoaded()) return;
    map.setStyle(STYLE_URL[theme], { diff: false });
  }, [theme]);

  /** Auswahl eines Stopps → hinfliegen. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || auswahl.art !== 'stopp') return;
    const ref = alleStopps.find((s) => s.id === auswahl.id);
    if (ref?.stopp.pos) fliegeZuPunkt(map, ref.stopp.pos);
  }, [auswahl]);

  const naechsterStopp =
    auswahl.art === 'ort'
      ? alleStopps
          .filter((s) => s.stopp.pos)
          .map((s) => ({ s, d: distanzKm(auswahl.pos, s.stopp.pos!) }))
          .sort((a, b) => a.d - b.d)[0]
      : undefined;

  return (
    <div className="absolute inset-0">
      {/*
        Nicht `absolute inset-0`: maplibre-gl.css setzt auf .maplibregl-map ein
        `position: relative` und gewinnt, wodurch inset-0 wirkungslos wird und
        der Container auf Höhe 0 zusammenfällt. `h-full w-full` umgeht das.
      */}
      <div ref={container} className="h-full w-full" data-testid="map" />

      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+18px)] rounded-md border border-white/15 bg-slate-950/90 px-2.5 py-1.5 text-xs text-slate-100 shadow-lg backdrop-blur"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-medium">{tooltip.name}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {tooltip.hoehe !== null ? `${Math.round(tooltip.hoehe)} m ü. NN` : 'Höhe unbekannt'}
            {tooltip.genauigkeit === 'bereich' && ' · Bereich'}
            {tooltip.genauigkeit === 'unbelegt' && ' · unbelegt'}
          </div>
        </div>
      )}

      {auswahl.art === 'ort' && naechsterStopp && (
        <span className="sr-only">
          Ort gewählt, nächster Stopp {naechsterStopp.s.stopp.name}
        </span>
      )}

      {karte && zeichenModus && <DrawControl map={karte} />}
    </div>
  );
}
