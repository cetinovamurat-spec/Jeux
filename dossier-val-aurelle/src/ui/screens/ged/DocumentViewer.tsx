/**
 * GED viewer: toolbar (previous / next in the filtered list, evidence,
 * print), the document on paper with the search words highlighted, block
 * annotations (composer docked at the bottom, list under the document) and,
 * in designer mode only, the clues of the document and its availability.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { blockText, type SearchHit } from '../../../game/documents';
import { addAnnotation, removeAnnotation, toggleEvidence, type DocumentState } from '../../../game/state';
import type { DocumentModel } from '../../../scenario/documents';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { DocumentView } from '../../components/DocumentView';
import { Badge, Button, Card, cx, Select } from '../../components/ui';
import { availabilityText, CATEGORY_LABELS, CLUE_SOURCE_LABELS, plural } from './labels';

export interface DocumentViewerProps {
  doc: DocumentModel;
  state: DocumentState | undefined;
  prevId: string | null;
  nextId: string | null;
  /** Position of the document in the filtered list (-1 when it is not in it). */
  position: number;
  total: number;
  hit: SearchHit | null;
  words: readonly string[];
  designer: boolean;
}

const EXCERPT = 70;

function excerpt(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > EXCERPT ? `${t.slice(0, EXCERPT - 1)}…` : t;
}

export function DocumentViewer({ doc, state, prevId, nextId, position, total, hit, words, designer }: DocumentViewerProps) {
  const act = useGame((s) => s.act);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [occurrence, setOccurrence] = useState(0);
  const [focused, setFocused] = useState(false);
  const expanded = focused || draft.includes('\n') || draft.length > 60;
  const scrollRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const annotations = useMemo(() => state?.annotations ?? [], [state]);
  const evidence = !!state?.evidence;

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of annotations) if (a.block !== undefined) m.set(a.block, (m.get(a.block) ?? 0) + 1);
    return m;
  }, [annotations]);

  /** Scrolls the document pane (never the page) to an element; `ifHidden`: only when it is not fully visible. */
  const scrollTo = (el: Element | null | undefined, smooth = true, ifHidden = false) => {
    const box = scrollRef.current;
    if (!box || !el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (ifHidden && r.top >= b.top && r.bottom <= b.bottom) return;
    const top = r.top - b.top + box.scrollTop - 24;
    box.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
  };
  const scrollToBlock = (i: number, smooth = true, ifHidden = false) => scrollTo(scrollRef.current?.querySelector(`[data-block="${i}"]`), smooth, ifHidden);

  // Jump to the first occurrence of the search when the document opens or the search changes.
  const hitKey = hit ? `${words.join(' ')}|${hit.blocks.join(',')}` : '';
  useEffect(() => {
    setOccurrence(0);
    if (hit && hit.block >= 0) scrollToBlock(hit.block, false, true);
  }, [hitKey]);

  const go = (id: string | null) => {
    if (id) navigate(`/ged/${encodeURIComponent(id)}`);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.trim()) return;
    act((s) => addAnnotation(s, doc.id, draft, selected ?? undefined));
    setDraft('');
    setSelected(null);
  };

  const moveOccurrence = (delta: number) => {
    if (!hit?.blocks.length) return;
    const n = (occurrence + delta + hit.blocks.length) % hit.blocks.length;
    setOccurrence(n);
    scrollToBlock(hit.blocks[n]!);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-panel">
      {/* toolbar */}
      <div className="border-b border-line px-3 py-2">
        <div role="toolbar" aria-label="Actions sur le document" className="flex flex-wrap items-center gap-2">
          <Button onClick={() => go(prevId)} disabled={!prevId} aria-label="Document précédent de la liste" title="Document précédent de la liste">
            ‹ Précédent
          </Button>
          <Button onClick={() => go(nextId)} disabled={!nextId} aria-label="Document suivant de la liste" title="Document suivant de la liste">
            Suivant ›
          </Button>
          <span className="font-mono text-xs text-muted" aria-label="Position dans la liste">
            {position >= 0 ? `${position + 1} / ${total}` : `hors liste (${total})`}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              aria-pressed={evidence}
              onClick={() => act((s) => toggleEvidence(s, doc.id))}
              title={evidence ? 'Document conservé comme élément probant : cliquer pour le retirer' : 'Conserver ce document comme élément probant'}
              className={cx(evidence && 'border-ok/50 bg-ok/10 font-medium text-ok hover:bg-ok/15')}
            >
              <span aria-hidden className={cx('inline-flex size-3.5 items-center justify-center rounded-sm border text-[10px] leading-none', evidence ? 'border-ok bg-ok text-panel' : 'border-muted')}>
                {evidence ? '✓' : ''}
              </span>
              Conserver comme preuve
            </Button>
            <Button onClick={() => window.print()} title="Imprimer le document">
              Imprimer
            </Button>
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{CATEGORY_LABELS[doc.category]}</span>
          <span>{state?.readOn ? `Consulté pour la première fois le ${formatDateFr(state.readOn)}` : 'Non lu'}</span>
          {annotations.length > 0 && (
            <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => scrollTo(notesRef.current)}>
              {plural(annotations.length, 'annotation', 'annotations')}
            </button>
          )}
          {hit && hit.blocks.length > 0 && (
            <span className="flex items-center gap-1" aria-live="polite">
              <span>
                Occurrences : bloc {hit.blocks[occurrence]! + 1} ({occurrence + 1} / {hit.blocks.length})
              </span>
              <Button variant="ghost" className="px-1 py-0 text-xs" onClick={() => moveOccurrence(-1)} aria-label="Occurrence précédente" disabled={hit.blocks.length < 2}>
                ‹
              </Button>
              <Button variant="ghost" className="px-1 py-0 text-xs" onClick={() => moveOccurrence(1)} aria-label="Occurrence suivante" disabled={hit.blocks.length < 2}>
                ›
              </Button>
            </span>
          )}
          {hit && hit.blocks.length === 0 && <span>Recherche trouvée dans le titre, l’émetteur ou les références</span>}
        </div>
      </div>

      {/* document, annotations, designer panel */}
      <div ref={scrollRef} data-ged-fill className="relative min-h-0 flex-1 overflow-y-auto bg-sunken px-4 py-5">
        <div data-ged-print>
          <DocumentView doc={doc} showClues={designer} annotations={counts} selectedBlock={selected} onSelectBlock={(i) => setSelected((s) => (s === i ? null : i))} highlight={words} />
        </div>

        <div ref={notesRef} className="mx-auto mt-5 max-w-3xl">
          <Card title={`Annotations (${annotations.length})`}>
            {annotations.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted">Aucune annotation. Cliquez sur un passage du document pour le sélectionner, puis rédigez votre note dans le cadre ci-dessous.</p>
            ) : (
              <ul aria-label="Annotations du document">
                {annotations.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 border-t border-line px-3 py-2 first:border-t-0">
                    <div className="w-24 shrink-0 text-xs">
                      {a.block !== undefined ? (
                        <button
                          type="button"
                          className="font-medium text-accent underline-offset-2 hover:underline"
                          onClick={() => {
                            setSelected(a.block!);
                            scrollToBlock(a.block!);
                          }}
                          title="Afficher le passage annoté"
                        >
                          Bloc {a.block + 1}
                        </button>
                      ) : (
                        <span className="font-medium">Document</span>
                      )}
                      <p className="font-mono text-muted">{formatDateFr(a.createdOn)}</p>
                    </div>
                    <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm">{a.text}</p>
                    <Button variant="ghost" className="px-1.5 py-0.5 text-xs" onClick={() => act((s) => removeAnnotation(s, doc.id, a.id))} aria-label={`Supprimer l’annotation du ${formatDateFr(a.createdOn)}${a.block !== undefined ? ` sur le bloc ${a.block + 1}` : ''}`}>
                      Supprimer
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {designer && <DesignerPanel doc={doc} />}
        </div>
      </div>

      {/* annotation composer */}
      <form onSubmit={submit} aria-label="Nouvelle annotation" className="border-t border-line bg-panel px-3 py-2">
        <div className="mb-1.5 flex items-center gap-2 text-xs">
          <label htmlFor="ged-note-target" className="shrink-0 font-medium text-muted">
            Annoter
          </label>
          <Select
            id="ged-note-target"
            value={selected === null ? '' : String(selected)}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              setSelected(v);
              if (v !== null) scrollToBlock(v);
            }}
            className="min-w-0 max-w-[24rem] flex-1 py-0.5 text-xs"
          >
            <option value="">le document entier</option>
            {doc.blocks.map((b, i) => (
              <option key={i} value={i}>
                Bloc {i + 1} – {excerpt(blockText(b))}
              </option>
            ))}
          </Select>
          {selected !== null && (
            <Button variant="ghost" className="shrink-0 px-1.5 py-0 text-xs" onClick={() => setSelected(null)}>
              Désélectionner
            </Button>
          )}
          <span className="hidden truncate text-muted xl:inline">Cliquez sur un passage du document pour le cibler.</span>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            aria-label="Texte de l’annotation"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
            }}
            rows={expanded ? 3 : 1}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={`${selected === null ? 'Note sur le document' : `Note sur le bloc ${selected + 1}`} (Ctrl + Entrée pour enregistrer)…`}
            className="min-w-0 flex-1 resize-y rounded-md border border-line bg-panel px-2 py-1 text-sm placeholder:text-muted"
          />
          <Button type="submit" variant="primary" disabled={!draft.trim()}>
            Annoter
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Designer mode: availability of the document and its clues. */
function DesignerPanel({ doc }: { doc: DocumentModel }) {
  const c = useCase();
  const titles = useMemo(() => new Map<string, string>([...c.synthesis.anomalies.map((a) => [a.id, a.title] as const), ...c.falseLeads.map((f) => [f.id, f.title] as const)]), [c]);
  return (
    <Card className="mt-4 border-warn/50" title={<span className="text-warn">Mode concepteur – accès et indices du document</span>}>
      <div className="space-y-2 px-3 py-2 text-sm">
        <p>
          <span className="font-medium">Accès : </span>
          {availabilityText(doc.availability, doc.date, c.params)}
        </p>
        <p className="text-xs text-muted">
          Identifiant <span className="font-mono">{doc.id}</span>
          {doc.reference ? ` · référence ${doc.reference}` : ''}
          {doc.noise ? ' · document de bruit réaliste' : ''}
        </p>
        {doc.clues.length === 0 ? (
          <p className="text-muted">Aucun indice dans ce document.</p>
        ) : (
          <div className="overflow-x-auto">
            <table aria-label="Indices du document" className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th scope="col" className="border-b border-line py-1 pr-2 font-semibold">Indice</th>
                  <th scope="col" className="border-b border-line py-1 pr-2 font-semibold">Cible</th>
                  <th scope="col" className="border-b border-line py-1 pr-2 font-semibold">Parties</th>
                  <th scope="col" className="border-b border-line py-1 pr-2 font-semibold">Source</th>
                  <th scope="col" className="border-b border-line py-1 font-semibold">Ce que montre l’indice</th>
                </tr>
              </thead>
              <tbody>
                {doc.clues.map((cl) => (
                  <tr key={cl.id} className="align-top">
                    <td className="border-b border-line py-1 pr-2 font-mono">{cl.id}</td>
                    <td className="border-b border-line py-1 pr-2">
                      <Badge tone={cl.target.startsWith('F') ? 'muted' : 'warn'}>{cl.target}</Badge>
                      <span className="mt-0.5 block text-muted">{titles.get(cl.target) ?? ''}</span>
                    </td>
                    <td className="border-b border-line py-1 pr-2 font-mono">{cl.parts?.join(', ') ?? 'toutes'}</td>
                    <td className="border-b border-line py-1 pr-2">{CLUE_SOURCE_LABELS[cl.source]}</td>
                    <td className="border-b border-line py-1">{cl.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
