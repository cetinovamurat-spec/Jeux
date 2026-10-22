/**
 * Observability of the anomalies (plan J4 §20, annex docs/j4-observabilite.md):
 * for each part, when its evidence can first be observed — documents (date
 * and availability mode: data room, mail after a date, request, confirmation;
 * the conditional ones of J5 are left aside) and accounting data (interim
 * extraction at 31/10/2025, final ledger, draft statements) — and in which
 * phase. Every part must be detectable before the end of the final; A15, an
 * event after the year end, has its decisive evidence (the receiver's letter)
 * before the signature of the report.
 *
 * `PRINT_OBSERVABILITY=1 npx vitest run tests/anomalies/observability.test.ts`
 * prints the table of the annex.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatDateFr, type IsoDate } from '../../src/engine/dates';
import { workCalendar } from '../../src/game/calendar';
import { periodAt } from '../../src/game/clock';
import { answerDate, arrivalDate } from '../../src/game/requests';
import { inExtraction, vintageDates } from '../../src/game/vintages';
import { ANOMALIES } from '../../src/scenario/anomalies/modules';
import type { DocumentModel } from '../../src/scenario/documents/model';
import { correctionKey, documents } from '../helpers/scenario';
import { params } from '../helpers/world';

const P = params();
const key = correctionKey();
const docs = documents();
const cal = workCalendar(P);
const start = P.game.startDate;
const vintages = vintageDates(P);
const finalEnd = P.game.calendar.find((p) => p.id === 'final')!.to;
const signature = P.game.calendar.find((p) => p.id === 'reporting')!.to;

interface Source {
  what: string;
  mode: string;
  on: IsoDate;
}

/** Date a document can first reach the auditor, with its mode (null: conditional, J5). */
function obtainable(d: DocumentModel): Source | null {
  const a = d.availability;
  switch (a.kind) {
    case 'initial':
      return { what: d.id, mode: 'dossier', on: d.date > start ? d.date : start };
    case 'afterDate':
      return { what: d.id, mode: 'courrier', on: a.from };
    case 'confirmation':
      return { what: d.id, mode: 'confirmation', on: a.arrives };
    case 'onRequest': {
      // a request about an entry of the final ledger can only be sent once the ledger is received
      const entryOnly = a.family === 'entry-voucher' && !(a.object ?? '').startsWith('2024:');
      const sentOn = entryOnly ? vintages.draftLedger : start;
      const item = { id: 'x', family: a.family ?? '', object: a.object ?? '', sentOn, difficulty: 'senior' as const };
      // a reply rebuilt on each request is established on the date of the request: it comes with the answer
      const on = a.rebuiltOnRequest ? answerDate(P, cal, item) : arrivalDate(P, cal, item, d.date);
      return { what: d.id, mode: 'demande', on };
    }
    case 'conditional':
      return null;
  }
}

const touched = key.presented.touched;
const entries = new Map(key.presented.world.ledgers.current.entries.map((e) => [e.id, e]));

/** Accounting data in which the anomaly shows: the interim extraction, the final ledger or the draft statements. */
function ledgerSource(anomalyId: string, hasEntry: boolean): Source | null {
  const own = [...touched.entries()].filter(([, a]) => a.includes(anomalyId as never)).flatMap(([id]) => entries.get(id) ?? []);
  if (own.length > 0) return own.every((e) => inExtraction(e, vintages.cutoff) && e.date <= vintages.cutoff) ? { what: 'extraction au 31/10/2025', mode: 'données', on: vintages.interimDelivered } : { what: 'balance et FEC définitifs', mode: 'données', on: vintages.draftLedger };
  if (hasEntry) return { what: 'balance et FEC définitifs', mode: 'données', on: vintages.draftLedger };
  return null;
}

function phaseOf(date: IsoDate): string {
  const p = periodAt(P.game.calendar, date);
  if (p.current) return p.current.id === 'confirmations' ? 'hors site' : p.current.label.split(' (')[0]!.toLowerCase();
  if (date > finalEnd) return 'après le final';
  return 'hors site';
}

interface Row {
  part: string;
  first: Source;
  sources: Source[];
  decisive?: Source;
}

const rows: Row[] = [];
for (const m of ANOMALIES)
  for (const p of m.parts) {
    const correction = key.corrections.find((c) => c.key === p.id)!;
    const ids = new Set<string>();
    for (const d of docs.documents) if (d.clues.some((c) => c.target === m.id && (!c.parts || c.parts.includes(p.id)))) ids.add(d.id);
    for (const o of [...p.signature.objects, ...(p.keyObjects ?? [])]) if (o.kind === 'document') ids.add(o.id);
    const sources = [...ids].map((id) => docs.byId.get(id)).filter((d): d is DocumentModel => !!d).map(obtainable).filter((s): s is Source => s !== null);
    const ledger = ledgerSource(m.id, correction.entry !== null);
    if (ledger) sources.push(ledger);
    sources.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : a.what < b.what ? -1 : 1));
    rows.push({ part: p.id, first: sources[0]!, sources, ...(p.id === 'A15' ? { decisive: sources.find((s) => s.what === 'courrier-mandataire')! } : {}) });
  }

function markdown(): string {
  const lines = ['| Partie | Premier élément observable | Mode | Date | Phase | Autres éléments (date) |', '|---|---|---|---|---|---|'];
  for (const r of rows) {
    const others = r.sources
      .slice(1)
      .map((s) => `${s.what} (${formatDateFr(s.on)})`)
      .join(', ');
    lines.push(`| ${r.part} | ${r.first.what} | ${r.first.mode} | ${formatDateFr(r.first.on)} | ${phaseOf(r.first.on)} | ${others} |`);
  }
  return lines.join('\n');
}

describe('observability of every part (plan J4 §20)', () => {
  if (process.env['PRINT_OBSERVABILITY']) console.log(markdown());

  it('every part has at least one source of evidence (document or accounting data)', () => {
    for (const r of rows) expect(r.sources.length, r.part).toBeGreaterThan(0);
  });

  it('every part is detectable before the end of the final', () => {
    for (const r of rows) expect(r.first.on <= finalEnd, `${r.part}: ${r.first.what} le ${r.first.on}`).toBe(true);
  });

  it('A15: the receiver’s letter (decisive) arrives after the final and before the signature of the report', () => {
    const d = rows.find((r) => r.part === 'A15')!.decisive!;
    expect(d.on > finalEnd).toBe(true);
    expect(d.on <= signature).toBe(true);
  });

  it('the evidence of the interim (A06, A19) is in the extraction at 31/10/2025; A11 only in the final ledger', () => {
    const src = (part: string) => rows.find((r) => r.part === part)!.sources.find((s) => s.mode === 'données')!;
    expect(src('A06').what).toBe('extraction au 31/10/2025');
    expect(src('A19').what).toBe('extraction au 31/10/2025');
    expect(src('A11').what).toBe('balance et FEC définitifs');
  });

  it('the annex docs/j4-observabilite.md lists every part with its first element, mode and date', () => {
    const text = readFileSync(resolve(import.meta.dirname, '../../docs/j4-observabilite.md'), 'utf8');
    for (const r of rows) {
      const line = text.split('\n').find((l) => l.startsWith(`| ${r.part} |`));
      expect(line, r.part).toBeDefined();
      const cells = line!.split('|').map((x) => x.trim());
      expect(cells.slice(2, 5), r.part).toEqual([r.first.what, r.first.mode, formatDateFr(r.first.on)]);
    }
  });
});
