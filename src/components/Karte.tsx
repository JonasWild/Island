'use client';

import dynamic from 'next/dynamic';
import { Timeline } from './Timeline';
import { ContextSheet } from './ContextSheet';
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
  const auswahl = useMapStore((s) => s.auswahl);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapCanvas />
      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'hell' ? 'Dunkles Kartenbild' : 'Helles Kartenbild'}
        className="absolute left-3 top-3 z-40 rounded-md bg-white/85 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow ring-1 ring-black/10 backdrop-blur transition hover:bg-white"
      >
        {theme === 'hell' ? 'Dunkel' : 'Hell'}
      </button>
      <ContextSheet />
      {/* Die Detailleiste nimmt ein Drittel — der Tagesstreifen rückt dann nach links. */}
      <div className={auswahl ? 'sm:pr-[33.333%]' : undefined}>
        <Timeline />
      </div>
    </main>
  );
}
