/** Project rules enforced by tests: layering and no hand-typed amounts in the UI and documents. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../src');

function files(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
    });
  } catch {
    return [];
  }
}

describe('layering', () => {
  it('the engine imports neither the scenario, the game nor the UI', () => {
    for (const f of files(join(SRC, 'engine'))) expect(readFileSync(f, 'utf8'), f).not.toMatch(/from '\.\.\/(\.\.\/)?(scenario|game|ui)\//);
  });
  it('the scenario does not import the game or the UI', () => {
    for (const f of files(join(SRC, 'scenario'))) expect(readFileSync(f, 'utf8'), f).not.toMatch(/from '\.\.\/(\.\.\/)?(game|ui)\//);
  });
  it('the game rules do not import the UI or React', () => {
    for (const f of files(join(SRC, 'game'))) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(/from '\.\.\/(\.\.\/)?ui\//);
      expect(text, f).not.toMatch(/from 'react/);
    }
  });
});

describe('no hand-typed amounts', () => {
  const amount = /\d{1,3}(?:[   ]\d{3})+(?:,\d{2})?\s?(?:€|k€|M€)|\d+,\d{2}\s?€/;
  it('UI components and document templates contain no literal amount', () => {
    for (const f of [...files(join(SRC, 'ui')), ...files(join(SRC, 'scenario/documents'))]) {
      const text = readFileSync(f, 'utf8');
      expect(text.match(amount)?.[0] ?? null, f).toBeNull();
      expect(text, f).not.toMatch(/eurosToCents\(|eur\(/);
    }
  });
});
