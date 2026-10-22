/**
 * Recalculations (plan J4 §11, J4-9): six tools (depreciation by component,
 * accrued interest by loan, impairment of receivables, maintenance provision
 * against the multi-year plan, rent revision against the cap, prorata
 * temporis). Each opens on the client's file — accessible only once its
 * source document has been obtained — and on the client's assumptions; the
 * player changes an assumption by citing its source (document or parameter);
 * the recorded amount is read at the posting grain. Only the summary is
 * stored (computed, recorded), never the detail lines.
 *
 * Gap = computed − recorded: the overstatement of the presented result (or of
 * the presented liability for the rent revision). The tools never read the
 * fields that betray the correction key (official-plan flag of the
 * maintenance items, reason of a write-off, service year of an invoice); the
 * CFO's version of the plan is read only through its document.
 * Section of the game state owned by J4c.
 */
import { z } from 'zod';
import { closingBalances, closingBalancesByAux } from '../engine/balance';
import { daysBetween, endOfMonth, type IsoDate } from '../engine/dates';
import { formatEuro } from '../engine/format';
import { allocate, type Cents } from '../engine/money';
import { accumulatedDepreciation, accumulatedSubsidyRelease } from '../engine/subledgers/depreciation';
import { accruedInterest } from '../engine/subledgers/loans';
import type { AssetComponent, ComponentFamily, JournalEntry, LoanScheduleLine, World } from '../engine/types';
import type { PresentationFacts } from '../scenario/anomalies/draft';
import type { ScenarioDatasets, TenantAccount } from '../scenario/datasets';
import type { DocumentModel } from '../scenario/documents/model';
import { programmeLabel } from '../scenario/documents/request-labels';
import { tenantAllowance, type ImpairmentMethod } from '../scenario/impairment';
import type { Params } from '../scenario/params';
import type { HoursCharge } from './budget';

export type RecalcToolId = 'depreciation' | 'icne' | 'impairment' | 'pge' | 'rent-revision' | 'prorata';
export const RECALC_TOOLS: readonly RecalcToolId[] = ['depreciation', 'icne', 'impairment', 'pge', 'rent-revision', 'prorata'];

export interface Recalc {
  id: string;
  executionId: string | null;
  tool: string;
  scope: string;
  /** Assumptions used, with their source ('doc:<id>[#block]', 'param:<name>', or null for the client's). */
  assumptions: Record<string, { value: string | number; source: string | null }>;
  summary: { computed: number; recorded: number };
  on: IsoDate;
}

export interface RecalcsState {
  items: Recalc[];
}

export function initialRecalcs(): RecalcsState {
  return { items: [] };
}

export const recalcsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      executionId: z.string().nullable(),
      tool: z.string(),
      scope: z.string(),
      assumptions: z.record(z.string(), z.object({ value: z.union([z.string(), z.number()]), source: z.string().nullable() })),
      summary: z.object({ computed: z.number(), recorded: z.number() }),
      on: z.string(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// definitions
// ---------------------------------------------------------------------------

export type AssumptionKind = 'date' | 'percent' | 'choice' | 'component' | 'amount';

export interface AssumptionDef {
  id: string;
  label: string;
  kind: AssumptionKind;
  choices?: readonly { id: string; label: string }[];
  help?: string;
}

export interface RecalcToolDef {
  id: RecalcToolId;
  label: string;
  description: string;
  /** What the scope designates. */
  scope: 'programme' | 'lender' | 'receivables' | 'single' | 'rents';
}

export const TOOL_DEFS: Readonly<Record<RecalcToolId, RecalcToolDef>> = {
  depreciation: { id: 'depreciation', label: 'Amortissements par composant', description: 'Dotation 2025, sorties de composants et quote-part des subventions d’un programme, selon le registre des composants.', scope: 'programme' },
  icne: { id: 'icne', label: 'Intérêts courus non échus par prêt', description: 'Intérêts courus au 31/12/2025, prêt par prêt, depuis la dernière échéance.', scope: 'lender' },
  impairment: { id: 'impairment', label: 'Dépréciation des créances', description: 'Dépréciation des créances locatives ou des redevances des gestionnaires au 31/12/2025, selon la méthode retenue.', scope: 'receivables' },
  pge: { id: 'pge', label: 'Provision pour gros entretien', description: 'Provision au 31/12/2025 selon la version du plan pluriannuel d’entretien retenue.', scope: 'single' },
  'rent-revision': { id: 'rent-revision', label: 'Révision des loyers', description: 'Loyers 2025 des logements conventionnés recalculés avec la hausse maximale retenue.', scope: 'rents' },
  prorata: { id: 'prorata', label: 'Prorata temporis', description: 'Montant annuel rapporté à une période (jours exacts / 365).', scope: 'single' },
};

/** Assumptions of a tool for a scope (labels for the form). */
export function assumptionDefs(tool: RecalcToolId, scope: string): AssumptionDef[] {
  switch (tool) {
    case 'depreciation':
      return [
        { id: 'inService', label: 'Mise en service des immobilisations en cours du programme', kind: 'date', help: 'Date à partir de laquelle les immobilisations en cours sont ventilées par composant (nomenclature de l’organisme) et amorties ; vide : restent en cours.' },
        { id: 'retire', label: 'Composant remplacé à sortir de l’actif', kind: 'component', help: 'Composant et date de sortie ; vide : aucune sortie.' },
        { id: 'revisedFrom', label: 'Révision du plan d’amortissement à compter du', kind: 'date' },
        { id: 'revisedUntil', label: 'Fin d’utilisation (amortissement de la valeur nette résiduelle jusqu’au)', kind: 'date' },
      ];
    case 'icne':
      return [
        { id: 'method', label: 'Taux des prêts indexés sur le Livret A', kind: 'choice', choices: [{ id: 'flat', label: 'Taux forfaitaire unique' }, { id: 'loan', label: 'Taux propre à chaque prêt depuis sa dernière échéance' }] },
        { id: 'flatRatePct', label: 'Taux forfaitaire', kind: 'percent' },
      ];
    case 'impairment':
      return scope === 'managers'
        ? [{ id: 'managerRate', label: 'Taux de dépréciation des redevances impayées des gestionnaires', kind: 'percent' }]
        : [
            { id: 'formerRate', label: 'Locataires partis (solde net des dépôts conservés)', kind: 'percent' },
            { id: 'over6mRate', label: 'Locataires présents, ancienneté supérieure à six mois', kind: 'percent' },
            { id: 'procedureRate', label: 'Dossiers en procédure et surendettement', kind: 'percent' },
            { id: 'discharge', label: 'Rétablissements personnels avec effacement notifiés en 2025', kind: 'choice', choices: [{ id: 'keep', label: 'Maintenus parmi les présents' }, { id: 'loss', label: 'Passés en perte (dette effacée)' }] },
          ];
    case 'pge':
      return [{ id: 'planVersion', label: 'Version du plan pluriannuel d’entretien', kind: 'choice', choices: [{ id: 'daf', label: 'Fichier de calcul de la direction financière' }, { id: 'official', label: 'Plan de la direction du patrimoine' }] }];
    case 'rent-revision':
      return [{ id: 'capPct', label: 'Hausse maximale des loyers au 01/01/2025', kind: 'percent' }];
    case 'prorata':
      return [
        { id: 'amount', label: 'Montant annuel', kind: 'amount' },
        { id: 'from', label: 'Du', kind: 'date' },
        { id: 'to', label: 'Au (inclus)', kind: 'date' },
        { id: 'recorded', label: 'Montant comptabilisé', kind: 'amount' },
      ];
  }
}

/** The client's assumptions (default of every tool). */
export function clientAssumptions(params: Params, tool: RecalcToolId, scope: string): Record<string, string | number> {
  const t = params.scenario.tenants;
  switch (tool) {
    case 'depreciation':
      return { inService: '', retire: '', revisedFrom: '', revisedUntil: '' };
    case 'icne':
      return { method: 'flat', flatRatePct: params.anomalies.A08.flatRatePct };
    case 'impairment':
      return scope === 'managers'
        ? { managerRate: Math.round(t.presentedMethod.residenceManagerRate * 10000) / 100 }
        : { formerRate: Math.round(t.presentedMethod.formerRate * 10000) / 100, over6mRate: Math.round(t.cleanMethod.over6mRate * 10000) / 100, procedureRate: Math.round(t.cleanMethod.procedureRate * 10000) / 100, discharge: 'keep' };
    case 'pge':
      return { planVersion: 'daf' };
    case 'rent-revision': {
      const r = params.regulatory.rentRevision.byYear['2025'];
      return { capPct: r?.votedByBoardPct ?? r?.appliedPct ?? 0 };
    }
    case 'prorata':
      return { amount: 0, from: '2025-01-01', to: '2025-12-31', recorded: 0 };
  }
}

// ---------------------------------------------------------------------------
// data and access to the client's file
// ---------------------------------------------------------------------------

export interface RecalcData {
  params: Params;
  /** Presented world (what the player audits). */
  world: World;
  facts: PresentationFacts;
  /** Scenario document available to the player at the game date (undefined otherwise). */
  doc: (id: string) => DocumentModel | undefined;
  /** The documents answering the request key have been received. */
  obtained: (key: string) => boolean;
}

const ds = (d: RecalcData) => d.world.datasets as unknown as ScenarioDatasets;

/** Scopes of a tool (programmes, lenders, populations of receivables…). */
export function toolScopes(tool: RecalcToolId, data: RecalcData): { id: string; label: string }[] {
  const p = data.params;
  switch (tool) {
    case 'depreciation':
      return [...p.programmes.map((x) => ({ id: x.id, label: x.name })), ...(ds(data).components.some((c) => c.programmeId === 'SIE') ? [{ id: 'SIE', label: programmeLabel(p, 'SIE') }] : [])];
    case 'icne':
      return [{ id: 'all', label: 'Tous les prêts' }, ...[...new Set(ds(data).loans.map((l) => l.lenderId))].map((id) => ({ id, label: ds(data).thirdParties.find((t) => t.id === id)?.name ?? id }))];
    case 'impairment':
      return [
        { id: 'tenants', label: 'Créances sur les locataires' },
        { id: 'managers', label: 'Redevances des gestionnaires de structures collectives' },
      ];
    case 'rent-revision':
      return [{ id: 'all', label: 'Tous les logements conventionnés' }, ...p.programmes.filter((x) => x.kind === 'family').map((x) => ({ id: x.id, label: x.name }))];
    case 'pge':
      return [{ id: 'pge', label: 'Provision pour gros entretien' }];
    case 'prorata':
      return [{ id: 'free', label: 'Calcul libre' }];
  }
}

export interface ToolAccess {
  ok: boolean;
  /** What must be obtained first (French). */
  missing?: string;
}

/** The client's file of the tool is accessible (its source document has been obtained). */
export function toolAccess(tool: RecalcToolId, scope: string, data: RecalcData): ToolAccess {
  switch (tool) {
    case 'depreciation':
      return data.obtained(`programme-components:${scope}`) ? { ok: true } : { ok: false, missing: `le registre des composants du programme ${programmeLabel(data.params, scope)} (demande au chef comptable)` };
    case 'icne':
      return data.doc('calcul-icne') ? { ok: true } : { ok: false, missing: 'le fichier de calcul des intérêts courus (pièce du dossier de clôture)' };
    case 'impairment':
      return data.doc('calcul-depreciation-creances') ? { ok: true } : { ok: false, missing: 'le calcul de la dépréciation des créances de la direction financière' };
    case 'pge':
      return data.doc('ppe-daf') ? { ok: true } : { ok: false, missing: 'le fichier de calcul de la provision pour gros entretien' };
    case 'rent-revision':
      return data.doc('quittances-echantillon') || (scope !== 'all' && data.obtained(`programme-rent-roll:${scope}:2025-01`)) ? { ok: true } : { ok: false, missing: 'les quittances de décembre 2024 et de janvier 2025 (dossier de révision des loyers) ou le quittancement de janvier 2025 du programme' };
    case 'prorata':
      return { ok: true };
  }
}

/** Assumption values that need a document the player has not obtained (French reason), or null. */
export function assumptionBlocked(tool: RecalcToolId, values: Record<string, string | number>, data: RecalcData): string | null {
  if (tool === 'pge' && values['planVersion'] === 'official' && !data.doc('ppe-officiel')) return 'Le plan de la direction du patrimoine n’a pas été obtenu.';
  if (tool === 'impairment' && values['discharge'] === 'loss' && !data.doc('decisions-surendettement')) return 'Les décisions de rétablissement personnel n’ont pas été obtenues.';
  return null;
}

// ---------------------------------------------------------------------------
// computations
// ---------------------------------------------------------------------------

export interface RecalcLine {
  label: string;
  computed: Cents;
  recorded: Cents;
}

export interface RecalcOutcome {
  computed: Cents;
  recorded: Cents;
  /** computed − recorded: overstatement of the presented result (or understatement of the liability). */
  gap: Cents;
  lines: RecalcLine[];
}

const YEAR_START = '2025-01-01';
const YEAR_END = '2025-12-31';
const PREV_END = '2024-12-31';

function outcome(lines: RecalcLine[], sign: (l: RecalcLine) => number = () => 1): RecalcOutcome {
  const computed = lines.reduce((s, l) => s + sign(l) * l.computed, 0);
  const recorded = lines.reduce((s, l) => s + sign(l) * l.recorded, 0);
  return { computed, recorded, gap: computed - recorded, lines };
}

function num(v: string | number | undefined, fallback = 0): number {
  const x = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(x) ? x : fallback;
}

function str(v: string | number | undefined): string {
  return v === undefined ? '' : String(v);
}

// --- depreciation by component ------------------------------------------------

/** Work in progress (2312 land, 2313 works) of a programme at the year end, from the ledgers. */
function wipOf(world: World, pid: string): { land: Cents; works: Cents } {
  const out = { land: 0, works: 0 };
  const add = (e: JournalEntry) => {
    for (const l of e.lines) {
      if (l.account !== '2312' && l.account !== '2313') continue;
      if (!l.refs?.includes(`prog:${pid}`)) continue;
      if (l.account === '2312') out.land += l.debit - l.credit;
      else out.works += l.debit - l.credit;
    }
  };
  for (const e of world.ledgers.prior.entries) add(e);
  for (const e of world.ledgers.current.entries) if (e.journal !== 'AN') add(e);
  return out;
}

/** Components a work in progress gives once put into service: land, and the works split over the buildings and the families of the nomenclature. */
function componentsFromWip(data: RecalcData, pid: string, inService: IsoDate): AssetComponent[] {
  const d = ds(data);
  const p = data.params.components;
  const wip = wipOf(data.world, pid);
  const op = d.operations.filter((o) => o.programmeId === pid && !d.components.some((c) => c.operationId === o.id)).sort((a, b) => b.year - a.year)[0]?.id ?? `OP-${pid}-MES`;
  const out: AssetComponent[] = [];
  const fam = (f: string) => p.families[f]!;
  if (wip.land > 0) out.push({ id: `${pid}-TER-MES`, programmeId: pid, building: `${pid}-TER`, family: 'land', label: fam('land').label, operationId: op, account: fam('land').account, cost: wip.land, inServiceDate: inService, usefulLifeYears: 0 });
  if (wip.works <= 0) return out;
  const buildings = d.buildings.filter((b) => b.programmeId === pid);
  const families = Object.keys(p.newConstructionShares);
  const perBuilding = buildings.length ? allocate(wip.works, buildings.map((b) => b.units)) : [wip.works];
  (buildings.length ? buildings : [{ id: pid }]).forEach((b, i) => {
    const parts = allocate(perBuilding[i]!, families.map((f) => p.newConstructionShares[f]!));
    families.forEach((f, k) => {
      if (!parts[k]) return;
      out.push({ id: `${b.id}-${f}-MES`, programmeId: pid, building: b.id, family: f as ComponentFamily, label: fam(f).label, operationId: op, account: fam(f).account, cost: parts[k]!, inServiceDate: inService, usefulLifeYears: fam(f).lifeYears });
    });
  });
  return out;
}

/** Components of the programme under the assumptions (register of the client, then the changes of the player). */
export function depreciationComponents(data: RecalcData, pid: string, a: Record<string, string | number>): AssetComponent[] {
  let comps = ds(data).components.filter((c) => c.programmeId === pid);
  const retire = str(a['retire']);
  if (retire.includes('@')) {
    const [id, at] = retire.split('@') as [string, string];
    comps = comps.map((c) => (c.id === id && c.inServiceDate <= at && !c.disposal ? { ...c, disposal: { date: at, reason: 'replacement' } } : c));
  }
  const from = str(a['revisedFrom']);
  const until = str(a['revisedUntil']);
  if (from && until && until >= from) {
    comps = comps.map((c) => (c.usefulLifeYears > 0 && c.inServiceDate < from && !(c.disposal && c.disposal.date < from) && !c.revisedPlan ? { ...c, revisedPlan: { from, until } } : c));
  }
  const inService = str(a['inService']);
  if (inService) comps = [...comps, ...componentsFromWip(data, pid, inService)];
  return comps;
}

function depreciationRecalc(data: RecalcData, pid: string, a: Record<string, string | number>): RecalcOutcome {
  // the closing entries of the year are computed on the register before the sales booked on the closing date (taken out at the signature)
  const comps = depreciationComponents(data, pid, a).map((c) => (c.disposal?.reason === 'sale' && c.disposal.date === YEAR_END ? { ...c, disposal: undefined } : c)) as AssetComponent[];
  let dep = 0;
  let retired = 0;
  for (const c of comps) {
    if (c.usefulLifeYears <= 0 || c.inServiceDate > YEAR_END) continue;
    if (c.disposal && (c.disposal.date < YEAR_START || c.disposal.reason === 'sale')) continue;
    const end = c.disposal && c.disposal.date <= YEAR_END ? c.disposal.date : YEAR_END;
    dep += accumulatedDepreciation(c, end) - accumulatedDepreciation(c, PREV_END);
    if (c.disposal && c.disposal.date <= YEAR_END) retired += c.cost - accumulatedDepreciation(c, c.disposal.date);
  }
  let release = 0;
  for (const s of ds(data).subsidies) {
    if (s.programmeId !== pid || s.decisionDate > YEAR_END) continue;
    release += accumulatedSubsidyRelease(s, comps, YEAR_END) - accumulatedSubsidyRelease(s, comps, PREV_END);
  }
  // recorded: closing entries and disposals of the programme (sales excluded, on both sides)
  const rec = { dep: 0, retired: 0, release: 0 };
  for (const e of data.world.ledgers.current.entries) {
    if (e.journal === 'AN' || e.lines.some((l) => l.account === '7752' || l.account === '6752')) continue;
    for (const l of e.lines) {
      if (!l.refs?.includes(`prog:${pid}`)) continue;
      if (l.account === '68111') rec.dep += l.debit - l.credit;
      else if (l.account === '6758') rec.retired += l.debit - l.credit;
      else if (l.account === '777') rec.release += l.credit - l.debit;
    }
  }
  return outcome(
    [
      { label: 'Dotations aux amortissements de l’exercice', computed: dep, recorded: rec.dep },
      { label: 'Valeur nette comptable des composants sortis', computed: retired, recorded: rec.retired },
      { label: 'Quote-part des subventions virée au résultat', computed: release, recorded: rec.release },
    ],
    (l) => (l.label.startsWith('Quote-part') ? -1 : 1),
  );
}

// --- accrued interest -----------------------------------------------------------

function icneRecalc(data: RecalcData, scope: string, a: Record<string, string | number>): RecalcOutcome {
  const d = ds(data);
  const schedules = new Map<string, LoanScheduleLine[]>();
  for (const l of d.loanSchedules) schedules.set(l.loanId, [...(schedules.get(l.loanId) ?? []), l]);
  const flat = str(a['method']) === 'flat' ? num(a['flatRatePct']) : undefined;
  const loans = d.loans.filter((l) => l.refDate <= YEAR_END && (scope === 'all' || l.lenderId === scope));
  const ids = new Set(loans.map((l) => l.id));
  const indexed = { computed: 0, recorded: 0 };
  const other = { computed: 0, recorded: 0 };
  const kind = new Map(loans.map((l) => [l.id, l.rate.kind === 'livretA' ? indexed : other]));
  for (const l of loans) kind.get(l.id)!.computed += accruedInterest(l, schedules.get(l.id) ?? [], YEAR_END, l.rate.kind === 'livretA' ? flat : undefined);
  const entry = data.world.ledgers.current.entries.find((e) => e.pieceRef === 'INV2025-ICNE');
  for (const l of entry?.lines ?? []) {
    if (l.account !== '1688') continue;
    const id = l.refs?.find((r) => r.startsWith('loan:'))?.slice(5);
    if (id && ids.has(id)) kind.get(id)!.recorded += l.credit - l.debit;
  }
  return outcome([
    { label: 'Prêts indexés sur le Livret A', ...indexed },
    { label: 'Prêts à taux fixe et autres', ...other },
  ]);
}

// --- impairment of receivables ------------------------------------------------

/** Tenants listed by the decisions of personal recovery with debt discharge (read from the document obtained). */
export function dischargedTenants(doc: DocumentModel, data: RecalcData): Set<string> {
  const rows = new Set<string>();
  for (const b of doc.blocks) if (b.kind === 'table') for (const r of b.rows) if (r.cells[0] && r.cells[1] && r.cells[2]) rows.add(`${r.cells[0]}|${r.cells[1]}|${r.cells[2]}`);
  const out = new Set<string>();
  for (const t of ds(data).tenants) {
    const balance = t.byYear.y2025?.balance ?? 0;
    if (balance > 0 && rows.has(`${t.name}|${programmeLabel(data.params, t.programmeId)}|${formatEuro(balance)}`)) out.add(t.id);
  }
  return out;
}

function creditBalance(world: World, accounts: readonly string[]): Cents {
  const b = closingBalances(world.ledgers.current);
  return accounts.reduce((s, a) => s - (b.get(a) ?? 0), 0);
}

function impairmentRecalc(data: RecalcData, scope: string, a: Record<string, string | number>): RecalcOutcome {
  if (scope === 'managers') {
    const rate = num(a['managerRate']) / 100;
    const aux = closingBalancesByAux(data.world.ledgers.current);
    let computed = 0;
    for (const t of ds(data).thirdParties) {
      if (t.kind !== 'residenceManager' || !t.aux) continue;
      const due = aux.get(`4114|${t.aux}`) ?? 0;
      if (due > 0) computed += Math.round(due * rate);
    }
    return outcome([{ label: 'Dépréciation des redevances des gestionnaires (4914)', computed, recorded: creditBalance(data.world, ['4914']) }]);
  }
  const method: ImpairmentMethod = { formerRate: num(a['formerRate']) / 100, over6mRate: num(a['over6mRate']) / 100, procedureRate: num(a['procedureRate']) / 100, debtDischargeRate: num(a['over6mRate']) / 100, managerRate: 0 };
  const doc = str(a['discharge']) === 'loss' ? data.doc('decisions-surendettement') : undefined;
  const discharged = doc ? dischargedTenants(doc, data) : new Set<string>();
  const byAccount = new Map<string, Cents>();
  let loss = 0;
  for (const t of ds(data).tenants as readonly TenantAccount[]) {
    if (discharged.has(t.id)) {
      loss += Math.max(0, t.byYear.y2025?.balance ?? 0);
      continue;
    }
    const al = tenantAllowance(t, 'y2025', method);
    if (al) byAccount.set(al.account, (byAccount.get(al.account) ?? 0) + al.amount);
  }
  let recordedLoss = 0;
  for (const e of data.world.ledgers.current.entries) if (e.label.startsWith('Effacement de dettes')) for (const l of e.lines) if (l.account === '6541') recordedLoss += l.debit - l.credit;
  return outcome([
    { label: 'Locataires partis (4915)', computed: byAccount.get('4915') ?? 0, recorded: creditBalance(data.world, ['4915']) },
    { label: 'Locataires présents de plus de six mois (4911)', computed: byAccount.get('4911') ?? 0, recorded: creditBalance(data.world, ['4911']) },
    { label: 'Dossiers en procédure (4916)', computed: byAccount.get('4916') ?? 0, recorded: creditBalance(data.world, ['4916']) },
    { label: 'Créances effacées passées en perte', computed: loss, recorded: recordedLoss },
  ]);
}

// --- maintenance provision ---------------------------------------------------------

/** Items of the CFO's file reported as postponed — readable only through the obtained document. */
function postponedItems(data: RecalcData): Set<string> {
  if (!data.doc('ppe-daf')) return new Set();
  const v = data.facts.documents['pge.dafVersion'] as { postponedItemIds?: string[] } | undefined;
  return new Set(v?.postponedItemIds ?? []);
}

function pgeRecalc(data: RecalcData, a: Record<string, string | number>): RecalcOutcome {
  const official = str(a['planVersion']) === 'official';
  const postponed = official ? new Set<string>() : postponedItems(data);
  let computed = 0;
  for (const it of ds(data).maintenancePlan) if (it.plannedYear >= 2026 && !postponed.has(it.id)) computed += it.provision.y2025;
  return outcome([{ label: 'Provision pour gros entretien au 31/12/2025 (1572)', computed, recorded: creditBalance(data.world, ['1572']) }]);
}

// --- rent revision --------------------------------------------------------------------

/** Rents of 2025 above the allowed increase, by programme (regulated leases running on 1 January). */
export function rentExcess(data: RecalcData, capPct: number, scope: string): Map<string, Cents> {
  const m = new Map<string, Cents>();
  for (const l of ds(data).leases) {
    if (scope !== 'all' && l.programmeId !== scope) continue;
    if (!l.regulated || l.start > YEAR_START || (l.end && l.end < '2025-01-31')) continue;
    const excess = l.rent.y2025 - Math.round(l.rent.y2024 * (1 + capPct / 100));
    if (excess <= 0) continue;
    let months = 0;
    for (let mo = 1; mo <= 12; mo++) if (l.start <= `2025-${String(mo).padStart(2, '0')}-01` && (!l.end || l.end >= endOfMonth(2025, mo))) months++;
    m.set(l.programmeId, (m.get(l.programmeId) ?? 0) + excess * months);
  }
  return m;
}

function rentRecalc(data: RecalcData, scope: string, a: Record<string, string | number>): RecalcOutcome {
  const computed = [...rentExcess(data, num(a['capPct']), scope).values()].reduce((s, x) => s + x, 0);
  let recorded = 0;
  for (const e of data.world.ledgers.current.entries) {
    if (e.pieceRef !== 'INV2025-RESTIT') continue;
    for (const l of e.lines) if (l.account === '70411' && (scope === 'all' || l.refs?.includes(`prog:${scope}`))) recorded += l.debit - l.credit;
  }
  return outcome([{ label: 'Trop-perçu de loyers 2025 à restituer aux locataires', computed, recorded }]);
}

// --- prorata temporis ------------------------------------------------------------------

function prorataRecalc(a: Record<string, string | number>): RecalcOutcome {
  const from = str(a['from']);
  const to = str(a['to']);
  const days = from && to && to >= from ? daysBetween(from, to) + 1 : 0;
  return outcome([{ label: `Montant annuel × ${days} jours / 365`, computed: Math.round((num(a['amount']) * days) / 365), recorded: Math.round(num(a['recorded'])) }]);
}

/** Runs a tool on a scope with the given assumptions (the client's file must be accessible: toolAccess). */
export function runRecalc(tool: RecalcToolId, scope: string, assumptions: Record<string, string | number>, data: RecalcData): RecalcOutcome {
  const a = { ...clientAssumptions(data.params, tool, scope), ...assumptions };
  switch (tool) {
    case 'depreciation':
      return depreciationRecalc(data, scope, a);
    case 'icne':
      return icneRecalc(data, scope, a);
    case 'impairment':
      return impairmentRecalc(data, scope, a);
    case 'pge':
      return pgeRecalc(data, a);
    case 'rent-revision':
      return rentRecalc(data, scope, a);
    case 'prorata':
      return prorataRecalc(a);
  }
}

/** Assumptions changed from the client's without a source (ids); the prorata temporis has no client file: its inputs are the player's. */
export function unsourcedChanges(params: Params, tool: RecalcToolId, scope: string, assumptions: Record<string, { value: string | number; source: string | null }>): string[] {
  if (tool === 'prorata') return [];
  const client = clientAssumptions(params, tool, scope);
  return Object.entries(assumptions)
    .filter(([k, v]) => String(v.value) !== String(client[k] ?? '') && !v.source)
    .map(([k]) => k);
}

// ---------------------------------------------------------------------------
// actions and budget
// ---------------------------------------------------------------------------

export interface RecalcHost {
  recalcs: RecalcsState;
  clock: { date: IsoDate };
  journal?: readonly { on: IsoDate; kind: string; ref?: string; data?: Record<string, string | number | boolean> }[];
}

/** Records a recalculation (summary only). Refused when an assumption differs from the client's without a source. */
export function saveRecalc<S extends RecalcHost>(
  s: S,
  r: { executionId: string | null; tool: RecalcToolId; scope: string; assumptions: Record<string, { value: string | number; source: string | null }>; outcome: RecalcOutcome; title: string },
  params: Params,
): S {
  if (unsourcedChanges(params, r.tool, r.scope, r.assumptions).length) return s;
  const id = `rc${s.recalcs.items.length + 1}`;
  const item: Recalc = { id, executionId: r.executionId, tool: r.tool, scope: r.scope, assumptions: r.assumptions, summary: { computed: r.outcome.computed, recorded: r.outcome.recorded }, on: s.clock.date };
  const next: S = { ...s, recalcs: { items: [...s.recalcs.items, item] } };
  return next.journal ? { ...next, journal: [...next.journal, { on: s.clock.date, kind: 'recalc', ref: id, data: { title: r.title, gap: r.outcome.gap } }] } : next;
}

/** Hours charged by the recalculations run outside a procedure (within a procedure, its hours are those of the procedure). */
export function hoursCharged(s: RecalcsState, params: Params): HoursCharge[] {
  return s.items.filter((x) => x.executionId === null).map((x) => ({ member: 'senior' as const, hours: params.sampling.recalcHours, on: x.on }));
}
