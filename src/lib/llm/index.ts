import type { LlmAdapter } from './types';
import { mockAdapter } from './mock';

export type { LlmAdapter, Frage, SseEreignis } from './types';
export { FrageSchema } from './types';

/**
 * LLM_MODE=mock (Standard) hält den echten Anbieter komplett aus dem Build.
 * Der Import des OpenAI-Adapters ist deshalb dynamisch — ohne Schlüssel wird
 * @langchain/openai nie geladen.
 */
export async function adapter(): Promise<LlmAdapter> {
  const modus = process.env.LLM_MODE ?? 'mock';
  if (modus !== 'live') return mockAdapter;
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[ask] LLM_MODE=live, aber OPENAI_API_KEY fehlt — nutze Mock.');
    return mockAdapter;
  }
  const { openaiAdapter } = await import('./openai');
  return openaiAdapter;
}
