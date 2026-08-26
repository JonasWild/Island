/**
 * Text kürzen, ohne ihn zu verstümmeln.
 *
 * Die Vorschau-Blase hat Platz für ein bis zwei Sätze. Ein Schnitt nach
 * Zeichenzahl trifft mitten ins Wort („ca. 180 Liter heißes Was …") und liest
 * sich wie ein Fehler. Deshalb wird nur an Satzgrenzen geschnitten: die Blase
 * zeigt lieber einen Satz zu wenig als einen halben.
 *
 * Ist schon der erste Satz länger als das Ziel, gewinnt der Satz — er kommt
 * ganz oder gar nicht. Ein Auslassungszeichen sagt, dass mehr folgt; das
 * vollständige Wort steht im Kontextblatt.
 */

/**
 * Abkürzungen, nach deren Punkt kein Satz endet. Ohne diese Liste zerfällt
 * „ca. 180 Liter" oder „im 17. Jh. Opfer" in zwei Sätze.
 */
const ABKUERZUNGEN = new Set([
  'ca',
  'bzw',
  'inkl',
  'exkl',
  'ggf',
  'evtl',
  'z',
  'b',
  'u',
  'a',
  'd',
  'h',
  'jh',
  'nr',
  'st',
  'bspw',
  'usw',
  'etc',
  'min',
  'max',
  'km',
  'm',
  'vgl',
  'sog',
]);

/** Endet an dieser Stelle wirklich ein Satz? */
function istSatzende(text: string, i: number): boolean {
  const zeichen = text[i];
  if (zeichen !== '.' && zeichen !== '!' && zeichen !== '?') return false;

  const danach = text[i + 1];
  if (danach !== undefined && danach !== ' ' && danach !== '\n') return false;

  if (zeichen === '.') {
    // Das Wort vor dem Punkt: eine Abkürzung oder eine Ordnungszahl („17.")
    // beendet keinen Satz.
    const vorher = text.slice(0, i);
    const wort = /([\wÄÖÜäöüß]+)$/.exec(vorher)?.[1] ?? '';
    if (ABKUERZUNGEN.has(wort.toLowerCase())) return false;
    if (/^\d+$/.test(wort)) return false;
    if (wort.length === 1) return false;
  }
  return true;
}

/** Alle Satzenden (Index des Satzzeichens) in Reihenfolge. */
function satzenden(text: string): number[] {
  const enden: number[] = [];
  for (let i = 0; i < text.length; i++) if (istSatzende(text, i)) enden.push(i);
  if (enden[enden.length - 1] !== text.length - 1) enden.push(text.length - 1);
  return enden;
}

/**
 * Kürzt auf ganze Sätze, höchstens `maxZeichen` und höchstens `maxSaetze`.
 * Wurde etwas weggelassen, endet das Ergebnis auf „ …".
 */
export function kuerzeAufSaetze(text: string, maxZeichen = 160, maxSaetze = 2): string {
  const roh = text.trim().replace(/\s+/g, ' ');
  if (roh.length === 0) return '';
  if (roh.length <= maxZeichen) return roh;

  const enden = satzenden(roh);
  let genommen = '';
  for (let n = 0; n < Math.min(maxSaetze, enden.length); n++) {
    const bis = enden[n]! + 1;
    if (n > 0 && bis > maxZeichen) break;
    genommen = roh.slice(0, bis);
    if (bis > maxZeichen) break; // erster Satz ist länger als das Ziel: ganz oder gar nicht
  }

  const gekuerzt = genommen.trim();
  if (gekuerzt.length === 0 || gekuerzt.length >= roh.length) return roh;
  return `${gekuerzt} …`;
}
