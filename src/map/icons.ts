import type { Map as MLMap, StyleImageInterface } from 'maplibre-gl';

/**
 * Icons werden zur Laufzeit gezeichnet statt als Sprite ausgeliefert: vier
 * Formen, zwei Themes, kein zusätzlicher Netzaufruf und keine CSP-Ausnahme.
 */

export type IconName =
  | 'stopp-punkt'
  | 'stopp-bereich'
  | 'stopp-buchen'
  | 'unterkunft'
  | 'ort-frage';

const GROESSE = 44;

type Zeichnung = { fuellung: string; rand: string; form: 'kreis' | 'ring' | 'raute' | 'haus' };

const ZEICHNUNGEN: Record<IconName, Zeichnung> = {
  'stopp-punkt': { fuellung: '#f8fafc', rand: '#0f172a', form: 'kreis' },
  // Bereichsangaben werden bewusst offen gezeichnet — die Unschärfe ist sichtbar.
  'stopp-bereich': { fuellung: 'transparent', rand: '#f8fafc', form: 'ring' },
  'stopp-buchen': { fuellung: '#fbbf24', rand: '#0f172a', form: 'raute' },
  unterkunft: { fuellung: '#34d399', rand: '#0f172a', form: 'haus' },
  'ort-frage': { fuellung: '#60a5fa', rand: '#f8fafc', form: 'kreis' },
};

function zeichne(name: IconName, pixelRatio: number): StyleImageInterface | null {
  const z = ZEICHNUNGEN[name];
  const s = GROESSE * pixelRatio;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const m = s / 2;
  const r = s * 0.28;
  ctx.lineWidth = s * 0.075;
  ctx.strokeStyle = z.rand;
  ctx.fillStyle = z.fuellung;

  ctx.beginPath();
  switch (z.form) {
    case 'kreis':
    case 'ring':
      ctx.arc(m, m, r, 0, Math.PI * 2);
      break;
    case 'raute':
      ctx.moveTo(m, m - r * 1.15);
      ctx.lineTo(m + r * 1.15, m);
      ctx.lineTo(m, m + r * 1.15);
      ctx.lineTo(m - r * 1.15, m);
      ctx.closePath();
      break;
    case 'haus':
      ctx.moveTo(m, m - r * 1.2);
      ctx.lineTo(m + r, m - r * 0.15);
      ctx.lineTo(m + r * 0.72, m - r * 0.15);
      ctx.lineTo(m + r * 0.72, m + r);
      ctx.lineTo(m - r * 0.72, m + r);
      ctx.lineTo(m - r * 0.72, m - r * 0.15);
      ctx.lineTo(m - r, m - r * 0.15);
      ctx.closePath();
      break;
  }
  if (z.fuellung !== 'transparent') ctx.fill();
  ctx.stroke();

  if (z.form === 'ring') {
    // gestrichelter Innenring als zweiter Hinweis auf „ungefähr hier"
    ctx.setLineDash([s * 0.09, s * 0.07]);
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.arc(m, m, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const data = ctx.getImageData(0, 0, s, s);
  return { width: s, height: s, data: new Uint8Array(data.data.buffer) };
}

/** Nach jedem Style-Wechsel erneut aufrufen — Style-Reload leert die Bilder. */
export function iconsRegistrieren(map: MLMap): void {
  const ratio = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
  for (const name of Object.keys(ZEICHNUNGEN) as IconName[]) {
    if (map.hasImage(name)) continue;
    const bild = zeichne(name, ratio);
    if (bild) map.addImage(name, bild, { pixelRatio: ratio });
  }
}
