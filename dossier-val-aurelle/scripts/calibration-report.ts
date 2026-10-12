/**
 * Solves the global calibration levers (params/levers.json) and prints the
 * calibration report: target / obtained / tolerance for the clean accounts.
 * Usage: npm run calibrate            (report only)
 *        npm run calibrate -- --solve (solve and write params/levers.json)
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { closingBalances, sumPrefixes } from '../src/engine/balance';
import { generateWorld, storedLevers } from '../src/scenario/generator';
import type { Levers } from '../src/scenario/generator/core';
import { loadParams } from '../src/scenario/params';
import { calibrationRows, presentedRows, type CalibrationRow } from '../src/scenario/calibration';
import { buildCorrectionKey } from '../src/scenario/anomalies/presented';

const params = loadParams();
const solve = process.argv.includes('--solve');

function measure(levers: Levers) {
  const r = generateWorld(params, levers);
  const b25 = closingBalances(r.world.ledgers.current);
  const b24 = closingBalances(r.world.ledgers.prior);
  const f25 = r.figures.y2025;
  const f24 = r.figures.y2024;
  const cash = sumPrefixes(b25, ['512']);
  const subsidies = -sumPrefixes(b25, ['13']);
  const dq25 = sumPrefixes(b25, ['68111']) + sumPrefixes(b25, ['777']);
  const dq24 = sumPrefixes(b24, ['68111']) + sumPrefixes(b24, ['777']);
  return { r, f25, f24, cash, subsidies, dq25, dq24 };
}

let levers: Levers = storedLevers();
if (solve) levers = { ...levers, loanExtensionYears: -1 };
if (solve) {
  for (let iter = 0; iter < 12; iter++) {
    const m = measure(levers);
    const caf25t = 0.026 * m.f25.denominator + m.f25.loanRepayments;
    const caf24t = 0.026 * m.f24.denominator + m.f24.loanRepayments;
    const res25t = 4_833_000_00;
    const res24t = 5_400_000_00;
    const subsT = 97_500_000_00;
    const cashT = 28_000_000_00;
    const dCaf25 = m.f25.caf - caf25t;
    const dCaf24 = m.f24.caf - caf24t;
    const res25After = m.f25.netResult - dCaf25;
    const scaleFactor = 1 + (res25After - res25t) / m.dq25;
    const res24After = m.f24.netResult - dCaf24 - (scaleFactor - 1) * m.dq24;
    const next: Levers = {
      maintenance2025Euros: Math.round(levers.maintenance2025Euros + dCaf25 / 100),
      maintenance2024Euros: Math.round(levers.maintenance2024Euros + dCaf24 / 100),
      constructionCostScale: levers.constructionCostScale * scaleFactor,
      pgeDotation2024Euros: Math.round(levers.pgeDotation2024Euros + (res24After - res24t) / 100),
      subsidyScale: levers.subsidyScale * (subsT / m.subsidies),
      openingCashEuros: Math.round(levers.openingCashEuros + (cashT - m.cash) / 100),
      loanExtensionYears: m.r.state.metrics['loanExtensionYears'] ?? -1,
    };
    const err = Math.abs(dCaf25) + Math.abs(dCaf24) + Math.abs(m.f25.netResult - res25t) + Math.abs(m.f24.netResult - res24t) + Math.abs(m.cash - cashT) + Math.abs(m.subsidies - subsT) / 10;
    console.log(`iteration ${iter + 1}: écart cumulé ${(err / 100).toFixed(0)} €`, next);
    levers = next;
    if (err < 2_000_00) break;
  }
  const out = { _comment: 'Leviers de calibrage résolus par « npm run calibrate -- --solve » (ne pas modifier à la main).', ...levers };
  writeFileSync(resolve(import.meta.dirname, '../src/scenario/params/levers.json'), JSON.stringify(out, null, 2) + '\n');
}

const final = measure(levers);
const rows: CalibrationRow[] = [...calibrationRows(final.r, params), ...presentedRows(buildCorrectionKey(final.r.world, params), params)];
const pad = (s: string, n: number) => s.padEnd(n);
console.log('\nRapport de calibrage (comptes propres, puis comptes présentés)\n');
console.log(pad('Exercice', 15) + pad('Agrégat', 52) + pad('Cible', 22) + pad('Obtenu', 18) + 'Statut');
for (const row of rows) console.log(pad(String(row.year), 15) + pad(row.label, 52) + pad(row.targetText, 22) + pad(row.valueText, 18) + (row.ok ? 'OK' : 'HORS TOLÉRANCE'));
const failures = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failures.length}/${rows.length} cibles atteintes.`);
if (failures.length && !solve) process.exitCode = 1;
