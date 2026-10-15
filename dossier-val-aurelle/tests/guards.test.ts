/** Project rules enforced by tests: layering and no hand-typed amounts in the UI and documents. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
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

/** Layer (first directory under src/) of every relative import or re-export of a file, whatever its depth. */
function importedLayers(file: string, text: string): string[] {
  const specifiers = [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)].map((m) => m[1]!);
  return specifiers
    .filter((s) => s.startsWith('.'))
    .map((s) => relative(SRC, resolve(dirname(file), s)).split(sep)[0]!)
    .filter((layer) => !layer.startsWith('..'));
}

const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  engine: ['engine'],
  scenario: ['engine', 'scenario'],
  game: ['engine', 'scenario', 'game'],
};

describe('layering', () => {
  it('resolves imports at any depth', () => {
    const f = join(SRC, 'scenario/anomalies/modules/example.ts');
    expect(importedLayers(f, "import { x } from '../../../game/state';\nexport { y } from '../../../ui/app/store';\nimport '../../../engine/money';")).toEqual(['game', 'ui', 'engine']);
  });
  for (const [layer, allowed] of Object.entries(ALLOWED)) {
    it(`${layer} only imports ${allowed.join(', ')}`, () => {
      for (const f of files(join(SRC, layer))) {
        const text = readFileSync(f, 'utf8');
        for (const imported of importedLayers(f, text)) expect(allowed, `${f} imports ${imported}`).toContain(imported);
      }
    });
  }
  it('the engine, the scenario and the game rules do not import React', () => {
    for (const layer of Object.keys(ALLOWED)) for (const f of files(join(SRC, layer))) expect(readFileSync(f, 'utf8'), f).not.toMatch(/from 'react/);
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
