'use client';

import dynamic from 'next/dynamic';
import { Timeline } from './Timeline';
import { ContextSheet } from './ContextSheet';
import { Hud } from './Hud';
import { useDeepLink } from '@/hooks/useDeepLink';
import { useTastatur } from '@/hooks/useTastatur';

// MapLibre braucht window — deshalb erst im Browser laden.
const MapCanvas = dynamic(() => import('./MapCanvas').then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-slate-950 text-sm text-slate-500">
      Karte wird geladen …
    </div>
  ),
});

/**
 * Die ganze App: eine Karte, eine Zeitachse, ein Kontextblatt.
 * Keine Sidebar-Liste, keine Tabs, keine Dokumentansicht.
 */
export function Karte() {
  useDeepLink();
  useTastatur();

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapCanvas />
      <Hud />
      <ContextSheet />
      <Timeline />
    </main>
  );
}
