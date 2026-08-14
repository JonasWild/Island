import { beforeEach, describe, expect, it } from 'vitest';
import { FrageSchema } from '@/lib/llm/types';
import { mockAdapter } from '@/lib/llm/mock';
import { nutzerPrompt, SYSTEM_PROMPT } from '@/lib/llm/prompt';
import { ipAus, limitZuruecksetzen, pruefeLimit } from '@/lib/rateLimit';
import { alleStopps } from '@/lib/reise';

async function sammle(nutzer: string) {
  const ctrl = new AbortController();
  let text = '';
  const quellen: string[] = [];
  for await (const s of mockAdapter.antworte(SYSTEM_PROMPT, nutzer, ctrl.signal)) {
    if (s.text) text += s.text;
    if (s.quelle) quellen.push(s.quelle.url);
  }
  return { text, quellen };
}

describe('Frage-Schema', () => {
  it('nimmt eine Ortsfrage an', () => {
    const r = FrageSchema.safeParse({ art: 'ort', pos: [64.1, -21.9], tagDatum: '2026-08-27' });
    expect(r.success).toBe(true);
  });

  it('weist unbekannte Arten ab', () => {
    expect(FrageSchema.safeParse({ art: 'irgendwas', tagDatum: '2026-08-27' }).success).toBe(false);
  });

  it('weist unmögliche Koordinaten ab', () => {
    expect(
      FrageSchema.safeParse({ art: 'ort', pos: [999, -21.9], tagDatum: '2026-08-27' }).success,
    ).toBe(false);
  });
});

describe('Prompt', () => {
  it('trägt Reisetag und Etappe in den Ortskontext', () => {
    const p = nutzerPrompt({ art: 'ort', pos: [64.5, -21.2], tagDatum: '2026-08-30' });
    expect(p).toContain('2026-08-30');
    expect(p).toContain('Etappe:');
    expect(p).toContain('Angeklickte Koordinate');
    expect(p).toContain('Nächstgelegene geplante Stopps');
  });

  it('nimmt den Veranstaltertext eines Stopps mit', () => {
    const ref = alleStopps.find((s) => s.stopp.name === 'Goðafoss')!;
    const p = nutzerPrompt({ art: 'stopp', stoppId: ref.id, tagDatum: ref.datum });
    expect(p).toContain('Goðafoss');
    expect(p).toContain('Text des Veranstalters');
  });

  it('verbietet dem Modell erfundene Sicherheitsaussagen', () => {
    expect(SYSTEM_PROMPT).toContain('safetravel.is');
    expect(SYSTEM_PROMPT).toContain('unsicher');
  });
});

describe('Mock-Adapter', () => {
  it('unterscheidet Orts- von Stoppfragen', async () => {
    const ref = alleStopps.find((s) => s.stopp.name === 'Goðafoss')!;
    const ort = await sammle(nutzerPrompt({ art: 'ort', pos: [64.5, -21.2], tagDatum: '2026-08-30' }));
    const stopp = await sammle(nutzerPrompt({ art: 'stopp', stoppId: ref.id, tagDatum: ref.datum }));
    expect(ort.text).not.toBe(stopp.text);
  });

  it('streamt deterministisch', async () => {
    const nutzer = nutzerPrompt({ art: 'ort', pos: [64.5, -21.2], tagDatum: '2026-08-30' });
    const a = await sammle(nutzer);
    const b = await sammle(nutzer);
    expect(a.text).toBe(b.text);
    expect(a.text.length).toBeGreaterThan(100);
    expect(a.quellen.length).toBeGreaterThan(0);
  });

  it('bricht bei Abbruch ab', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const stuecke: string[] = [];
    for await (const s of mockAdapter.antworte('sys', 'Angeklickte Koordinate', ctrl.signal)) {
      if (s.text) stuecke.push(s.text);
    }
    expect(stuecke).toHaveLength(0);
  });
});

describe('Rate Limit', () => {
  beforeEach(() => limitZuruecksetzen());

  it('lässt bis zum Limit durch und sperrt dann', () => {
    const ip = '203.0.113.7';
    for (let i = 0; i < 10; i++) expect(pruefeLimit(ip, 1000).erlaubt).toBe(true);
    const gesperrt = pruefeLimit(ip, 1000);
    expect(gesperrt.erlaubt).toBe(false);
    expect(gesperrt.resetSek).toBeGreaterThan(0);
  });

  it('öffnet nach dem Fenster wieder', () => {
    const ip = '203.0.113.8';
    for (let i = 0; i < 11; i++) pruefeLimit(ip, 1000);
    expect(pruefeLimit(ip, 1000).erlaubt).toBe(false);
    expect(pruefeLimit(ip, 62_000).erlaubt).toBe(true);
  });

  it('trennt IPs', () => {
    for (let i = 0; i < 11; i++) pruefeLimit('198.51.100.1', 1000);
    expect(pruefeLimit('198.51.100.2', 1000).erlaubt).toBe(true);
  });

  it('liest die erste IP aus x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.9, 70.41.3.18' });
    expect(ipAus(h)).toBe('203.0.113.9');
    expect(ipAus(new Headers())).toBe('unbekannt');
  });
});
