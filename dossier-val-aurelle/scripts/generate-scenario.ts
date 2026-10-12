/**
 * Generates the clean world of the case and writes inspection files to
 * generated/val-aurelle-2025/ (not versioned). The fingerprint is compared to
 * scenario.lock.json (versioned); « --update-lock » records an intended change.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { trialBalance } from '../src/engine/balance';
import { toCsv } from '../src/engine/csv';
import { buildFec, fecToText } from '../src/engine/fec';
import { formatFecAmount } from '../src/engine/format';
import { worldFingerprint } from '../src/scenario/fingerprint';
import { generateWorld } from '../src/scenario/generator';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'generated/val-aurelle-2025');
mkdirSync(out, { recursive: true });
const t0 = Date.now();
const r = generateWorld();
const fp = worldFingerprint(r);
const w = r.world;
writeFileSync(resolve(out, 'world.json'), JSON.stringify(w));
for (const [key, ledger] of Object.entries(w.ledgers)) {
  const year = ledger.fiscalYear;
  writeFileSync(resolve(out, `fec-${year}.txt`), fecToText(buildFec(ledger, w.chart, w.journals, w.auxiliaries)));
  const tb = trialBalance(ledger, w.chart);
  writeFileSync(
    resolve(out, `balance-${year}.csv`),
    '﻿' + toCsv([['Compte', 'Libellé', 'Solde ouverture', 'Débit', 'Crédit', 'Solde clôture'], ...tb.rows.map((x) => [x.account, x.label, formatFecAmount(x.opening), formatFecAmount(x.debit), formatFecAmount(x.credit), formatFecAmount(x.closing)])]),
  );
  void key;
}
writeFileSync(resolve(out, 'fingerprint.json'), JSON.stringify(fp, null, 2));
const lockPath = resolve(root, 'scenario.lock.json');
if (process.argv.includes('--update-lock') || !existsSync(lockPath)) {
  writeFileSync(lockPath, JSON.stringify({ _comment: 'Empreinte du monde généré. Mettre à jour par « npm run generate -- --update-lock » après une modification voulue.', fingerprint: fp }, null, 2) + '\n');
  console.log('scenario.lock.json mis à jour');
} else {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  if (lock.fingerprint.hash !== fp.hash) console.warn(`⚠ Le monde généré diffère de scenario.lock.json (${lock.fingerprint.hash} → ${fp.hash}). Lancer « npm run generate -- --update-lock » si la modification est voulue.`);
}
console.log(`Monde généré en ${Date.now() - t0} ms – empreinte ${fp.hash} – ${fp.lines.current} lignes de FEC 2025 → ${out}`);
