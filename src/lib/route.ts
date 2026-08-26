import rohdaten from '@data/route.json';
import { RouteSchema, type Route, type TagRoute } from './schema';

/**
 * Gefahrene Route je Tag, erzeugt von `pnpm route` zur Build-Zeit.
 *
 * Zur Laufzeit wird die Datei nur noch gelesen. Beide öffentlichen
 * Routing-Dienste sind Demo-Instanzen mit Fair-Use-Auflagen; ein Aufruf pro
 * Seitenaufruf wäre respektlos und langsam — und der Nutzer sähe die Route
 * erst nach dem Netzweg.
 */
export const route: Route = RouteSchema.parse(rohdaten);

const nachDatum = new Map(route.tage.map((t) => [t.datum, t]));

export function routeNach(datum: string): TagRoute | null {
  return nachDatum.get(datum) ?? null;
}

/** Tage, deren Routing nicht sauber gelang und die als Luftlinie gelten. */
export const luftlinienTage: readonly TagRoute[] = route.tage.filter((t) => t.art === 'luftlinie');

/** Alle Stützpunkte eines Tages am Stück — für Kamerarahmen und Kettenprüfung. */
export function geometrieVon(tag: TagRoute): Array<[number, number]> {
  return tag.abschnitte.flatMap((a, i) => (i === 0 ? a.punkte : a.punkte.slice(1)));
}
