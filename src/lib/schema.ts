import { z } from 'zod';

/**
 * Schema für data/reise.json — Single Source of Truth.
 * Wird beim Build validiert (`pnpm validate`) und beim Laden im Server.
 */

/** [lat, lon] — Reihenfolge wie in den Reiseunterlagen, NICHT GeoJSON. */
export const PosSchema = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);
export type Pos = z.infer<typeof PosSchema>;

export const PosQuelleSchema = z.enum([
  'osm',
  'wikidata',
  'anbieter',
  /** Von Hand aus den Reiseunterlagen gesetzt und dort belassen, weil OSM sie nicht bestätigt. */
  'reiseplan',
  'manuell',
]);
export const PosGenauigkeitSchema = z.enum(['punkt', 'bereich']);

/**
 * Herkunftsnachweis einer Koordinate. Ohne posMeta gilt eine Position als
 * unbelegt — die UI zeichnet sie dann als Lücke, nicht als Fakt.
 */
export const PosMetaSchema = z.object({
  quelle: PosQuelleSchema,
  genauigkeit: PosGenauigkeitSchema,
  geprueftAm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ISO-Datum erwartet'),
  ref: z.string().optional(),
  hinweis: z.string().optional(),
});
export type PosMeta = z.infer<typeof PosMetaSchema>;

export const WanderungSchema = z.object({
  gehzeit: z.string().optional(),
  hoehenmeter: z.string().optional(),
  distanz: z.string().optional(),
});

/**
 * Recherchierter Hintergrundtext zu einem Stopp. Kommt aus der deutschen
 * Wikipedia und trägt seine Herkunft mit: ohne Quelle und Link kein Wissen.
 * Fehlt der Schlüssel, hat die Pipeline keinen eindeutigen Artikel gefunden —
 * dann steht dort nichts, statt etwas Falsches.
 */
export const WissenSchema = z.object({
  text: z.string().min(1),
  quelle: z.string().min(1),
  url: z.string().url(),
  geprueftAm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ISO-Datum erwartet'),
});
export type Wissen = z.infer<typeof WissenSchema>;

export const StoppSchema = z.object({
  name: z.string().min(1),
  strasse: z.string().nullable().optional(),
  text: z.string().min(1),
  link: z.string().url().optional(),
  buchen: z.boolean().optional(),
  buchenText: z.string().optional(),
  wanderung: WanderungSchema.optional(),
  /** Fehlt der Schlüssel ganz, gilt die Position als unbekannt — nicht als 0/0. */
  pos: PosSchema.nullable().default(null),
  posMeta: PosMetaSchema.optional(),
  wissen: WissenSchema.optional(),
});
export type Stopp = z.infer<typeof StoppSchema>;

export const EtappeSchema = z.object({
  von: z.string(),
  nach: z.string(),
  km: z.number().nullable(),
  fahrzeit: z.string().nullable(),
  hinweis: z.string().nullable().optional(),
});
export type Etappe = z.infer<typeof EtappeSchema>;

export const TagTypSchema = z.enum([
  'anreise',
  'standtag',
  'tagesausflug',
  'etappe',
  'abreise',
]);
export type TagTyp = z.infer<typeof TagTypSchema>;

export const TagSchema = z.object({
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wochentag: z.string(),
  titel: z.string(),
  typ: TagTypSchema,
  unterkunft: z.string().nullable(),
  etappe: EtappeSchema.nullable(),
  lang: z.boolean(),
  langHinweis: z.string().optional(),
  highlights: z.array(StoppSchema),
});
export type Tag = z.infer<typeof TagSchema>;

export const UnterkunftSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  ort: z.string(),
  region: z.string(),
  von: z.string(),
  bis: z.string(),
  naechte: z.number().int().positive(),
  typ: z.string(),
  buchungsnummer: z.string(),
  telefon: z.string().nullable().optional(),
  email: z.string().optional(),
  website: z.string().url().optional(),
  verpflegung: z.string(),
  beschreibung: z.string(),
  hinweis: z.string().nullable().optional(),
  pos: PosSchema.nullable().default(null),
  posMeta: PosMetaSchema.optional(),
});
export type Unterkunft = z.infer<typeof UnterkunftSchema>;

export const ReiseKopfSchema = z.object({
  titel: z.string(),
  vorgang: z.string(),
  von: z.string(),
  bis: z.string(),
  veranstalter: z.string(),
  teilnehmer: z.array(z.string()),
  mietwagen: z.object({
    kategorie: z.string(),
    fahrzeug: z.string(),
    vermieter: z.string(),
    uebernahme: z.string(),
    rueckgabe: z.string(),
    inklusive: z.string(),
    hinweise: z.array(z.string()),
  }),
  flughafen: z.object({
    name: z.string(),
    adresse: z.string(),
    telefon: z.string(),
    pos: PosSchema,
    posMeta: PosMetaSchema.optional(),
  }),
  allgemeineHinweise: z.array(z.string()),
  inkludierteLeistungen: z.array(z.object({ name: z.string(), text: z.string() })),
});

export const ReiseSchema = z
  .object({
    reise: ReiseKopfSchema,
    unterkuenfte: z.array(UnterkunftSchema),
    tage: z.array(TagSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const ids = new Set(data.unterkuenfte.map((u) => u.id));
    data.tage.forEach((tag, i) => {
      if (tag.unterkunft !== null && !ids.has(tag.unterkunft)) {
        ctx.addIssue({
          code: 'custom',
          path: ['tage', i, 'unterkunft'],
          message: `Unbekannte Unterkunft-ID "${tag.unterkunft}"`,
        });
      }
    });
    // Tage müssen chronologisch und lückenlos sein — die Zeitachse verlässt sich darauf.
    for (let i = 1; i < data.tage.length; i++) {
      const prev = data.tage[i - 1]!.datum;
      const cur = data.tage[i]!.datum;
      if (cur <= prev) {
        ctx.addIssue({
          code: 'custom',
          path: ['tage', i, 'datum'],
          message: `Datum ${cur} liegt nicht nach ${prev}`,
        });
      }
    }
  });

export type Reise = z.infer<typeof ReiseSchema>;

/** Ein Stopp mit belegter Position — das, was die Karte zeichnen kann. */
export type VerorteterStopp = Stopp & { pos: Pos };

export function istVerortet(s: Stopp): s is VerorteterStopp {
  return s.pos !== null;
}

/**
 * Schema für data/route.json — erzeugt von scripts/route.ts zur Build-Zeit.
 * Zur Laufzeit wird nur noch geladen; es geht keine Anfrage an einen
 * Routing-Dienst.
 */
export const TagRouteSchema = z.object({
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /**
   * 'strasse': über echte Straßen geroutet.
   * 'luftlinie': Routing nicht sauber gelungen — Schematik, keine
   * Fahrempfehlung. Der Grund steht dabei und die Karte zeichnet den Tag
   * gestrichelt. Eine falsche Straßenroute stillschweigend zu zeigen wäre
   * schlimmer.
   */
  art: z.enum(['strasse', 'luftlinie']),
  grund: z.string().optional(),
  km: z.number().nonnegative(),
  fahrzeitMin: z.number().int().nonnegative(),
  /** Die direkte Etappe aus dem Reiseplan — ohne Abstecher. */
  planKm: z.number().nullable(),
  wegpunkte: z.number().int().nonnegative(),
  /** [lon, lat] wie in GeoJSON, nicht wie `pos`. */
  geometrie: z.array(z.tuple([z.number(), z.number()])).min(2),
});
export type TagRoute = z.infer<typeof TagRouteSchema>;

export const RouteSchema = z.object({
  erzeugtAm: z.string(),
  dienst: z.string(),
  hinweis: z.string(),
  tage: z.array(TagRouteSchema),
});
export type Route = z.infer<typeof RouteSchema>;

export const OffenEintragSchema = z.object({
  tag: z.string().nullable(),
  name: z.string(),
  art: z.enum(['stopp', 'unterkunft']),
  hinweis: z.string(),
  kandidaten: z
    .array(z.object({ label: z.string(), pos: PosSchema, quelle: z.string() }))
    .default([]),
});
export const OffenSchema = z.object({
  erzeugtAm: z.string(),
  eintraege: z.array(OffenEintragSchema),
});
export type OffenEintrag = z.infer<typeof OffenEintragSchema>;
