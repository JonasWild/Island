import type { LlmAdapter } from './types';

/**
 * Deterministischer Mock. Gegen ihn wird die ganze UI gebaut und getestet:
 * gleiche Frage → gleiche Antwort → stabile Snapshots und E2E-Tests.
 * Der echte Aufruf ist nur ein Adapter-Tausch, kein UI-Umbau.
 */

const FIXTURES: Record<string, string[]> = {
  ort: [
    '- **Lage** — Der Punkt liegt im offenen Gelände; die Karte zeigt keinen geplanten Stopp direkt darauf.',
    '- **Untergrund** — Hochlandnahe Flächen in Island sind meist Lava, Moos oder Sander. Abseits markierter Wege gilt landesweites Fahrverbot.',
    '- **Erreichbarkeit** — Prüfen, ob die nächstgelegene Straße eine F-Piste ist; die sind mit einem 9-Sitzer ohne Allrad tabu.',
    '- **Zeitbudget** — Ein spontaner Abstecher kostet an einem Etappentag schnell 60–90 Minuten. Bei langen Tagen bewusst streichen.',
    '- **Unsicher** — Ob es hier einen Parkplatz oder Pfad gibt, lässt sich aus den Reiseunterlagen nicht ableiten.',
    '- **Vor Ort prüfen** — Straßenzustand auf road.is, Wetter auf vedur.is.',
  ],
  stopp: [
    '- **Im Reiseplan** — Der Stopp steht mit Veranstaltertext in den Unterlagen; die Karte zeigt die belegte Position.',
    '- **Aufenthalt** — Für Wasserfälle und Aussichtspunkte 30–45 Minuten rechnen, für Wanderungen die angegebene Gehzeit plus Puffer.',
    '- **Parken** — An bekannten Zielen in Island sind Parkgebühren von 750–1000 ISK üblich, oft per Kennzeichen-App.',
    '- **Andrang** — Zwischen 11 und 15 Uhr ist es an den Hauptzielen am vollsten; früh oder spät ist ruhiger.',
    '- **Anfang September** — Tageslicht rund 14 Stunden, Wetterumschwünge häufig. Wind ist der begrenzende Faktor, nicht die Temperatur.',
    '- **Unsicher** — Öffnungszeiten und Preise für 2026 sind nicht Teil der Reiseunterlagen und müssen beim Anbieter geprüft werden.',
  ],
  flaeche: [
    '- **Gebiet** — Die gezeichnete Fläche liegt im Umfeld der Tagesetappe; die Karte listet die geplanten Stopps darin.',
    '- **Landschaft** — In dieser Größenordnung wechseln in Island Küste, Lavafeld und Hochlandrand oft innerhalb weniger Kilometer.',
    '- **Zusätzliche Ziele** — Was hier sonst noch liegt, ist meist über Stichstraßen erreichbar; jede Stichstraße kostet Hin- und Rückweg.',
    '- **Fahrzeit** — Als Faustregel 60–70 km/h auf der Ringstraße, 40 km/h auf Schotter der Nummern 500+.',
    '- **Unsicher** — Ohne Routingdienst sind die Entfernungen in der App Luftlinien, keine Fahrstrecken.',
    '- **Vor Ort prüfen** — Bei Hochlandnähe die Öffnung der F-Straßen auf road.is verifizieren.',
  ],
};

function fixtureFuer(nutzer: string): string[] {
  if (nutzer.includes('Gezeichnete Fläche')) return FIXTURES.flaeche!;
  if (nutzer.includes('Angeklickte Koordinate')) return FIXTURES.ort!;
  return FIXTURES.stopp!;
}

const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockAdapter: LlmAdapter = {
  modus: 'mock',
  modell: 'mock-fixtures',
  async *antworte(_system, nutzer, signal) {
    const zeilen = fixtureFuer(nutzer);
    for (const zeile of zeilen) {
      // In Wortgruppen streamen, damit die UI dasselbe Verhalten sieht wie live.
      for (const stueck of zeile.match(/\S+\s*/g) ?? []) {
        if (signal.aborted) return;
        yield { text: stueck };
        await schlaf(18);
      }
      yield { text: '\n' };
    }
    yield { quelle: { titel: 'Reiseplan Katla Travel, Vorgang 15412', url: 'https://www.katla-travel.de' } };
    yield { quelle: { titel: 'SafeTravel Island', url: 'https://safetravel.is' } };
  },
};
