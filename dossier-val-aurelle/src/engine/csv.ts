/** Minimal CSV reader/writer (semicolon by default, quoted fields, CRLF tolerant). */
export function parseCsv(text: string, separator = ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === separator) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

export function toCsv(rows: readonly (readonly (string | number)[])[], separator = ';'): string {
  const esc = (v: string | number): string => {
    const s = String(v);
    return /[";\n\r]/.test(s) || s.includes(separator) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(separator)).join('\r\n') + '\r\n';
}

/** Parses a CSV with a header row into objects keyed by header names. */
export function parseCsvObjects(text: string, separator = ';'): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text, separator);
  if (!header) return [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}
