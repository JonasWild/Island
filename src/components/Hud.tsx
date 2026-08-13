'use client';

import { useMapStore } from '@/store/mapStore';
import { kennzahlen, reise } from '@/lib/reise';

function Knopf({
  an,
  onClick,
  titel,
  children,
}: {
  an?: boolean;
  onClick: () => void;
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titel}
      aria-label={titel}
      aria-pressed={an}
      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
        an
          ? 'border-sky-400/50 bg-sky-400/15 text-sky-200'
          : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/15'
      }`}
    >
      {children}
    </button>
  );
}

/** Kopfzeile: Titel, Datenstand, die zwei Schalter. Mehr Chrome gibt es nicht. */
export function Hud() {
  const theme = useMapStore((s) => s.theme);
  const toggleTheme = useMapStore((s) => s.toggleTheme);
  const zeichenModus = useMapStore((s) => s.zeichenModus);
  const setZeichenModus = useMapStore((s) => s.setZeichenModus);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3">
      <div className="pointer-events-auto rounded-lg border border-white/10 bg-slate-950/75 px-3 py-2 shadow-xl backdrop-blur-md">
        <h1 className="text-sm font-semibold leading-tight text-slate-50">
          Island 2026 — Rund um die Insel
        </h1>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {reise.reise.von.split('-').reverse().join('.')} – {reise.reise.bis.split('-').reverse().join('.')}
          <span className="mx-1.5 text-slate-600">·</span>
          {kennzahlen.tage} Tage
          <span className="mx-1.5 text-slate-600">·</span>
          {kennzahlen.stopps} Stopps
          <span className="mx-1.5 text-slate-600">·</span>~{kennzahlen.km.toLocaleString('de-DE')} km
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {kennzahlen.punktgenau} punktgenau · {kennzahlen.verortet - kennzahlen.punktgenau} als
          Bereich
          {kennzahlen.ohnePosition > 0 && ` · ${kennzahlen.ohnePosition} ohne Position`}
        </p>
      </div>

      <div className="pointer-events-auto flex flex-col items-end gap-1.5">
        <div className="flex gap-1.5">
          <Knopf
            an={zeichenModus}
            onClick={() => setZeichenModus(!zeichenModus)}
            titel="Zeichnen — eine Fläche ist eine Frage ans Modell"
          >
            Zeichnen
          </Knopf>
          <Knopf
            onClick={toggleTheme}
            titel={theme === 'dunkel' ? 'Helles Kartenbild' : 'Dunkles Kartenbild'}
          >
            {theme === 'dunkel' ? 'Hell' : 'Dunkel'}
          </Knopf>
        </div>
      </div>
    </header>
  );
}
