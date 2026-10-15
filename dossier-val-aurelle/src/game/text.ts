/**
 * Text folding shared by every search of the game (GED, FEC, general ledger,
 * balance, command palette): case-, accent- and ligature-insensitive, so that
 * a word typed without accents or ligatures (« oeuvre ») finds the label that
 * has them (« maîtrise d’œuvre »). Apostrophes read as spaces. Pure, no React.
 */

/** Ligatures expanded by the folding (no Unicode normalisation decomposes them). */
const LIGATURES: Readonly<Record<string, string>> = { œ: 'oe', Œ: 'oe', æ: 'ae', Æ: 'ae' };
const LIGATURE_CHARS = new RegExp(`[${Object.keys(LIGATURES).join('')}]`, 'g');
const COMBINING_MARKS = /[̀-ͯ]/g;
const APOSTROPHES = /['’]/g;

/** Lower case, without accents, ligatures expanded (œ → oe, æ → ae), apostrophes as spaces. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(LIGATURE_CHARS, (ch) => LIGATURES[ch] ?? ch)
    .replace(APOSTROPHES, ' ')
    .toLowerCase();
}

export interface FoldedText {
  /** `fold(raw)`. */
  text: string;
  /** `map[i]` is the position in the raw text of the character `text[i]` comes from. */
  map: number[];
}

/** Folds a text for searching, keeping the positions in the raw text (snippets, highlighting). */
export function foldText(raw: string): FoldedText {
  let text = '';
  const map: number[] = [];
  let pos = 0;
  for (const ch of raw) {
    // ASCII fast path; any other character goes through `fold`, so that both agree.
    const f = ch.charCodeAt(0) < 128 ? (ch === "'" ? ' ' : ch.toLowerCase()) : fold(ch);
    for (let k = 0; k < f.length; k++) map.push(pos);
    text += f;
    pos += ch.length;
  }
  return { text, map };
}
