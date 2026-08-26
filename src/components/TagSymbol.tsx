import type { TagTyp } from '@/lib/schema';

/**
 * Ein Symbol je Tagesart — fünf Stück, nicht sechzehn.
 *
 * Die Zielarten (`Kategorie`) werden in `src/map/icons.ts` auf ein Canvas für
 * MapLibre gezeichnet und stehen im DOM deshalb nicht zur Verfügung. Hier geht
 * es um etwas anderes: die **Art des Tages**. Fünf Zeichen lassen sich als
 * eigene SVG-Pfade billiger pflegen, als den Canvas-Weg für den DOM
 * umzubauen — und sie sind auf 16 px optimiert, wo die Kartensymbole mit ihrer
 * Platte und ihrem Ring nicht mehr lesbar wären.
 *
 * Die Zeichen erzählen die Bewegung des Tages:
 *   anreise      Pfeil von aussen auf einen Punkt
 *   etappe       Pfeil von einem Punkt zum nächsten
 *   standtag     ein Punkt, an dem man bleibt
 *   tagesausflug Schleife zurück zum selben Punkt
 *   abreise      Pfeil vom Punkt weg nach aussen
 */
const PFAD: Record<TagTyp, React.ReactNode> = {
  anreise: (
    <>
      <path d="M1 8h8" />
      <path d="M6 5l3 3-3 3" />
      <circle cx="12.5" cy="8" r="2.5" />
    </>
  ),
  etappe: (
    <>
      <circle cx="3" cy="8" r="2" />
      <path d="M6 8h7" />
      <path d="M10.5 5.5L13 8l-2.5 2.5" />
    </>
  ),
  standtag: (
    <>
      <circle cx="8" cy="8" r="2.5" />
      <circle cx="8" cy="8" r="6" strokeDasharray="1.5 2.5" />
    </>
  ),
  tagesausflug: (
    <>
      <circle cx="8" cy="10.5" r="2" />
      <path d="M8 8.5V6a3.5 3.5 0 1 1 3.5 3.5H10" />
      <path d="M11.5 8l1.5 1.5-1.5 1.5" />
    </>
  ),
  abreise: (
    <>
      <circle cx="3.5" cy="8" r="2.5" />
      <path d="M7 8h8" />
      <path d="M12 5l3 3-3 3" />
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
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PFAD[typ]}
    </svg>
  );
}
