/** Every part alone and every pair of anomalies give a consistent world (negotiation: any subset may stay uncorrected). */
import { describe, expect, it } from 'vitest';
import { checkLedger } from '../../src/engine/ledger';
import { ANOMALIES, PART_KEYS } from '../../src/scenario/anomalies/modules';
import { buildState, stateFigures } from '../../src/scenario/anomalies/presented';
import { correctionKey } from '../helpers/scenario';
import { params, world } from '../helpers/world';

function consistent(keys: readonly string[]): string[] {
  const s = buildState(world().world, params(), keys);
  const problems = checkLedger(s.world.ledgers.current);
  const f = stateFigures(s.world, params());
  if (f.statements.checks.assetsTotal !== f.statements.checks.liabilitiesTotal) problems.push('bilan déséquilibré');
  if (f.statements.checks.incomeStatementResult !== f.statements.checks.balanceSheetResult) problems.push('résultat incohérent');
  return problems;
}

describe('composability', () => {
  it('each part alone', () => {
    for (const k of PART_KEYS) expect(consistent([k]), k).toEqual([]);
  });
  it('every pair of anomalies', () => {
    const parts = (id: string) => ANOMALIES.find((m) => m.id === id)!.parts.map((p) => p.id);
    for (let i = 0; i < ANOMALIES.length; i++) {
      for (let j = i + 1; j < ANOMALIES.length; j++) {
        const keys = [...parts(ANOMALIES[i]!.id), ...parts(ANOMALIES[j]!.id)];
        expect(consistent(keys), keys.join('+')).toEqual([]);
      }
    }
  });
  it('only expected overlaps between patches (A01 and A16 on the additional works of Les Tilleuls)', () => {
    const overlaps = [...correctionKey().presented.touched.entries()].filter(([, ids]) => ids.length > 1).map(([, ids]) => ids.join('+'));
    expect(overlaps.every((x) => x === 'A01+A16')).toBe(true);
  });
});
