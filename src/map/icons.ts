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

function zeichne(kategorie: Kategorie, ratio: number): StyleImageInterface | null {
  const px = S * ratio;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.scale(ratio, ratio);

  const m = S / 2;

  // Platte mit Schlagschatten und Lichtverlauf — gibt dem Symbol über dem
  // Terrain Körper, ohne dass ein 3D-Renderer nötig wäre.
  c.save();
  c.shadowColor = 'rgba(15, 23, 42, 0.45)';
  c.shadowBlur = S * 0.12;
  c.shadowOffsetY = S * 0.05;
  const verlauf = c.createLinearGradient(0, m - PLATTE, 0, m + PLATTE);
  verlauf.addColorStop(0, '#ffffff');
  verlauf.addColorStop(1, '#dbe2ea');
  c.fillStyle = verlauf;
  c.beginPath();
  c.arc(m, m, PLATTE, 0, Math.PI * 2);
  c.fill();
  c.restore();

  c.strokeStyle = 'rgba(15, 23, 42, 0.25)';
  c.lineWidth = S * 0.02;
  c.beginPath();
  c.arc(m, m, PLATTE, 0, Math.PI * 2);
  c.stroke();

  // Piktogramm im 100×100-Feld, auf die Plattenfläche skaliert.
  c.save();
  const feld = PLATTE * 1.62;
  c.translate(m - feld / 2, m - feld / 2);
  c.scale(feld / 100, feld / 100);
  c.strokeStyle = '#0f172a';
  c.lineWidth = 6;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  PIKTOGRAMM[kategorie](c);
  c.restore();

  const data = c.getImageData(0, 0, px, px);
  return { width: px, height: px, data: new Uint8Array(data.data.buffer) };
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
}
