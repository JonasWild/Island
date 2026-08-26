'use client';

import dynamic from 'next/dynamic';
import { Timeline } from './Timeline';
import { ContextSheet } from './ContextSheet';
import { Filterleiste } from './Filterleiste';
import { Tagesdetails } from './Tagesdetails';
import { useMapStore } from '@/store/mapStore';
import { useDeepLink } from '@/hooks/useDeepLink';
import { useTastatur } from '@/hooks/useTastatur';

// MapLibre braucht window — deshalb erst im Browser laden.
const MapCanvas = dynamic(() => import('./MapCanvas').then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
      Karte wird geladen …
    </div>
  ),
});

/** Die ganze App: eine Karte, ein Tagesstreifen, ein Kontextblatt. */
export function Karte() {
  useDeepLink();
  useTastatur();
  const theme = useMapStore((s) => s.theme);
  const toggleTheme = useMapStore((s) => s.toggleTheme);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapCanvas />
      <Filterleiste />
      {/*
        Auf dem Handy sitzen die Schalter unten links, über dem Tagesstreifen —
        oben links ist auf einem 844 px hohen Gerät kein Daumenziel. Sie sitzen
        direkt über dem Tagesstreifen — dessen gemessene Höhe steht in
        `--streifen-hoehe`, damit hier keine Zahl geraten werden muss. Darüber
        liegt die Herkunftsangabe (siehe globals.css). Ab `sm:` wieder oben, wo
        sie die Karte am wenigsten verdecken.
      */}
      <div className="absolute bottom-[calc(var(--streifen-hoehe,7rem)+0.5rem)] left-3 z-30 flex gap-2 sm:bottom-auto sm:top-16">
        <button
          type="button"
          onClick={toggleTheme}
          data-testid="schalter-theme"
          title={theme === 'hell' ? 'Dunkles Kartenbild' : 'Helles Kartenbild'}
          className="flex h-11 min-w-11 items-center justify-center rounded-md bg-white/85 px-3 text-xs font-medium text-slate-700 shadow ring-1 ring-black/10 backdrop-blur transition hover:bg-white"
        >
          {theme === 'hell' ? 'Dunkel' : 'Hell'}
        </button>
      </div>
      <ContextSheet />
      <Timeline />
      <Tagesdetails />
    </main>
  );
}
