'use client';

import { useMapStore } from '@/store/mapStore';
import { alleStopps, datumKurz, tagNach, unterkunftNach } from '@/lib/reise';
import { formatKoordinate } from '@/lib/geo';
import type { PosMeta } from '@/lib/schema';
import type { Frage } from '@/lib/llm/types';
import { AskPanel } from './AskPanel';

function Beleg({ meta, pos }: { meta?: PosMeta; pos?: [number, number] | null }) {
  if (!pos) {
    return (
      <p className="mt-2 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-200">
        Keine belegte Position. Die Karte zeigt diese Lücke, statt sie zu erfinden.
      </p>
    );
  }
  return (
    <div className="mt-2 space-y-1 text-[11px] text-slate-500">
      <p className="font-mono">{formatKoordinate(pos)}</p>
      {meta ? (
        <p>
          <span
            className={
              meta.genauigkeit === 'punkt'
                ? 'text-emerald-400/80'
                : 'text-amber-300/80'
            }
          >
            {meta.genauigkeit === 'punkt' ? 'punktgenau' : 'Bereichsangabe'}
          </span>
          {' · '}
          {meta.quelle}
          {' · geprüft '}
          {meta.geprueftAm}
        </p>
      ) : (
        <p className="text-amber-300/80">ohne Herkunftsnachweis</p>
      )}
      {meta?.ref && <p className="text-slate-600">{meta.ref}</p>}
      {meta?.hinweis && <p className="text-slate-400">{meta.hinweis}</p>}
    </div>
  );
}

function Kopf({ titel, unter, onClose }: { titel: string; unter: string; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">{unter}</p>
        <h2 className="mt-0.5 text-base font-semibold leading-tight text-slate-50">{titel}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Kontextblatt schließen"
        className="-mr-1 -mt-1 shrink-0 rounded p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-slate-200"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor">
          <path d="M3 3l10 10M13 3L3 13" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export function ContextSheet() {
  const auswahl = useMapStore((s) => s.auswahl);
  const schliesse = useMapStore((s) => s.schliesse);
  const tagDatum = useMapStore((s) => s.tagDatum);

  if (auswahl.art === 'keine') return null;

  let inhalt: React.ReactNode = null;
  let frage: Frage | null = null;
  let frageTitel = '';

  if (auswahl.art === 'stopp') {
    const ref = alleStopps.find((s) => s.id === auswahl.id);
    if (!ref) return null;
    const { stopp, datum } = ref;
    const tag = tagNach(datum);
    inhalt = (
      <>
        <Kopf
          titel={stopp.name}
          unter={`${datumKurz(datum)} · ${tag?.titel ?? ''}`}
          onClose={schliesse}
        />
        {stopp.strasse && <p className="mt-2 text-xs text-slate-400">{stopp.strasse}</p>}
        <p className="mt-3 text-[13px] leading-relaxed text-slate-300">{stopp.text}</p>
        {stopp.wanderung && (
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-[11px]">
            {stopp.wanderung.distanz && (
              <div>
                <dt className="inline text-slate-500">Strecke </dt>
                <dd className="inline text-slate-200">{stopp.wanderung.distanz}</dd>
              </div>
            )}
            {stopp.wanderung.gehzeit && (
              <div>
                <dt className="inline text-slate-500">Gehzeit </dt>
                <dd className="inline text-slate-200">{stopp.wanderung.gehzeit}</dd>
              </div>
            )}
            {stopp.wanderung.hoehenmeter && (
              <div>
                <dt className="inline text-slate-500">Aufstieg </dt>
                <dd className="inline text-slate-200">{stopp.wanderung.hoehenmeter}</dd>
              </div>
            )}
          </dl>
        )}
        {stopp.buchen && (
          <p className="mt-3 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-200">
            Vorausbuchung nötig{stopp.buchenText ? ` — ${stopp.buchenText}` : '.'}
          </p>
        )}
        <Beleg meta={stopp.posMeta} pos={stopp.pos} />
      </>
    );
    frage = { art: 'stopp', stoppId: auswahl.id, tagDatum: datum };
    frageTitel = stopp.name;
  }

  if (auswahl.art === 'unterkunft') {
    const u = unterkunftNach(auswahl.id);
    if (!u) return null;
    inhalt = (
      <>
        <Kopf
          titel={u.name}
          unter={`Unterkunft · ${datumKurz(u.von)}–${datumKurz(u.bis)} · ${u.naechte} Nächte`}
          onClose={schliesse}
        />
        <p className="mt-2 text-xs text-slate-400">
          {u.ort} · {u.region}
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-300">{u.beschreibung}</p>
        <dl className="mt-3 space-y-1 text-[11px]">
          <div>
            <dt className="inline text-slate-500">Typ </dt>
            <dd className="inline text-slate-200">{u.typ}</dd>
          </div>
          <div>
            <dt className="inline text-slate-500">Verpflegung </dt>
            <dd className="inline text-slate-200">{u.verpflegung}</dd>
          </div>
          <div>
            <dt className="inline text-slate-500">Buchung </dt>
            <dd className="inline text-slate-200">{u.buchungsnummer}</dd>
          </div>
          {u.telefon && (
            <div>
              <dt className="inline text-slate-500">Telefon </dt>
              <dd className="inline text-slate-200">{u.telefon}</dd>
            </div>
          )}
        </dl>
        {u.hinweis && (
          <p className="mt-3 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-200">
            {u.hinweis}
          </p>
        )}
        {u.website && (
          <a
            href={u.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[11px] text-sky-400 underline underline-offset-2"
          >
            Anbieterseite
          </a>
        )}
        <Beleg meta={u.posMeta} pos={u.pos} />
      </>
    );
  }

  if (auswahl.art === 'ort') {
    inhalt = (
      <>
        <Kopf titel="Was ist hier?" unter="Punkt auf der Karte" onClose={schliesse} />
        <p className="mt-2 font-mono text-[11px] text-slate-500">{formatKoordinate(auswahl.pos)}</p>
      </>
    );
    frage = { art: 'ort', pos: auswahl.pos, tagDatum };
    frageTitel = formatKoordinate(auswahl.pos);
  }

  if (auswahl.art === 'flaeche') {
    const [w, s, o, n] = auswahl.bbox;
    inhalt = (
      <>
        <Kopf
          titel="Gezeichnete Fläche"
          unter={`ca. ${auswahl.flaecheKm2.toFixed(0)} km²`}
          onClose={schliesse}
        />
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-500">
          {s.toFixed(3)}…{n.toFixed(3)}° N
          <br />
          {Math.abs(o).toFixed(3)}…{Math.abs(w).toFixed(3)}° W
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
          Die Fläche ist die Frage. Was darin liegt, beantwortet das Modell unten.
        </p>
      </>
    );
    frage = {
      art: 'flaeche',
      bbox: auswahl.bbox,
      flaecheKm2: auswahl.flaecheKm2,
      tagDatum,
    };
    frageTitel = `${auswahl.flaecheKm2.toFixed(0)} km²`;
  }

  return (
    <aside
      data-testid="kontextblatt"
      className="pointer-events-auto absolute right-0 top-0 z-30 flex h-full w-full max-w-[33.333%] min-w-[300px] flex-col overflow-y-auto border-l border-white/10 bg-slate-950/85 p-4 pb-40 shadow-2xl backdrop-blur-md sm:w-[33.333%]"
    >
      {inhalt}
      {frage && <AskPanel frage={frage} titel={frageTitel} />}
    </aside>
  );
}
