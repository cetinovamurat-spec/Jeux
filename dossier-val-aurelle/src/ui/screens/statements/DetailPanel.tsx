/**
 * Detail of a statement line or an annex row, shown next to the tables:
 * - detail line: accounts of the trial balance mapped to the line, for the
 *   current and the prior year, in the sign convention of the statement, with
 *   their sum (passage balance → états);
 * - subtotal or total: the lines it adds up (or subtracts);
 * - result of the year: class 7 and class 6 balances;
 * - annex row: accounts matching the row's prefixes, opening and closing balances.
 * Nothing is compared or flagged: the player ticks.
 */
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import type { Cents } from '../../../engine/money';
import type { StatementLineDef } from '../../../engine/types';
import { accountsByPrefixes, componentLines, lineComposition, movementsByPrefixes, resultComposition, type CompositionItem } from '../../../game/ticking';
import { useCase } from '../../app/context';
import { Amount } from '../../components/Amount';
import { Badge, Button, cx } from '../../components/ui';
import { NewFindingButton } from '../findings/NewFindingButton';
import { sideAmount, type TabId } from './labels';
import type { Selection } from './statementsView';
import type { FindingSeed } from '../../../game/findings';

export interface DetailPanelProps {
  selection: Selection;
  designer: boolean;
  onSelect: (s: Selection) => void;
  onGoTab: (tab: TabId) => void;
  onClose: () => void;
}

function ledgerUrl(account: string, year: number, current: number): string {
  return `/grand-livre?compte=${encodeURIComponent(account)}${year !== current ? `&exercice=${year}` : ''}`;
}

export function DetailPanel({ selection, designer, onSelect, onGoTab, onClose }: DetailPanelProps) {
  const c = useCase();
  let kicker = '';
  let title = '';
  let body: ReactNode = null;
  if (selection.kind === 'line') {
    const def = c.params.statements.find((d) => d.id === selection.lineId);
    title = def?.label ?? 'Rubrique inconnue';
    kicker = def?.kind === 'detail' ? (def.isResult ? 'Résultat de l’exercice' : 'Composition de la rubrique') : 'Composition du total';
    body = !def ? (
      <p className="px-3 py-3 text-sm text-muted">Cette rubrique n’existe pas dans le modèle d’états.</p>
    ) : def.kind !== 'detail' ? (
      <TotalDetail def={def} onSelectLine={(lineId) => onSelect({ kind: 'line', lineId })} />
    ) : def.isResult ? (
      <ResultDetail onGoTab={onGoTab} />
    ) : (
      <LineDetail def={def} designer={designer} />
    );
  } else {
    const table = c.annex().current.find((t) => t.id === selection.tableId);
    const row = table?.rows.find((r) => r.id === selection.rowId);
    kicker = table?.title ?? 'Annexe';
    title = row?.label ?? 'Ligne inconnue';
    body = row ? <AnnexRowDetail prefixes={row.accounts} /> : <p className="px-3 py-3 text-sm text-muted">Cette ligne ne figure pas dans l’annexe présentée.</p>;
  }
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="flex items-start justify-between gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs text-muted">{kicker}</p>
          <h2 id="etats-detail-title" className="text-sm font-semibold">
            {title}
          </h2>
        </div>
        <span className="flex shrink-0 items-center gap-1">
          <NewFindingButton compact seed={findingSeed(selection, title, c.params.cycles.cycles)} />
          <Button variant="ghost" onClick={onClose} aria-label="Fermer le détail" title="Fermer le détail (Échap)" className="shrink-0 px-1.5">
            <span aria-hidden="true">✕</span>
          </Button>
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">{body}</div>
    </div>
  );
}

/** Item of the annex or of the management report a table of the annex reports (findings form). */
const ANNEX_TABLE_ITEMS: Readonly<Record<string, string>> = { immobilisations: 'fixed-assets-table', amortissements: 'fixed-assets-table', provisions: 'provisions-table', subventions: 'subsidies-table', dettes: 'debt-maturity' };

/** Context of « Créer un constat » on a statement line (its cycle) or on an annex row (cycle « annexe », item of the annex). */
function findingSeed(selection: Selection, title: string, cycles: readonly { id: string; statementLines: readonly string[] }[]): FindingSeed {
  if (selection.kind === 'line') {
    const cycle = cycles.find((x) => x.statementLines.includes(selection.lineId))?.id;
    return { ...(cycle ? { cycle } : {}), label: `États financiers – ${title}` };
  }
  const item = ANNEX_TABLE_ITEMS[selection.tableId];
  return { cycle: 'disclosures', ...(item ? { objects: [{ kind: 'disclosureItem', id: item }] } : {}), label: `Annexe – ${title}` };
}

// ---------------------------------------------------------------------------
// building blocks
// ---------------------------------------------------------------------------

function YearHeading({ children }: { children: ReactNode }) {
  return <h3 className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">{children}</h3>;
}

function Note({ children }: { children: ReactNode }) {
  return <p className="px-3 pt-3 text-xs text-muted">{children}</p>;
}

const cellL = 'py-1 pl-3 pr-2 text-left align-top';
const cellR = 'py-1 pl-2 pr-3 text-right align-top';

function SumRow({ label, cents, decimals = 2, strong = true, shade = false }: { label: string; cents: Cents; decimals?: number; strong?: boolean; shade?: boolean }) {
  return (
    <tr className={cx('border-t border-line', strong && 'font-semibold', shade && 'bg-sunken')}>
      <th scope="row" className={cx(cellL, strong ? 'font-semibold' : 'font-normal')}>
        {label}
      </th>
      <td className={cellR}>
        <Amount cents={cents} decimals={decimals} />
      </td>
    </tr>
  );
}

function AccountCell({ account, year, designer, reclassified }: { account: string; year: number; designer?: boolean; reclassified?: boolean }) {
  const c = useCase();
  return (
    <td className={cellL}>
      <Link to={ledgerUrl(account, year, c.params.scenario.years.current)} className="font-mono text-xs text-accent underline-offset-2 hover:underline" title={`Ouvrir le compte ${account} dans le grand livre ${year}`}>
        {account}
      </Link>
      <span className="block text-xs text-muted">{c.accountLabel(account)}</span>
      {designer && reclassified && (
        <span className="mt-0.5 block">
          <Badge tone="warn" title="Mode concepteur : reclassement de présentation appliqué à ce compte">
            Reclassement de présentation
          </Badge>
        </span>
      )}
    </td>
  );
}

// ---------------------------------------------------------------------------
// detail line: accounts of the balance
// ---------------------------------------------------------------------------

function LineDetail({ def, designer }: { def: StatementLineDef; designer: boolean }) {
  const c = useCase();
  const { current: cy, prior: py } = c.params.scenario.years;
  const bal = c.balances();
  const n = useMemo(() => lineComposition(def, bal.current, c.accounts, c.presented.presentation, cy), [def, bal, c, cy]);
  const n1 = useMemo(() => lineComposition(def, bal.prior, c.accounts, c.presented.presentation, py), [def, bal, c, py]);
  const sign =
    def.statement === 'assets'
      ? 'actif au débit, amortissements et dépréciations (comptes 28, 29, 39, 49 et 59) en positif'
      : def.statement === 'liabilities'
        ? 'passif au crédit'
        : def.nature === 'charge'
          ? 'charges au débit'
          : 'produits au crédit';
  return (
    <>
      <YearComposition label={`Exercice ${cy} – soldes au ${formatDateFr(`${cy}-12-31`)}`} comp={n} year={cy} assets={def.statement === 'assets'} designer={designer} />
      <YearComposition label={`Exercice ${py} – soldes au ${formatDateFr(`${py}-12-31`)}`} comp={n1} year={py} assets={def.statement === 'assets'} designer={designer} />
      <Note>
        Comptes de la balance à solde non nul classés dans cette rubrique, montants dans le sens de l’état ({sign}). Le classement d’un compte peut dépendre du sens de son solde. Cliquez sur un numéro de compte pour ouvrir le grand livre.
      </Note>
    </>
  );
}

function ItemRows({ items, year, designer }: { items: CompositionItem[]; year: number; designer: boolean }) {
  return (
    <>
      {items.map((it) => (
        <tr key={it.account} className="border-t border-line">
          <AccountCell account={it.account} year={year} designer={designer} reclassified={it.reclassified} />
          <td className={cellR}>
            <Amount cents={it.amount} decimals={2} />
          </td>
        </tr>
      ))}
    </>
  );
}

function YearComposition({ label, comp, year, assets, designer }: { label: string; comp: ReturnType<typeof lineComposition>; year: number; assets: boolean; designer: boolean }) {
  const gross = comp.items.filter((i) => i.part === 'gross');
  const dep = comp.items.filter((i) => i.part === 'depreciation');
  const other = comp.items.filter((i) => i.part === 'value');
  return (
    <section aria-label={label}>
      <YearHeading>{label}</YearHeading>
      {comp.items.length === 0 ? (
        <p className="px-3 text-sm text-muted">Aucun compte à solde non nul dans cette rubrique.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead className="sr-only">
            <tr>
              <th scope="col">Compte</th>
              <th scope="col">Montant</th>
            </tr>
          </thead>
          <tbody>
            {assets ? (
              <>
                <tr>
                  <th colSpan={2} scope="colgroup" className="px-3 pt-1 text-left text-xs font-semibold text-muted">
                    Valeurs brutes
                  </th>
                </tr>
                <ItemRows items={gross} year={year} designer={designer} />
                <SumRow label="Total des valeurs brutes" cents={comp.gross} strong={false} />
                {dep.length > 0 && (
                  <tr>
                    <th colSpan={2} scope="colgroup" className="px-3 pt-2 text-left text-xs font-semibold text-muted">
                      Amortissements et dépréciations
                    </th>
                  </tr>
                )}
                <ItemRows items={dep} year={year} designer={designer} />
                <SumRow label="Total des amortissements et dépréciations" cents={comp.depreciation} strong={false} />
                <ItemRows items={other} year={year} designer={designer} />
                <SumRow label="Valeur nette" cents={comp.total} shade />
              </>
            ) : (
              <>
                <ItemRows items={comp.items} year={year} designer={designer} />
                <SumRow label="Total des comptes" cents={comp.total} shade />
              </>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// subtotal or total: component lines
// ---------------------------------------------------------------------------

function TotalDetail({ def, onSelectLine }: { def: StatementLineDef; onSelectLine: (id: string) => void }) {
  const c = useCase();
  const { current: cy, prior: py } = c.params.scenario.years;
  const comps = componentLines(c.params.statements, def.id);
  const v = (id: string) => c.statements.lines[id];
  const assets = def.statement === 'assets';
  const sum = (f: (id: string) => number) => comps.reduce((s, x) => s + x.sign * f(x.def.id), 0);
  const label = (x: (typeof comps)[number]) => (
    <button type="button" onClick={() => onSelectLine(x.def.id)} className="text-left underline-offset-2 hover:text-accent hover:underline" title="Afficher la composition de cette rubrique">
      {x.sign < 0 ? <span className="text-muted">moins : </span> : null}
      {x.def.label}
    </button>
  );
  const head = 'px-2 py-1 text-right text-xs font-semibold text-muted';
  if (comps.length === 0) return <p className="px-3 py-3 text-sm text-muted">Aucune rubrique rattachée.</p>;
  return (
    <>
      {assets ? (
        <>
          <YearHeading>Exercice {cy}</YearHeading>
          {/* label on its own line, the three amounts below: the panel is too narrow for four columns */}
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th scope="col" className={cx(head, 'pl-3')}>
                  Brut
                </th>
                <th scope="col" className={head}>
                  Amort. et dépréc.
                </th>
                <th scope="col" className={cx(head, 'pr-3')}>
                  Net
                </th>
              </tr>
            </thead>
            {comps.map((x) => (
              <tbody key={x.def.id} className="border-t border-line">
                <tr>
                  <th scope="rowgroup" colSpan={3} className="px-3 pt-1 text-left font-normal">
                    {label(x)}
                  </th>
                </tr>
                <tr>
                  <td className="py-0.5 pl-3 pr-2 text-right">
                    <Amount cents={x.sign * (v(x.def.id)?.currentGross ?? 0)} />
                  </td>
                  <td className="px-2 py-0.5 text-right">
                    <Amount cents={x.sign * (v(x.def.id)?.currentDepreciation ?? 0)} />
                  </td>
                  <td className="py-0.5 pl-2 pr-3 text-right">
                    <Amount cents={x.sign * (v(x.def.id)?.current ?? 0)} />
                  </td>
                </tr>
              </tbody>
            ))}
            <tbody className="border-t border-line bg-sunken font-semibold">
              <tr>
                <th scope="rowgroup" colSpan={3} className="px-3 pt-1 text-left font-semibold">
                  Somme des rubriques
                </th>
              </tr>
              <tr>
                <td className="py-0.5 pl-3 pr-2 text-right">
                  <Amount cents={sum((id) => v(id)?.currentGross ?? 0)} />
                </td>
                <td className="px-2 py-0.5 text-right">
                  <Amount cents={sum((id) => v(id)?.currentDepreciation ?? 0)} />
                </td>
                <td className="py-0.5 pl-2 pr-3 text-right">
                  <Amount cents={sum((id) => v(id)?.current ?? 0)} />
                </td>
              </tr>
            </tbody>
          </table>
          <YearHeading>Exercice {py}</YearHeading>
          <SimpleTotals comps={comps} label={label} cols={[{ name: 'Net', value: (id) => v(id)?.prior ?? 0 }]} />
        </>
      ) : (
        <>
          <div className="pt-2" />
          <SimpleTotals
            comps={comps}
            label={label}
            cols={[
              { name: `Exercice ${cy}`, value: (id) => v(id)?.current ?? 0 },
              { name: `Exercice ${py}`, value: (id) => v(id)?.prior ?? 0 },
            ]}
          />
        </>
      )}
      <Note>Montants des rubriques tels que présentés dans les états. Cliquez sur une rubrique pour afficher sa composition.</Note>
    </>
  );
}

function SimpleTotals({
  comps,
  label,
  cols,
}: {
  comps: ReturnType<typeof componentLines>;
  label: (x: ReturnType<typeof componentLines>[number]) => ReactNode;
  cols: { name: string; value: (id: string) => number }[];
}) {
  const head = 'px-2 py-1 text-right text-xs font-semibold text-muted last:pr-3';
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          <th scope="col" className="py-1 pl-3 pr-2 text-left text-xs font-semibold text-muted">
            Rubrique
          </th>
          {cols.map((col) => (
            <th key={col.name} scope="col" className={head}>
              {col.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {comps.map((x) => (
          <tr key={x.def.id} className="border-t border-line">
            <th scope="row" className={cx(cellL, 'font-normal')}>
              {label(x)}
            </th>
            {cols.map((col) => (
              <td key={col.name} className="px-2 py-1 text-right align-top last:pr-3">
                <Amount cents={x.sign * col.value(x.def.id)} />
              </td>
            ))}
          </tr>
        ))}
        <tr className="border-t border-line bg-sunken font-semibold">
          <th scope="row" className={cx(cellL, 'font-semibold')}>
            Somme des rubriques
          </th>
          {cols.map((col) => (
            <td key={col.name} className="px-2 py-1 text-right last:pr-3">
              <Amount cents={comps.reduce((s, x) => s + x.sign * col.value(x.def.id), 0)} />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// result of the year
// ---------------------------------------------------------------------------

function ResultDetail({ onGoTab }: { onGoTab: (tab: TabId) => void }) {
  const c = useCase();
  const { current: cy, prior: py } = c.params.scenario.years;
  const bal = c.balances();
  const years = useMemo(
    () => [
      { year: cy, r: resultComposition(bal.current) },
      { year: py, r: resultComposition(bal.prior) },
    ],
    [bal, cy, py],
  );
  return (
    <>
      {years.map(({ year, r }) => (
        <section key={year} aria-label={`Exercice ${year}`}>
          <YearHeading>Exercice {year}</YearHeading>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <SumRow label="Produits (comptes de classe 7)" cents={r.products} strong={false} />
              <SumRow label="Charges (comptes de classe 6)" cents={r.charges} strong={false} />
              <SumRow label="Résultat (produits − charges)" cents={r.result} shade />
            </tbody>
          </table>
        </section>
      ))}
      <Note>
        Le résultat inscrit au passif est le solde des comptes de gestion de l’exercice.{' '}
        <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => onGoTab('resultat')}>
          Afficher le compte de résultat
        </button>
      </Note>
    </>
  );
}

// ---------------------------------------------------------------------------
// annex row: accounts by prefix, opening and closing balances
// ---------------------------------------------------------------------------

function AnnexRowDetail({ prefixes }: { prefixes: readonly string[] }) {
  const c = useCase();
  const { current: cy, prior: py } = c.params.scenario.years;
  const bal = c.balances();
  const r = useMemo(() => accountsByPrefixes(prefixes, bal.prior, bal.current), [prefixes, bal]);
  const mv = useMemo(() => movementsByPrefixes(prefixes, c.balanceRows()), [prefixes, c]);
  if (prefixes.length === 0)
    return (
      <Note>
        Cette ligne ne provient pas d’un compte de la balance (information hors bilan) : elle se rapproche des pièces justificatives (contrats, conventions, évaluations, correspondance).
      </Note>
    );
  const head = 'px-2 py-1 text-right text-xs font-semibold text-muted';
  return (
    <>
      <p className="px-3 pt-3 text-xs text-muted">
        Comptes commençant par <span className="font-mono text-ink">{prefixes.join(', ')}</span>
      </p>
      <section aria-label="Soldes de la balance">
        <YearHeading>Soldes de la balance</YearHeading>
        {r.accounts.length === 0 ? (
          <p className="px-3 text-sm text-muted">Aucun compte de la balance à solde non nul.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th scope="col" className="py-1 pl-3 pr-2 text-left text-xs font-semibold text-muted">
                  Compte
                </th>
                <th scope="col" className={head}>
                  Ouverture
                  <span className="block font-normal">{formatDateFr(`${py}-12-31`)}</span>
                </th>
                <th scope="col" className={cx(head, 'pr-3')}>
                  Clôture
                  <span className="block font-normal">{formatDateFr(`${cy}-12-31`)}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {r.accounts.map((a) => (
                <tr key={a.account} className="border-t border-line">
                  <AccountCell account={a.account} year={cy} />
                  <td className="num px-2 py-1 align-top">{sideAmount(a.opening)}</td>
                  <td className="num py-1 pl-2 pr-3 align-top">{sideAmount(a.closing)}</td>
                </tr>
              ))}
              <tr className="border-t border-line bg-sunken font-semibold">
                <th scope="row" className={cx(cellL, 'font-semibold')}>
                  Total
                </th>
                <td className="num px-2 py-1">{sideAmount(r.opening)}</td>
                <td className="num py-1 pl-2 pr-3">{sideAmount(r.closing)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
      <section aria-label={`Mouvements de l’exercice ${cy}`}>
        <YearHeading>Mouvements de l’exercice {cy}</YearHeading>
        {mv.accounts.length === 0 ? (
          <p className="px-3 text-sm text-muted">Aucun mouvement sur ces comptes au cours de l’exercice.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th scope="col" className="py-1 pl-3 pr-2 text-left text-xs font-semibold text-muted">
                  Compte
                </th>
                <th scope="col" className={head}>
                  Débit
                </th>
                <th scope="col" className={cx(head, 'pr-3')}>
                  Crédit
                </th>
              </tr>
            </thead>
            <tbody>
              {mv.accounts.map((a) => (
                <tr key={a.account} className="border-t border-line">
                  <AccountCell account={a.account} year={cy} />
                  <td className="px-2 py-1 text-right align-top">
                    <Amount cents={a.debit} decimals={2} />
                  </td>
                  <td className="py-1 pl-2 pr-3 text-right align-top">
                    <Amount cents={a.credit} decimals={2} />
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line bg-sunken font-semibold">
                <th scope="row" className={cx(cellL, 'font-semibold')}>
                  Total
                </th>
                <td className="px-2 py-1 text-right">
                  <Amount cents={mv.debit} decimals={2} />
                </td>
                <td className="py-1 pl-2 pr-3 text-right">
                  <Amount cents={mv.credit} decimals={2} />
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
      <Note>
        Soldes de la balance (D : débiteur, C : créditeur) ; l’ouverture correspond au solde de clôture de l’exercice précédent. Mouvements de l’exercice hors à-nouveaux, tels qu’ils figurent dans la balance. Cliquez sur un numéro de compte pour
        consulter ses écritures au grand livre.
      </Note>
    </>
  );
}
