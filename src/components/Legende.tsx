'use client';

import { useState } from 'react';
import { TAG_FARBE, TAG_LABEL } from '@/lib/reise';
import { KATEGORIE_LABEL, type Kategorie } from '@/lib/kategorie';
import { GRUPPE_FARBE, GRUPPE_INHALT, GRUPPE_LABEL, GRUPPEN } from '@/lib/gruppe';
import { kategorieFarbe } from '@/map/icons';

/**
 * Was die Karte mit Farbe und Strichart sagt.
 *
 * Ohne diese Erklärung ist die Farbcodierung Dekoration: fünfzehn bunte
 * Linien, sechzehn bunte Punkte, und niemand weiss, wofür sie stehen. Die
 * Legende ist zugeklappt, weil sie nur einmal gebraucht wird — aber sie ist
 * da, und sie steht in Daumenreichweite.
 */
const ZIELARTEN: Kategorie[] = [
  'wasserfall',
  'see',
  'strand',
  'bad',
  'gletscher',
  'vulkan',
  'schlucht',
  'hoehle',
  'berg',
  'wanderung',
  'tier',
  'museum',
  'kirche',
  'ort',
  'verkehr',
];

export function Legende() {
  const [offen, setOffen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        data-testid="schalter-legende"
        aria-expanded={offen}
        title={offen ? 'Legende schließen' : 'Was bedeuten die Farben?'}
        className={`flex h-11 min-w-11 items-center justify-center rounded-md px-3 text-xs font-medium shadow ring-1 ring-black/10 backdrop-blur transition ${
          offen
            ? 'bg-slate-800/90 text-white hover:bg-slate-800'
            : 'bg-white/85 text-slate-700 hover:bg-white'
        }`}
      >
        Legende
      </button>

      {offen && (
        /*
          `fixed`, nicht `absolute`: der Schalter sitzt in einem schmalen
          Flex-Container, und ein absolut positioniertes Kind würde sich an
          dessen Breite ausrichten statt an der Karte. Auf dem Handy dieselbe
          Sprache wie das Kontextblatt — ein Blatt von unten über die volle
          Breite; ab `sm:` eine Tafel neben den Schaltern.
        */
        <div
          data-testid="legende"
          className="pointer-events-auto fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl bg-white/95 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 shadow-xl ring-1 ring-black/10 backdrop-blur sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-[7.25rem] sm:max-h-[calc(100dvh-9rem)] sm:w-80 sm:rounded-xl sm:p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Legende</h2>
            <button
              type="button"
              onClick={() => setOffen(false)}
              aria-label="Legende schließen"
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4"
                aria-hidden
                fill="none"
                stroke="currentColor"
              >
                <path d="M3 3l10 10M13 3L3 13" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <h3 className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Die Linie
          </h3>
          <ul className="mt-1.5 space-y-1.5 text-xs text-slate-700">
            <li className="flex items-center gap-2.5">
              <svg viewBox="0 0 32 8" className="h-2 w-8 shrink-0" aria-hidden>
                <line x1="1" y1="4" x2="31" y2="4" stroke="#0f172a" strokeWidth="4" />
              </svg>
              Pflicht — so kommt man abends ins Bett
            </li>
            <li className="flex items-center gap-2.5">
              <svg viewBox="0 0 32 8" className="h-2 w-8 shrink-0" aria-hidden>
                <line
                  x1="1"
                  y1="4"
                  x2="31"
                  y2="4"
                  stroke="#0f172a"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="0.4 6"
                />
              </svg>
              Abstecher — kann man auch weglassen
            </li>
            <li className="flex items-center gap-2.5">
              <svg viewBox="0 0 32 8" className="h-2 w-8 shrink-0" aria-hidden>
                <line
                  x1="1"
                  y1="4"
                  x2="31"
                  y2="4"
                  stroke="#64748b"
                  strokeWidth="3"
                  strokeDasharray="3 6"
                />
              </svg>
              Luftlinie — nicht sauber routbar, keine Fahrempfehlung
            </li>
            <li className="flex items-center gap-2.5">
              <svg viewBox="0 0 32 12" className="h-3 w-8 shrink-0" aria-hidden>
                <line x1="1" y1="6" x2="31" y2="6" stroke="#cbd5e1" strokeWidth="3" />
                <path d="M14 1.5 L22 6 L14 10.5 L16.5 6 Z" fill="#ffffff" stroke="#0f172a" />
              </svg>
              Fahrtrichtung
            </li>
          </ul>

          <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Die Farbe der Linie: Art des Tages
          </h3>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700">
            {(Object.keys(TAG_LABEL) as Array<keyof typeof TAG_LABEL>).map((typ) => (
              <li key={typ} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: TAG_FARBE[typ] }}
                />
                {TAG_LABEL[typ]}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            Nur der gewählte Tag trägt seine Farbe. Alle anderen bleiben grau — fünfzehn bunte
            Linien gleichzeitig sagen nichts mehr.
          </p>

          <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Die Marker
          </h3>
          <ul className="mt-1.5 space-y-1.5 text-xs text-slate-700">
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-5 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                style={{ backgroundColor: kategorieFarbe('unterkunft') }}
              >
                3
              </span>
              Übernachtung, mit Anzahl der Nächte
            </li>
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="inline-block h-4 w-4 shrink-0 rounded-full ring-2 ring-white"
                style={{ backgroundColor: kategorieFarbe('wanderung') }}
              />
              Abzeichen am Ziel: hier geht es zu Fuß weiter
            </li>
          </ul>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            Der Verlauf der Wanderwege steht in keiner Quelle dieses Projekts und wird deshalb
            nicht gezeichnet. Gehzeit, Strecke und Anstieg stehen im Kontextblatt.
          </p>

          <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Die Filter oben
          </h3>
          <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
            {GRUPPEN.map((g) => (
              <li key={g} className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className="mt-1 inline-block h-2.5 w-2.5 shrink-0 self-start rounded-full"
                  style={{ backgroundColor: GRUPPE_FARBE[g] }}
                />
                <span>
                  <span className="font-medium">{GRUPPE_LABEL[g]}</span>
                  <span className="text-slate-500"> — {GRUPPE_INHALT[g]}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            Unterkünfte lassen sich nicht wegfiltern: wo man schläft, ist der Anker des Tages.
          </p>

          <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Die Farbe der Ziele
          </h3>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700">
            {ZIELARTEN.map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: kategorieFarbe(k) }}
                />
                {KATEGORIE_LABEL[k]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
