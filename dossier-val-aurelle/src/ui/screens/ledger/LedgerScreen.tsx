/**
 * Grand livre (route '/grand-livre?compte=…&exercice=…'): account picker kept
 * in the URL, lines of the account (opening entries first, then by date and
 * entry number) with the running balance, filters, totals checked against the
 * trial balance, totals per auxiliary account, entry panel (contra accounts),
 * CSV export.
 */
import { useCallback, useDeferredValue, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { closingBalances } from '../../../engine/balance';
import { toCsv } from '../../../engine/csv';
import { formatDateFr } from '../../../engine/dates';
import { formatAmount } from '../../../engine/format';
import type { FecLineInternal } from '../../../engine/types';
import {
  accountLedger,
  accountLineIndex,
  EMPTY_LEDGER_FILTER,
  filterLedger,
  groupByAux,
  isLedgerFilterActive,
  ledgerLineMatcher,
  neighbours,
  NO_AUX,
  resolveAccount,
  topAccounts,
  type AuxGroup,
  type LedgerFilter,
  type LedgerRow,
} from '../../../game/ledger';
import type { Year } from '../../app/case';
import { useCase } from '../../app/context';
import { useDesigner } from '../../app/hooks';
import { DataTable, type Column } from '../../components/DataTable';
import { download } from '../../components/download';
import { Badge, Button, Card, Checkbox, cx, Kbd, PageHeader, Select } from '../../components/ui';
import { classLabel, CSV_BOM, csvAmount, fecDateFr, formatCount, plural } from '../balance/format';
import { useFillHeight } from '../balance/hooks';
import { AlignedRow, Field, Signed } from '../balance/tableParts';
import { EntryPanel } from './EntryPanel';
import { useLedgerView } from './ledgerView';

interface AccountOption {
  account: string;
  label: string;
}

function optionText(o: AccountOption): string {
  return `${o.account} – ${o.label}`;
}

export function LedgerScreen() {
  const c = useCase();
  const [params, setParams] = useSearchParams();
  const { current, prior } = c.params.scenario.years;
  const year = (params.get('exercice') === String(prior) ? prior : current) as Year;
  const account = (params.get('compte') ?? '').trim();

  const fec = c.fec(year);
  const byAccount = useMemo(() => accountLineIndex(fec), [fec]);
  const accounts = useMemo((): AccountOption[] => [...byAccount.keys()].sort().map((a) => ({ account: a, label: c.accountLabel(a) })), [byAccount, c]);
  const ids = useMemo(() => accounts.map((a) => a.account), [accounts]);
  const { prev, next } = neighbours(ids, account);

  const go = useCallback(
    (acc: string, y: number = year) => {
      const p = new URLSearchParams();
      if (acc) p.set('compte', acc);
      if (y !== current) p.set('exercice', String(y));
      setParams(p);
    },
    [year, current, setParams],
  );

  return (
    <>
      <PageHeader
        title="Grand livre"
        description={
          <>
            Mouvements d’un compte sur l’exercice : à-nouveaux, puis écritures par date et par numéro, avec le solde progressif (débiteur positif). Cliquez sur une ligne (ou <Kbd>Entrée</Kbd>) pour afficher l’écriture complète et ses contreparties.
          </>
        }
      />

      <section aria-label="Choix du compte" className="mb-3 flex flex-wrap items-end gap-x-3 gap-y-2 rounded-lg border border-line bg-panel px-3 py-2.5">
        <AccountPicker key={`${year}|${account}`} account={account} accounts={accounts} year={year} onPick={go} />
        <div className="flex gap-1">
          <Button disabled={!prev} onClick={() => prev && go(prev)} aria-label={prev ? `Compte précédent : ${prev} – ${c.accountLabel(prev)}` : 'Pas de compte précédent'} title={prev ? `${prev} – ${c.accountLabel(prev)}` : undefined}>
            <span aria-hidden="true">‹</span> Précédent
          </Button>
          <Button disabled={!next} onClick={() => next && go(next)} aria-label={next ? `Compte suivant : ${next} – ${c.accountLabel(next)}` : 'Pas de compte suivant'} title={next ? `${next} – ${c.accountLabel(next)}` : undefined}>
            Suivant <span aria-hidden="true">›</span>
          </Button>
        </div>
        <Field id="gl-year" label="Exercice" className="w-56">
          <Select id="gl-year" value={String(year)} onChange={(e) => go(account, Number(e.target.value))} className="w-full">
            <option value={current}>{current} – exercice audité</option>
            <option value={prior}>{prior} – exercice précédent</option>
          </Select>
        </Field>
      </section>

      {!account ? (
        <Suggestions year={year} byAccount={byAccount} />
      ) : byAccount.has(account) ? (
        <AccountView key={`${year}|${account}`} year={year} account={account} fec={fec} indices={byAccount.get(account)!} />
      ) : (
        <NoLines account={account} year={year} onYear={(y) => go(account, y)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Account picker
// ---------------------------------------------------------------------------

function AccountPicker({ account, accounts, year, onPick }: { account: string; accounts: readonly AccountOption[]; year: number; onPick: (account: string) => void }) {
  const c = useCase();
  const initial = account ? optionText({ account, label: c.accountLabel(account) }) : '';
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const options = useMemo(() => new Map(accounts.map((a) => [optionText(a), a.account])), [accounts]);

  const commit = (text: string) => {
    if (!text.trim()) return;
    const acc = resolveAccount(text, accounts);
    if (!acc) {
      setError(`Aucun compte mouvementé en ${year} ne correspond à « ${text.trim()} ».`);
      return;
    }
    setError('');
    if (acc !== account) onPick(acc);
    else setDraft(initial);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Escape' && draft !== initial) {
      e.preventDefault();
      setDraft(initial);
      setError('');
    }
  };

  return (
    <div className="min-w-0">
      <label htmlFor="gl-account" className="mb-1 block text-xs font-medium text-muted">
        Compte (numéro ou libellé, puis <Kbd>Entrée</Kbd>)
      </label>
      <input
        id="gl-account"
        list="gl-accounts"
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          setError('');
          // An option chosen in the list opens the account at once.
          const picked = options.get(v);
          if (picked && picked !== account) onPick(picked);
        }}
        onKeyDown={onKeyDown}
        onFocus={(e) => e.target.select()}
        placeholder="ex. 4111 ou locataires"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'gl-account-error' : undefined}
        className={cx('w-[28rem] max-w-full rounded-md border bg-panel px-2 py-1 text-sm placeholder:text-muted', error ? 'border-ko' : 'border-line')}
      />
      <datalist id="gl-accounts">
        {accounts.map((a) => (
          <option key={a.account} value={optionText(a)} />
        ))}
      </datalist>
      {error && (
        <p id="gl-account-error" role="alert" className="mt-1 text-xs text-ko">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function SuggestionList({ title, items, year }: { title: string; items: readonly { account: string; value: ReactNode }[]; year: number }) {
  const c = useCase();
  const yearQuery = year === c.params.scenario.years.current ? '' : `&exercice=${year}`;
  return (
    <div className="min-w-0">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <ul className="divide-y divide-line rounded-md border border-line">
        {items.map((it) => (
          <li key={it.account}>
            <Link to={`/grand-livre?compte=${encodeURIComponent(it.account)}${yearQuery}`} className="flex items-baseline justify-between gap-3 px-3 py-1.5 hover:bg-sunken">
              <span className="min-w-0 truncate">
                <span className="font-mono text-accent">{it.account}</span> <span>{c.accountLabel(it.account)}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">{it.value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** No account chosen: how to pick one, and the most significant accounts of the year. */
function Suggestions({ year, byAccount }: { year: Year; byAccount: ReadonlyMap<string, number[]> }) {
  const c = useCase();
  const isCurrent = year === c.params.scenario.years.current;
  const biggest = useMemo(() => {
    const balances = isCurrent ? c.balances().current : c.balances().prior;
    return topAccounts(
      [...balances].map(([account, b]) => ({ account, b })),
      (x) => Math.abs(x.b),
      10,
    );
  }, [c, isCurrent]);
  const busiest = useMemo(
    () =>
      topAccounts(
        [...byAccount].map(([account, idx]) => ({ account, n: idx.length })),
        (x) => x.n,
        10,
      ),
    [byAccount],
  );
  return (
    <Card title="Aucun compte sélectionné">
      <div className="px-4 py-3 text-sm">
        <p className="max-w-3xl text-muted">
          Saisissez un numéro de compte ou un libellé ci-dessus : la liste propose les {plural(byAccount.size, 'compte mouvementé', 'comptes mouvementés')} en {year}. Vous pouvez aussi ouvrir un compte depuis la{' '}
          <Link to="/balance" className="text-accent underline-offset-2 hover:underline">
            balance N / N-1
          </Link>{' '}
          ou partir des comptes les plus significatifs :
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <SuggestionList title={`Soldes les plus élevés au ${formatDateFr(`${year}-12-31`)} (valeur absolue)`} year={year} items={biggest.map((x) => ({ account: x.account, value: <Signed cents={x.b} decimals={0} /> }))} />
          <SuggestionList title={`Comptes les plus mouvementés en ${year}`} year={year} items={busiest.map((x) => ({ account: x.account, value: plural(x.n, 'ligne', 'lignes') }))} />
        </div>
      </div>
    </Card>
  );
}

/** The account has no line in the year (or does not exist). */
function NoLines({ account, year, onYear }: { account: string; year: Year; onYear: (year: number) => void }) {
  const c = useCase();
  const { current, prior } = c.params.scenario.years;
  const other = (year === current ? prior : current) as Year;
  const known = c.accounts.has(account);
  const inOther = useMemo(() => c.fec(other).some((l) => l.CompteNum === account), [c, other, account]);
  return (
    <div role="status" className="rounded-lg border border-line bg-panel px-6 py-6 text-sm">
      <p className="font-semibold">
        {known ? (
          <>
            Aucune écriture sur le compte <span className="font-mono">{account}</span> – {c.accountLabel(account)} en {year}.
          </>
        ) : (
          <>
            Le compte <span className="font-mono">{account}</span> ne figure pas au plan de comptes et n’est pas mouvementé en {year}.
          </>
        )}
      </p>
      <p className="mt-1 text-muted">Choisissez un autre compte ci-dessus{inOther ? ' ou consultez l’autre exercice' : ''}.</p>
      {inOther && (
        <Button className="mt-3" onClick={() => onYear(other)}>
          Consulter l’exercice {other}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ledger of one account
// ---------------------------------------------------------------------------

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Mono({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return <span className={cx('font-mono', small ? 'text-xs' : 'text-[13px]')}>{children}</span>;
}

/** Amount cell of the ledger (13 px so that large balances fit the column). */
function Cell({ cents, hideZero = false }: { cents: number; hideZero?: boolean }) {
  if (hideZero && cents === 0) return null;
  return (
    <span className="text-[13px]">
      <Signed cents={cents} />
    </span>
  );
}

function AccountView({ year, account, fec, indices }: { year: Year; account: string; fec: readonly FecLineInternal[]; indices: readonly number[] }) {
  const c = useCase();
  const designer = useDesigner();
  const view = useLedgerView();
  const { current } = c.params.scenario.years;
  const label = c.accountLabel(account);
  const closingDate = formatDateFr(`${year}-12-31`);

  const ledger = useMemo(() => accountLedger(fec, account, indices), [fec, account, indices]);
  const entries = useMemo(() => new Set(ledger.rows.map((r) => r.line.entryId)).size, [ledger]);
  const trial = (year === current ? c.balances().current : c.balances().prior).get(account) ?? 0;

  // Filters (reset with the account: the component is keyed by year and account).
  const [journal, setJournal] = useState('');
  const [aux, setAux] = useState('');
  const [text, setText] = useState('');
  const deferredText = useDeferredValue(text);
  const pending = deferredText !== text;
  const filter = useMemo((): LedgerFilter => ({ journal, aux, text: deferredText }), [journal, aux, deferredText]);
  const active = isLedgerFilterActive(filter);
  const shown = useMemo(() => (active ? filterLedger(ledger, ledgerLineMatcher(filter)) : ledger), [ledger, filter, active]);
  const reset = () => {
    setJournal(EMPTY_LEDGER_FILTER.journal);
    setAux(EMPTY_LEDGER_FILTER.aux);
    setText(EMPTY_LEDGER_FILTER.text);
  };

  const journals = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const r of ledger.rows) {
      const j = m.get(r.line.JournalCode);
      if (j) j.n++;
      else m.set(r.line.JournalCode, { label: r.line.JournalLib, n: 1 });
    }
    return [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [ledger]);
  const auxAll = useMemo(() => groupByAux(ledger.rows.map((r) => r.line)), [ledger]);
  const hasAux = auxAll.some((g) => g.aux !== '');
  const withoutAux = auxAll.find((g) => g.aux === '');
  const grouped = view.grouped && hasAux;
  const lettered = useMemo(() => ledger.rows.some((r) => r.line.EcritureLet !== ''), [ledger]);
  const groups = useMemo(() => (grouped ? groupByAux(shown.rows.map((r) => r.line)) : []), [grouped, shown]);

  // Designer mode: origin of the entries and balance of the clean world.
  const origins = useMemo(() => (designer ? new Map((year === current ? c.presented.ledgers.current : c.presented.ledgers.prior).entries.map((e) => [e.id, e.origin])) : null), [designer, c, year, current]);
  const cleanBalance = useMemo(() => (designer ? (closingBalances(year === current ? c.clean.ledgers.current : c.clean.ledgers.prior).get(account) ?? 0) : null), [designer, c, year, current, account]);

  // Entry panel; focus goes back to the row that opened it.
  const [entry, setEntry] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openEntry = (r: LedgerRow) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEntry(r.line.entryId);
  };
  const closeEntry = useCallback(() => {
    setEntry(null);
    const el = opener.current;
    requestAnimationFrame(() => {
      if (el?.isConnected) el.focus();
    });
  }, []);

  const columns = useMemo((): Column<LedgerRow>[] => {
    const cols: (Column<LedgerRow> | false)[] = [
      { id: 'date', header: 'Date', width: '5.25rem', cell: (r) => <Mono>{formatDateFr(r.line.date)}</Mono>, sortValue: (r) => r.line.date },
      { id: 'journal', header: 'Journal', width: '3.25rem', cell: (r) => <Mono>{r.line.JournalCode}</Mono>, title: (r) => r.line.JournalLib, sortValue: (r) => r.line.JournalCode },
      { id: 'num', header: 'N°', width: '4.75rem', cell: (r) => <Mono>{r.line.EcritureNum}</Mono>, sortValue: (r) => r.line.EcritureNum },
      { id: 'piece', header: 'Pièce', width: '6.5rem', cell: (r) => <Mono>{r.line.PieceRef}</Mono>, title: (r) => (r.line.PieceRef ? `${r.line.PieceRef}${r.line.PieceDate ? ` du ${fecDateFr(r.line.PieceDate)}` : ''}` : 'Sans référence de pièce'), sortValue: (r) => r.line.PieceRef },
      { id: 'label', header: 'Libellé', width: 'minmax(9rem,1fr)', cell: (r) => r.line.EcritureLib, title: (r) => r.line.EcritureLib, sortValue: (r) => r.line.EcritureLib },
      hasAux && { id: 'aux', header: 'Auxiliaire', width: '5rem', cell: (r) => <Mono>{r.line.CompAuxNum}</Mono>, title: (r) => (r.line.CompAuxNum ? `${r.line.CompAuxNum} – ${r.line.CompAuxLib}` : ''), sortValue: (r) => r.line.CompAuxNum },
      { id: 'debit', header: 'Débit', width: '7.25rem', align: 'right', cell: (r) => <Cell cents={r.line.debitCents} hideZero />, sortValue: (r) => r.line.debitCents },
      { id: 'credit', header: 'Crédit', width: '7.25rem', align: 'right', cell: (r) => <Cell cents={r.line.creditCents} hideZero />, sortValue: (r) => r.line.creditCents },
      { id: 'balance', header: 'Solde progressif', width: '7.75rem', align: 'right', cell: (r) => <Cell cents={r.balance} />, sortValue: (r) => r.balance },
      view.controlColumns && lettered && { id: 'let', header: 'Lettrage', width: '3.75rem', cell: (r) => <Mono>{r.line.EcritureLet}</Mono>, title: (r) => (r.line.DateLet ? `Lettré le ${fecDateFr(r.line.DateLet)}` : ''), sortValue: (r) => r.line.EcritureLet },
      view.controlColumns && { id: 'valid', header: 'Validée le', width: '5.25rem', cell: (r) => <Mono>{formatDateFr(r.line.validDate)}</Mono>, sortValue: (r) => r.line.validDate },
      view.controlColumns && { id: 'user', header: 'Saisie par', width: '6rem', cell: (r) => <Mono small>{r.line.enteredBy}</Mono>, title: (r) => r.line.enteredBy, sortValue: (r) => r.line.enteredBy },
      origins !== null && {
        id: 'origin',
        header: 'Origine (concepteur)',
        width: '8rem',
        cell: (r) => {
          const o = origins.get(r.line.entryId) ?? '';
          return o.startsWith('gen:') ? <Mono small>{o}</Mono> : <Badge tone="warn">{o || '?'}</Badge>;
        },
        title: (r) => origins.get(r.line.entryId) ?? '',
        sortValue: (r) => origins.get(r.line.entryId) ?? '',
      },
    ];
    return cols.filter((x): x is Column<LedgerRow> => x !== false);
  }, [view.controlColumns, origins, hasAux, lettered]);

  const groupColumns = useMemo(
    (): Column<AuxGroup>[] => [
      { id: 'aux', header: 'Compte auxiliaire', width: '8rem', cell: (g) => (g.aux ? <Mono>{g.aux}</Mono> : <span className="text-muted">Sans auxiliaire</span>), sortValue: (g) => g.aux },
      { id: 'label', header: 'Nom', width: 'minmax(12rem,1fr)', cell: (g) => g.label, title: (g) => g.label, sortValue: (g) => g.label },
      { id: 'count', header: 'Lignes', width: '5rem', align: 'right', cell: (g) => <span className="num">{formatCount(g.count)}</span>, sortValue: (g) => g.count },
      { id: 'debit', header: 'Débit', width: '8rem', align: 'right', cell: (g) => <Signed cents={g.debit} />, sortValue: (g) => g.debit },
      { id: 'credit', header: 'Crédit', width: '8rem', align: 'right', cell: (g) => <Signed cents={g.credit} />, sortValue: (g) => g.credit },
      { id: 'balance', header: 'Solde', width: '8.5rem', align: 'right', cell: (g) => <Signed cents={g.balance} />, sortValue: (g) => g.balance },
    ],
    [],
  );

  const exportCsv = () => {
    const base = `grand-livre-${account}-${year}`;
    if (grouped) {
      const header = ['Compte auxiliaire', 'Nom', 'Lignes', 'Débit', 'Crédit', 'Solde'];
      const lines = groups.map((g) => [g.aux, g.label, g.count, csvAmount(g.debit), csvAmount(g.credit), csvAmount(g.balance)]);
      download(`${base}-auxiliaires.csv`, CSV_BOM + toCsv([header, ...lines]), 'text/csv;charset=utf-8');
      return;
    }
    const header = ['Compte', 'Date', 'Journal', 'N° écriture', 'Pièce', 'Date pièce', 'Libellé', 'Compte auxiliaire', 'Nom auxiliaire', 'Débit', 'Crédit', 'Solde progressif', 'Lettrage', 'Date de lettrage', 'Validée le', 'Saisie par'];
    const lines = shown.rows.map(({ line: l, balance }) => [
      l.CompteNum,
      formatDateFr(l.date),
      l.JournalCode,
      l.EcritureNum,
      l.PieceRef,
      fecDateFr(l.PieceDate),
      l.EcritureLib,
      l.CompAuxNum,
      l.CompAuxLib,
      csvAmount(l.debitCents),
      csvAmount(l.creditCents),
      csvAmount(balance),
      l.EcritureLet,
      fecDateFr(l.DateLet),
      formatDateFr(l.validDate),
      l.enteredBy,
    ]);
    download(`${base}.csv`, CSV_BOM + toCsv([header, ...lines]), 'text/csv;charset=utf-8');
  };

  const fillRef = useRef<HTMLDivElement>(null);
  const fill = useFillHeight(fillRef, 56);
  const count = grouped ? groups.length : shown.rows.length;
  const natural = 34 + count * 30 + 2;
  const height = Math.max(160, Math.min(fill ?? 480, natural));
  const debitIndex = columns.findIndex((col) => col.id === 'debit');

  return (
    <section aria-label={`Grand livre du compte ${account}`} className="rounded-lg border border-line bg-panel">
      <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-2 border-b border-line px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            <span className="font-mono">{account}</span> – {label}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span>
              {classLabel(account) ? `Classe ${account[0]} – ${classLabel(account)} · ` : ''}
              Exercice {year} · {plural(ledger.rows.length, 'ligne', 'lignes')} · {plural(entries, 'écriture', 'écritures')}
            </span>
            {trial === ledger.balance ? (
              <Badge tone="ok" title={`Solde du grand livre = solde de la balance générale au ${closingDate} (${formatAmount(trial)})`}>
                Concorde avec la balance
              </Badge>
            ) : (
              <Badge tone="ko" title={`Solde de la balance générale au ${closingDate} : ${formatAmount(trial)}`}>
                Écart avec la balance : {formatAmount(ledger.balance - trial)}
              </Badge>
            )}
          </p>
          {cleanBalance !== null && (
            <p className={cx('mt-1 text-xs', cleanBalance === ledger.balance ? 'text-muted' : 'text-warn')}>
              Concepteur – solde du monde propre : {formatAmount(cleanBalance)}
              {cleanBalance !== ledger.balance ? ` (écart ${formatAmount(ledger.balance - cleanBalance)})` : ' (identique)'}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-right sm:grid-cols-4">
          <Stat label={`À-nouveaux au ${formatDateFr(`${year}-01-01`)}`}>
            <Signed cents={ledger.opening} />
          </Stat>
          <Stat label="Débit de l’exercice">
            <Signed cents={ledger.movementDebit} />
          </Stat>
          <Stat label="Crédit de l’exercice">
            <Signed cents={ledger.movementCredit} />
          </Stat>
          <Stat label={`Solde au ${closingDate}`}>
            <Signed cents={ledger.balance} strong />
          </Stat>
        </dl>
      </header>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-line px-3 py-2.5">
        <Field id="gl-journal" label="Journal" className="w-56">
          <Select id="gl-journal" value={journal} onChange={(e) => setJournal(e.target.value)} className="w-full">
            <option value="">Tous les journaux ({journals.length})</option>
            {journals.map(([code, j]) => (
              <option key={code} value={code}>
                {code} – {j.label} ({formatCount(j.n)})
              </option>
            ))}
          </Select>
        </Field>
        <Field id="gl-aux" label="Compte auxiliaire" className="w-64">
          <Select id="gl-aux" value={aux} onChange={(e) => setAux(e.target.value)} disabled={!hasAux} className="w-full" title={hasAux ? undefined : 'Aucun compte auxiliaire sur ce compte'}>
            <option value="">{hasAux ? `Tous (${formatCount(auxAll.length - (withoutAux ? 1 : 0))})` : 'Aucun compte auxiliaire'}</option>
            {hasAux && withoutAux && <option value={NO_AUX}>Sans compte auxiliaire ({formatCount(withoutAux.count)} lignes)</option>}
            {auxAll
              .filter((g) => g.aux !== '')
              .map((g) => (
                <option key={g.aux} value={g.aux}>
                  {g.aux} – {g.label}
                </option>
              ))}
          </Select>
        </Field>
        <Field id="gl-text" label="Libellé ou pièce contient" className="w-60">
          <input
            id="gl-text"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ex. loyer, facture"
            title="Tous les mots doivent figurer dans le libellé ou la référence de pièce (sans tenir compte des accents)"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm placeholder:text-muted"
          />
        </Field>
        <div className="flex flex-col gap-1 pb-0.5">
          {hasAux ? (
            <Checkbox id="gl-grouped" label="Regrouper par compte auxiliaire" checked={view.grouped} onChange={(v) => view.update({ grouped: v })} />
          ) : (
            <span className="text-sm text-muted">Pas de compte auxiliaire</span>
          )}
          <Checkbox id="gl-control-cols" label="Colonnes lettrage, validation, utilisateur" checked={view.controlColumns} onChange={(v) => view.update({ controlColumns: v })} />
        </div>
        <div className="mb-px ml-auto flex items-center gap-2">
          {active && (
            <Button variant="ghost" onClick={reset}>
              Réinitialiser les filtres
            </Button>
          )}
          <Button onClick={exportCsv} disabled={count === 0} title={grouped ? 'Télécharger les totaux par compte auxiliaire (CSV)' : 'Télécharger les lignes affichées (CSV, séparateur point-virgule)'}>
            Exporter (CSV)
          </Button>
        </div>
      </div>

      <p aria-live="polite" className={cx('px-3 py-1.5 text-xs text-muted', pending && 'opacity-60')}>
        {grouped
          ? `${plural(groups.length, 'compte auxiliaire', 'comptes auxiliaires')} – cliquez sur un compte auxiliaire pour afficher ses lignes.`
          : `${plural(shown.rows.length, 'ligne affichée', 'lignes affichées')}${active ? ` sur ${formatCount(ledger.rows.length)} – solde progressif recalculé sur les lignes affichées` : ''}.`}
        {pending ? ' Filtrage…' : ''}
      </p>

      <div ref={fillRef} className="border-t border-line">
        {grouped ? (
          <DataTable
            key="groups"
            rows={groups}
            columns={groupColumns}
            rowKey={(g) => g.aux || '(none)'}
            ariaLabel={`Totaux par compte auxiliaire du compte ${account}`}
            height={`${height}px`}
            onRowClick={(g) => {
              setAux(g.aux || NO_AUX);
              view.update({ grouped: false });
            }}
            footer={
              groups.length ? (
                <AlignedRow
                  columns={groupColumns}
                  lead={<span className="text-xs font-semibold">Total</span>}
                  leadSpan={2}
                  cells={{
                    count: <span className="num font-semibold">{formatCount(groups.reduce((s, g) => s + g.count, 0))}</span>,
                    debit: <Signed cents={shown.debit} strong />,
                    credit: <Signed cents={shown.credit} strong />,
                    balance: <Signed cents={shown.balance} strong />,
                  }}
                />
              ) : undefined
            }
          />
        ) : (
          <DataTable
            key="lines"
            rows={shown.rows}
            columns={columns}
            rowKey={(r) => String(r.index)}
            ariaLabel={`Lignes du compte ${account} – ${label}, exercice ${year}`}
            height={`${height}px`}
            onRowClick={openEntry}
            rowClassName={(r) => cx(r.line.entryId === entry && 'bg-accent-soft', r.opening && r.line.entryId !== entry && 'bg-sunken/60')}
            footer={
              shown.rows.length ? (
                <AlignedRow
                  columns={columns}
                  lead={<span className="text-xs font-semibold">{active ? 'Total des lignes affichées' : 'Total du compte (à-nouveaux compris)'}</span>}
                  leadSpan={debitIndex}
                  cells={{
                    debit: <Cell cents={shown.debit} />,
                    credit: <Cell cents={shown.credit} />,
                    balance: (
                      <span className="font-semibold">
                        <Cell cents={shown.balance} />
                      </span>
                    ),
                  }}
                />
              ) : (
                <p className="py-1 text-center text-sm text-muted">
                  Aucune ligne ne correspond aux filtres.{' '}
                  <button type="button" onClick={reset} className="text-accent underline-offset-2 hover:underline">
                    Réinitialiser les filtres
                  </button>
                </p>
              )
            }
          />
        )}
      </div>

      {entry && <EntryPanel year={year} entryId={entry} account={account} defaultYear={current} onClose={closeEntry} origin={origins?.get(entry)} />}
    </section>
  );
}
