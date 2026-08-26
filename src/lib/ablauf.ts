import { alleStopps, reise, tage, tagIndex, unterkunftNach, type StoppRef } from './reise';
import { routeNach } from './route';
import type { Unterkunft } from './schema';

/**
 * Der Tag als Ablauf, nicht als Liste.
 *
 * `reise.json` führt die Ziele eines Tages in der Reihenfolge auf, in der der
 * Veranstalter sie vorschlägt — mehrfach genannt, in beliebiger Folge. Die
 * Fahrreihenfolge entsteht erst in `pnpm route` und steht dort als
 * `reihenfolge`. Diese Datei setzt beides zusammen:
 *
 * - **Start**: wo der Tag beginnt (Flughafen am ersten Tag, sonst das Bett
 *   der letzten Nacht).
 * - **Auf der Route**: die Ziele in Fahrreihenfolge.
 * - **Weitere Vorschläge**: Ziele des Tages, die die Route nicht anfährt —
 *   Landschaftsräume ohne Punktposition, Streckenabschnitte, Doppelnennungen.
 *   Sie werden gezeigt, aber nicht als Halt behauptet.
 * - **Ziel**: wo der Tag endet, mit der Zahl der Nächte.
 */
export type Ablauf = {
  start: { name: string; unterkunft: Unterkunft | null };
  aufRoute: readonly StoppRef[];
  weitere: readonly StoppRef[];
  ziel: { name: string; unterkunft: Unterkunft | null };
};

const FLUGHAFEN = reise.reise.flughafen.name;

export function ablaufVon(datum: string): Ablauf | null {
  const index = tagIndex(datum);
  const tag = tage[index];
  if (!tag) return null;

  const vortag = index > 0 ? tage[index - 1] : null;
  const vorherigesHaus = vortag ? unterkunftNach(vortag.unterkunft) : null;
  const eigenesHaus = unterkunftNach(tag.unterkunft);

  const gefahren = routeNach(datum);
  const reihenfolge = gefahren?.reihenfolge ?? [];
  const nachId = new Map(alleStopps.map((s) => [s.id, s]));

  const aufRoute = reihenfolge
    .map((id) => nachId.get(id))
    .filter((s): s is StoppRef => s !== undefined);
  const aufRouteIds = new Set(aufRoute.map((s) => s.id));

  const weitere = alleStopps.filter((s) => s.datum === datum && !aufRouteIds.has(s.id));

  return {
    start: {
      name: index === 0 ? FLUGHAFEN : (vorherigesHaus?.name ?? 'Vortag'),
      unterkunft: index === 0 ? null : vorherigesHaus,
    },
    aufRoute,
    weitere,
    ziel: {
      name: tag.typ === 'abreise' ? FLUGHAFEN : (eigenesHaus?.name ?? 'Tagesende'),
      unterkunft: tag.typ === 'abreise' ? null : eigenesHaus,
    },
  };
}
