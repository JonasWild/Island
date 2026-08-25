import type { Map as MLMap, StyleImageInterface } from 'maplibre-gl';
import type { Kategorie } from '@/lib/kategorie';

/**
 * Ein Piktogramm je Zielart, zur Laufzeit auf ein Canvas gezeichnet: kein
 * Sprite, kein zusätzlicher Netzaufruf, keine CSP-Ausnahme.
 *
 * Echte glTF-Modelle wären ein three.js- oder deck.gl-Custom-Layer über
 * MapLibre — ein eigener Renderer und deutlich mehr Bundle. Stattdessen sitzen
 * die Symbole auf einer plastisch schattierten Platte, damit sie über dem
 * Terrain als Objekte lesbar sind statt als flache Punkte.
 */

const S = 64; // logische Kantenlänge
const PLATTE = S * 0.34; // Radius der Platte

/**
 * Eine Farbe je Zielart. Sechzehn Piktogramme in identischem Grau sind auf
 * Marker-Grösse nicht auseinanderzuhalten — auf dem Handy erst recht nicht.
 * Die Farbe trägt die Unterscheidung schon aus der Ferne, das Piktogramm
 * bestätigt sie aus der Nähe.
 *
 * Die Zuordnung ist nicht dekorativ: Wasser blau, Vulkanisches rot,
 * Gletscher/Eis hell und kühl, Gebautes warmgrau, Grün für Lebendiges. Wer die
 * Karte kennt, liest die Art, ohne das Symbol zu entziffern.
 */
const FARBE: Record<Kategorie, string> = {
  wasserfall: '#0284c7',
  see: '#0369a1',
  strand: '#0e7490',
  bad: '#06b6d4',
  gletscher: '#38bdf8',
  vulkan: '#dc2626',
  schlucht: '#b45309',
  hoehle: '#7c3aed',
  berg: '#57534e',
  wanderung: '#16a34a',
  tier: '#65a30d',
  museum: '#a16207',
  kirche: '#9333ea',
  ort: '#475569',
  verkehr: '#0f766e',
  unterkunft: '#be123c',
};

type Zeichner = (c: CanvasRenderingContext2D) => void;

/** Alle Zeichner arbeiten in einem 100×100-Feld, zentriert um (50, 50). */
const PIKTOGRAMM: Record<Kategorie, Zeichner> = {
  wasserfall: (c) => {
    c.beginPath();
    c.moveTo(30, 26);
    c.lineTo(70, 26);
    c.stroke();
    for (const x of [38, 50, 62]) {
      c.beginPath();
      c.moveTo(x, 28);
      c.bezierCurveTo(x - 6, 44, x + 6, 54, x, 70);
      c.stroke();
    }
  },
  bad: (c) => {
    for (const y of [50, 62, 74]) welle(c, y, 22);
    c.beginPath();
    c.moveTo(40, 38);
    c.bezierCurveTo(34, 30, 46, 28, 40, 20);
    c.moveTo(60, 38);
    c.bezierCurveTo(54, 30, 66, 28, 60, 20);
    c.stroke();
  },
  vulkan: (c) => {
    c.beginPath();
    c.moveTo(22, 74);
    c.lineTo(42, 40);
    c.lineTo(58, 40);
    c.lineTo(78, 74);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(44, 34);
    c.lineTo(50, 18);
    c.lineTo(56, 34);
    c.stroke();
  },
  gletscher: (c) => {
    c.beginPath();
    c.moveTo(20, 72);
    c.lineTo(44, 30);
    c.lineTo(68, 72);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(34, 51);
    c.lineTo(44, 44);
    c.lineTo(54, 51);
    c.stroke();
    c.beginPath();
    c.moveTo(58, 72);
    c.lineTo(72, 52);
    c.lineTo(84, 72);
    c.closePath();
    c.stroke();
  },
  schlucht: (c) => {
    c.beginPath();
    c.moveTo(18, 22);
    c.lineTo(30, 22);
    c.lineTo(42, 76);
    c.moveTo(82, 22);
    c.lineTo(70, 22);
    c.lineTo(58, 76);
    c.stroke();
    welle(c, 66, 10);
  },
  hoehle: (c) => {
    c.beginPath();
    c.moveTo(22, 76);
    c.bezierCurveTo(22, 26, 78, 26, 78, 76);
    c.stroke();
    c.beginPath();
    c.moveTo(40, 76);
    c.bezierCurveTo(40, 50, 60, 50, 60, 76);
    c.stroke();
  },
  strand: (c) => {
    c.beginPath();
    c.arc(64, 34, 11, 0, Math.PI * 2);
    c.stroke();
    welle(c, 58, 30);
    welle(c, 72, 30);
  },
  berg: (c) => {
    c.beginPath();
    c.moveTo(16, 74);
    c.lineTo(40, 32);
    c.lineTo(64, 74);
    c.closePath();
    c.moveTo(52, 74);
    c.lineTo(70, 44);
    c.lineTo(88, 74);
    c.closePath();
    c.stroke();
  },
  see: (c) => {
    c.beginPath();
    c.ellipse(50, 54, 30, 17, 0, 0, Math.PI * 2);
    c.stroke();
    welle(c, 54, 16);
  },
  tier: (c) => {
    // Wal: Rücken, Fluke, Blas.
    c.beginPath();
    c.moveTo(22, 62);
    c.bezierCurveTo(34, 42, 62, 42, 72, 60);
    c.lineTo(80, 48);
    c.lineTo(84, 66);
    c.stroke();
    welle(c, 74, 28);
    c.beginPath();
    c.moveTo(38, 42);
    c.lineTo(34, 28);
    c.moveTo(38, 42);
    c.lineTo(46, 30);
    c.stroke();
  },
  museum: (c) => {
    c.beginPath();
    c.moveTo(18, 40);
    c.lineTo(50, 22);
    c.lineTo(82, 40);
    c.closePath();
    c.stroke();
    for (const x of [30, 44, 58, 70]) {
      c.beginPath();
      c.moveTo(x, 44);
      c.lineTo(x, 68);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(18, 74);
    c.lineTo(82, 74);
    c.stroke();
  },
  kirche: (c) => {
    c.beginPath();
    c.moveTo(50, 14);
    c.lineTo(50, 34);
    c.moveTo(42, 22);
    c.lineTo(58, 22);
    c.stroke();
    c.beginPath();
    c.moveTo(30, 76);
    c.lineTo(30, 46);
    c.lineTo(50, 34);
    c.lineTo(70, 46);
    c.lineTo(70, 76);
    c.stroke();
  },
  wanderung: (c) => {
    c.beginPath();
    c.moveTo(18, 76);
    c.lineTo(46, 40);
    c.lineTo(62, 58);
    c.lineTo(84, 30);
    c.stroke();
    c.beginPath();
    c.moveTo(84, 30);
    c.lineTo(84, 14);
    c.lineTo(70, 20);
    c.lineTo(84, 26);
    c.stroke();
  },
  ort: (c) => {
    c.beginPath();
    c.moveTo(20, 74);
    c.lineTo(20, 44);
    c.lineTo(50, 20);
    c.lineTo(80, 44);
    c.lineTo(80, 74);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(42, 74);
    c.lineTo(42, 54);
    c.lineTo(58, 54);
    c.lineTo(58, 74);
    c.stroke();
  },
  verkehr: (c) => {
    c.beginPath();
    c.moveTo(18, 62);
    c.lineTo(24, 46);
    c.lineTo(70, 46);
    c.lineTo(82, 62);
    c.lineTo(82, 70);
    c.lineTo(18, 70);
    c.closePath();
    c.stroke();
    for (const x of [34, 68]) {
      c.beginPath();
      c.arc(x, 70, 7, 0, Math.PI * 2);
      c.stroke();
    }
  },
  unterkunft: (c) => {
    c.beginPath();
    c.moveTo(14, 48);
    c.lineTo(50, 20);
    c.lineTo(86, 48);
    c.stroke();
    c.beginPath();
    c.moveTo(24, 46);
    c.lineTo(24, 76);
    c.lineTo(76, 76);
    c.lineTo(76, 46);
    c.stroke();
    c.beginPath();
    c.moveTo(42, 76);
    c.lineTo(42, 58);
    c.lineTo(58, 58);
    c.lineTo(58, 76);
    c.stroke();
  },
};

function welle(c: CanvasRenderingContext2D, y: number, halbBreite: number) {
  const b = halbBreite;
  c.beginPath();
  c.moveTo(50 - b, y);
  c.bezierCurveTo(50 - b / 2, y - 6, 50 - b / 2, y + 6, 50, y);
  c.bezierCurveTo(50 + b / 2, y - 6, 50 + b / 2, y + 6, 50 + b, y);
  c.stroke();
}

export function iconName(kategorie: Kategorie): string {
  return `sym-${kategorie}`;
}

/** Richtungspfeil auf der Route. */
export const ICON_PFEIL = 'route-pfeil';

/**
 * Anstecker für Stopps, an denen gewandert wird. Die Wanderung ist keine
 * eigene Zielart — Dettifoss bleibt ein Wasserfall, auch wenn man 2,8 km zu
 * Fuss hinläuft. Sie ist eine Eigenschaft des Stopps und bekommt deshalb ein
 * kleines Abzeichen neben dem Symbol statt einer eigenen Farbe.
 */
export const ICON_FUSSWEG = 'sym-fussweg';

/**
 * Unterkünfte bekommen ein eigenes Bild je Anzahl Nächte. Wo man schläft und
 * wie lange ist die wichtigste Information des Tages — sie gehört auf den
 * Marker und nicht erst ins Kontextblatt, das man aufklappen muss.
 */
export function unterkunftIconName(naechte: number): string {
  return `sym-unterkunft-${naechte}`;
}

/** Vorkommende Nächtezahlen — nur die werden gezeichnet. */
export const UNTERKUNFT_NAECHTE: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

function leinwand(px: number, ratio: number) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.scale(ratio, ratio);
  return c;
}

function alsBild(c: CanvasRenderingContext2D, px: number): StyleImageInterface {
  const data = c.getImageData(0, 0, px, px);
  return { width: px, height: px, data: new Uint8Array(data.data.buffer) };
}

function zeichne(kategorie: Kategorie, ratio: number): StyleImageInterface | null {
  const px = S * ratio;
  const c = leinwand(px, ratio);
  if (!c) return null;

  const m = S / 2;
  const ton = FARBE[kategorie];

  // Platte mit Schlagschatten — gibt dem Symbol über der Karte Körper. Weiss
  // bleibt sie, damit der farbige Ring und das farbige Piktogramm tragen; eine
  // vollflächig farbige Platte würde bei sechzehn Farben zu unruhig.
  c.save();
  c.shadowColor = 'rgba(15, 23, 42, 0.45)';
  c.shadowBlur = S * 0.12;
  c.shadowOffsetY = S * 0.05;
  const verlauf = c.createLinearGradient(0, m - PLATTE, 0, m + PLATTE);
  verlauf.addColorStop(0, '#ffffff');
  verlauf.addColorStop(1, '#eef2f7');
  c.fillStyle = verlauf;
  c.beginPath();
  c.arc(m, m, PLATTE, 0, Math.PI * 2);
  c.fill();
  c.restore();

  // Farbiger Ring: das ist die Unterscheidung, die auch dann noch trägt, wenn
  // das Piktogramm zu klein zum Entziffern ist.
  c.strokeStyle = ton;
  c.lineWidth = S * 0.055;
  c.beginPath();
  c.arc(m, m, PLATTE - S * 0.027, 0, Math.PI * 2);
  c.stroke();

  // Piktogramm im 100×100-Feld, auf die Plattenfläche skaliert.
  c.save();
  const feld = PLATTE * 1.5;
  c.translate(m - feld / 2, m - feld / 2);
  c.scale(feld / 100, feld / 100);
  c.strokeStyle = ton;
  c.lineWidth = 7;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  PIKTOGRAMM[kategorie](c);
  c.restore();

  return alsBild(c, px);
}

/**
 * Die Unterkunft als Bett mit Zahl. Grösser als die Zielsymbole, in kräftigem
 * Rot und mit einer Zahlenscheibe: „hier schläfst du, und zwar N Nächte". Das
 * ist die eine Marke, die sich vom Rest der Karte abheben muss — alles andere
 * sind Ziele, die man ansteuert und wieder verlässt.
 */
function zeichneUnterkunft(naechte: number, ratio: number): StyleImageInterface | null {
  const px = S * ratio;
  const c = leinwand(px, ratio);
  if (!c) return null;

  const m = S / 2;
  const r = S * 0.4;
  const ton = FARBE.unterkunft;

  // Abgerundetes Quadrat statt Kreis — schon die Silhouette unterscheidet die
  // Unterkunft von jedem Ziel, auch bei starker Verkleinerung.
  c.save();
  c.shadowColor = 'rgba(15, 23, 42, 0.5)';
  c.shadowBlur = S * 0.14;
  c.shadowOffsetY = S * 0.06;
  c.fillStyle = ton;
  c.beginPath();
  c.roundRect(m - r, m - r * 0.86, r * 2, r * 1.72, r * 0.42);
  c.fill();
  c.restore();

  c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  c.lineWidth = S * 0.035;
  c.beginPath();
  c.roundRect(m - r, m - r * 0.86, r * 2, r * 1.72, r * 0.42);
  c.stroke();

  // Bett, links.
  c.save();
  c.translate(m - r * 0.98, m - r * 0.62);
  c.scale((r * 1.2) / 100, (r * 1.2) / 100);
  c.strokeStyle = '#ffffff';
  c.lineWidth = 9;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(14, 74);
  c.lineTo(14, 30);
  c.moveTo(14, 56);
  c.lineTo(86, 56);
  c.lineTo(86, 74);
  c.stroke();
  c.beginPath();
  c.moveTo(30, 56);
  c.bezierCurveTo(30, 40, 56, 40, 56, 56);
  c.stroke();
  c.restore();

  // Zahlenscheibe, rechts.
  const zx = m + r * 0.44;
  const zy = m;
  const zr = r * 0.5;
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(zx, zy, zr, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = ton;
  c.font = `700 ${zr * 1.5}px ui-sans-serif, system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(String(naechte), zx, zy + zr * 0.06);

  return alsBild(c, px);
}

/**
 * Wanderabzeichen: grüner Kreis mit Stiefel. Klein genug, um das Zielsymbol
 * nicht zu überdecken, kräftig genug, um auf einen Blick zu sagen: hier geht
 * es zu Fuss weiter.
 */
function zeichneFussweg(ratio: number): StyleImageInterface | null {
  const px = S * ratio;
  const c = leinwand(px, ratio);
  if (!c) return null;

  const m = S / 2;
  const r = S * 0.36;

  c.fillStyle = FARBE.wanderung;
  c.beginPath();
  c.arc(m, m, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#ffffff';
  c.lineWidth = S * 0.07;
  c.beginPath();
  c.arc(m, m, r, 0, Math.PI * 2);
  c.stroke();

  /*
    Stiefel als **gefüllte** Form, nicht als Strichzeichnung. Das Abzeichen ist
    im Einsatz gut zwanzig Pixel gross; Striche laufen dort ineinander und
    ergeben einen weissen Fleck. Eine Fläche behält ihre Silhouette.
  */
  c.save();
  const feld = r * 1.5;
  c.translate(m - feld / 2, m - feld / 2);
  c.scale(feld / 100, feld / 100);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(26, 8);
  c.lineTo(54, 8);
  c.lineTo(54, 52);
  c.lineTo(78, 62);
  c.quadraticCurveTo(90, 67, 90, 79);
  c.lineTo(90, 92);
  c.lineTo(26, 92);
  c.closePath();
  c.fill();
  c.restore();

  return alsBild(c, px);
}

/**
 * Pfeil für die Fahrtrichtung. Weisser Kern mit dunklem Rand, damit er auf
 * jeder Linienfarbe und auf jeder Basiskarte lesbar bleibt.
 */
function zeichnePfeil(ratio: number): StyleImageInterface | null {
  const px = S * ratio;
  const c = leinwand(px, ratio);
  if (!c) return null;

  const m = S / 2;
  const l = S * 0.26;
  // Nach rechts: MapLibre dreht das Bild entlang der Linienrichtung, und die
  // ist die Reihenfolge der Koordinaten — also die Fahrtrichtung.
  c.beginPath();
  c.moveTo(m + l, m);
  c.lineTo(m - l * 0.75, m - l * 0.8);
  c.lineTo(m - l * 0.35, m);
  c.lineTo(m - l * 0.75, m + l * 0.8);
  c.closePath();

  c.fillStyle = '#ffffff';
  c.strokeStyle = 'rgba(15, 23, 42, 0.7)';
  c.lineWidth = S * 0.035;
  c.lineJoin = 'round';
  c.fill();
  c.stroke();

  return alsBild(c, px);
}

/** Nach jedem Style-Wechsel erneut aufrufen — ein Style-Reload leert die Bilder. */
export function iconsRegistrieren(map: MLMap): void {
  const ratio = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));

  for (const kategorie of Object.keys(PIKTOGRAMM) as Kategorie[]) {
    const name = iconName(kategorie);
    if (map.hasImage(name)) continue;
    const bild = zeichne(kategorie, ratio);
    if (bild) map.addImage(name, bild, { pixelRatio: ratio });
  }

  for (const naechte of UNTERKUNFT_NAECHTE) {
    const name = unterkunftIconName(naechte);
    if (map.hasImage(name)) continue;
    const bild = zeichneUnterkunft(naechte, ratio);
    if (bild) map.addImage(name, bild, { pixelRatio: ratio });
  }

  if (!map.hasImage(ICON_PFEIL)) {
    const pfeil = zeichnePfeil(ratio);
    if (pfeil) map.addImage(ICON_PFEIL, pfeil, { pixelRatio: ratio });
  }

  if (!map.hasImage(ICON_FUSSWEG)) {
    const fuss = zeichneFussweg(ratio);
    if (fuss) map.addImage(ICON_FUSSWEG, fuss, { pixelRatio: ratio });
  }
}

/** Farbe einer Zielart — für Legende und Kontextblatt, damit beide dieselbe sprechen. */
export function kategorieFarbe(kategorie: Kategorie): string {
  return FARBE[kategorie];
}
