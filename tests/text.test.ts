import { describe, expect, it } from 'vitest';
import { kuerzeAufSaetze } from '@/lib/text';
import { alleStopps } from '@/lib/reise';

describe('kuerzeAufSaetze', () => {
  it('lässt kurze Texte unangetastet', () => {
    const t = 'Ortschaft des Dichters Snorri Sturluson.';
    expect(kuerzeAufSaetze(t)).toBe(t);
  });

  it('schneidet nie mitten im Satz', () => {
    const t =
      'Einer der größten und ältesten Fischerorte Islands. Alter Leuchtturm mit Ausstellungen, Konzerten und Ausblick bis Reykjavík; Meeresschwimmen am Sandstrand Langisandur. Öffnungszeiten prüfen.';
    const k = kuerzeAufSaetze(t, 60);
    expect(k).toBe('Einer der größten und ältesten Fischerorte Islands. …');
  });

  it('nimmt den ersten Satz ganz, auch wenn er zu lang ist', () => {
    const t =
      'Ergiebigste Heißwasserquelle der Welt: ca. 180 Liter heißes Wasser pro Sekunde, per Rohrleitung bis Borgarnes, Hvanneyri und Akranes zur Gebäudeheizung. Kurzer Halt.';
    const k = kuerzeAufSaetze(t, 60);
    expect(k.startsWith('Ergiebigste')).toBe(true);
    expect(k.endsWith('Gebäudeheizung. …')).toBe(true);
  });

  it('zerlegt Abkürzungen und Ordnungszahlen nicht in Sätze', () => {
    expect(kuerzeAufSaetze('Im 17. Jh. Opfer algerischer Piraten. Danach Ruhe.', 30)).toBe(
      'Im 17. Jh. Opfer algerischer Piraten. …',
    );
  });

  it('kommt mit leerem Text zurecht', () => {
    expect(kuerzeAufSaetze('')).toBe('');
    expect(kuerzeAufSaetze('   ')).toBe('');
  });

  it('endet für jeden der 128 Stopps auf einem ganzen Satz', () => {
    for (const { stopp } of alleStopps) {
      const k = kuerzeAufSaetze(stopp.text);
      expect(k.length, stopp.name).toBeGreaterThan(0);
      // Entweder der ganze Text oder ein Ergebnis, das auf Satzzeichen endet.
      const ende = k.replace(/ …$/, '').trim().slice(-1);
      expect(['.', '!', '?', ':', ';'], `${stopp.name}: ${k}`).toContain(ende);
      expect(stopp.text.replace(/\s+/g, ' ').startsWith(k.replace(/ …$/, ''))).toBe(true);
    }
  });
});
