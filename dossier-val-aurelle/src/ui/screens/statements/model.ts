/**
 * Tickable tables of the screen, built once per case: the presented
 * statements (assets, liabilities, income statement), the presented annex
 * tables (as presented, alterations included) and the certified prior-year
 * statements. Each value cell carries its tick key.
 */
import { formatDateFr } from '../../../engine/dates';
import type { Cents } from '../../../engine/money';
import type { StatementId, StatementLineDef } from '../../../engine/types';
import { annexCell, certifiedCell, orderedLines, statementCell, statementColumns, STATEMENT_ORDER, type StatementColumn } from '../../../game/ticking';
import type { CaseData } from '../../app/case';
import type { TabId } from './labels';

export interface ColumnModel {
  id: string;
  /** Column header. */
  label: string;
  /** Full name of the column (accessible names, export). */
  name: string;
}

export interface CellModel {
  key: string;
  /** Undefined when the presented table leaves the cell empty. */
  value: Cents | undefined;
}

export interface RowModel {
  id: string;
  label: string;
  depth: number;
  kind: StatementLineDef['kind'];
  cells: CellModel[];
}

export interface SectionModel {
  id: string;
  title: string;
  columns: ColumnModel[];
  /** Optional upper header row (column groups). */
  groups?: { label: string; span: number }[];
  rows: RowModel[];
  notes?: readonly string[];
  /** Accessible names of the cells mention the section title (several tables in one tab). */
  qualify?: boolean;
}

export interface TabModel {
  id: TabId;
  label: string;
  statement?: StatementId;
  sections: SectionModel[];
  /** Every tickable cell of the tab. */
  cells: string[];
}

const STATEMENT_TABS: { id: TabId; statement: StatementId; label: string }[] = [
  { id: 'actif', statement: 'assets', label: 'Bilan – actif' },
  { id: 'passif', statement: 'liabilities', label: 'Bilan – passif' },
  { id: 'resultat', statement: 'income', label: 'Compte de résultat' },
];

const STATEMENT_TITLES: Record<StatementId, string> = { assets: 'Bilan – actif', liabilities: 'Bilan – passif', income: 'Compte de résultat' };

function tab(id: TabId, label: string, sections: SectionModel[], statement?: StatementId): TabModel {
  return { id, label, sections, cells: sections.flatMap((s) => s.rows.flatMap((r) => r.cells.map((c) => c.key))), ...(statement ? { statement } : {}) };
}

export function certifiedTitle(prior: number): string {
  return `Comptes annuels ${prior} certifiés (annexés au rapport du commissaire aux comptes sur l’exercice ${prior})`;
}

export function buildTabs(c: CaseData): TabModel[] {
  const defs = c.params.statements;
  const { current: cy, prior: py } = c.params.scenario.years;
  const st = c.statements;

  const statementSection = (statement: StatementId, title: string): SectionModel => {
    const assets = statement === 'assets';
    const columns: Record<StatementColumn, ColumnModel> = {
      brut: { id: 'brut', label: 'Brut', name: `Brut ${cy}` },
      amort: { id: 'amort', label: 'Amortissements et dépréciations', name: `Amortissements et dépréciations ${cy}` },
      n: assets ? { id: 'n', label: 'Net', name: `Net ${cy}` } : { id: 'n', label: `Exercice ${cy}`, name: `Exercice ${cy}` },
      'n-1': assets ? { id: 'n-1', label: 'Net', name: `Net ${py}` } : { id: 'n-1', label: `Exercice ${py}`, name: `Exercice ${py}` },
    };
    const cols = statementColumns(statement);
    return {
      id: statement,
      title,
      columns: cols.map((k) => columns[k]),
      ...(assets
        ? {
            groups: [
              { label: `Exercice ${cy}`, span: 3 },
              { label: `Exercice ${py}`, span: 1 },
            ],
          }
        : {}),
      rows: orderedLines(defs, statement).map(({ def, depth }) => {
        const v = st.lines[def.id];
        const value: Record<StatementColumn, Cents | undefined> = { brut: v?.currentGross, amort: v?.currentDepreciation, n: v?.current, 'n-1': v?.prior };
        return { id: def.id, label: def.label, depth, kind: def.kind, cells: cols.map((k) => ({ key: statementCell(def.id, k), value: value[k] ?? 0 })) };
      }),
    };
  };

  const annex: SectionModel[] = c.annex().current.map((t) => ({
    id: t.id,
    title: t.title,
    qualify: true,
    columns: t.columns.map((col) => ({ id: col.id, label: col.label, name: col.label })),
    rows: t.rows.map((r) => ({ id: r.id, label: r.label, depth: 0, kind: 'detail' as const, cells: t.columns.map((col) => ({ key: annexCell(t.id, r.id, col.id), value: r.values[col.id] })) })),
    ...(t.notes ? { notes: t.notes } : {}),
  }));

  const certified = c.certified2024;
  const certifiedSections: SectionModel[] = STATEMENT_ORDER.map((statement) => {
    const column: ColumnModel =
      statement === 'income' ? { id: 'n-1', label: `Exercice ${py}`, name: `Comptes certifiés ${py}` } : { id: 'n-1', label: `Net au ${formatDateFr(`${py}-12-31`)}`, name: `Comptes certifiés ${py}` };
    return {
      id: statement,
      title: STATEMENT_TITLES[statement],
      columns: [column],
      rows: orderedLines(defs, statement).map(({ def, depth }) => ({ id: def.id, label: def.label, depth, kind: def.kind, cells: [{ key: certifiedCell(def.id), value: certified.lines[def.id]?.prior ?? 0 }] })),
    };
  });

  return [
    ...STATEMENT_TABS.map((t) => tab(t.id, t.label, [statementSection(t.statement, t.label)], t.statement)),
    tab('annexe', 'Annexe', annex),
    tab('certifies', `Comptes certifiés ${py}`, certifiedSections),
  ];
}
