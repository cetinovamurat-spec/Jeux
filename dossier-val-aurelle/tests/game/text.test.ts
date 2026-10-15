/** Shared text folding (src/game/text.ts): one folding for the GED, the FEC, the general ledger and the balance. */
import { describe, expect, it } from 'vitest';
import { fold, foldText } from '../../src/game/text';
import { foldText as documentsFoldText } from '../../src/game/documents';
import { normalize } from '../../src/game/fec-query';

describe('fold', () => {
  it('ignores case and accents and reads apostrophes as spaces', () => {
    expect(fold('Régul’été')).toBe('regul ete');
    expect(fold("L'ÉCHÉANCE à Noël")).toBe('l echeance a noel');
  });
  it('expands the ligatures (œ → oe, æ → ae), in either case', () => {
    expect(fold('Maîtrise d’Œuvre')).toBe('maitrise d oeuvre');
    expect(fold('gros œuvre, cœur, Æquo, ex æquo')).toBe('gros oeuvre, coeur, aequo, ex aequo');
  });
  it('keeps digits and punctuation', () => {
    expect(fold('REM-12 n° 7 : 1 234,50')).toBe('rem-12 n° 7 : 1 234,50');
  });
});

describe('foldText', () => {
  const samples = ['Maîtrise d’Œuvre', 'Honoraires de maîtrise d’œuvre – Atelier Lumen', "Créances d'ÉTÉ, ex æquo", 'Ça coûte 1 234,56 € (n° 7)', 'Recouvrement'];
  it('gives the same text as fold, with one raw position per folded character', () => {
    for (const raw of samples) {
      const f = foldText(raw);
      expect(f.text, raw).toBe(fold(raw));
      expect(f.map, raw).toHaveLength(f.text.length);
    }
  });
  it('maps both letters of an expanded ligature to the ligature', () => {
    const raw = 'd’Œuvre';
    const f = foldText(raw);
    const p = f.text.indexOf('oe');
    expect(f.map[p]).toBe(raw.indexOf('Œ'));
    expect(f.map[p + 1]).toBe(raw.indexOf('Œ'));
  });
  it('is the folding of the GED and of the FEC and ledger searches', () => {
    expect(documentsFoldText).toBe(foldText);
    for (const raw of samples) expect(normalize(raw), raw).toBe(fold(raw));
  });
});
