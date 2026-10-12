import { useMemo, useState } from 'react';
import { trialBalance } from '../../engine/balance';
import { toCsv } from '../../engine/csv';
import { formatFecAmount } from '../../engine/format';
import { useDossierData } from '../app/context';
import { Amount } from '../components/Amount';
import { download } from '../components/download';
import { Panel, td, th } from '../components/Panel';

export function BalanceScreen() {
  const d = useDossierData();
  const [filter, setFilter] = useState('');
  const rows = useMemo(() => {
    const cur = trialBalance(d.world.ledgers.current, d.world.chart);
    const prior = d.balances.prior;
    const accounts = new Map(d.world.chart.accounts.map((a) => [a.number, a]));
    const all = new Set([...cur.rows.map((r) => r.account), ...prior.keys()]);
    return [...all].sort().map((account) => {
      const r = cur.rows.find((x) => x.account === account);
      return { account, label: accounts.get(account)?.label ?? '', toValidate: accounts.get(account)?.toValidate ?? false, prior: prior.get(account) ?? 0, debit: r?.debit ?? 0, credit: r?.credit ?? 0, closing: r?.closing ?? 0 };
    });
  }, [d]);
  const f = filter.trim().toLowerCase();
  const shown = rows.filter((r) => !f || r.account.startsWith(f) || r.label.toLowerCase().includes(f));
  const total = (k: 'prior' | 'debit' | 'credit' | 'closing') => shown.reduce((s, r) => s + r[k], 0);
  const exportCsv = () =>
    download('balance-2025.csv', '﻿' + toCsv([['Compte', 'Libellé', 'Solde 2024', 'Débit 2025', 'Crédit 2025', 'Solde 2025'], ...rows.map((r) => [r.account, r.label, formatFecAmount(r.prior), formatFecAmount(r.debit), formatFecAmount(r.credit), formatFecAmount(r.closing)])]), 'text/csv;charset=utf-8');
  return (
    <Panel
      title="Balance générale 2025 et soldes 2024 (soldes débiteurs positifs)"
      actions={
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted" htmlFor="filtre-balance">
            Filtre
          </label>
          <input id="filtre-balance" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Compte ou libellé" className="rounded border border-line bg-page px-2 py-1 text-sm" />
          <button type="button" onClick={exportCsv} className="rounded border border-line px-2 py-1 text-sm hover:bg-page">
            Export CSV
          </button>
        </div>
      }
    >
      <table className="w-full">
        <thead>
          <tr>
            <th className={th}>Compte</th>
            <th className={th}>Libellé</th>
            <th className={`${th} text-right`}>Solde 31/12/2024</th>
            <th className={`${th} text-right`}>Débit 2025</th>
            <th className={`${th} text-right`}>Crédit 2025</th>
            <th className={`${th} text-right`}>Solde 31/12/2025</th>
            <th className={`${th} text-right`}>Variation</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.account}>
              <td className={`${td} num text-left`}>{r.account}</td>
              <td className={td}>
                {r.label}
                {r.toValidate && <span className="ml-2 rounded bg-page px-1.5 text-xs text-muted" title="Compte proposé, à valider">à valider</span>}
              </td>
              <td className={td}><Amount cents={r.prior} decimals={2} /></td>
              <td className={td}><Amount cents={r.debit} decimals={2} /></td>
              <td className={td}><Amount cents={r.credit} decimals={2} /></td>
              <td className={td}><Amount cents={r.closing} decimals={2} /></td>
              <td className={td}><Amount cents={r.closing - r.prior} decimals={2} /></td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={td} colSpan={2}>Total ({shown.length} comptes)</td>
            <td className={td}><Amount cents={total('prior')} decimals={2} /></td>
            <td className={td}><Amount cents={total('debit')} decimals={2} /></td>
            <td className={td}><Amount cents={total('credit')} decimals={2} /></td>
            <td className={td}><Amount cents={total('closing')} decimals={2} /></td>
            <td className={td} />
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}
