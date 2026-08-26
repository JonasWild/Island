/**
 * pnpm validate — läuft vor jedem Build. Bricht ab, wenn reise.json oder
 * route.json nicht zum Schema passen, und meldet den Datenstand.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReiseSchema, RouteSchema } from '../src/lib/schema';

const P = resolve(import.meta.dirname, '../data/reise.json');
const P_ROUTE = resolve(import.meta.dirname, '../data/route.json');
const ergebnis = ReiseSchema.safeParse(JSON.parse(readFileSync(P, 'utf8')));

if (!ergebnis.success) {
  console.error('reise.json ist ungültig:\n');
  for (const issue of ergebnis.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const routeErgebnis = RouteSchema.safeParse(JSON.parse(readFileSync(P_ROUTE, 'utf8')));
if (!routeErgebnis.success) {
  console.error('route.json ist ungültig:\n');
  for (const issue of routeErgebnis.error.issues) {
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

const route = routeErgebnis.data;
const strasse = route.tage.filter((t) => t.art === 'strasse');
console.log(
  `route.json ok — ${strasse.length}/${route.tage.length} Tage über echte Straßen (${route.dienst}, ${route.erzeugtAm}).`,
);
for (const t of route.tage.filter((t) => t.art === 'luftlinie')) {
  console.log(`  Luftlinie ${t.datum}: ${t.grund ?? 'ohne Begründung'}`);
}

// Jeder Reisetag braucht eine Route, sonst zeigt die Karte für ihn nichts.
const fehlend = reise.tage.filter((t) => !route.tage.some((r) => r.datum === t.datum));
if (fehlend.length > 0) {
  console.error(`\nroute.json fehlen Tage: ${fehlend.map((t) => t.datum).join(', ')}`);
  console.error('  `pnpm route` ausführen.');
  process.exit(1);
}
