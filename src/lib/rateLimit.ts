/**
 * Fenster-Zähler pro IP. Bewusst im Prozessspeicher: auf Vercel gilt das
 * Limit je Instanz, nicht global — als Kostenbremse für eine Familien-App
 * reicht das. Für ein hartes Limit wäre ein externer Zähler nötig (v2).
 */
const FENSTER_MS = 60_000;
const MAX_PRO_FENSTER = Number(process.env.LLM_RATE_LIMIT ?? 10);

const zaehler = new Map<string, { anzahl: number; bis: number }>();

export type LimitErgebnis = { erlaubt: boolean; verbleibend: number; resetSek: number };

export function pruefeLimit(ip: string, jetzt = Date.now()): LimitErgebnis {
  const eintrag = zaehler.get(ip);
  if (!eintrag || eintrag.bis <= jetzt) {
    zaehler.set(ip, { anzahl: 1, bis: jetzt + FENSTER_MS });
    return { erlaubt: true, verbleibend: MAX_PRO_FENSTER - 1, resetSek: FENSTER_MS / 1000 };
  }
  const resetSek = Math.ceil((eintrag.bis - jetzt) / 1000);
  if (eintrag.anzahl >= MAX_PRO_FENSTER) {
    return { erlaubt: false, verbleibend: 0, resetSek };
  }
  eintrag.anzahl++;
  return { erlaubt: true, verbleibend: MAX_PRO_FENSTER - eintrag.anzahl, resetSek };
}

/** Nur für Tests — sonst wächst die Map über die Lebensdauer der Instanz. */
export function limitZuruecksetzen(): void {
  zaehler.clear();
}

export function ipAus(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? 'unbekannt';
}
