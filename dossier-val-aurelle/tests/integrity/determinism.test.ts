import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateWorld } from '../../src/scenario/generator';
import { worldFingerprint } from '../../src/scenario/fingerprint';

describe('determinism', () => {
  it('two generations produce the same world', () => {
    const a = createHash('sha256').update(JSON.stringify(generateWorld().world)).digest('hex');
    const b = createHash('sha256').update(JSON.stringify(generateWorld().world)).digest('hex');
    expect(a).toBe(b);
  });
  it('the generated world matches scenario.lock.json (run « npm run generate -- --update-lock » after an intended change)', () => {
    const lock = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../scenario.lock.json'), 'utf8'));
    const r = generateWorld();
    expect(worldFingerprint(r)).toEqual(lock.fingerprint);
  });
});
