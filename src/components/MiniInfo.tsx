'use client';

import { useEffect, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { useMapStore } from '@/store/mapStore';
import { ansicht, zielPos } from '@/lib/ziel';

/**
 * Erste Stufe: eine kleine Karte direkt am Marker mit dem Nötigsten.
 * Wer mehr will, öffnet von hier aus die Detailleiste.
 */
export function MiniInfo({ map }: { map: MLMap }) {
  const fokus = useMapStore((s) => s.fokus);
  const auswahl = useMapStore((s) => s.auswahl);
  const tagDatum = useMapStore((s) => s.tagDatum);
  const setFokus = useMapStore((s) => s.setFokus);
  const oeffneDetails = useMapStore((s) => s.oeffneDetails);
  const [punkt, setPunkt] = useState<{ x: number; y: number } | null>(null);

  const pos = fokus ? zielPos(fokus) : null;

  // Die Box klebt am Marker — also bei jeder Kamerabewegung neu projizieren.
  // Die erste Berechnung läuft im nächsten Frame, nicht synchron im Effekt.
  useEffect(() => {
    if (!pos) return;
    const setzen = () => {
      const p = map.project({ lng: pos[1], lat: pos[0] });
      setPunkt({ x: p.x, y: p.y });
    };
    const rahmen = requestAnimationFrame(setzen);
    map.on('move', setzen);
    map.on('terrain', setzen);
    return () => {
      cancelAnimationFrame(rahmen);
      map.off('move', setzen);
      map.off('terrain', setzen);
    };
  }, [map, pos]);

  // Ohne Ziel gibt es nichts zu positionieren.
  if (!pos) return null;

  if (!fokus || !punkt) return null;
  const a = ansicht(fokus, tagDatum);
  if (!a) return null;

  return (
    <div
      data-testid="mini-info"
      className="pointer-events-auto absolute z-20 w-60 -translate-x-1/2 -translate-y-[calc(100%+34px)] overflow-hidden rounded-lg bg-white/95 shadow-xl ring-1 ring-black/10 backdrop-blur"
      style={{ left: punkt.x, top: punkt.y }}
    >
      {a.bild && (
        // eslint-disable-next-line @next/next/no-img-element -- externe Commons-URL, kein Loader
        <img
          src={a.bild.url}
          alt={a.bild.titel}
          className="h-24 w-full bg-slate-200 object-cover"
        />
      )}
      <div className="p-2.5">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">{a.unter}</p>
        <p className="mt-0.5 text-sm font-semibold leading-tight text-slate-900">{a.titel}</p>
        {a.fakten.length > 0 && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600">
            {a.fakten.join(' · ')}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          {!auswahl && (
            <button
              type="button"
              data-testid="mini-details"
              onClick={() => oeffneDetails()}
              className="rounded bg-slate-900 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-slate-700"
            >
              Details
            </button>
          )}
          <button
            type="button"
            onClick={() => setFokus(null)}
            className="ml-auto rounded px-1.5 py-1 text-[11px] text-slate-500 transition hover:bg-black/5"
          >
            Schließen
          </button>
        </div>
      </div>
      {/* Zeiger zum Marker */}
      <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white/95 ring-1 ring-black/10" />
    </div>
  );
}
