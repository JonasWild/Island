import { adapter, FrageSchema, type SseEreignis } from '@/lib/llm';
import { nutzerPrompt, SYSTEM_PROMPT } from '@/lib/llm/prompt';
import { ipAus, pruefeLimit } from '@/lib/rateLimit';

// LangChain läuft nicht zuverlässig auf Edge — Node-Runtime ist die
// bewusste Entscheidung gegen den schnelleren Kaltstart.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ZEICHEN = Number(process.env.LLM_MAX_ZEICHEN ?? 4000);

function sse(ereignis: SseEreignis): string {
  return `data: ${JSON.stringify(ereignis)}\n\n`;
}

export async function POST(req: Request): Promise<Response> {
  const ip = ipAus(req.headers);
  const limit = pruefeLimit(ip);
  if (!limit.erlaubt) {
    return Response.json(
      { fehler: `Zu viele Anfragen. Neuer Versuch in ${limit.resetSek} s.` },
      { status: 429, headers: { 'Retry-After': String(limit.resetSek) } },
    );
  }

  const roh = await req.json().catch(() => null);
  const geparst = FrageSchema.safeParse(roh);
  if (!geparst.success) {
    return Response.json(
      { fehler: 'Ungültige Anfrage', details: geparst.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const frage = geparst.data;
  const llm = await adapter();
  const nutzer = nutzerPrompt(frage);
  const start = Date.now();
  const abbruch = new AbortController();
  req.signal.addEventListener('abort', () => abbruch.abort());

  const encoder = new TextEncoder();
  let zeichen = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const senden = (e: SseEreignis) => controller.enqueue(encoder.encode(sse(e)));
      senden({ typ: 'start', modus: llm.modus, modell: llm.modell });
      try {
        for await (const stueck of llm.antworte(SYSTEM_PROMPT, nutzer, abbruch.signal)) {
          if (stueck.quelle) senden({ typ: 'quelle', ...{ ...stueck.quelle } });
          if (stueck.text) {
            zeichen += stueck.text.length;
            if (zeichen > MAX_ZEICHEN) {
              senden({ typ: 'delta', text: ' …[gekürzt]' });
              break;
            }
            senden({ typ: 'delta', text: stueck.text });
          }
        }
      } catch (err) {
        senden({ typ: 'fehler', text: (err as Error).message });
      } finally {
        const dauerMs = Date.now() - start;
        senden({ typ: 'ende', zeichen, dauerMs });
        // Kosten pro Anfrage grob mitschreiben — Zeichen statt Token, aber
        // genug, um Ausreißer im Vercel-Log zu sehen.
        console.log(
          `[ask] ${llm.modus} ${llm.modell} art=${frage.art} tag=${frage.tagDatum} zeichen=${zeichen} ms=${dauerMs} ip=${ip} rest=${limit.verbleibend}`,
        );
        controller.close();
      }
    },
    cancel() {
      abbruch.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-LLM-Modus': llm.modus,
    },
  });
}
