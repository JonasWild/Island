'use client';

import { useEffect, useRef } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { MaplibreTerradrawControl } from '@watergis/maplibre-gl-terradraw';
import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css';
import type { Feature, Polygon, Position } from 'geojson';
import { useMapStore } from '@/store/mapStore';

const SPEICHER = 'island2026:zeichnung';

type GespeicherteFeatures = Feature[];

function laden(): GespeicherteFeatures {
  if (typeof window === 'undefined') return [];
  try {
    const roh = window.localStorage.getItem(SPEICHER);
    return roh ? (JSON.parse(roh) as GespeicherteFeatures) : [];
  } catch {
    return [];
  }
}

function speichern(features: GespeicherteFeatures): void {
  try {
    window.localStorage.setItem(SPEICHER, JSON.stringify(features));
  } catch {
    /* Speicher voll oder gesperrt — Zeichnung bleibt nur in dieser Sitzung. */
  }
}

function bboxVon(ring: Position[]): [number, number, number, number] {
  let w = 180;
  let s = 90;
  let o = -180;
  let n = -90;
  for (const [lon, lat] of ring) {
    if (lon! < w) w = lon!;
    if (lon! > o) o = lon!;
    if (lat! < s) s = lat!;
    if (lat! > n) n = lat!;
  }
  return [w, s, o, n];
}

/** Kugelflächenformel für ein geschlossenes Polygon, Ergebnis in km². */
function flaecheKm2(ring: Position[]): number {
  const R = 6371;
  let summe = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i]!;
    const [lon2, lat2] = ring[i + 1]!;
    summe +=
      ((lon2! - lon1!) * Math.PI) / 180 *
      (2 + Math.sin((lat1! * Math.PI) / 180) + Math.sin((lat2! * Math.PI) / 180));
  }
  return Math.abs((summe * R * R) / 2);
}

/**
 * Terra Draw über das MapLibre-Control: Punkt, Linie, Fläche, Undo/Redo,
 * Snapping. Eine fertige Fläche ist keine Zeichnung, sondern eine Frage —
 * sie öffnet sofort das Kontextblatt.
 */
export function DrawControl({ map }: { map: MLMap }) {
  const waehle = useMapStore((s) => s.waehle);
  const control = useRef<MaplibreTerradrawControl | null>(null);

  useEffect(() => {
    const ctrl = new MaplibreTerradrawControl({
      modes: [
        'render',
        'point',
        'linestring',
        'polygon',
        'rectangle',
        'select',
        'undo',
        'redo',
        'delete-selection',
        'delete',
      ],
      open: true,
      adapterOptions: { coordinatePrecision: 6 },
    });
    control.current = ctrl;
    map.addControl(ctrl, 'top-left');

    const draw = ctrl.getTerraDrawInstance();
    const wiederherstellen = () => {
      const alt = laden();
      if (alt.length > 0) {
        try {
          draw?.addFeatures(alt as never);
        } catch {
          /* inkompatible Altdaten ignorieren */
        }
      }
    };

    const beiFertig = (id: string | number) => {
      const alle = draw?.getSnapshot() ?? [];
      speichern(alle as unknown as GespeicherteFeatures);
      const f = alle.find((x) => x.id === id);
      if (!f || f.geometry.type !== 'Polygon') return;
      const ring = (f.geometry as Polygon).coordinates[0];
      if (!ring || ring.length < 4) return;
      waehle({
        art: 'flaeche',
        featureId: String(id),
        bbox: bboxVon(ring),
        flaecheKm2: flaecheKm2(ring),
      });
    };

    const beiAenderung = () => speichern((draw?.getSnapshot() ?? []) as unknown as GespeicherteFeatures);

    draw?.on('ready', wiederherstellen);
    draw?.on('finish', beiFertig);
    draw?.on('change', beiAenderung);
    if (draw?.enabled) wiederherstellen();

    return () => {
      draw?.off('finish', beiFertig);
      draw?.off('change', beiAenderung);
      draw?.off('ready', wiederherstellen);
      try {
        map.removeControl(ctrl);
      } catch {
        /* Karte bereits abgebaut */
      }
      control.current = null;
    };
  }, [map, waehle]);

  return null;
}
