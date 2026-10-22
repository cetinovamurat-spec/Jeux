/**
 * Replies to the requests and confirmations of the auditor (plan J4 §8.3 and
 * §9). The same fillers build the scenario documents (which carry clues) and
 * the generic replies given for every other object of a family, from the
 * presented data and without clue: a reply never signals « nothing here », and
 * a scenario document looks like its neighbours.
 *
 * Generic replies are built on demand on the main thread (the UI caches them);
 * they never read a field that betrays the correction key.
 *
 * As-of rule (plan J4 §8.2-8.4): the families of REQUEST_DATED_FAMILIES are
 * answered by documents established on the date of the request, with the data
 * known at that date, for every object — the scenario's too, whose clues are
 * tagged on the same documents (catalog/contracts.ts → SCENARIO_REPLIES).
 */
import { addBusinessDays, addDays, endOfMonth, type IsoDate } from '../../engine/dates';
import { closingBalancesByAux } from '../../engine/balance';
import { compareFecEntries } from '../../engine/fec';
import type { Cents } from '../../engine/money';
import { accumulatedDepreciation } from '../../engine/subledgers/depreciation';
import { accruedInterest, outstandingAt } from '../../engine/subledgers/loans';
import type { AssetComponent, JournalEntry, Ledger, LoanScheduleLine, ThirdParty } from '../../engine/types';
import { createRng } from '../../engine/rng';
import type { Invoice, Lease } from '../datasets';
import { DocBuilder, ENTITY_HEADER, date, debitOf, euro, euro0, fromEuros, person, progName, pts, tpName, type AvailabilityInput, type DocContext } from './context';
import { versionedId, type DocumentModel, type Interlocutor } from './model';
import { requestLabel } from './request-labels';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « octobre 2025 » for '2025-10'. */
export function monthLabel(month: string): string {
  return `${MONTHS_FR[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** Lower-case ascii slug of a name, without its leading article (« Les Lilas » → « lilas »). */
export function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^(les|le|la|l')\s+/, '')
    .replace(/^l['’]/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function onRequest(family: string, object: string, from: Interlocutor): AvailabilityInput {
  return { kind: 'onRequest', family, object, from };
}

/** « de » elided before a vowel or a mute h: « d’entretien des espaces verts », « de travaux ». */
function de(text: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûüœæ]/i.test(text) ? `d’${text}` : `de ${text}`;
}

/** First words of the names that take the definite article (institutions, and companies named by a common noun). */
const DEFINITE: Readonly<Record<string, 'le' | 'la' | 'l’' | 'les'>> = {
  État: 'l’',
  Agence: 'l’',
  Association: 'l’',
  Région: 'la',
  Communauté: 'la',
  Caisse: 'la',
  Banque: 'la',
  Compagnie: 'la',
  Société: 'la',
  Mutuelle: 'la',
  Direction: 'la',
  Département: 'le',
  Centre: 'le',
  Crédit: 'le',
  Cabinet: 'le',
  GIE: 'le',
  Communes: 'les',
};
const OF_ARTICLE = { le: 'du ', la: 'de la ', 'l’': 'de l’', les: 'des ' } as const;

/**
 * « de » + name of a third party, with the article of the institutions and
 * the contractions: de l’État, de la Région, du Département, du Centre
 * communal…, des Jardiniers du Val, d’Énergies du Val, de Me Hélène Leclerc.
 */
export function ofName(name: string): string {
  const lead = /^(Les|Le|La) (.+)$/.exec(name);
  if (lead) return `${OF_ARTICLE[lead[1]!.toLowerCase() as 'les' | 'le' | 'la']}${lead[2]}`;
  if (/^L[’']/.test(name)) return `de ${name}`;
  const article = DEFINITE[name.split(/[\s’']/)[0]!];
  return article ? `${OF_ARTICLE[article]}${name}` : de(name);
}

/** Title of a third party’s reply to a confirmation request; a name with an apposition (« Me X, notaire ») is closed by a comma. */
export function confirmationReplyTitle(name: string): string {
  return `Réponse ${ofName(name)}${name.includes(',') ? ',' : ''} à la demande de confirmation`;
}

// ---------------------------------------------------------------------------
// as-of rule
// ---------------------------------------------------------------------------

/**
 * Families whose replies are established on the date of the request, from the
 * data known at that date (invoices, orders and situations, receptions,
 * sales): a later request of the same object gets updated documents, whose ids
 * carry its date (`update`), beside the first ones.
 */
export const REQUEST_DATED_FAMILIES: ReadonlySet<string> = new Set(['programme-invoices', 'operation-orders', 'operation-acceptance', 'sale-notary']);

/**
 * The reply to every object of the family is built by the family's builder,
 * the scenario's objects included (the families dated on the request, and the
 * supporting documents of an entry): a scenario piece that is not such a
 * reply is attached to it only when it exists on the date of the request;
 * established later, it reaches the auditor as mail, at its date plus the
 * interlocutor's delay, without being announced.
 */
export function builtForEveryObject(family: string): boolean {
  return REQUEST_DATED_FAMILIES.has(family) || family === 'entry-voucher';
}

/** Id of a document of a reply dated on the request: the date is appended for the updated version of a later request. */
function replyId(id: string, asOf: IsoDate, update: boolean): string {
  return update ? versionedId(id, asOf) : id;
}

const byDateThenNumber = (a: Invoice, b: Invoice) => (a.invoiceDate < b.invoiceDate ? -1 : a.invoiceDate > b.invoiceDate ? 1 : a.number < b.number ? -1 : a.number > b.number ? 1 : 0);

/** Operation label (construction, rehabilitation, replacement…). */
function operationLabel(c: DocContext, id: string): string {
  return c.pd.operations.find((o) => o.id === id)?.label ?? id;
}

function thirdParty(c: DocContext, id: string): ThirdParty | undefined {
  return c.pd.thirdParties.find((t) => t.id === id);
}

function schedulesOf(c: DocContext): Map<string, LoanScheduleLine[]> {
  const m = new Map<string, LoanScheduleLine[]>();
  for (const l of c.pd.loanSchedules) {
    const list = m.get(l.loanId);
    if (list) list.push(l);
    else m.set(l.loanId, [l]);
  }
  return m;
}

/** FEC entry numbers ('OD000189') of a ledger, by entry id: per journal, in FEC order (engine/fec). */
export function fecNumbers(ledger: Ledger): Map<string, string> {
  const ordered = [...ledger.entries].sort(compareFecEntries);
  const counters = new Map<string, number>();
  const out = new Map<string, string>();
  for (const e of ordered) {
    const n = (counters.get(e.journal) ?? 0) + 1;
    counters.set(e.journal, n);
    out.set(e.id, `${e.journal}${String(n).padStart(6, '0')}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// components register (one per programme)
// ---------------------------------------------------------------------------

export const REGISTER_DATE = '2026-02-06';
const YEAR_END = '2025-12-31';

/** Components of a programme on the balance sheet at 31/12/2025 (register of the presented accounts). */
export function registerComponents(c: DocContext, pid: string): AssetComponent[] {
  return c.pd.components.filter((x) => x.programmeId === pid && x.inServiceDate <= YEAR_END && !(x.disposal && x.disposal.date <= YEAR_END));
}

/**
 * Register of the components of a programme, one row per operation, family,
 * date of entry into service and useful life (buildings counted).
 */
export function fillComponentRegister(b: DocBuilder, c: DocContext, pid: string, clueOf?: (rows: readonly AssetComponent[]) => string | undefined): void {
  const comps = registerComponents(c, pid);
  b.fields([
    ['Programme', progName(c, pid)],
    ['Situation', 'au 31/12/2025, après écritures d’inventaire'],
  ]);
  if (!comps.length) {
    b.p(`${progName(c, pid)} : aucun composant enregistré au registre.`, clueOf?.([]));
    return;
  }
  const order = Object.keys(c.params.components.families);
  const groups = new Map<string, AssetComponent[]>();
  for (const x of comps) {
    const k = `${x.inServiceDate}|${x.operationId}|${String(order.indexOf(x.family)).padStart(2, '0')}|${x.usefulLifeYears}|${x.label}`;
    const g = groups.get(k);
    if (g) g.push(x);
    else groups.set(k, [x]);
  }
  let cost = 0;
  let acc = 0;
  const rows = [...groups.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([, g]) => {
      const first = g[0]!;
      const gc = g.reduce((s, x) => s + x.cost, 0);
      const ga = g.reduce((s, x) => s + accumulatedDepreciation(x, YEAR_END), 0);
      cost += gc;
      acc += ga;
      const buildings = [...new Set(g.map((x) => x.building))];
      const clue = clueOf?.(g);
      return {
        cells: [first.label, operationLabel(c, first.operationId), buildings.length === 1 ? buildings[0]! : `${buildings.length} bâtiments`, date(first.inServiceDate), first.usefulLifeYears ? `${first.usefulLifeYears} ans` : '—', euro0(gc), euro0(ga), euro0(gc - ga)],
        ...(clue ? { clue } : {}),
      };
    });
  b.table(['Composant', 'Opération', 'Bâtiments', 'Mise en service', 'Durée', 'Valeur brute', 'Amortissements cumulés', 'Valeur nette'], rows, {
    align: ['left', 'left', 'left', 'left', 'right', 'right', 'right', 'right'],
    footer: ['Total', '', '', '', '', euro0(cost), euro0(acc), euro0(cost - acc)],
  });
}

function componentRegister(c: DocContext, pid: string): DocumentModel {
  const b = new DocBuilder({ id: `registre-composants-${slug(progName(c, pid))}`, title: `Registre des composants au 31/12/2025 – ${progName(c, pid)}`, category: 'accounting', date: REGISTER_DATE, issuer: ENTITY_HEADER(c), availability: onRequest('programme-components', pid, 'chiefAccountant') });
  fillComponentRegister(b, c, pid);
  return b.build();
}

// ---------------------------------------------------------------------------
// invoices and purchase orders of a programme
// ---------------------------------------------------------------------------

const WORKS = new Set(['investissement', 'entretien', 'gros_entretien', 'gros_entretien_pge']);

/** Works invoices (investment, maintenance) of the programme dated in 2025 up to `upTo`. */
export function programmeWorksInvoices(c: DocContext, pid: string, upTo: IsoDate): Invoice[] {
  const end = upTo < YEAR_END ? upTo : YEAR_END;
  return c.pd.invoices.filter((i) => i.invoiceDate >= '2025-01-01' && i.invoiceDate <= end && WORKS.has(i.category) && i.lines.some((l) => l.programmeId === pid)).sort(byDateThenNumber);
}

export function fillInvoices(b: DocBuilder, c: DocContext, invoices: readonly Invoice[], clueOf?: (i: Invoice) => string | undefined): void {
  b.table(
    ['Fournisseur', 'Facture', 'Date', 'Objet', 'Bon de commande', 'Montant HT'],
    invoices.map((i) => {
      const clue = clueOf?.(i);
      return { cells: [tpName(c, i.supplierId), i.number, date(i.invoiceDate), i.description, i.orderRef ?? '—', euro(i.total)], ...(clue ? { clue } : {}) };
    }),
    { align: ['left', 'left', 'left', 'left', 'left', 'right'], footer: ['Total', `${invoices.length} factures`, '', '', '', euro(invoices.reduce((s, i) => s + i.total, 0))] },
  );
}

/** Budget line of a purchase order (category of the invoice). */
function budgetLine(c: DocContext, i: Invoice): string {
  switch (i.category) {
    case 'entretien':
      return 'Programme d’entretien 2025';
    case 'gros_entretien_pge':
      return 'Plan pluriannuel d’entretien (provision)';
    case 'gros_entretien':
      return 'Gros entretien 2025';
    default: {
      const op = i.lines.find((l) => l.operationId)?.operationId;
      return op ? `Investissement – ${operationLabel(c, op)}` : 'Investissement';
    }
  }
}

export function fillOrders(b: DocBuilder, c: DocContext, invoices: readonly Invoice[], clueOf?: (i: Invoice) => string | undefined): void {
  const withOrder = invoices.filter((i) => i.orderRef);
  b.table(
    ['Bon de commande', 'Fournisseur', 'Objet', 'Imputation budgétaire', 'Montant HT'],
    withOrder.map((i) => {
      const clue = clueOf?.(i);
      return { cells: [i.orderRef!, tpName(c, i.supplierId), i.description, budgetLine(c, i), euro(i.total)], ...(clue ? { clue } : {}) };
    }),
    { align: ['left', 'left', 'left', 'left', 'right'] },
  );
}

export function invoicesTitle(c: DocContext, pid: string): string {
  return `Factures de travaux et d’entretien 2025 – ${progName(c, pid)}`;
}

export function ordersTitle(c: DocContext, pid: string): string {
  return `Bons de commande 2025 – ${progName(c, pid)}`;
}

/** Clues of a scenario object tagged on the documents of its reply (registered on each document's builder). */
type Tagger<T> = (b: DocBuilder) => (x: T) => string | undefined;

/**
 * Works invoices of the programme and their purchase orders, as known at
 * `asOf`. A scenario object keeps the ids of its documents and tags its
 * clues on the rows (`tags`).
 */
export function programmeInvoices(c: DocContext, pid: string, asOf: IsoDate, update = false, tags: { invoicesId?: string; ordersId?: string; invoice?: Tagger<Invoice>; order?: Tagger<Invoice> } = {}): DocumentModel[] {
  const inv = programmeWorksInvoices(c, pid, asOf);
  const s = slug(progName(c, pid));
  const b = new DocBuilder({ id: replyId(tags.invoicesId ?? `factures-${s}`, asOf, update), title: invoicesTitle(c, pid), category: 'contracts', date: asOf, issuer: `${ENTITY_HEADER(c)} – comptabilité fournisseurs`, availability: onRequest('programme-invoices', pid, 'chiefAccountant') });
  fillInvoices(b, c, inv, tags.invoice?.(b));
  const o = new DocBuilder({ id: replyId(tags.ordersId ?? `bons-commande-${s}`, asOf, update), title: ordersTitle(c, pid), category: 'contracts', date: asOf, issuer: `${ENTITY_HEADER(c)} – direction du patrimoine`, availability: onRequest('programme-invoices', pid, 'chiefAccountant') });
  fillOrders(o, c, inv, tags.order?.(o));
  return [b.build(), o.build()];
}

// ---------------------------------------------------------------------------
// rent roll of a programme for a month
// ---------------------------------------------------------------------------

export function rentRollLeases(c: DocContext, pid: string, month: string): Lease[] {
  const start = `${month}-01`;
  const end = endOfMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  return c.pd.leases.filter((l) => l.programmeId === pid && l.start <= end && (!l.end || l.end >= start)).sort((a, b) => (a.dwellingId < b.dwellingId ? -1 : a.dwellingId > b.dwellingId ? 1 : 0));
}

export function rentRollTitle(c: DocContext, pid: string, month: string): string {
  const software = `${month}-01` >= c.params.scenario.users.migrationDate ? 'LOGIGES 2' : 'LOGIGES';
  return `Quittancement de ${monthLabel(month)} – ${progName(c, pid)} (extrait ${software})`;
}

export function fillRentRoll(b: DocBuilder, c: DocContext, pid: string, month: string, clueOf?: (l: Lease) => string | undefined): void {
  const leases = rentRollLeases(c, pid, month);
  const y = month.startsWith('2024') ? 'y2024' : 'y2025';
  if (!leases.length) {
    b.p(`Aucun logement quittancé sur le programme en ${monthLabel(month)}.`);
    return;
  }
  let rent = 0;
  let charges = 0;
  let rls = 0;
  const rows = leases.map((l) => {
    rent += l.rent[y];
    charges += l.chargeProvision[y];
    rls += l.rls[y];
    const clue = clueOf?.(l);
    return { cells: [l.id, l.dwellingId, l.tenantName, euro(l.rent[y]), euro(l.chargeProvision[y]), euro(l.rls[y])], ...(clue ? { clue } : {}) };
  });
  b.table(['Bail', 'Logement', 'Locataire', 'Loyer', 'Provision de charges', 'RLS'], rows, {
    align: ['left', 'left', 'left', 'right', 'right', 'right'],
    footer: ['Total', `${leases.length} baux`, '', euro(rent), euro(charges), euro(rls)],
  });
}

function rentRoll(c: DocContext, pid: string, month: string): DocumentModel {
  const b = new DocBuilder({ id: `quittancement-${pid.toLowerCase()}-${month}`, title: rentRollTitle(c, pid, month), category: 'accounting', date: `${month}-01`, issuer: `${ENTITY_HEADER(c)} – gestion locative`, availability: onRequest('programme-rent-roll', `${pid}:${month}`, 'rentManager') });
  fillRentRoll(b, c, pid, month);
  return b.build();
}

// ---------------------------------------------------------------------------
// bank statement of the main account for a month
// ---------------------------------------------------------------------------

export interface BankRow {
  date: IsoDate;
  label: string;
  /** Debit and credit seen from the bank (debit = money out of the account). */
  debit: Cents;
  credit: Cents;
  /** Entry of the ledger the row comes from (2025 months). */
  entry?: JournalEntry;
}

const BANK = '5121';

function bankWording(c: DocContext, e: JournalEntry): string {
  const loanRef = e.lines.flatMap((l) => l.refs ?? []).find((r) => r.startsWith('loan:'))?.slice(5);
  const loan = loanRef ? c.pd.loans.find((l) => l.id === loanRef) : undefined;
  if (e.pieceRef?.startsWith('ECH-') && loan) return `PRLV ECHEANCE PRET ${loan.contractNumber} ${tpName(c, loan.lenderId).toUpperCase()}`;
  if (e.pieceRef?.startsWith('CTR-') && loan) return `VIR RECU ${tpName(c, loan.lenderId).toUpperCase()} CTR ${loan.contractNumber}`;
  if (e.pieceRef?.startsWith('VIR')) {
    const n = e.lines.filter((l) => l.account !== BANK).length;
    return `VIREMENTS SEPA EMIS – REMISE DE ${n} ORDRES`;
  }
  return e.label.toUpperCase();
}

/** Movements of the main account in a month of 2025 (from the presented ledger). */
function bankRows2025(c: DocContext, month: string): BankRow[] {
  const rows: BankRow[] = [];
  for (const e of c.presented.ledgers.current.entries) {
    if (!e.date.startsWith(month) || e.journal === 'AN') continue;
    let net = 0;
    for (const l of e.lines) if (l.account === BANK) net += l.debit - l.credit;
    if (net === 0) continue;
    rows.push({ date: e.date, label: bankWording(c, e), debit: net < 0 ? -net : 0, credit: net > 0 ? net : 0, entry: e });
  }
  return rows;
}

/**
 * Movements of a month of 2026 (no ledger yet): payments of invoices,
 * instalments of loans, notary and subsidy receipts from the datasets; the
 * recurring receipts of the month (remittances of rents, housing benefit,
 * fees) follow the pattern of December 2025, one month later.
 */
function bankRows2026(c: DocContext, month: string): BankRow[] {
  const rows: BankRow[] = [];
  const byDay = new Map<IsoDate, { n: number; total: Cents }>();
  for (const i of c.pd.invoices) {
    if (!i.paidDate?.startsWith(month)) continue;
    const d = byDay.get(i.paidDate) ?? { n: 0, total: 0 };
    d.n++;
    d.total += i.total;
    byDay.set(i.paidDate, d);
  }
  for (const [d, x] of byDay) rows.push({ date: d, label: `VIREMENTS SEPA EMIS – REMISE DE ${x.n} ORDRES`, debit: x.total, credit: 0 });
  const loans = new Map(c.pd.loans.map((l) => [l.id, l]));
  for (const s of c.pd.loanSchedules) {
    if (!s.dueDate.startsWith(month)) continue;
    const loan = loans.get(s.loanId);
    if (!loan) continue;
    rows.push({ date: s.dueDate, label: `PRLV ECHEANCE PRET ${loan.contractNumber} ${tpName(c, loan.lenderId).toUpperCase()}`, debit: s.principal + s.interest, credit: 0 });
  }
  const sales = new Map<string, { date: IsoDate; notary: string; total: Cents }>();
  for (const s of c.pd.sales) {
    if (!s.paymentDate.startsWith(month)) continue;
    const k = `${s.paymentDate}|${s.notaryId}`;
    const x = sales.get(k) ?? { date: s.paymentDate, notary: s.notaryId, total: 0 };
    x.total += s.price;
    sales.set(k, x);
  }
  for (const x of sales.values()) rows.push({ date: x.date, label: `VIR ${tpName(c, x.notary).toUpperCase()} VENTES`, debit: 0, credit: x.total });
  for (const sub of c.pd.subsidies) for (const r of sub.receipts) if (r.date.startsWith(month)) rows.push({ date: r.date, label: `VIR RECU ${(c.d.grantors[sub.grantorId] ?? sub.grantorId).toUpperCase()} SUBVENTION`, debit: 0, credit: r.amount });
  // recurring receipts: December 2025 pattern, shifted to the month
  for (const r of bankRows2025(c, '2025-12')) {
    const e = r.entry!;
    const recurring = e.pieceRef?.startsWith('ENC') || e.lines.some((l) => l.account === '4431' || l.account === '4114' || l.account === '7088');
    if (!recurring || r.credit === 0) continue;
    const d = Number(r.date.slice(8, 10));
    const day = Math.min(d, Number(endOfMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7))).slice(8, 10)));
    rows.push({ date: `${month}-${String(day).padStart(2, '0')}`, label: r.label.replace(/12\/2025/g, `${month.slice(5, 7)}/${month.slice(0, 4)}`), debit: 0, credit: r.credit });
  }
  return rows;
}

export function bankRows(c: DocContext, month: string): BankRow[] {
  const rows = month.startsWith('2025') ? bankRows2025(c, month) : bankRows2026(c, month);
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.credit - a.credit || a.debit - b.debit || (a.label < b.label ? -1 : 1)));
}

export function bankStatementTitle(month: string): string {
  return `Relevé bancaire de ${monthLabel(month)} – compte principal`;
}

/**
 * Bank statement of a month. `special` adds rows (their position follows the
 * date) or rewrites a row (bank wording) and tags clues.
 */
export function fillBankStatement(b: DocBuilder, c: DocContext, month: string, special?: { rewrite?: (r: BankRow) => Partial<BankRow> & { clue?: string } | undefined; extra?: readonly (BankRow & { clue?: string; dateText?: string })[] }): void {
  const base: (BankRow & { clue?: string; dateText?: string })[] = bankRows(c, month).map((r) => {
    const w = special?.rewrite?.(r);
    return w ? { ...r, ...w } : r;
  });
  const rows = [...base, ...(special?.extra ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  b.fields([
    ['Titulaire', c.params.scenario.entity.name],
    ['Période', `du 01/${month.slice(5, 7)}/${month.slice(0, 4)} au ${date(endOfMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7))))}`],
  ]);
  b.table(
    ['Date', 'Libellé', 'Débit', 'Crédit'],
    rows.map((r) => ({ cells: [r.dateText ?? date(r.date), r.label, r.debit ? euro(r.debit) : '', r.credit ? euro(r.credit) : ''], ...(r.clue ? { clue: r.clue } : {}) })),
    { align: ['left', 'left', 'right', 'right'], footer: ['Total des mouvements', '', euro(rows.reduce((s, r) => s + r.debit, 0)), euro(rows.reduce((s, r) => s + r.credit, 0))] },
  );
}

function bankStatement(c: DocContext, month: string): DocumentModel {
  const end = endOfMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  const b = new DocBuilder({ id: `releve-bancaire-${month}`, title: bankStatementTitle(month), category: 'thirdParty', date: end, issuer: 'Banque commerciale – compte principal', availability: onRequest('bank-statements', month, 'chiefAccountant') });
  fillBankStatement(b, c, month);
  return b.build();
}

// ---------------------------------------------------------------------------
// rent interface journal for a month
// ---------------------------------------------------------------------------

export function interfaceLots(c: DocContext, month: string): JournalEntry[] {
  const prefix = `QT${month.replace('-', '')}-`;
  return c.presented.ledgers.current.entries.filter((e) => e.journal === 'QT' && e.pieceRef?.startsWith(prefix));
}

export function interfaceJournalTitle(month: string): string {
  return `Journal de l’interface de quittancement – ${monthLabel(month)} (lots intégrés)`;
}

export function fillInterfaceJournal(b: DocBuilder, c: DocContext, month: string, clueOf?: (e: JournalEntry, duplicated: boolean) => string | undefined): void {
  const lots = interfaceLots(c, month);
  const counts = new Map<string, number>();
  for (const e of lots) counts.set(e.pieceRef!, (counts.get(e.pieceRef!) ?? 0) + 1);
  b.table(
    ['Lot', 'Programme', 'Date', 'Utilisateur', 'Montant (débit 4111)'],
    lots.map((e) => {
      const clue = clueOf?.(e, (counts.get(e.pieceRef!) ?? 0) > 1);
      return { cells: [e.pieceRef!, progName(c, e.pieceRef!.slice(9)), date(e.date), e.enteredBy, euro(e.lines.find((l) => l.account === '4111')?.debit ?? 0)], ...(clue ? { clue } : {}) };
    }),
    { align: ['left', 'left', 'left', 'left', 'right'] },
  );
}

function interfaceJournal(c: DocContext, month: string): DocumentModel {
  const b = new DocBuilder({ id: `journal-interface-${month}`, title: interfaceJournalTitle(month), category: 'accounting', date: endOfMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7))), issuer: ENTITY_HEADER(c), availability: onRequest('rent-interface', month, 'chiefAccountant') });
  fillInterfaceJournal(b, c, month);
  return b.build();
}

// ---------------------------------------------------------------------------
// operations: orders and situations, acceptance
// ---------------------------------------------------------------------------

/** Recent operations of a programme (2024 and later), or the operation in progress of that id. */
export function recentOperations(c: DocContext, pid: string): { id: string; label: string; kind: string }[] {
  return c.pd.operations.filter((o) => o.programmeId === pid && o.year >= 2024 && o.kind !== 'acquisition').map((o) => ({ id: o.id, label: o.label, kind: o.kind }));
}

function operationInvoices(c: DocContext, opId: string, upTo: IsoDate): Invoice[] {
  return c.pd.invoices.filter((i) => i.invoiceDate <= upTo && i.lines.some((l) => l.operationId === opId)).sort(byDateThenNumber);
}

export function fillOperationOrders(b: DocBuilder, c: DocContext, pid: string, upTo: IsoDate, amendments: string): void {
  for (const op of recentOperations(c, pid)) {
    const inv = operationInvoices(c, op.id, upTo);
    const suppliers = [...new Set(inv.map((i) => i.supplierId))];
    b.h(op.label);
    b.fields([
      ['Entreprises titulaires', suppliers.map((s) => tpName(c, s)).join(', ') || '—'],
      ['Premier ordre de service (démarrage)', inv[0] ? date(addDays(inv[0].invoiceDate, -30)) : '—'],
      ['Situations et factures réglées ou à régler', `${inv.length} – ${euro(inv.reduce((s, i) => s + i.total, 0))}`],
    ]);
    if (inv.length) b.table(['Date', 'Entreprise', 'Objet', 'Montant HT'], inv.map((i) => [date(i.invoiceDate), tpName(c, i.supplierId), i.description, euro(i.total)]), { align: ['left', 'left', 'left', 'right'] });
  }
  b.note(amendments);
}

/**
 * Orders, amendments and situations of the recent operations of a programme,
 * as known at `asOf`. A scenario object keeps its id, states its amendments
 * and appends them (`tags.annex`, which tags the clues).
 */
export function operationOrders(c: DocContext, pid: string, asOf: IsoDate, update = false, tags: { id?: string; amendments?: string; annex?: (b: DocBuilder) => void } = {}): DocumentModel {
  const b = new DocBuilder({ id: replyId(tags.id ?? `ordres-service-${slug(progName(c, pid))}`, asOf, update), title: `Ordres de service, avenants et situations de travaux – ${progName(c, pid)}`, category: 'contracts', date: asOf, issuer: `${ENTITY_HEADER(c)} – maîtrise d’ouvrage`, availability: onRequest('operation-orders', pid, 'assetDirector') });
  fillOperationOrders(b, c, pid, asOf, tags.amendments ?? 'Aucun ordre de service modificatif ni avenant aux marchés de ces opérations.');
  tags.annex?.(b);
  return b.build();
}

/** Reception of an operation stated by the maîtrise d’ouvrage: date, buildings, clue (scenario objects). */
export interface Reception {
  on: IsoDate;
  buildings: readonly string[];
  clue?: string | undefined;
}

/**
 * Receptions of the recent operations of a programme, as known at `asOf`
 * (an operation put in service later is still in progress). A scenario
 * object keeps its id and states the reception of its operations
 * (`tags.reception`, which tags the clues).
 */
export function operationAcceptance(c: DocContext, pid: string, asOf: IsoDate, update = false, tags: { id?: string; reception?: (b: DocBuilder, operationId: string) => Reception | undefined } = {}): DocumentModel {
  const asset = person(c, 'assetDirector');
  const b = new DocBuilder({ id: replyId(tags.id ?? `reception-${slug(progName(c, pid))}`, asOf, update), title: `Réception des travaux – ${progName(c, pid)}`, category: 'contracts', date: asOf, issuer: `${ENTITY_HEADER(c)} – maîtrise d’ouvrage`, availability: onRequest('operation-acceptance', pid, 'assetDirector') });
  const rows: { cells: string[]; clue?: string }[] = [];
  for (const op of recentOperations(c, pid)) {
    const inv = operationInvoices(c, op.id, asOf);
    const contractor = inv.length ? tpName(c, inv[inv.length - 1]!.supplierId) : '—';
    const comps = c.pd.components.filter((x) => x.operationId === op.id && x.inServiceDate <= asOf);
    const r: Reception | undefined = tags.reception?.(b, op.id) ?? (comps.length ? { on: comps.map((x) => x.inServiceDate).sort()[0]!, buildings: comps.map((x) => x.building) } : undefined);
    if (r && r.on <= asOf) {
      const buildings = [...new Set(r.buildings)];
      rows.push({ cells: [op.label, buildings.length === 1 ? buildings[0]! : buildings.length ? `${buildings.length} bâtiments` : '—', contractor, `Réception prononcée le ${date(r.on)}, sans réserve majeure`], ...(r.clue ? { clue: r.clue } : {}) });
    } else {
      const delivery = c.params.scenario.operationsInProgress.find((o) => o.id === pid)?.delivery;
      rows.push({ cells: [op.label, '—', contractor, delivery ? `Travaux en cours ; livraison prévue le ${date(delivery)}` : 'Travaux en cours ; réception non prononcée'] });
    }
  }
  b.table(['Opération', 'Bâtiments', 'Entreprise', 'Réception'], rows, { align: ['left', 'left', 'left', 'left'] });
  b.sign(asset.name, `${asset.role}, pour le maître de l’ouvrage`, asOf);
  return b.build();
}

// ---------------------------------------------------------------------------
// tender file of a supplier
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  investissement: 'travaux d’investissement',
  entretien: 'travaux d’entretien courant',
  gros_entretien_pge: 'travaux de gros entretien',
  gros_entretien: 'travaux de gros entretien',
  eau: 'fourniture d’eau',
  chauffage: 'fourniture de chaleur et exploitation des chaufferies',
  electricite_pc: 'fourniture d’électricité des parties communes',
  ascenseurs: 'maintenance des ascenseurs',
  espaces_verts: 'entretien des espaces verts',
  nettoyage: 'nettoyage des parties communes',
  contrats_entretien: 'entretien et maintenance des équipements techniques',
};

/**
 * Purchase categories that no commission awards: statutory contributions of
 * the HLM bodies, co-ownership charges called by the syndic, bank services.
 * Their suppliers have no tender file, and their agreements no contractual
 * clause (nature only).
 */
export const NOT_AWARDED: Readonly<Record<string, string>> = {
  cglls: 'Cotisation réglementaire due par les organismes d’habitations à loyer modéré, sans contrat',
  syndic: 'Charges de copropriété appelées par le syndic désigné par l’assemblée générale des copropriétaires',
  banque: 'Convention de compte et conditions tarifaires des services bancaires',
};

const mainCategories = new WeakMap<readonly Invoice[], Map<string, string>>();

/** Main purchase category of a supplier: the category of its largest invoiced total. */
export function supplierCategoryOf(invoices: readonly Invoice[], id: string): string {
  let main = mainCategories.get(invoices);
  if (!main) {
    const totals = new Map<string, Map<string, number>>();
    for (const i of invoices) {
      const t = totals.get(i.supplierId) ?? new Map<string, number>();
      t.set(i.category, (t.get(i.category) ?? 0) + i.total);
      totals.set(i.supplierId, t);
    }
    main = new Map([...totals].map(([s, t]) => [s, [...t.entries()].sort((a, b) => b[1] - a[1])[0]![0]]));
    mainCategories.set(invoices, main);
  }
  return main.get(id) ?? 'autres_services';
}

/** The purchases of the supplier are awarded after competition: a tender file exists. */
export function hasTenderFile(invoices: readonly Invoice[], id: string): boolean {
  return !(supplierCategoryOf(invoices, id) in NOT_AWARDED);
}

function supplierCategory(c: DocContext, id: string): string {
  return supplierCategoryOf(c.pd.invoices, id);
}

function supplierVolume(c: DocContext, id: string, year: string): Cents {
  return c.pd.invoices.filter((i) => i.supplierId === id && i.invoiceDate.startsWith(year)).reduce((s, i) => s + i.total, 0);
}

function supplierTender(c: DocContext, id: string, asOf: IsoDate): DocumentModel[] {
  const name = tpName(c, id);
  const cat = supplierCategory(c, id);
  const base = supplierVolume(c, id, '2025') || supplierVolume(c, id, '2024');
  const first = c.pd.invoices.filter((i) => i.supplierId === id).map((i) => i.invoiceDate).sort()[0] ?? asOf;
  const award = addDays(first, -45);
  const rng = createRng(`tender:${id}`);
  // never the auditor's own firm among the bidders
  const others = c.pd.thirdParties.filter((t) => t.kind === 'supplier' && t.id !== id && t.name !== c.params.game.firmName && supplierCategory(c, t.id) === cat).map((t) => t.name);
  const fillers = ['Groupe Habitat Services', 'Entreprise Duval Bâtiment', 'Rénovation Marnaise SAS'];
  const bidders = [name, ...rng.shuffle(others).slice(0, 3)];
  for (const f of fillers) if (bidders.length < 4 && !bidders.includes(f)) bidders.push(f);
  const factors = [1, ...[0, 1, 2].map(() => 1 + rng.uniform(0.03, 0.2))].sort((a, b) => a - b);
  const s = slug(name);
  const b = new DocBuilder({ id: `marche-${s}`, title: `Rapport d’analyse des offres – marché ${de(CATEGORY_LABELS[cat] ?? 'prestations')} attribué à ${name}`, category: 'contracts', date: award, issuer: `${ENTITY_HEADER(c)} – commission d’appel d’offres`, availability: onRequest('supplier-tender', id, 'assetDirector') });
  b.table(['Candidat', 'Offre (base annuelle)', 'Classement'], bidders.map((x, i) => [x, euro0(Math.round(base * factors[i]!)), String(i + 1)]), { align: ['left', 'right', 'right'] });
  b.p('La commission (directeur général, directrice administrative et financière, un administrateur) retient l’offre économiquement la plus avantageuse.');
  const ceo = person(c, 'ceo');
  b.sign(ceo.name, `${ceo.role}, président de la commission`, award);
  const d = new DocBuilder({ id: `declarations-interets-${s}`, title: `Déclarations d’absence de conflit d’intérêts – commission d’appel d’offres (marché ${name})`, category: 'contracts', date: award, issuer: ENTITY_HEADER(c), availability: onRequest('supplier-tender', id, 'assetDirector') });
  d.p('Les membres de la commission déclarent n’avoir aucun lien de parenté ni intérêt personnel avec les candidats au marché.');
  d.sign(ceo.name, ceo.role, award);
  d.sign(person(c, 'cfo').name, person(c, 'cfo').role, award);
  return [b.build(), d.build()];
}

// ---------------------------------------------------------------------------
// sales of a programme: promises, deeds, notary
// ---------------------------------------------------------------------------

/** Sales of a programme known at `asOf`: promises signed by then, deeds and payments of the notary made by then. */
function saleNotary(c: DocContext, pid: string, asOf: IsoDate, update = false): DocumentModel {
  const sales = c.pd.sales.filter((s) => s.programmeId === pid && (s.deedDate >= '2025-01-01' || s.promiseDate >= '2025-01-01') && s.promiseDate <= asOf).sort((a, b) => (a.promiseDate < b.promiseDate ? -1 : 1));
  const b = new DocBuilder({ id: replyId(`ventes-${slug(progName(c, pid))}`, asOf, update), title: `Ventes HLM – ${progName(c, pid)} : promesses, actes et versements du notaire`, category: 'contracts', date: asOf, issuer: `${ENTITY_HEADER(c)} – direction financière`, availability: onRequest('sale-notary', pid, 'cfo') });
  b.table(
    ['Vente', 'Logement', 'Acquéreur', 'Promesse', 'Acte authentique', 'Prix', 'Versement du notaire', 'Notaire'],
    sales.map((s) => [s.id, s.dwellingIds[0] ?? '', s.buyer, date(s.promiseDate), s.deedDate <= asOf ? date(s.deedDate) : 'à signer', euro0(s.price), s.paymentDate <= asOf ? date(s.paymentDate) : '—', tpName(c, s.notaryId)]),
    { align: ['left', 'left', 'left', 'left', 'left', 'right', 'left', 'left'] },
  );
  b.p('Clauses usuelles des promesses : transfert de propriété et entrée en jouissance à la signature de l’acte authentique ; condition suspensive d’obtention du financement par l’acquéreur.');
  return b.build();
}

// ---------------------------------------------------------------------------
// agreements with a third party
// ---------------------------------------------------------------------------

/**
 * Agreements in force with a third party, as known at `asOf` (date of the
 * request): loans signed, financing decisions and their receipts, sales
 * entrusted to the notary, invoicing of the year — up to that date, and up
 * to the year end once it is past.
 */
function agreements(c: DocContext, id: string, asOf: IsoDate): DocumentModel {
  const tp = thirdParty(c, id);
  const name = tpName(c, id);
  const at = asOf < YEAR_END ? asOf : YEAR_END;
  const b = new DocBuilder({ id: `conventions-${slug(name)}`, title: `Conventions et contrats en vigueur – ${name}`, category: 'contracts', date: asOf, issuer: ENTITY_HEADER(c), recipient: name, availability: onRequest('third-party-agreements', id, 'cfo') });
  const kind = tp?.kind ?? 'other';
  if (kind === 'lender') {
    const loans = c.pd.loans.filter((l) => l.lenderId === id && l.startDate <= asOf);
    if (loans.length) {
      b.table(['Contrat', 'Produit', 'Programme', 'Montant emprunté', 'Date de signature', 'Taux'], loans.map((l) => [l.contractNumber, l.product, l.programmeId ? progName(c, l.programmeId) : '—', euro0(l.principal), date(l.startDate), l.rate.kind === 'fixed' ? `fixe ${pts(l.rate.ratePct)}` : `Livret A + ${pts(l.rate.marginPct)}`]), { title: 'Contrats de prêt', align: ['left', 'left', 'left', 'right', 'left', 'left'] });
    } else {
      b.p('Convention de compte courant et de services bancaires (gestion des flux, cartes, comptes à terme) ; conditions tarifaires annuelles.');
    }
  } else if (kind === 'publicBody') {
    const subs = c.pd.subsidies.filter((s) => s.grantorId === id && s.decisionDate <= asOf);
    if (subs.length) b.table(['Décision', 'Programme', 'Montant accordé', `Versé au ${date(at)}`], subs.map((s) => [date(s.decisionDate), progName(c, s.programmeId), euro0(s.amount), euro0(s.receipts.filter((r) => r.date <= at).reduce((a, r) => a + r.amount, 0))]), { title: 'Décisions de financement', align: ['left', 'left', 'right', 'right'] });
    else b.p('Relations régies par les dispositions réglementaires générales ; aucune convention particulière de financement en cours.');
  } else if (kind === 'notary') {
    const sales = c.pd.sales.filter((s) => s.notaryId === id && s.deedDate >= '2024-01-01' && s.promiseDate <= asOf);
    b.p('Lettre de mission pour la rédaction des actes de vente de logements aux locataires : honoraires à la charge des acquéreurs, versement du prix à l’organisme dans les jours suivant la signature des actes.');
    b.fields([['Ventes confiées depuis 2024', String(sales.length)]]);
  } else {
    const known = c.pd.invoices.filter((i) => i.supplierId === id && i.invoiceDate <= at);
    const inv = known.filter((i) => i.invoiceDate.startsWith('2025'));
    const invoiced: [string, string] = [`Facturation 2025 (au ${date(at)})`, `${inv.length} factures – ${euro(inv.reduce((s, i) => s + i.total, 0))}`];
    const cat = supplierCategory(c, id);
    const nature = NOT_AWARDED[cat];
    if (nature) {
      // statutory contributions, co-ownership charges, bank services: no contract of the entity, no contractual clause
      b.fields([['Nature', nature], invoiced]);
    } else {
      const first = known.map((i) => i.invoiceDate).sort()[0];
      const terms = inv.length ? Math.round(inv.reduce((s, i) => s + (Date.parse(i.dueDate) - Date.parse(i.invoiceDate)) / 86_400_000, 0) / inv.length) : 30;
      b.fields([
        ['Objet', CATEGORY_LABELS[cat] ?? 'prestations de services'],
        ['Contrat en vigueur depuis', first ? date(addDays(first, -30)) : '—'],
        ['Conditions de paiement', `${terms} jours à réception de facture`],
        invoiced,
      ]);
      b.p('Révision annuelle des prix selon l’indice contractuel ; résiliation possible à chaque échéance annuelle moyennant un préavis de trois mois.');
    }
  }
  return b.build();
}

// ---------------------------------------------------------------------------
// supporting document of an entry
// ---------------------------------------------------------------------------

/** Entry of the presented ledger of the year with that FEC number. */
export function entryByNumber(c: DocContext, year: number, num: string): JournalEntry | undefined {
  const ledger = year === 2024 ? c.presented.ledgers.prior : c.presented.ledgers.current;
  const numbers = fecNumbers(ledger);
  return ledger.entries.find((e) => numbers.get(e.id) === num);
}

function entryVoucher(c: DocContext, year: number, num: string): DocumentModel | null {
  const e = entryByNumber(c, year, num);
  if (!e) return null;
  const refs = e.lines.flatMap((l) => l.refs ?? []);
  const ids = (prefix: string) => [...new Set(refs.filter((r) => r.startsWith(prefix)).map((r) => r.slice(prefix.length)))];
  const b = new DocBuilder({ id: `piece-${year}-${num.toLowerCase()}`, title: `Pièces justificatives de l’écriture ${num} (${year})`, category: 'accounting', date: e.validDate, issuer: `${ENTITY_HEADER(c)} – comptabilité`, availability: onRequest('entry-voucher', `${year}:${num}`, 'chiefAccountant') });
  b.fields([
    ['Écriture', `${num} du ${date(e.date)}`],
    ['Libellé', e.label],
    ['Référence de pièce', e.pieceRef ?? '—'],
  ]);
  const invoices = ids('inv:').map((id) => c.pd.invoices.find((i) => i.id === id)).filter((i): i is Invoice => !!i);
  if (invoices.length) {
    const shown = invoices.slice(0, 60);
    b.table(['Fournisseur', 'Facture', 'Date', 'Objet', 'Bon de commande', 'Montant TTC'], shown.map((i) => [tpName(c, i.supplierId), i.number, date(i.invoiceDate), i.description, i.orderRef ?? '—', euro(i.total)]), { title: 'Factures', align: ['left', 'left', 'left', 'left', 'left', 'right'] });
    if (invoices.length > shown.length) b.note(`… et ${invoices.length - shown.length} autres factures du même lot.`);
  }
  const loans = ids('loan:').map((id) => c.pd.loans.find((l) => l.id === id)).filter((l) => !!l);
  if (loans.length) {
    const sched = schedulesOf(c);
    b.table(['Contrat', 'Prêteur', 'Échéance', 'Capital', 'Intérêts'], loans.map((l) => {
      const s = (sched.get(l!.id) ?? []).find((x) => x.dueDate === e.date);
      return [l!.contractNumber, tpName(c, l!.lenderId), s ? date(s.dueDate) : date(e.date), s ? euro(s.principal) : euro0(l!.principal), s ? euro(s.interest) : '—'];
    }), { title: 'Avis d’échéance et contrats de prêt', align: ['left', 'left', 'left', 'right', 'right'] });
  }
  const subs = ids('sub:').map((id) => c.pd.subsidies.find((s) => s.id === id)).filter((s) => !!s);
  if (subs.length) b.table(['Financeur', 'Programme', 'Décision', 'Montant accordé'], subs.map((s) => [c.d.grantors[s!.grantorId] ?? s!.grantorId, progName(c, s!.programmeId), date(s!.decisionDate), euro0(s!.amount)]), { title: 'Décisions de financement', align: ['left', 'left', 'left', 'right'] });
  const comps = ids('comp:').map((id) => c.pd.components.find((x) => x.id === id)).filter((x) => !!x);
  if (comps.length) b.table(['Composant', 'Bâtiment', 'Mise en service', 'Valeur brute'], comps.map((x) => [x!.label, x!.building, date(x!.inServiceDate), euro0(x!.cost)]), { title: 'Fiches d’immobilisation', align: ['left', 'left', 'left', 'right'] });
  b.table(['Compte', 'Libellé du compte', 'Débit', 'Crédit'], e.lines.slice(0, 80).map((l) => [l.account + (l.aux ? ` (${l.aux})` : ''), c.presented.chart.accounts.find((a) => a.number === l.account)?.label ?? '', l.debit ? euro(l.debit) : '', l.credit ? euro(l.credit) : '']), { title: 'Imputation comptable', align: ['left', 'left', 'right', 'right'] });
  b.sign(person(c, 'chiefAccountant').name, person(c, 'chiefAccountant').role);
  return b.build();
}

// ---------------------------------------------------------------------------
// closing file: loan schedules; interim extraction
// ---------------------------------------------------------------------------

function debtSchedule(c: DocContext): DocumentModel {
  const sched = schedulesOf(c);
  const b = new DocBuilder({ id: 'echeancier-emprunts-2026', title: 'Tableaux d’amortissement des emprunts – échéances 2026', category: 'accounting', date: '2026-01-14', issuer: ENTITY_HEADER(c), availability: onRequest('closing-file', 'debt-schedule', 'chiefAccountant') });
  const loans = c.pd.loans.filter((l) => l.refDate <= YEAR_END);
  let crd = 0;
  let cap = 0;
  let int = 0;
  const rows = loans.map((l) => {
    const s = sched.get(l.id) ?? [];
    const o = outstandingAt(l, s, YEAR_END);
    const due = s.filter((x) => x.dueDate.startsWith('2026'));
    const p = due.reduce((a, x) => a + x.principal, 0);
    const i = due.reduce((a, x) => a + x.interest, 0);
    crd += o;
    cap += p;
    int += i;
    return [l.contractNumber, tpName(c, l.lenderId), l.product, euro0(o), due.map((x) => date(x.dueDate)).join(', ') || '—', euro0(p), euro0(i)];
  });
  b.table(['Contrat', 'Prêteur', 'Produit', 'Capital restant dû au 31/12/2025', 'Échéances 2026', 'Capital 2026', 'Intérêts 2026'], rows, { align: ['left', 'left', 'left', 'right', 'left', 'right', 'right'], footer: ['Total', '', '', euro0(crd), '', euro0(cap), euro0(int)] });
  return b.build();
}

function interimExtraction(c: DocContext): DocumentModel {
  const cutoff = c.params.game.dataVintages.interim.cutoff;
  const entries = c.presented.ledgers.current.entries.filter((e) => e.journal === 'AN' || e.validDate <= cutoff);
  let debit = 0;
  for (const e of entries) for (const l of e.lines) debit += l.debit;
  const chief = person(c, 'chiefAccountant');
  const b = new DocBuilder({ id: 'extraction-comptable-interim', title: `Extraction comptable au ${date(cutoff)} – bordereau de transmission`, category: 'accounting', date: cutoff, issuer: `${chief.name}, ${chief.role}`, recipient: c.params.game.firmName, availability: onRequest('interim-extraction', '', 'chiefAccountant') });
  b.fields([
    ['Période', `du 01/01/2025 au ${date(cutoff)} (écritures validées)`],
    ['Nombre d’écritures', String(entries.length)],
    ['Total des débits (à-nouveaux compris)', euro(debit)],
  ]);
  b.list(['Balance générale au ' + date(cutoff) + ' et cumul au ' + date(`${Number(cutoff.slice(0, 4)) - 1}${cutoff.slice(4)}`), 'Fichier des écritures comptables (FEC) des écritures validées', 'Balance de l’auxiliaire des locataires', 'Journal de l’interface de quittancement']);
  b.note('Les écritures d’inventaire et les remboursements annuels d’emprunts ne sont pas encore passés : la balance n’est pas un projet de comptes.');
  b.sign(chief.name, chief.role, cutoff);
  return b.build();
}

// ---------------------------------------------------------------------------
// closing file: transmittal of the documents already in the data room
// ---------------------------------------------------------------------------

/**
 * Closing-file objects answered by a transmittal note of the chief accountant
 * or the CFO: the documents it lists are handed over with the closing file
 * (data room, at their own dates), so the note is dated on the last of them.
 * The titles and dates follow the catalogue. They make most of the closing
 * file: its list of objects does not single out the files the scenario
 * answers.
 */
export const CLOSING_TRANSMITTALS: Readonly<Record<string, { date: IsoDate; from: Interlocutor; documents: readonly { title: string; date: IsoDate }[] }>> = {
  'fixed-assets': {
    date: '2026-02-06',
    from: 'chiefAccountant',
    documents: [
      { title: 'Tableau des immobilisations 2025 et détail des immobilisations en cours par opération', date: '2026-02-06' },
      { title: 'Tableau de suivi des subventions d’investissement (subventions à recevoir et opérations récentes)', date: '2026-02-06' },
    ],
  },
  'hlm-sales': {
    date: '2026-01-26',
    from: 'cfo',
    documents: [{ title: 'État des ventes HLM comptabilisées en 2025', date: '2026-01-26' }],
  },
  treasury: {
    date: '2026-01-12',
    from: 'chiefAccountant',
    documents: [
      { title: 'État de rapprochement bancaire au 31/12/2025 – compte principal', date: '2026-01-12' },
      { title: 'Détail des comptes d’attente au 31/12/2025', date: '2026-01-12' },
    ],
  },
  'rent-billing': {
    date: '2026-01-20',
    from: 'rentManager',
    documents: [
      { title: 'État de quittancement 2025 par programme (LOGIGES / LOGIGES 2)', date: '2026-01-08' },
      { title: 'Rapprochement RLS / APL 2025 avec les états de la CAF', date: '2026-01-20' },
    ],
  },
  accruals: {
    date: '2026-02-04',
    from: 'chiefAccountant',
    documents: [{ title: 'État des charges à payer et des produits à recevoir au 31/12/2025', date: '2026-02-04' }],
  },
  provisions: {
    date: '2026-01-30',
    from: 'chiefAccountant',
    documents: [{ title: 'Tableau des provisions et dépréciations 2025 (dossier de clôture)', date: '2026-01-30' }],
  },
  payroll: {
    date: '2026-01-22',
    from: 'cfo',
    documents: [
      { title: 'État des effectifs et des mouvements de personnel 2025', date: '2026-01-15' },
      { title: 'Évaluation actuarielle des indemnités de fin de carrière au 31/12/2025', date: '2026-01-22' },
    ],
  },
  'property-tax': {
    date: '2025-12-15',
    from: 'cfo',
    documents: [
      { title: 'Avis de taxe foncière 2025 (récapitulatif)', date: '2025-09-10' },
      { title: 'Tableau fiscal – taxe foncière sur les propriétés bâties 2024-2025', date: '2025-10-20' },
      { title: 'Réclamation contentieuse – dégrèvement de TFPB pour travaux d’économie d’énergie', date: '2025-12-15' },
    ],
  },
  litigation: {
    date: '2026-01-10',
    from: 'cfo',
    documents: [{ title: 'Registre des contentieux en cours au 31/12/2025 (service juridique)', date: '2026-01-10' }],
  },
  'aged-balance': {
    date: '2026-01-09',
    from: 'chiefAccountant',
    documents: [
      { title: 'Balance âgée des comptes de locataires au 31/12/2025 (LOGIGES 2)', date: '2026-01-08' },
      { title: 'Balance âgée des fournisseurs au 31/12/2025 – factures échues non réglées', date: '2026-01-09' },
    ],
  },
  'management-report-support': {
    date: '2026-01-15',
    from: 'cfo',
    documents: [
      { title: 'Balance âgée des fournisseurs au 31/12/2025 – factures échues non réglées (délais de paiement)', date: '2026-01-09' },
      { title: 'Rapport de vacance 2025 (gestion locative)', date: '2026-01-15' },
      { title: 'Calcul de l’autofinancement net HLM, établi avec le projet de comptes', date: '2026-01-15' },
    ],
  },
};

function closingTransmittal(c: DocContext, object: string): DocumentModel | null {
  const t = CLOSING_TRANSMITTALS[object];
  if (!t) return null;
  const who = person(c, t.from);
  const label = c.params.requests.families.find((f) => f.id === 'closing-file')?.objects?.find((o) => o.id === object)?.label ?? object;
  const b = new DocBuilder({ id: `bordereau-${object}`, title: `Bordereau de transmission – ${label}`, category: 'accounting', date: t.date, issuer: `${who.name}, ${who.role}`, recipient: c.params.game.firmName, availability: onRequest('closing-file', object, t.from) });
  b.p('En réponse à votre demande, les pièces suivantes du dossier de clôture ont été versées à la gestion documentaire mise à votre disposition :');
  b.table(['Pièce', 'Établie le'], t.documents.map((d) => [d.title, date(d.date)]), { align: ['left', 'left'] });
  b.p('Nous restons à votre disposition pour tout complément.');
  b.sign(who.name, who.role, t.date);
  return b.build();
}

// ---------------------------------------------------------------------------
// generic replies to requests
// ---------------------------------------------------------------------------

/** Label of the request on the documents answering it (designer mode, review pack). */
export function withRequestLabel(c: DocContext, family: string, object: string, docs: readonly DocumentModel[]): DocumentModel[] {
  const label = requestLabel(c.params, family, object, (id) => thirdParty(c, id)?.name);
  return docs.map((d) => (d.availability.kind === 'onRequest' ? { ...d, availability: { ...d.availability, request: label } } : d));
}

/**
 * Generic documents answering a request of the family about the object,
 * built from the presented data as known at `asOf` (date of the request), or
 * an empty list when the object is unknown. `update`: an earlier request of
 * the same object was sent on another date — the documents of the families
 * dated on the request carry the date in their ids. The scenario's objects
 * are answered by documents/index.ts → requestReply.
 */
export function genericReplies(c: DocContext, family: string, object: string, asOf: IsoDate, update = false): DocumentModel[] {
  return withRequestLabel(c, family, object, buildGeneric(c, family, object, asOf, update));
}

function buildGeneric(c: DocContext, family: string, object: string, asOf: IsoDate, update: boolean): DocumentModel[] {
  switch (family) {
    case 'interim-extraction':
      return [interimExtraction(c)];
    case 'entry-voucher': {
      const [y, num] = object.split(':');
      const d = num ? entryVoucher(c, Number(y), num) : null;
      return d ? [d] : [];
    }
    case 'programme-invoices':
      return programmeInvoices(c, object, asOf, update);
    case 'programme-rent-roll': {
      const [pid, month] = object.split(':');
      return pid && month ? [rentRoll(c, pid, month)] : [];
    }
    case 'operation-orders':
      return [operationOrders(c, object, asOf, update)];
    case 'operation-acceptance':
      return [operationAcceptance(c, object, asOf, update)];
    case 'supplier-tender':
      return supplierTender(c, object, asOf);
    case 'sale-notary':
      return [saleNotary(c, object, asOf, update)];
    case 'third-party-agreements':
      return [agreements(c, object, asOf)];
    case 'programme-components':
      return [componentRegister(c, object)];
    case 'bank-statements':
      return [bankStatement(c, object)];
    case 'rent-interface':
      return [interfaceJournal(c, object)];
    case 'closing-file': {
      if (object === 'debt-schedule') return [debtSchedule(c)];
      const t = closingTransmittal(c, object);
      return t ? [t] : [];
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// confirmations
// ---------------------------------------------------------------------------

/** Date at which the third party's reply reaches the auditor (business days after the sending, engine calendar like the scenario letters). */
export function confirmationReplyDate(c: DocContext, thirdPartyId: string): IsoDate {
  const sent = c.d.calendar['confirmationsSent']!;
  const set = c.params.requests.confirmations.replyBusinessDays[thirdPartyId];
  if (set !== undefined) return addBusinessDays(sent, set);
  const min = c.params.game.responseDelaysBusinessDays['thirdPartyMin'] ?? 5;
  const max = c.params.game.responseDelaysBusinessDays['thirdPartyMax'] ?? 15;
  return addBusinessDays(sent, createRng(`confirmation:${thirdPartyId}`).int(min, max));
}

/** Supplier balance in the books (credit positive) at 31/12/2025, on every auxiliary account of the third party. */
function auxBalance(c: DocContext, aux: string, prefixes: readonly string[]): Cents {
  const b = closingBalancesByAux(c.presented.ledgers.current);
  let s = 0;
  for (const [k, v] of b) {
    const [account, a] = k.split('|') as [string, string];
    if (a === aux && prefixes.some((p) => account.startsWith(p))) s += v;
  }
  return s;
}

/** Text and rows of a reply « sans écart » built from the books at 31/12/2025. */
export function fillConfirmationReply(b: DocBuilder, c: DocContext, thirdPartyId: string): void {
  const tp = thirdParty(c, thirdPartyId);
  const name = tpName(c, thirdPartyId);
  const entity = c.params.scenario.entity.name;
  const sched = schedulesOf(c);
  const loans = c.pd.loans.filter((l) => l.lenderId === thirdPartyId && l.refDate <= YEAR_END);
  if (loans.length) {
    const crd = loans.reduce((s, l) => s + outstandingAt(l, sched.get(l.id) ?? [], YEAR_END), 0);
    const icne = loans.reduce((s, l) => s + accruedInterest(l, sched.get(l.id) ?? [], YEAR_END), 0);
    b.fields([
      ['Nombre de contrats', String(loans.length)],
      ['Capital restant dû au 31/12/2025', euro0(crd)],
      ['Intérêts courus non échus au 31/12/2025', euro0(icne)],
    ]);
    b.p('Nous ne vous connaissons aucun autre concours, engagement ni garantie.');
    return;
  }
  switch (tp?.kind) {
    case 'lender':
      b.fields([
        ['Solde créditeur du compte courant au 31/12/2025', euro(debitOf(c.pb, ['5121']) + fromEuros(c.d.F6.outstandingChequesEuros))],
        ['Concours, emprunts et engagements', 'néant'],
      ]);
      b.p('Le solde indiqué est celui de nos livres à la date d’arrêté, avant prise en compte des opérations en cours d’encaissement ou de paiement chez le titulaire.');
      return;
    case 'notary': {
      const held = c.pd.sales.filter((s) => s.notaryId === thirdPartyId && s.deedDate <= YEAR_END && s.paymentDate > YEAR_END).reduce((s, x) => s + x.price, 0);
      b.p(held ? `Au 31/12/2025, nous détenions pour le compte de ${entity} la somme de ${euro0(held)}, versée depuis.` : `Au 31/12/2025, aucune somme n’était détenue ni due pour le compte de ${entity}.`);
      return;
    }
    case 'publicBody': {
      const due = c.pd.subsidies.filter((s) => s.grantorId === thirdPartyId && s.decisionDate <= YEAR_END && !(s.cancelledOn && s.cancelledOn <= YEAR_END)).map((s) => ({ s, rest: s.amount - s.receipts.filter((r) => r.date <= YEAR_END).reduce((a, r) => a + r.amount, 0) })).filter((x) => x.rest > 0);
      b.table(['Décision', 'Programme', 'Montant accordé', 'Reste à verser au 31/12/2025'], due.map((x) => [date(x.s.decisionDate), progName(c, x.s.programmeId), euro0(x.s.amount), euro0(x.rest)]), { align: ['left', 'left', 'right', 'right'], footer: ['Total', '', '', euro0(due.reduce((a, x) => a + x.rest, 0))] });
      b.p('Les montants restant à verser le seront sur présentation des justificatifs d’achèvement des opérations.');
      return;
    }
    default: {
      const balance = tp?.aux ? -auxBalance(c, tp.aux, ['40', '41']) : 0;
      b.fields([[balance >= 0 ? `Solde en notre faveur au 31/12/2025` : `Solde en votre faveur au 31/12/2025`, euro(Math.abs(balance))]]);
      b.p(`Ce solde correspond aux factures émises et non réglées à la date d’arrêté. Nous ne détenons aucune autre créance sur ${entity}.`);
    }
  }
}

/** Generic reply of a third party to a confirmation request (null when the third party never replies). */
export function genericConfirmationReply(c: DocContext, thirdPartyId: string): DocumentModel | null {
  if (c.params.requests.confirmations.nonResponders.includes(thirdPartyId)) return null;
  const name = tpName(c, thirdPartyId);
  const at = confirmationReplyDate(c, thirdPartyId);
  const b = new DocBuilder({ id: `confirmation-${slug(name)}`, title: confirmationReplyTitle(name), category: 'thirdParty', date: at, issuer: name, recipient: c.params.game.firmName, availability: { kind: 'confirmation', request: thirdPartyId, label: name, arrives: at } });
  fillConfirmationReply(b, c, thirdPartyId);
  b.sign(name, 'Pour le service comptable', at);
  return b.build();
}
