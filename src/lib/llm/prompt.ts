import { alleStopps, tagNach, unterkunftNach } from '../reise';
import { distanzKm, formatKoordinate } from '../geo';
import type { Pos } from '../schema';
import type { Frage } from './types';

export const SYSTEM_PROMPT = `Du bist der Ortskundige für eine 15-tägige Islandreise (27.08.–10.09.2026, 5 Personen, Mietwagen, Ferienhäuser).
Der Nutzer fragt über eine Karte — er sieht bereits, wo er hinzeigt.

Regeln:
- Höchstens 6 Punkte, je ein bis zwei Sätze. Keine Einleitung, kein Fazit.
- Zahlen nennen, wenn es welche gibt (Entfernung, Gehzeit, Höhe, Öffnungszeit, Preis).
- Was du nicht sicher weißt, kennzeichnest du als unsicher — lieber „unklar" als eine erfundene Zahl.
- Bezug zum Reisetag herstellen, wenn er passt (Fahrzeit, Umweg, Tageslänge).
- Antworte auf Deutsch. Isländische Eigennamen in Originalschreibweise.
- Keine Sicherheitsversprechen zu Vulkanen, Furten oder Wetter — dafür auf safetravel.is, vedur.is und road.is verweisen.`;

function stoppZeile(name: string, pos: Pos, ab: Pos): string {
  return `${name} (${distanzKm(ab, pos).toFixed(1)} km entfernt)`;
}

/** Kontext kommt ausschließlich aus reise.json — kein freier Modellkontext. */
export function nutzerPrompt(frage: Frage): string {
  const tag = tagNach(frage.tagDatum);
  const kopf: string[] = [];
  if (tag) {
    kopf.push(`Reisetag: ${tag.datum} (${tag.wochentag}) — ${tag.titel} [${tag.typ}]`);
    if (tag.etappe) {
      kopf.push(
        `Etappe: ${tag.etappe.von} → ${tag.etappe.nach}` +
          (tag.etappe.km ? `, ${tag.etappe.km} km` : '') +
          (tag.etappe.fahrzeit ? `, ${tag.etappe.fahrzeit}` : ''),
      );
    }
    const u = unterkunftNach(tag.unterkunft);
    if (u) kopf.push(`Unterkunft an diesem Tag: ${u.name} (${u.ort}), ${u.typ}`);
    if (tag.lang && tag.langHinweis) kopf.push(`Hinweis des Veranstalters: ${tag.langHinweis}`);
  }

  switch (frage.art) {
    case 'ort': {
      const nah = alleStopps
        .filter((s) => s.stopp.pos)
        .map((s) => ({ s, d: distanzKm(frage.pos, s.stopp.pos!) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      kopf.push(`Angeklickte Koordinate: ${formatKoordinate(frage.pos)}`);
      if (nah.length > 0) {
        kopf.push(
          `Nächstgelegene geplante Stopps: ${nah
            .map(({ s }) => stoppZeile(s.stopp.name, s.stopp.pos!, frage.pos))
            .join('; ')}`,
        );
      }
      return `${kopf.join('\n')}\n\nFrage: Was ist an dieser Stelle? Lohnt ein Stopp an diesem Reisetag?`;
    }
    case 'stopp': {
      const ref = alleStopps.find((s) => s.id === frage.stoppId);
      if (!ref) return `${kopf.join('\n')}\n\nFrage: Stopp unbekannt.`;
      const s = ref.stopp;
      kopf.push(`Stopp: ${s.name}${s.strasse ? ` (${s.strasse})` : ''}`);
      kopf.push(`Text des Veranstalters: ${s.text}`);
      if (s.wanderung) {
        kopf.push(
          `Wanderung laut Reiseplan: ${[s.wanderung.distanz, s.wanderung.gehzeit, s.wanderung.hoehenmeter]
            .filter(Boolean)
            .join(', ')}`,
        );
      }
      if (s.buchen) kopf.push(`Vorausbuchung nötig: ${s.buchenText ?? 'ja'}`);
      if (s.pos) kopf.push(`Position: ${formatKoordinate(s.pos)} (${s.posMeta?.genauigkeit ?? 'unbelegt'})`);
      return `${kopf.join('\n')}\n\nFrage: Was sollte man zu diesem Stopp wissen, das nicht schon im Veranstaltertext steht? Aktueller Stand 2026, wenn relevant.`;
    }
    case 'flaeche': {
      const [w, s, o, n] = frage.bbox;
      const mitte: Pos = [(s + n) / 2, (w + o) / 2];
      const drin = alleStopps.filter(
        (x) => x.stopp.pos && x.stopp.pos[0] >= s && x.stopp.pos[0] <= n && x.stopp.pos[1] >= w && x.stopp.pos[1] <= o,
      );
      kopf.push(
        `Gezeichnete Fläche: ca. ${frage.flaecheKm2.toFixed(0)} km², Mitte ${formatKoordinate(mitte)}`,
      );
      kopf.push(
        drin.length > 0
          ? `Geplante Stopps in der Fläche: ${drin.map((x) => x.stopp.name).join(', ')}`
          : 'In der Fläche liegt kein geplanter Stopp.',
      );
      return `${kopf.join('\n')}\n\nFrage: Was liegt in diesem Gebiet und was davon passt zu diesem Reisetag?`;
    }
  }
}
