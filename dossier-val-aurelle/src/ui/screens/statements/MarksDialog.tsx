/**
 * Marks manager (modal dialog « Marques de pointage »): list of the marks with
 * their use, creation (symbol of at most two characters, meaning, colour),
 * modification and deletion (with confirmation: the ticks using the mark are
 * removed too).
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { addTickMark, removeTickMark, updateTickMark, type TickMark, type Tone } from '../../../game/state';
import { countByPrefix, markUsage, MAX_SYMBOL_LENGTH, symbolLength, ANNEX_PREFIX, CERTIFIED_PREFIX, STATEMENT_PREFIX } from '../../../game/ticking';
import { useGame } from '../../app/store';
import { Button, cx, Kbd, Select, TextInput, toneText } from '../../components/ui';
import { formatCount, plural, TONE_LABELS, TONES } from './labels';

interface Draft {
  symbol: string;
  label: string;
  tone: Tone;
}

/** Validation message of a mark draft (null when valid). */
function validate(d: Draft, marks: readonly TickMark[], ignoreId?: string): string | null {
  const n = symbolLength(d.symbol);
  if (n === 0) return 'Indiquez un symbole.';
  if (n > MAX_SYMBOL_LENGTH) return `Le symbole compte au plus ${MAX_SYMBOL_LENGTH} caractères.`;
  if (!d.label.trim()) return 'Indiquez la signification de la marque.';
  if (marks.some((m) => m.id !== ignoreId && m.symbol === d.symbol.trim())) return 'Ce symbole est déjà utilisé par une autre marque.';
  return null;
}

function ToneSelect({ id, value, onChange, label }: { id: string; value: Tone; onChange: (t: Tone) => void; label?: string }) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value as Tone)} {...(label ? { 'aria-label': label } : {})}>
      {TONES.map((t) => (
        <option key={t} value={t}>
          {TONE_LABELS[t]}
        </option>
      ))}
    </Select>
  );
}

export function MarksDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="etats-marks-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto max-h-[88vh] w-[min(46rem,94vw)] overflow-hidden rounded-lg border border-line bg-panel p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      {open && <MarksManager onClose={onClose} />}
    </dialog>
  );
}

function MarksManager({ onClose }: { onClose: () => void }) {
  const marks = useGame((s) => s.game.tickMarks);
  const ticks = useGame((s) => s.game.ticks);
  const act = useGame((s) => s.act);
  const usage = useMemo(() => markUsage(ticks, marks), [ticks, marks]);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ symbol: '', label: '', tone: 'accent' });
  const [error, setError] = useState<string | null>(null);
  const formId = useId();

  const add = (e: FormEvent) => {
    e.preventDefault();
    const msg = validate(draft, marks);
    setError(msg);
    if (msg) return;
    act((s) => addTickMark(s, { symbol: draft.symbol.trim(), label: draft.label.trim(), tone: draft.tone }));
    setDraft({ symbol: '', label: '', tone: draft.tone });
  };

  const totals = [
    { label: 'États 2025', n: countByPrefix(ticks, STATEMENT_PREFIX) },
    { label: 'Annexe', n: countByPrefix(ticks, ANNEX_PREFIX) },
    { label: 'Comptes certifiés', n: countByPrefix(ticks, CERTIFIED_PREFIX) },
  ];

  return (
    <div className="flex max-h-[88vh] flex-col">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="etats-marks-title" className="text-base font-semibold">
            Marques de pointage
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Les marques documentent le pointage des états, de l’annexe et du comparatif. Sur une case, les touches <Kbd>1</Kbd> à <Kbd>9</Kbd> appliquent les neuf premières marques.
          </p>
        </div>
        <Button variant="ghost" onClick={onClose} aria-label="Fermer la gestion des marques" className="shrink-0 px-1.5">
          <span aria-hidden="true">✕</span>
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="px-4 pt-3 text-xs text-muted">
          Cases pointées : {totals.map((t) => `${t.label.toLowerCase()} ${formatCount(t.n)}`).join(' · ')}
        </p>
        {marks.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Aucune marque : ajoutez-en une pour pointer les états.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-sm" aria-label="Marques de pointage">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="w-10 py-1 pl-4 pr-2 font-semibold">
                  Touche
                </th>
                <th scope="col" className="w-16 px-2 py-1 font-semibold">
                  Symbole
                </th>
                <th scope="col" className="px-2 py-1 font-semibold">
                  Signification
                </th>
                <th scope="col" className="px-2 py-1 font-semibold">
                  Couleur
                </th>
                <th scope="col" className="px-2 py-1 text-right font-semibold">
                  Cases
                </th>
                <th scope="col" className="py-1 pl-2 pr-4 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {marks.map((m, i) =>
                editing === m.id ? (
                  <EditRow key={m.id} mark={m} index={i} marks={marks} onDone={() => setEditing(null)} />
                ) : deleting === m.id ? (
                  <tr key={m.id} className="border-t border-line bg-ko/5">
                    <td colSpan={6} className="px-4 py-2">
                      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1">
                          Supprimer la marque <span className={cx('font-semibold', toneText(m.tone))}>{m.symbol}</span> « {m.label} » ?{' '}
                          {(usage[m.id] ?? 0) > 0 ? `${plural(usage[m.id] ?? 0, 'case pointée sera effacée', 'cases pointées seront effacées')}.` : 'Elle n’est utilisée sur aucune case.'}
                        </span>
                        <Button
                          variant="danger"
                          onClick={() => {
                            act((s) => removeTickMark(s, m.id));
                            setDeleting(null);
                          }}
                        >
                          Supprimer définitivement
                        </Button>
                        <Button autoFocus onClick={() => setDeleting(null)}>
                          Annuler
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id} className="border-t border-line">
                    <td className="py-1.5 pl-4 pr-2">{i < 9 ? <Kbd>{i + 1}</Kbd> : <span className="text-xs text-muted">–</span>}</td>
                    <td className={cx('px-2 py-1.5 text-base font-semibold', toneText(m.tone))}>{m.symbol}</td>
                    <td className="px-2 py-1.5">{m.label}</td>
                    <td className="px-2 py-1.5 text-xs text-muted">{TONE_LABELS[m.tone]}</td>
                    <td className="num px-2 py-1.5">{usage[m.id] ?? 0}</td>
                    <td className="py-1.5 pl-2 pr-4 text-right">
                      <span className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          className="px-1.5 py-0.5 text-xs"
                          onClick={() => {
                            setDeleting(null);
                            setEditing(m.id);
                          }}
                          aria-label={`Modifier la marque ${m.label}`}
                        >
                          Modifier
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-1.5 py-0.5 text-xs"
                          onClick={() => {
                            setEditing(null);
                            setDeleting(m.id);
                          }}
                          aria-label={`Supprimer la marque ${m.label}`}
                        >
                          Supprimer
                        </Button>
                      </span>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}

        <form onSubmit={add} aria-labelledby={`${formId}-title`} className="mt-3 border-t border-line px-4 py-3">
          <h3 id={`${formId}-title`} className="text-sm font-semibold">
            Nouvelle marque
          </h3>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-muted" htmlFor={`${formId}-symbol`}>
                Symbole
              </label>
              <TextInput
                id={`${formId}-symbol`}
                value={draft.symbol}
                onChange={(e) => setDraft({ ...draft, symbol: e.target.value })}
                className="w-16 text-center font-semibold"
                placeholder="R"
                autoComplete="off"
                aria-describedby={`${formId}-error`}
              />
            </div>
            <div className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
              <label className="text-xs text-muted" htmlFor={`${formId}-label`}>
                Signification
              </label>
              <TextInput id={`${formId}-label`} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Recalculé" autoComplete="off" aria-describedby={`${formId}-error`} />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-muted" htmlFor={`${formId}-tone`}>
                Couleur
              </label>
              <ToneSelect id={`${formId}-tone`} value={draft.tone} onChange={(tone) => setDraft({ ...draft, tone })} />
            </div>
            <Button type="submit" variant="primary">
              Ajouter la marque
            </Button>
          </div>
          <p id={`${formId}-error`} aria-live="polite" className="mt-1.5 min-h-4 text-xs text-ko">
            {error ?? ''}
          </p>
          <p className="text-xs text-muted">
            Aperçu :{' '}
            <span className={cx('inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-sunken px-0.5 text-xs font-semibold', toneText(draft.tone))}>{draft.symbol.trim() || '?'}</span>{' '}
            {draft.label.trim() || 'signification de la marque'}
          </p>
        </form>
      </div>
    </div>
  );
}

function EditRow({ mark, index, marks, onDone }: { mark: TickMark; index: number; marks: readonly TickMark[]; onDone: () => void }) {
  const act = useGame((s) => s.act);
  const [d, setD] = useState<Draft>({ symbol: mark.symbol, label: mark.label, tone: mark.tone });
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const save = (e?: FormEvent) => {
    e?.preventDefault();
    const msg = validate(d, marks, mark.id);
    setError(msg);
    if (msg) return;
    act((s) => updateTickMark(s, mark.id, { symbol: d.symbol.trim(), label: d.label.trim(), tone: d.tone }));
    onDone();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onDone();
    }
  };
  return (
    <tr className="border-t border-line bg-accent-soft/50" onKeyDown={onKeyDown}>
      <td className="py-1.5 pl-4 pr-2">{index < 9 ? <Kbd>{index + 1}</Kbd> : null}</td>
      <td className="px-2 py-1.5">
        <TextInput autoFocus aria-label="Symbole" value={d.symbol} onChange={(e) => setD({ ...d, symbol: e.target.value })} className={cx('w-12 text-center font-semibold', toneText(d.tone))} id={`${id}-s`} />
      </td>
      <td className="px-2 py-1.5">
        <TextInput aria-label="Signification" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} className="w-full" />
        {error && (
          <p role="alert" className="mt-0.5 text-xs text-ko">
            {error}
          </p>
        )}
      </td>
      <td className="px-2 py-1.5">
        <ToneSelect id={`${id}-t`} label="Couleur" value={d.tone} onChange={(tone) => setD({ ...d, tone })} />
      </td>
      <td />
      <td className="py-1.5 pl-2 pr-4 text-right">
        <span className="inline-flex gap-1">
          <Button variant="primary" className="px-1.5 py-0.5 text-xs" onClick={() => save()}>
            Enregistrer
          </Button>
          <Button className="px-1.5 py-0.5 text-xs" onClick={onDone}>
            Annuler
          </Button>
        </span>
      </td>
    </tr>
  );
}
