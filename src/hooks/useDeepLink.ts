'use client';

import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/mapStore';
import { alleStopps, tage, unterkuenfte } from '@/lib/reise';

/**
 * `/?tag=2026-09-05&stopp=8` — teilbar und reload-fest.
 * Der URL-Zustand ist bewusst schmal: Tag und Auswahl, sonst nichts.
 */
export function useDeepLink() {
  const tagDatum = useMapStore((s) => s.tagDatum);
  const auswahl = useMapStore((s) => s.auswahl);
  const setTag = useMapStore((s) => s.setTag);
  const waehleMitDetails = useMapStore((s) => s.waehleMitDetails);
  const gelesen = useRef(false);

  /*
   * Beim ersten Rendern die URL übernehmen.
   *
   * Ein Deep Link öffnet weiterhin das volle Kontextblatt, nicht die
   * Vorschau-Blase. Begründung: die Blase ist die Antwort auf einen Klick —
   * sie hält den Kontext, den man gerade selbst aufgebaut hat. Wer einem
   * geteilten Link folgt, hat diesen Kontext nicht und will genau das sehen,
   * wofür der Link geschickt wurde. Ein Zwischenschritt wäre hier eine Hürde,
   * keine Rücksicht.
   */
  useEffect(() => {
    if (gelesen.current) return;
    gelesen.current = true;
    const p = new URLSearchParams(window.location.search);
    const tag = p.get('tag');
    if (tag && tage.some((t) => t.datum === tag)) setTag(tag);

    const stopp = p.get('stopp');
    const zielTag = tag && tage.some((t) => t.datum === tag) ? tag : useMapStore.getState().tagDatum;
    if (stopp !== null) {
      const id = `${zielTag}#${Number(stopp)}`;
      if (alleStopps.some((s) => s.id === id)) waehleMitDetails({ art: 'stopp', id });
    }
    const haus = p.get('unterkunft');
    if (haus && unterkuenfte.some((u) => u.id === haus)) {
      waehleMitDetails({ art: 'unterkunft', id: haus });
    }
  }, [setTag, waehleMitDetails]);

  // Danach die URL dem Zustand nachführen — ohne History-Einträge zu fluten.
  useEffect(() => {
    if (!gelesen.current) return;
    const p = new URLSearchParams();
    p.set('tag', tagDatum);
    if (auswahl.art === 'stopp') {
      const [, index] = auswahl.id.split('#');
      if (auswahl.id.startsWith(tagDatum) && index) p.set('stopp', index);
    }
    if (auswahl.art === 'unterkunft') p.set('unterkunft', auswahl.id);
    const neu = `${window.location.pathname}?${p.toString()}`;
    if (neu !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', neu);
    }
  }, [tagDatum, auswahl]);
}
