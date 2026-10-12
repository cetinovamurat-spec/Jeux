/**
 * Realistic rendering of a structured document (paper sheet: header,
 * references, signatures, « Reçu le » stamp). Blocks can be selected (for
 * annotations); clue highlighting is reserved to the designer mode.
 */
import type { ReactNode } from 'react';
import { formatDateFr } from '../../engine/dates';
import type { Block, DocumentModel } from '../../scenario/documents';
import { cx } from './ui';

export interface DocumentViewProps {
  doc: DocumentModel;
  /** Designer mode: highlight the blocks carrying clues and show their target. */
  showClues?: boolean;
  /** Number of annotations per block index. */
  annotations?: ReadonlyMap<number, number>;
  selectedBlock?: number | null;
  onSelectBlock?: (index: number) => void;
  /** Words to highlight (search). */
  highlight?: readonly string[];
}

function mark(text: string, words: readonly string[] | undefined) {
  if (!words?.length) return text;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const n = norm(text);
  const ranges: [number, number][] = [];
  for (const w of words) {
    let i = n.indexOf(w);
    while (w && i >= 0) {
      ranges.push([i, i + w.length]);
      i = n.indexOf(w, i + w.length);
    }
  }
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], k) => {
    if (s < pos) return;
    out.push(text.slice(pos, s), <mark key={k} className="rounded-sm bg-warn/30 text-inherit">{text.slice(s, e)}</mark>);
    pos = e;
  });
  out.push(text.slice(pos));
  return out;
}

export function DocumentView({ doc, showClues, annotations, selectedBlock, onSelectBlock, highlight }: DocumentViewProps) {
  const clueTarget = new Map(doc.clues.map((c) => [c.id, `${c.target}${c.parts ? ` (${c.parts.join(', ')})` : ''}`]));
  const clueCls = (clue?: string) => (showClues && clue ? 'clue-mark' : '');
  const tag = (clue?: string) => (showClues && clue ? <span className="ml-1 rounded border border-warn px-1 font-mono text-[10px] text-warn">{clueTarget.get(clue)}</span> : null);
  const t = (s: string) => mark(s, highlight);

  const render = (b: Block, i: number) => {
    switch (b.kind) {
      case 'heading':
        return <h3 className={cx('mt-4 mb-1 font-semibold', clueCls(b.clue))}>{t(b.text)}{tag(b.clue)}</h3>;
      case 'paragraph':
        return <p className={cx('my-2 leading-relaxed', clueCls(b.clue))}>{t(b.text)}{tag(b.clue)}</p>;
      case 'note':
        return <p className={cx('my-2 text-sm italic opacity-80', clueCls(b.clue))}>{t(b.text)}{tag(b.clue)}</p>;
      case 'fields':
        return (
          <dl className="my-2 grid grid-cols-[minmax(12rem,45%)_1fr] gap-x-4 gap-y-0.5 text-sm">
            {b.rows.map((r, k) => (
              <div key={k} className="contents">
                <dt className="opacity-70">{t(r.label)}</dt>
                <dd className={clueCls(r.clue)}>{t(r.value)}{tag(r.clue)}</dd>
              </div>
            ))}
          </dl>
        );
      case 'list':
        return (
          <ul className="my-2 list-disc space-y-1 pl-5">
            {b.items.map((it, k) => (
              <li key={k} className={clueCls(it.clue)}>{t(it.text)}{tag(it.clue)}</li>
            ))}
          </ul>
        );
      case 'signature':
        return (
          <p className="mt-5 text-right">
            <span className="font-[cursive] text-lg italic opacity-80">{b.name}</span>
            <br />
            <span className="text-sm opacity-80">{b.role}{b.date ? `, le ${b.date}` : ''}</span>
          </p>
        );
      case 'stamp':
        return (
          <p className="my-3">
            <span className={cx('stamp', clueCls(b.clue))}>{b.text} {b.date}</span>
            {tag(b.clue)}
          </p>
        );
      case 'table': {
        const right = (k: number) => b.align?.[k] === 'right';
        return (
          <div className="my-3 overflow-x-auto">
            {b.title && <p className="mb-1 text-sm font-semibold">{t(b.title)}</p>}
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {b.columns.map((c, k) => (
                    <th key={k} className={cx('border-b border-current/30 px-2 py-1 text-left font-semibold', right(k) && 'text-right')}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, k) => (
                  <tr key={k} className={clueCls(r.clue)}>
                    {r.cells.map((cell, m) => (
                      <td key={m} className={cx('border-b border-current/10 px-2 py-0.5 align-top', right(m) && 'num')}>
                        {t(cell)}
                        {m === r.cells.length - 1 && tag(r.clue)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {b.footer && (
                <tfoot>
                  <tr>
                    {b.footer.map((c, k) => (
                      <th key={k} className={cx('border-t border-current/30 px-2 py-1 text-left', right(k) && 'num')}>{c}</th>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        );
      }
    }
  };

  return (
    <article className="paper mx-auto max-w-3xl rounded-sm px-8 py-7 font-serif text-[15px]" aria-label={doc.title}>
      <header className="mb-4 border-b border-current/20 pb-3 font-sans text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="font-semibold">{doc.issuer}</span>
          <span>{formatDateFr(doc.date)}</span>
        </div>
        {(doc.recipient || doc.reference) && (
          <div className="mt-1 flex flex-wrap justify-between gap-2 opacity-80">
            <span>{doc.recipient ? `À l’attention de : ${doc.recipient}` : ''}</span>
            <span>{doc.reference ? `Réf. : ${doc.reference}` : ''}</span>
          </div>
        )}
      </header>
      <h2 className="mb-3 font-sans text-base font-semibold">{t(doc.title)}</h2>
      {doc.blocks.map((b, i) => (
        <div
          key={i}
          data-block={i}
          onClick={onSelectBlock ? () => onSelectBlock(i) : undefined}
          className={cx('relative rounded-sm', onSelectBlock && 'cursor-pointer hover:bg-accent-soft/40', selectedBlock === i && 'bg-accent-soft/60 ring-1 ring-accent')}
        >
          {render(b, i)}
          {(annotations?.get(i) ?? 0) > 0 && (
            <span className="absolute -right-6 top-1 rounded-full bg-accent px-1.5 font-sans text-[10px] font-semibold text-panel" title="Annotations">
              {annotations!.get(i)}
            </span>
          )}
        </div>
      ))}
    </article>
  );
}
