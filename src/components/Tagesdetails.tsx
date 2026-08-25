'use client';

import { useMapStore } from '@/store/mapStore';
import { ablaufVon } from '@/lib/ablauf';
import { datumKurz, gehzeitTag, TAG_FARBE, TAG_LABEL, tagNach } from '@/lib/reise';
import { etappeName, etappeVon, nachtNummer } from '@/lib/etappe';
import { routeNach } from '@/lib/route';
import { KATEGORIE_LABEL, kategorieVon } from '@/lib/kategorie';
import { kategorieFarbe } from '@/map/icons';
import type { StoppRef } from '@/lib/reise';

function stunden(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/**
 * Was an diesem Tag ansteht — als Ablauf von Bett zu Bett.
 *
 * Der Tagesstreifen zeigt die Kennzahlen; hier steht, woraus sie entstehen.
 * Die Reihenfolge ist die **gefahrene**, nicht die des Reiseplans: der
 * Veranstalter nennt Vorschläge, die Routing-Pipeline legt die Folge fest.
 *
 * Jeder Schritt sagt dazu, ob er auf der Pflichtstrecke liegt oder ein
 * Abstecher ist — das ist die Frage, die man morgens im Auto stellt. Ziele
 * ohne Wegpunkt stehen getrennt darunter: sie sind Vorschläge, kein Halt.
 */
export function Tagesdetails() {
  const datum = useMapStore((s) => s.tagDatum);
  const offen = useMapStore((s) => s.detailsOffen);
  const schliesse = useMapStore((s) => s.schliesseDetails);
  const waehle = useMapStore((s) => s.waehle);
  const setTag = useMapStore((s) => s.setTag);
  const zeigeDetails = useMapStore((s) => s.zeigeDetails);

  const tag = tagNach(datum);
  const ablauf = ablaufVon(datum);
  const gefahren = routeNach(datum);
  const gehzeit = gehzeitTag(datum);
  const etappe = etappeVon(datum);
  const nacht = nachtNummer(datum);

  if (!offen || !tag || !ablauf || !etappe) return null;

  /*
    Blättern **innerhalb der Etappe**, nicht über die ganze Reise: die Tage
    einer Standzeit gehören zusammen, der Sprung ins nächste Quartier ist ein
    anderer Schritt. `setTag` schliesst die Details, deshalb werden sie danach
    wieder geöffnet.
  */
  const stelle = etappe.tage.findIndex((t) => t.datum === datum);
  const wechsle = (richtung: -1 | 1) => {
    const ziel = etappe.tage[stelle + richtung];
    if (!ziel) return;
    setTag(ziel.datum);
    zeigeDetails();
  };

  const kuer = gefahren ? Math.round(gefahren.km - gefahren.pflichtKm) : 0;

  const zeigeStopp = (ref: StoppRef) => {
    waehle({ art: 'stopp', id: ref.id });
    schliesse();
  };

  const schritt = (ref: StoppRef, nummer: number | null) => {
    const kategorie = kategorieVon(ref.stopp);
    const farbe = kategorieFarbe(kategorie);
    return (
      <li key={ref.id} className="relative pl-9">
        {/* Punkt auf dem Zeitstrahl, in der Farbe der Zielart. */}
        <span
          aria-hidden
          className="absolute left-[0.6875rem] top-3 z-10 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white"
          style={{ backgroundColor: farbe }}
        />
        <button
          type="button"
          onClick={() => zeigeStopp(ref)}
          className="flex w-full items-start gap-3 rounded-lg py-2 pr-2 text-left transition hover:bg-slate-50"
        >
          {ref.stopp.bild ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ref.stopp.bild.url}
              alt=""
              width={ref.stopp.bild.breite}
              height={ref.stopp.bild.hoehe}
              loading="lazy"
              decoding="async"
              className="h-14 w-14 shrink-0 rounded-md object-cover ring-1 ring-black/5"
            />
          ) : (
            <span
              aria-hidden
              className="h-14 w-14 shrink-0 rounded-md ring-1 ring-black/5"
              style={{ backgroundColor: `${farbe}1a` }}
            />
          )}
          <span className="min-w-0 flex-1">
            {/* Nicht umbrechen lassen: sonst steht die Nummer allein in einer
                Zeile über einem langen Namen. */}
            <span className="flex items-baseline gap-2">
              {nummer !== null && (
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-400">
                  {nummer}
                </span>
              )}
              <span className="min-w-0 font-medium leading-tight text-slate-900">
                {ref.stopp.name}
              </span>
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
              <span className="text-slate-500">{KATEGORIE_LABEL[kategorie]}</span>
              {ref.stopp.wanderung && (
                <span className="rounded-full bg-green-100 px-1.5 py-0.5 font-medium text-green-800">
                  zu Fuß
                  {ref.stopp.wanderung.gehzeit ? ` · ${ref.stopp.wanderung.gehzeit}` : ''}
                </span>
              )}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div
      data-testid="tagesdetails"
      role="dialog"
      aria-modal="true"
      aria-label={`Ablauf am ${datumKurz(datum)}`}
      className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-y-6 sm:left-1/2 sm:w-[34rem] sm:max-w-[calc(100vw-3rem)] sm:-translate-x-1/2 sm:rounded-2xl sm:shadow-2xl sm:ring-1 sm:ring-black/10"
    >
      <header className="shrink-0 border-b border-slate-200 px-5 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] sm:pt-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {/*
              Zuerst die Standzeit, dann der Tag darin. Ein Tag allein sagt
              nicht, ob man Gepäck im Auto hat oder abends ins selbe Bett
              zurückkehrt — die Etappe sagt es.
            */}
            <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500">
              <span className="font-medium text-rose-700">{etappeName(etappe)}</span>
              {etappe.unterkunft && nacht > 0 && (
                <span>
                  · Nacht {nacht} von {etappe.unterkunft.naechte}
                </span>
              )}
              <span>
                · {datumKurz(etappe.von)}–{datumKurz(etappe.bis)}
              </span>
            </p>
            {/*
              Die Tagesart als Pille in ihrer Farbe — dieselbe, die auf der
              Karte die Linie trägt. Ein Farbpunkt ohne Wort erklärt nichts,
              ein Wort ohne Farbe verbindet nichts.
            */}
            <span
              className="mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: TAG_FARBE[tag.typ] }}
            >
              {TAG_LABEL[tag.typ]}
            </span>
            <h2 className="mt-1.5 text-lg font-semibold leading-tight text-slate-900">
              {tag.titel}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {tag.wochentag}, {datumKurz(datum)}
              {tag.etappe ? ` · ${tag.etappe.von} → ${tag.etappe.nach}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={schliesse}
            aria-label="Schließen"
            data-testid="tagesdetails-schliessen"
            className="-mr-2.5 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
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

        {/* Blättern durch die Tage dieser Standzeit. */}
        {etappe.tage.length > 1 && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => wechsle(-1)}
              disabled={stelle === 0}
              data-testid="tagesdetails-zurueck"
              className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden fill="none" stroke="currentColor">
                <path d="M10 3L5 8l5 5" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {stelle > 0 ? datumKurz(etappe.tage[stelle - 1]!.datum) : 'Tag zurück'}
            </button>
            <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
              {stelle + 1} / {etappe.tage.length}
            </span>
            <button
              type="button"
              onClick={() => wechsle(1)}
              disabled={stelle === etappe.tage.length - 1}
              data-testid="tagesdetails-vor"
              className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100"
            >
              {stelle < etappe.tage.length - 1 ? datumKurz(etappe.tage[stelle + 1]!.datum) : 'Tag vor'}
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden fill="none" stroke="currentColor">
                <path d="M6 3l5 5-5 5" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Die Kennzahlen des Tages, alle vier auf einen Blick. */}
        {gefahren?.art === 'strasse' && (
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { k: 'Strecke', v: `${Math.round(gefahren.km)} km` },
              { k: 'Im Auto', v: stunden(gefahren.fahrzeitMin) },
              {
                k: 'Davon Pflicht',
                v: gefahren.pflichtKm > 0 ? `${Math.round(gefahren.pflichtKm)} km` : 'keine',
              },
              { k: 'Zu Fuß', v: gehzeit > 0 ? stunden(gehzeit) : '–' },
            ].map(({ k, v }) => (
              <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="text-sm font-semibold tabular-nums text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {gefahren && gefahren.pflichtKm === 0 && gefahren.art === 'strasse' && (
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Start und Ziel sind dieselbe Unterkunft — an diesem Tag ist alles freiwillig. Die
            {` ${Math.round(gefahren.km)} `}km entstehen nur, wenn man alles mitnimmt.
          </p>
        )}
        {gefahren && gefahren.pflichtKm > 0 && (
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            {Math.round(gefahren.pflichtKm)} km muss man fahren, um abends im Bett zu liegen. Die
            übrigen {kuer} km sind Abstecher.
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
        {tag.etappe?.hinweis && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-100">
            {tag.etappe.hinweis}
          </p>
        )}
        {tag.langHinweis && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-100">
            {tag.langHinweis}
          </p>
        )}

        <ol className="relative">
          {/* Die durchgehende Linie des Zeitstrahls. */}
          <span
            aria-hidden
            className="absolute bottom-6 left-[1.1875rem] top-6 w-px bg-slate-200"
          />

          <li className="relative pl-9">
            <span
              aria-hidden
              className="absolute left-[0.8125rem] top-3.5 z-10 h-3 w-3 rounded-full bg-slate-400 ring-2 ring-white"
            />
            <p className="py-2 text-xs text-slate-500">
              Start: <span className="font-medium text-slate-700">{ablauf.start.name}</span>
            </p>
          </li>

          {ablauf.aufRoute.map((ref, i) => schritt(ref, i + 1))}

          <li className="relative pl-9">
            <span
              aria-hidden
              className="absolute left-[0.6875rem] top-4 z-10 h-4 w-4 rounded-full ring-2 ring-white"
              style={{ backgroundColor: kategorieFarbe('unterkunft') }}
            />
            {ablauf.ziel.unterkunft ? (
              <button
                type="button"
                onClick={() => {
                  waehle({ art: 'unterkunft', id: ablauf.ziel.unterkunft!.id });
                  schliesse();
                }}
                data-testid="tagesdetails-unterkunft"
                className="mt-1 flex w-full items-center gap-3 rounded-xl bg-rose-50 px-3 py-3 text-left ring-1 ring-rose-100 transition hover:bg-rose-100"
              >
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-rose-600 text-white">
                  <span className="text-base font-bold leading-none tabular-nums">
                    {ablauf.ziel.unterkunft.naechte}
                  </span>
                  <span className="text-[8px] uppercase leading-none tracking-wide">
                    {ablauf.ziel.unterkunft.naechte === 1 ? 'Nacht' : 'Nächte'}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] uppercase tracking-wide text-rose-700/80">
                    Übernachtung
                  </span>
                  <span className="block font-medium leading-tight text-rose-950">
                    {ablauf.ziel.unterkunft.name}
                  </span>
                  <span className="block text-[11px] text-rose-700/80">
                    {ablauf.ziel.unterkunft.ort} · {ablauf.ziel.unterkunft.verpflegung}
                  </span>
                </span>
              </button>
            ) : (
              <p className="py-2 text-xs text-slate-500">
                Ziel: <span className="font-medium text-slate-700">{ablauf.ziel.name}</span>
              </p>
            )}
          </li>
        </ol>

        {/*
          Ziele, die die Route nicht anfährt: Landschaftsräume ohne
          Punktposition, Streckenabschnitte, Doppelnennungen. Sie stehen im
          Reiseplan und gehören deshalb hierher — aber nicht als Halt, den es
          so nicht gibt.
        */}
        {ablauf.weitere.length > 0 && (
          <section className="mt-5 border-t border-slate-200 pt-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Ohne festen Halt
            </h3>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              Im Reiseplan genannt, aber nicht als Wegpunkt gefahren — Landschaft am Weg,
              Streckenabschnitte oder Ziele ohne punktgenaue Adresse.
            </p>
            <ul className="mt-2 space-y-1">{ablauf.weitere.map((ref) => schritt(ref, null))}</ul>
          </section>
        )}
      </div>
    </div>
  );
}
