import type { TagTyp } from '@/lib/schema';

/**
 * Fünf Symbole für die fünf Tagesarten.
 *
 * **Warum eigene SVGs und nicht die Zeichner aus `src/map/icons.ts`?** Weil
 * die dort nichts Passendes hergeben: sie zeichnen die **Zielart**
 * (Wasserfall, Gletscher, Museum — 16 Werte) für die Karte, nicht die
 * **Tagesart** (Anreise, Standtag, Tagesausflug, Etappe, Abreise — 5 Werte).
 * Ein Umbau der Canvas-Zeichner auf SVG-Ausgabe wäre also viel Arbeit für
 * Symbole, die es danach immer noch nicht gäbe. Winzige Canvas-Elemente im
 * DOM wären für ein statisches Piktogramm ein Umweg mit Ratio-, Theme- und
 * Rendering-Fragen.
 *
 * Bleibt: fünf eigene SVG-Pfade. Keine Doppelpflege, denn es gibt nichts
 * Zweites zu pflegen — und auf 14 px kann man sie so zeichnen, dass sie noch
 * lesbar sind. Sie erben `currentColor` und tragen damit den Zustand des
 * Tages (gewählt / nicht gewählt) mit.
 */

/**
 * Pfade in einem 24×24-Feld, Strich 2, runde Enden.
 *
 * Sie sind bewusst grob: im Zeitstrahl sitzen sie in einem 22-px-Kreis und
 * werden mit 12 px gezeichnet. Alles, was mehr als zwei, drei Striche braucht
 * — ein Flugzeugumriss etwa —, wird dort zu einem Fleck. Anreise und Abreise
 * teilen sich deshalb dieselbe Bodenlinie und unterscheiden sich nur in der
 * Pfeilrichtung; das liest man auch klein noch.
 */
const PFAD: Record<TagTyp, React.ReactNode> = {
  // Anreise: Pfeil herunter auf den Boden.
  anreise: (
    <>
      <path d="M4 20h16" />
      <path d="M12 4v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
    </>
  ),
  // Standtag: Haus — man bleibt, wo man ist.
  standtag: (
    <>
      <path d="M4 12 12 5l8 7" />
      <path d="M6.5 11v8h11v-8" />
    </>
  ),
  // Tagesausflug: Rundpfeil — hinaus und zurück zum selben Quartier.
  tagesausflug: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M18.4 3v4h-4" />
    </>
  ),
  // Etappe: Pfeil geradeaus — von einem Quartier zum nächsten.
  etappe: (
    <>
      <path d="M5 12h12" />
      <path d="M12.5 7.5 17 12l-4.5 4.5" />
    </>
  ),
  // Abreise: Pfeil vom Boden weg.
  abreise: (
    <>
      <path d="M4 20h16" />
      <path d="M12 16V5" />
      <path d="M7.5 9.5 12 5l4.5 4.5" />
    </>
  ),
};

export function TagTypSymbol({ typ, className }: { typ: TagTyp; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PFAD[typ]}
    </svg>
  );
}
