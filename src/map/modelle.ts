import maplibregl, { type CustomLayerInterface, type Map as MLMap } from 'maplibre-gl';
import * as THREE from 'three';
import type { Kategorie } from '@/lib/kategorie';

/**
 * Echte 3D-Modelle als MapLibre-Custom-Layer mit three.js.
 *
 * Die Modelle werden im Code erzeugt statt als glTF geladen: bei sechzehn
 * einfachen Formen ist das kleiner, schneller und braucht keine externe Datei
 * und keine CSP-Ausnahme. Sie stehen auf dem Gelände, neigen sich mit der
 * Kamera und werden vom Terrain verdeckt — das leistet ein Symbolbild nicht.
 *
 * Wichtig: Custom-Layer rechnen in Mercator-Weltkoordinaten. Die Karte läuft
 * deshalb in Mercator-Projektion, nicht als Globus.
 */

export const LYR_MODELLE = 'stopp-modelle';

/** Zielhöhe eines Modells auf dem Schirm. Daraus wird die Größe je Zoom berechnet. */
const HOEHE_PX = 40;

export type Modellpunkt = {
  id: string;
  lngLat: [number, number];
  kategorie: Kategorie;
  /** Stopps anderer Tage stehen blasser und kleiner da. */
  aktiv: boolean;
};

const FARBE: Record<Kategorie, number> = {
  wasserfall: 0x38bdf8,
  bad: 0x22d3ee,
  vulkan: 0xdc2626,
  gletscher: 0xe0f2fe,
  schlucht: 0xa16207,
  hoehle: 0x44403c,
  strand: 0xfacc15,
  berg: 0x78716c,
  see: 0x2563eb,
  tier: 0x9333ea,
  museum: 0xf1f5f9,
  kirche: 0xe2e8f0,
  wanderung: 0x16a34a,
  ort: 0xf8fafc,
  verkehr: 0x475569,
  unterkunft: 0x059669,
};

/**
 * Eine Form je Zielart, aufgebaut in einem Einheitswürfel: Grundfläche etwa
 * 1×1, Höhe 1, Ursprung am Boden. Die Skalierung passiert später.
 */
function form(kategorie: Kategorie): THREE.BufferGeometry[] {
  const kegel = (r: number, h: number, y: number, seiten = 12) => {
    const g = new THREE.ConeGeometry(r, h, seiten);
    g.translate(0, y + h / 2, 0);
    return g;
  };
  const quader = (b: number, h: number, t: number, y: number) => {
    const g = new THREE.BoxGeometry(b, h, t);
    g.translate(0, y + h / 2, 0);
    return g;
  };
  const scheibe = (r: number, h: number, y: number) => {
    const g = new THREE.CylinderGeometry(r, r, h, 16);
    g.translate(0, y + h / 2, 0);
    return g;
  };

  switch (kategorie) {
    case 'vulkan': {
      // Kegelstumpf mit Krater: oben schmaler, kleine Rauchsäule.
      const g = new THREE.CylinderGeometry(0.18, 0.5, 0.75, 14);
      g.translate(0, 0.375, 0);
      return [g, kegel(0.1, 0.35, 0.7, 8)];
    }
    case 'berg':
      return [kegel(0.45, 0.85, 0), kegel(0.2, 0.28, 0.62)];
    case 'gletscher':
      return [kegel(0.5, 0.7, 0, 6), kegel(0.28, 0.35, 0.55, 6)];
    case 'wasserfall':
      return [quader(0.7, 0.55, 0.28, 0), quader(0.3, 0.9, 0.1, 0)];
    case 'bad':
      return [scheibe(0.5, 0.25, 0), scheibe(0.22, 0.5, 0.2)];
    case 'see':
      return [scheibe(0.55, 0.14, 0)];
    case 'strand':
      return [scheibe(0.55, 0.12, 0), quader(0.5, 0.3, 0.12, 0.1)];
    case 'schlucht':
      return [quader(0.24, 0.8, 0.7, 0), quader(0.24, 0.6, 0.7, 0)].map((g, i) => {
        g.translate(i === 0 ? -0.32 : 0.32, 0, 0);
        return g;
      });
    case 'hoehle': {
      const g = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      return [g, quader(0.7, 0.1, 0.7, 0)];
    }
    case 'tier': {
      // Wal: gestreckte Kugel mit Fluke.
      const koerper = new THREE.SphereGeometry(0.32, 12, 8);
      koerper.scale(1.6, 0.7, 0.7);
      koerper.translate(0, 0.28, 0);
      return [koerper, quader(0.22, 0.28, 0.06, 0.3)];
    }
    case 'museum':
      return [quader(0.85, 0.55, 0.55, 0), kegel(0.62, 0.3, 0.55, 4)];
    case 'kirche':
      return [quader(0.5, 0.5, 0.5, 0), kegel(0.36, 0.55, 0.5, 4), quader(0.06, 0.22, 0.06, 1.05)];
    case 'wanderung':
      return [quader(0.42, 0.22, 0.42, 0), quader(0.3, 0.2, 0.3, 0.22), quader(0.18, 0.18, 0.18, 0.42)];
    case 'verkehr':
      return [quader(0.8, 0.28, 0.4, 0.06), quader(0.42, 0.22, 0.36, 0.34)];
    case 'unterkunft':
      return [quader(0.7, 0.5, 0.6, 0), kegel(0.55, 0.42, 0.5, 4)];
    case 'ort':
    default:
      return [quader(0.6, 0.5, 0.5, 0), kegel(0.48, 0.35, 0.5, 4)];
  }
}

const geometrieCache = new Map<Kategorie, THREE.BufferGeometry[]>();
function geometrien(k: Kategorie): THREE.BufferGeometry[] {
  let g = geometrieCache.get(k);
  if (!g) {
    g = form(k);
    geometrieCache.set(k, g);
  }
  return g;
}

type Eintrag = { punkt: Modellpunkt; gruppe: THREE.Group; meterEinheit: number };

export function modellLayer(
  punkteLesen: () => Modellpunkt[],
  hoeheLesen: (lngLat: [number, number]) => number,
): CustomLayerInterface & { aktualisieren: () => void } {
  let renderer: THREE.WebGLRenderer | null = null;
  let karte: MLMap | null = null;
  const szene = new THREE.Scene();
  const kamera = new THREE.Camera();
  kamera.matrixAutoUpdate = false;
  let eintraege: Eintrag[] = [];

  szene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const sonne = new THREE.DirectionalLight(0xffffff, 2.2);
  sonne.position.set(-0.5, 1, 0.8);
  szene.add(sonne);

  function aufbauen() {
    for (const e of eintraege) szene.remove(e.gruppe);
    eintraege = [];

    for (const punkt of punkteLesen()) {
      const gruppe = new THREE.Group();
      const material = new THREE.MeshLambertMaterial({
        color: FARBE[punkt.kategorie],
        transparent: true,
      });
      for (const g of geometrien(punkt.kategorie)) {
        gruppe.add(new THREE.Mesh(g, material));
      }
      // three baut Y-oben, Mercator rechnet Z-oben und Y nach Süden.
      gruppe.rotation.x = Math.PI / 2;
      gruppe.matrixAutoUpdate = true;
      szene.add(gruppe);
      const mc = maplibregl.MercatorCoordinate.fromLngLat(punkt.lngLat, 0);
      eintraege.push({ punkt, gruppe, meterEinheit: mc.meterInMercatorCoordinateUnits() });
    }
  }

  return {
    id: LYR_MODELLE,
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      karte = map;
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      aufbauen();
    },

    onRemove() {
      for (const e of eintraege) szene.remove(e.gruppe);
      eintraege = [];
      renderer?.dispose();
      renderer = null;
      karte = null;
    },

    aktualisieren() {
      aufbauen();
      karte?.triggerRepaint();
    },

    render(_gl, options) {
      if (!renderer || !karte) return;

      // Größe so wählen, dass die Modelle auf dem Schirm gleich groß bleiben.
      const zoom = karte.getZoom();
      const breite = 40075016.686 * Math.cos((karte.getCenter().lat * Math.PI) / 180);
      const meterProPixel = breite / (512 * 2 ** zoom);
      const zielMeter = HOEHE_PX * meterProPixel;

      // Die Geländehöhe wird je Bild gelesen, nicht zwischengespeichert: sobald
      // neue DEM-Kacheln ankommen, zeichnet MapLibre ohnehin neu, und die
      // Modelle sitzen sofort richtig. Ein Nachziehen per 'idle' würde einen
      // Dauer-Repaint auslösen (idle → triggerRepaint → idle → …).
      for (const { punkt, gruppe, meterEinheit } of eintraege) {
        const mc = maplibregl.MercatorCoordinate.fromLngLat(punkt.lngLat, hoeheLesen(punkt.lngLat));
        const s = meterEinheit * zielMeter * (punkt.aktiv ? 1 : 0.6);
        gruppe.position.set(mc.x, mc.y, mc.z);
        gruppe.scale.set(s, s, s);
        for (const kind of gruppe.children) {
          const m = (kind as THREE.Mesh).material as THREE.MeshLambertMaterial;
          m.opacity = punkt.aktiv ? 1 : 0.55;
        }
      }

      kamera.projectionMatrix = new THREE.Matrix4().fromArray(
        options.defaultProjectionData.mainMatrix,
      );
      renderer.resetState();
      renderer.render(szene, kamera);
    },
  };
}
