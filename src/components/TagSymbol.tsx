import type { TagTyp } from '@/lib/schema';

/**
 * Ein Symbol je Tagesart — fünf Stück, nicht sechzehn.
 *
 * Die Zielarten (`Kategorie`) werden in `src/map/icons.ts` auf ein Canvas für
 * MapLibre gezeichnet und stehen im DOM deshalb nicht zur Verfügung. Hier geht
 * es um etwas anderes: die **Art des Tages**. Fünf Zeichen lassen sich als
 * eigene SVG-Pfade billiger pflegen, als den Canvas-Weg für den DOM
 * umzubauen — und sie sind auf 18 px optimiert, wo die Kartensymbole mit ihrer
 * Platte und ihrem Ring nicht mehr lesbar wären.
 *
 * Alle fünf folgen **einer Grammatik**: der gefüllte Punkt ist das Quartier,
 * der Pfeil ist die Bewegung dorthin, davon weg oder darum herum.
 *
 *   anreise      Pfeil von der Kante **in** einen Punkt
 *   etappe       Punkt → Pfeil → **zweiter** Punkt
 *   standtag     ein Punkt. Sonst nichts — man bleibt.
 *   tagesausflug derselbe Punkt, umkreist von einem Pfeil: weg und zurück
 *   abreise      Punkt → Pfeil **über die Kante hinaus**, kein Ziel
 *
 * Unterschieden wird über die **Silhouette**, nicht über Details. Die erste
 * Fassung war das nicht: `etappe` (Kreis, Linie, Spitze) und `abreise` (Kreis,
 * Linie, Spitze) unterschieden sich um weniger als zwei Pixel und waren auf
 * Perlengrösse dasselbe Zeichen. Der zweite Punkt bei `etappe` trägt diese
 * Unterscheidung jetzt allein — er ist auch dann noch zu sehen, wenn von der
 * Pfeilspitze nichts mehr übrig ist.
 *
 * Dass Standtag und Tagesausflug **denselben Punkt** teilen, ist die Aussage:
 * es ist dasselbe Bett, der Unterschied ist nur die Fahrt drumherum. Der
 * geschlossene Ring, den der Standtag vorher trug, war dabei im Weg — er sah
 * dem umkreisenden Pfeil zu ähnlich. Ein blosser Punkt kann mit nichts
 * verwechselt werden.
 *
 * Punkte sind **gefüllt**. Als Strichkreise laufen sie auf dieser Grösse zu
 * einem grauen Fleck zusammen; dasselbe galt für den gestrichelten Ring, der
 * zu einem Schleier zerfiel.
 */
const PFAD: Record<TagTyp, React.ReactNode> = {
  anreise: (
    <>
      <path d="M1 8h7.5" />
      <path d="M6 5.5L8.5 8 6 10.5" />
      <circle cx="12.4" cy="8" r="2.4" fill="currentColor" stroke="none" />
    </>
  ),
  etappe: (
    <>
      <circle cx="2.4" cy="8" r="2" fill="currentColor" stroke="none" />
      <path d="M5 8h4.4" />
      <path d="M7.7 6.3L9.4 8 7.7 9.7" />
      <circle cx="13.6" cy="8" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  standtag: <circle cx="8" cy="8" r="3.6" fill="currentColor" stroke="none" />,
  tagesausflug: (
    <>
      <circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none" />
      <path d="M8 2.6a5.4 5.4 0 1 1-4.7 2.8" />
      <path d="M5.2 2.2L8 2.6 6.6 5.1" />
    </>
  ),
  abreise: (
    <>
      <circle cx="2.6" cy="8" r="2.4" fill="currentColor" stroke="none" />
      <path d="M5.6 8H15" />
      <path d="M12.2 5.2L15 8l-2.8 2.8" />
    </>
  ),
};

export function TagSymbol({ typ, className }: { typ: TagTyp; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PFAD[typ]}
    </svg>
  );
}

/**
 * Bett und Stiefel — dieselben Silhouetten, die auf der Karte die Nadel und
 * das Wanderabzeichen tragen (`src/map/icons.ts`), hier als SVG für den DOM.
 *
 * Sie ersetzen Farbe durch Form: die Nächtezahl stand vorher als rote Ziffer
 * ohne Wort im Streifen, die Gehzeit als grüne Zeile. Beides war Farbe, die
 * etwas bedeuten sollte, ohne es zu sagen.
 */
export function BettSymbol({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 4v8.5" />
      <path d="M2 9.2h12v3.3" />
      <path d="M4.9 9.2C4.9 6.2 9.3 6.2 9.3 9.2" />
    </svg>
  );
}

export function StiefelSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="currentColor">
      <path d="M4.2 1.3h4.4v7l3.9 1.6q1.9.8 1.9 2.7v2.1H4.2z" />
    </svg>
  );
}
