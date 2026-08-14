import { z } from 'zod';
import { PosSchema } from '../schema';

/** Die zwei Fragen, die die Karte stellen kann. Mehr gibt es nicht. */
export const FrageSchema = z.discriminatedUnion('art', [
  z.object({
    art: z.literal('ort'),
    pos: PosSchema,
    tagDatum: z.string(),
  }),
  z.object({
    art: z.literal('stopp'),
    stoppId: z.string(),
    tagDatum: z.string(),
  }),
]);
export type Frage = z.infer<typeof FrageSchema>;

export type SseEreignis =
  | { typ: 'start'; modus: 'mock' | 'live'; modell: string }
  | { typ: 'delta'; text: string }
  | { typ: 'quelle'; titel: string; url: string }
  | { typ: 'ende'; zeichen: number; dauerMs: number }
  | { typ: 'fehler'; text: string };

export interface LlmAdapter {
  readonly modus: 'mock' | 'live';
  readonly modell: string;
  /** Liefert Textstücke; Quellen kommen als separates Ereignis. */
  antworte(
    system: string,
    nutzer: string,
    signal: AbortSignal,
  ): AsyncGenerator<{ text?: string; quelle?: { titel: string; url: string } }>;
}
