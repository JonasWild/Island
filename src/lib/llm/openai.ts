import { ChatOpenAI } from '@langchain/openai';
import type { AIMessage, AIMessageChunk } from '@langchain/core/messages';
import type { LlmAdapter } from './types';

/**
 * Echter Adapter. Zwei Pfade, weil Streaming + `web_search` in LangChain JS
 * unzuverlässig ist (langchainjs#8283):
 *
 *   web_search AUS → echtes Token-Streaming über .stream()
 *   web_search AN  → .invoke() ohne Stream, Antwort wird hier nachgestreamt
 *
 * Der Client merkt keinen Unterschied: beide Pfade liefern dieselben
 * SSE-Ereignisse. Schlägt der Suchpfad fehl, wird ohne Suche wiederholt.
 */

const MODELL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
const WEB_SEARCH = process.env.LLM_WEB_SEARCH !== '0';
const MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS ?? 700);

type Quelle = { titel: string; url: string };

type Annotation = {
  type?: string;
  url?: string;
  title?: string;
  url_citation?: { url?: string; title?: string };
};

/** Quellen kommen je nach Modell/Version an unterschiedlichen Stellen an. */
function quellenAusNachricht(msg: AIMessage | AIMessageChunk): Quelle[] {
  const roh: Annotation[] = [];
  const inhalt = msg.content;
  if (Array.isArray(inhalt)) {
    for (const block of inhalt) {
      const ann = (block as { annotations?: Annotation[] }).annotations;
      if (Array.isArray(ann)) roh.push(...ann);
    }
  }
  const meta = msg.response_metadata as { annotations?: Annotation[] } | undefined;
  if (Array.isArray(meta?.annotations)) roh.push(...meta.annotations);

  const gesehen = new Set<string>();
  const out: Quelle[] = [];
  for (const a of roh) {
    const url = a.url ?? a.url_citation?.url;
    if (!url || gesehen.has(url)) continue;
    gesehen.add(url);
    out.push({ url, titel: a.title ?? a.url_citation?.title ?? new URL(url).hostname });
  }
  return out;
}

function textAus(inhalt: AIMessage['content']): string {
  if (typeof inhalt === 'string') return inhalt;
  return inhalt
    .map((b) => (typeof b === 'string' ? b : ((b as { text?: string }).text ?? '')))
    .join('');
}

function modell(mitSuche: boolean) {
  const llm = new ChatOpenAI({
    model: MODELL,
    temperature: 0.2,
    maxTokens: MAX_TOKENS,
    // Responses-API ist Voraussetzung für das eingebaute web_search-Tool.
    useResponsesApi: mitSuche,
  });
  return mitSuche ? llm.bindTools([{ type: 'web_search' }]) : llm;
}

const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const openaiAdapter: LlmAdapter = {
  modus: 'live',
  modell: MODELL,
  async *antworte(system, nutzer, signal) {
    const nachrichten = [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: nutzer },
    ];

    if (WEB_SEARCH) {
      try {
        const antwort = (await modell(true).invoke(nachrichten, { signal })) as AIMessage;
        const text = textAus(antwort.content);
        // Nachstreamen, damit die UI denselben Verlauf sieht wie im Stream-Pfad.
        for (const stueck of text.match(/\S+\s*/g) ?? []) {
          if (signal.aborted) return;
          yield { text: stueck };
          await schlaf(8);
        }
        for (const q of quellenAusNachricht(antwort)) yield { quelle: q };
        return;
      } catch (err) {
        if (signal.aborted) return;
        console.warn('[ask] web_search fehlgeschlagen, ohne Suche erneut:', (err as Error).message);
      }
    }

    const stream = await modell(false).stream(nachrichten, { signal });
    let letzter: AIMessageChunk | null = null;
    for await (const chunk of stream) {
      if (signal.aborted) return;
      letzter = letzter ? letzter.concat(chunk) : chunk;
      const text = textAus(chunk.content);
      if (text) yield { text };
    }
    if (letzter) for (const q of quellenAusNachricht(letzter)) yield { quelle: q };
  },
};
