import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { buildFec, fecToText, FEC_FIELDS } from '../../engine/fec';
import { useDossierData } from '../app/context';
import { download } from '../components/download';
import { Panel } from '../components/Panel';

export function FecScreen() {
  const d = useDossierData();
  const w = d.world;
  const fec = useMemo(() => buildFec(w.ledgers.current, w.chart, w.journals, w.auxiliaries), [w]);
  const byJournal = useMemo(() => {
    const m = new Map<string, { entries: Set<string>; lines: number }>();
    for (const l of fec) {
      const x = m.get(l.JournalCode) ?? { entries: new Set(), lines: 0 };
      x.entries.add(l.EcritureNum);
      x.lines++;
      m.set(l.JournalCode, x);
    }
    return m;
  }, [fec]);
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: fec.length, getScrollElement: () => parentRef.current, estimateSize: () => 26, overscan: 20 });
  const cols = ['JournalCode', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompAuxNum', 'PieceRef', 'EcritureLib', 'Debit', 'Credit', 'EcritureLet', 'ValidDate'] as const;
  return (
    <>
      <Panel
        title={`FEC 2025 – ${fec.length.toLocaleString('fr-FR')} lignes (18 champs, numérotation par journal dans l’ordre de validation)`}
        actions={
          <div className="flex gap-2">
            <button type="button" className="rounded border border-line px-2 py-1 text-sm hover:bg-page" onClick={() => download('FEC-2025.txt', fecToText(fec))}>
              Télécharger le FEC 2025
            </button>
            <button type="button" className="rounded border border-line px-2 py-1 text-sm hover:bg-page" onClick={() => download('FEC-2024.txt', fecToText(buildFec(w.ledgers.prior, w.chart, w.journals, w.auxiliaries)))}>
              FEC 2024
            </button>
          </div>
        }
      >
        <p className="px-4 py-2 text-sm text-muted">
          {[...byJournal.entries()].map(([j, x]) => `${j} : ${x.entries.size.toLocaleString('fr-FR')} écritures / ${x.lines.toLocaleString('fr-FR')} lignes`).join(' · ')}. Champs exportés : {FEC_FIELDS.length}.
        </p>
      </Panel>
      <Panel title="Aperçu">
        <div className="grid grid-cols-[4rem_7rem_6.5rem_5rem_4.5rem_8rem_1fr_8rem_8rem_3rem_6.5rem] gap-x-2 border-b border-line px-3 py-2 text-xs font-semibold uppercase text-muted">
          {cols.map((c) => (
            <div key={c}>{c}</div>
          ))}
        </div>
        <div ref={parentRef} className="h-[60vh] overflow-auto" role="grid" aria-rowcount={fec.length}>
          <div style={{ height: v.getTotalSize(), position: 'relative' }}>
            {v.getVirtualItems().map((item) => {
              const l = fec[item.index]!;
              return (
                <div key={item.key} role="row" className="absolute left-0 right-0 grid grid-cols-[4rem_7rem_6.5rem_5rem_4.5rem_8rem_1fr_8rem_8rem_3rem_6.5rem] gap-x-2 border-b border-line px-3 text-xs leading-[26px]" style={{ top: item.start, height: item.size }}>
                  {cols.map((c) => (
                    <div key={c} role="gridcell" className={`truncate ${c === 'Debit' || c === 'Credit' ? 'num' : ''}`} title={l[c]}>
                      {l[c]}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </>
  );
}
