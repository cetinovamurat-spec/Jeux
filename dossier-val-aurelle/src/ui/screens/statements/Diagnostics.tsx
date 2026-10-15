/**
 * Designer mode only: differences between the presented figures and the
 * corrected ones (clean world), presentation reclassifications and annex
 * alterations. Never rendered for the player.
 */
import { useMemo } from 'react';
import type { Cents } from '../../../engine/money';
import type { StatementId } from '../../../engine/types';
import { orderedLines, statementColumns, type StatementColumn } from '../../../game/ticking';
import { buildAnnex } from '../../../scenario/annex';
import { useCase } from '../../app/context';
import { Amount } from '../../components/Amount';
import { Badge, Card } from '../../components/ui';

interface DiffRow {
  key: string;
  where: string;
  column: string;
  presented: Cents | undefined;
  corrected: Cents | undefined;
}

const COLUMN_NAMES: Record<StatementColumn, string> = { brut: 'Brut N', amort: 'Amort. N', n: 'N', 'n-1': 'N-1' };

function DiffTable({ rows, label }: { rows: DiffRow[]; label: string }) {
  if (rows.length === 0) return <p className="px-3 py-2 text-sm text-muted">Aucun écart.</p>;
  const th = 'border-b border-line py-1 pr-2 text-left font-semibold';
  return (
    <div className="overflow-x-auto px-3 py-2">
      <table aria-label={label} className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-muted">
            <th scope="col" className={th}>
              Rubrique
            </th>
            <th scope="col" className={th}>
              Colonne
            </th>
            <th scope="col" className={`${th} text-right`}>
              Présenté
            </th>
            <th scope="col" className={`${th} text-right`}>
              Corrigé
            </th>
            <th scope="col" className={`${th} text-right`}>
              Présenté − corrigé
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="border-b border-line py-1 pr-2">{r.where}</td>
              <td className="border-b border-line py-1 pr-2">{r.column}</td>
              <td className="border-b border-line py-1 pr-2 text-right">{r.presented === undefined ? <span className="text-muted">omis</span> : <Amount cents={r.presented} />}</td>
              <td className="border-b border-line py-1 pr-2 text-right">{r.corrected === undefined ? <span className="text-muted">–</span> : <Amount cents={r.corrected} />}</td>
              <td className="border-b border-line py-1 text-right">
                <Amount cents={(r.presented ?? 0) - (r.corrected ?? 0)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DesignerCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="m-3 border-warn/50" title={<span className="text-warn">{title}</span>} actions={<Badge tone="warn">Concepteur</Badge>}>
      {children}
    </Card>
  );
}

export function StatementDiagnostics({ statement }: { statement: StatementId }) {
  const c = useCase();
  const defs = c.params.statements;
  const rows = useMemo(() => {
    const out: DiffRow[] = [];
    const pick = (v: { current: Cents; prior: Cents; currentGross?: Cents; currentDepreciation?: Cents } | undefined, col: StatementColumn) =>
      v ? { brut: v.currentGross ?? 0, amort: v.currentDepreciation ?? 0, n: v.current, 'n-1': v.prior }[col] : undefined;
    for (const { def } of orderedLines(defs, statement)) {
      for (const col of statementColumns(statement)) {
        const p = pick(c.statements.lines[def.id], col);
        const k = pick(c.certified2024.lines[def.id], col);
        if (p !== k) out.push({ key: `${def.id}:${col}`, where: def.label, column: COLUMN_NAMES[col], presented: p, corrected: k });
      }
    }
    return out;
  }, [c, defs, statement]);
  const lineIds = new Set(defs.filter((d) => d.statement === statement).map((d) => d.id));
  const reclass = c.presented.presentation.reclassifications.filter((r) => lineIds.has(r.to) || lineIds.has(c.accounts.get(r.account)?.rubriqueCredit ?? '') || lineIds.has(c.accounts.get(r.account)?.rubriqueDebit ?? ''));
  return (
    <DesignerCard title="Mode concepteur – écarts présentés / corrigés">
      <p className="px-3 pt-2 text-xs text-muted">Corrigé : comptes après correction de toutes les anomalies (colonne N) et comptes certifiés (colonne N-1).</p>
      <DiffTable rows={rows} label="Écarts entre les états présentés et corrigés" />
      {reclass.length > 0 && (
        <ul className="space-y-0.5 px-3 pb-2 text-xs">
          {reclass.map((r) => (
            <li key={`${r.account}:${r.to}`}>
              Reclassement de présentation : compte <span className="font-mono">{r.account}</span> ({c.accountLabel(r.account)}) présenté en « {defs.find((d) => d.id === r.to)?.label ?? r.to} » ({r.years.join(', ')})
            </li>
          ))}
        </ul>
      )}
    </DesignerCard>
  );
}

export function AnnexDiagnostics() {
  const c = useCase();
  const rows = useMemo(() => {
    const presented = c.annex().current;
    const clean = buildAnnex(c.clean, c.params, 'current');
    const out: DiffRow[] = [];
    for (const t of clean) {
      const pt = presented.find((x) => x.id === t.id);
      for (const r of t.rows) {
        const pr = pt?.rows.find((x) => x.id === r.id);
        for (const col of t.columns) {
          const p = pr?.values[col.id];
          const k = r.values[col.id];
          if (p !== k) out.push({ key: `${t.id}:${r.id}:${col.id}`, where: `${t.title} – ${r.label}`, column: col.label, presented: p, corrected: k });
        }
      }
    }
    return out;
  }, [c]);
  const cells = c.presented.presentation.annexCells;
  return (
    <DesignerCard title="Mode concepteur – annexe présentée / corrigée">
      <DiffTable rows={rows} label="Écarts entre l’annexe présentée et l’annexe corrigée" />
      {cells.length > 0 && (
        <ul className="space-y-0.5 px-3 pb-2 text-xs">
          {cells.map((x) => (
            <li key={`${x.table}:${x.rowId}:${x.column}`}>
              Altération de présentation : <span className="font-mono">{`${x.table} / ${x.rowId} / ${x.column}`}</span> – {x.transform === 'omit' ? 'omission' : 'inversion des 2e et 3e chiffres'}
            </li>
          ))}
        </ul>
      )}
    </DesignerCard>
  );
}
