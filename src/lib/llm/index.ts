import type { LlmAdapter } from './types';
import { mockAdapter } from './mock';

export type { LlmAdapter, Frage, SseEreignis } from './types';
export { FrageSchema } from './types';

let gewarnt = false;

/**
 * Kein Modus-Schalter: Ist OPENAI_API_KEY gesetzt, läuft der echte Aufruf.
 * Fehlt er, antwortet der Mock — und zwar deutlich sichtbar, damit niemand
 * Fixtures für eine echte Recherche hält.
 *
 * Der Import des OpenAI-Adapters ist dynamisch, damit @langchain/openai ohne
 * Schlüssel gar nicht erst geladen wird.
 */
export async function adapter(): Promise<LlmAdapter> {
  if (process.env.OPENAI_API_KEY) {
    const { openaiAdapter } = await import('./openai');
    return openaiAdapter;
  }
  if (!gewarnt) {
    gewarnt = true;
    console.warn(
      '\n' +
        '='.repeat(72) +
        '\n  WARNUNG: OPENAI_API_KEY ist nicht gesetzt.' +
        '\n  Alle Antworten kommen aus festen Beispieltexten und sind KEINE' +
        '\n  Recherche. Schlüssel in .env.local oder in der Vercel-Env setzen.\n' +
        '='.repeat(72) +
        '\n',
    );
  }
  return mockAdapter;
}
