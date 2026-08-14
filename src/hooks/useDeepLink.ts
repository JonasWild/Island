'use client';

import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/mapStore';
import { alleStopps, tage, unterkuenfte } from '@/lib/reise';

/**
 * `/?tag=2026-09-05&stopp=8` — teilbar und reload-fest.
 * Der URL-Zustand ist bewusst schmal: Tag und geöffnetes Ziel, sonst nichts.
 */
export function useDeepLink() {
  const tagDatum = useMapStore((s) => s.tagDatum);
  const auswahl = useMapStore((s) => s.auswahl);
  const setTag = useMapStore((s) => s.setTag);
  const oeffneDetails = useMapStore((s) => s.oeffneDetails);
  const gelesen = useRef(false);

  // Beim ersten Rendern die URL übernehmen.
  useEffect(() => {
    if (gelesen.current) return;
    gelesen.current = true;
    const p = new URLSearchParams(window.location.search);
    const tag = p.get('tag');
    if (tag && tage.some((t) => t.datum === tag)) setTag(tag);

    const zielTag = tag && tage.some((t) => t.datum === tag) ? tag : useMapStore.getState().tagDatum;
    const stopp = p.get('stopp');
    if (stopp !== null) {
      const id = `${zielTag}#${Number(stopp)}`;
      if (alleStopps.some((s) => s.id === id)) oeffneDetails({ art: 'stopp', id });
    }
    const haus = p.get('unterkunft');
    if (haus && unterkuenfte.some((u) => u.id === haus)) {
      oeffneDetails({ art: 'unterkunft', id: haus });
    }
  }, [setTag, oeffneDetails]);

  // Danach die URL dem Zustand nachführen — ohne History-Einträge zu fluten.
  useEffect(() => {
    if (!gelesen.current) return;
    const p = new URLSearchParams();
    p.set('tag', tagDatum);
    if (auswahl?.art === 'stopp') {
      const [, index] = auswahl.id.split('#');
      if (auswahl.id.startsWith(tagDatum) && index) p.set('stopp', index);
    }
    if (auswahl?.art === 'unterkunft') p.set('unterkunft', auswahl.id);
    const neu = `${window.location.pathname}?${p.toString()}`;
    if (neu !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', neu);
    }
  }, [tagDatum, auswahl]);
}
