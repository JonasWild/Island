import type { Stopp } from './schema';

/**
 * Was für eine Art Ziel ist das? Bestimmt das Symbol auf der Karte.
 *
 * Entschieden wird **nur am Namen**, nicht am Beschreibungstext. Der Text ist
 * zu unzuverlässig: „Stykkishólmur" hat ein Vulkanmuseum, „Akranes" einen Hot
 * Pot, „Egilsstaðir" ein Schwimmbad — alles Nebensätze, die den Ort falsch
 * einsortieren würden.
 *
 * Isländische Ortsnamen tragen ihre Art dagegen im Wort: -foss ist ein
 * Wasserfall, -jökull ein Gletscher, hver eine heiße Quelle, -gljúfur eine
 * Schlucht. Das trägt den Großteil; für die bekannten Ausnahmen, bei denen der
 * Name nichts verrät, steht eine kurze Liste davor.
 *
 * Erste passende Regel gewinnt — die Reihenfolge ist Teil der Aussage.
 */
export type Kategorie =
  | 'wasserfall'
  | 'bad'
  | 'vulkan'
  | 'gletscher'
  | 'schlucht'
  | 'hoehle'
  | 'strand'
  | 'berg'
  | 'see'
  | 'tier'
  | 'museum'
  | 'kirche'
  | 'wanderung'
  | 'ort'
  | 'verkehr'
  | 'unterkunft';

type Regel = { kategorie: Kategorie; muster: RegExp };

const REGELN: Regel[] = [
  // 1. Bekannte Ziele, deren Name ihre Art nicht verrät.
  { kategorie: 'vulkan', muster: /dimmuborgir|fagradalsfjall|námafjall|namafjall|krýsuvík|krysuvik|seltún|seltun|leirhnjúkur|krafla|eldhraun|reykjanes/i },
  { kategorie: 'berg', muster: /herðubreið|herdubreid|kirkjufell|vestrahorn|brunnhorn|reynisdrangar|hljóðaklettar|hljodaklettar/i },
  { kategorie: 'schlucht', muster: /ásbyrgi|asbyrgi|almannagjá|almannagja|jökulsárgljúfur/i },
  { kategorie: 'tier', muster: /ytri tunga|hrísey|hrisey|hafnarhólmi|hafnarholmi|hauganes|dyrhólaey|dyrholaey/i },
  { kategorie: 'see', muster: /silfra/i },
  { kategorie: 'museum', muster: /grenjaðarstaður|glaumbær|skaftárstofa|gljúfrasteinn|friðheimar/i },
  { kategorie: 'kirche', muster: /þingvellir|thingvellir|skálholt|skalholt|reykholt|möðrudalur|modrudalur/i },

  // 2. Gattungswörter und isländische Namensendungen.
  { kategorie: 'gletscher', muster: /gletscher|jökul|jokul|eisberg|diamond beach/i },
  { kategorie: 'wasserfall', muster: /wasserfall|foss\b|fossar/i },
  { kategorie: 'strand', muster: /strand|sandur\b|beach|strönd|stroend|kap\b/i },
  { kategorie: 'hoehle', muster: /höhle|hoehle|hellir|cave/i },
  { kategorie: 'schlucht', muster: /schlucht|gljúfur|gljufur|canyon|gil\b|gjá\b/i },
  { kategorie: 'vulkan', muster: /vulkan|krater|lava|solfatar|geysir|hver\b|hverir|hverð|maar|námaskarð|namaskard/i },
  { kategorie: 'bad', muster: /bad\b|baths?\b|lagoon|lagune|lónið|hot pot|spa\b|böðin|bodin|laug/i },
  { kategorie: 'see', muster: /\bsee\b|vatn\b|lagarfljót|lögurinn/i },
  { kategorie: 'berg', muster: /\bberg|fjall\b|fjalli|horn\b|klippen|klettar|basalt|felsen|passhöhe/i },
  { kategorie: 'kirche', muster: /kirche|kirkja|kloster|bischof/i },
  { kategorie: 'museum', muster: /museum|ausstellung|sammlung|zentrum|center|centre|safn\b|stofa\b|greenhouse|settlement/i },
  { kategorie: 'tier', muster: /\bwal\b|wale|walbeob|robben|papageitaucher|vogel|vögel|reiterhof|reittour|pferde|sea tours|whale/i },
  { kategorie: 'verkehr', muster: /tunnel|göng|tankstelle|volltanken|check-in|flughafen|airport|fähre|leuchtturm|lighthouse|route\b|küstenroute/i },
  { kategorie: 'wanderung', muster: /wanderung|wanderweg|spaziergang|dalur\b/i },
  { kategorie: 'ort', muster: /ortschaft|stadt|dorf|hafen|vík\b|fjörður\b|bær\b|eyri\b|nes\b|staðir\b|höfn\b|holt\b|ey\b/i },
];

/** Nur der Name entscheidet; ohne Treffer bleibt es ein Ort — nie geraten. */
export function kategorieVon(stopp: Pick<Stopp, 'name' | 'wanderung'>): Kategorie {
  for (const { kategorie, muster } of REGELN) {
    if (muster.test(stopp.name)) return kategorie;
  }
  return stopp.wanderung ? 'wanderung' : 'ort';
}

export const KATEGORIE_LABEL: Record<Kategorie, string> = {
  wasserfall: 'Wasserfall',
  bad: 'Bad & heiße Quelle',
  vulkan: 'Vulkanisch',
  gletscher: 'Gletscher & Eis',
  schlucht: 'Schlucht',
  hoehle: 'Höhle',
  strand: 'Strand & Küste',
  berg: 'Berg & Fels',
  see: 'See',
  tier: 'Tiere',
  museum: 'Museum & Kultur',
  kirche: 'Historisch',
  wanderung: 'Wanderung',
  ort: 'Ort',
  verkehr: 'Unterwegs',
  unterkunft: 'Unterkunft',
};
