/**
 * pnpm validate — läuft vor jedem Build. Bricht ab, wenn reise.json nicht
 * zum Schema passt, und meldet, wie viele Positionen belegt sind.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReiseSchema } from '../src/lib/schema';

const P = resolve(import.meta.dirname, '../data/reise.json');
const ergebnis = ReiseSchema.safeParse(JSON.parse(readFileSync(P, 'utf8')));

if (!ergebnis.success) {
  console.error('reise.json ist ungültig:\n');
  for (const issue of ergebnis.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const reise = ergebnis.data;
const stopps = reise.tage.flatMap((t) => t.highlights);
const belegt = stopps.filter((s) => s.pos && s.posMeta).length;
const punkt = stopps.filter((s) => s.posMeta?.genauigkeit === 'punkt').length;
const ohnePos = stopps.filter((s) => !s.pos).map((s) => s.name);

console.log(
  `reise.json ok — ${reise.tage.length} Tage, ${reise.unterkuenfte.length} Unterkünfte, ${stopps.length} Stopps.`,
);
console.log(`  ${belegt} belegt (${punkt} punktgenau, ${belegt - punkt} Bereich)`);
if (ohnePos.length > 0) console.log(`  ohne Position: ${ohnePos.join(', ')}`);
