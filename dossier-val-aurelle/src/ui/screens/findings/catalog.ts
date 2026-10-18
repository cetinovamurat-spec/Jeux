/**
 * Closed lists of the findings form (plan J4 §13.1): programmes, third
 * parties, accounts of the chart, documents available, loans, subsidies and
 * items of the annex or of the management report. They are built from the
 * presented data and the parameters only — never from the anomalies — so that
 * their composition reveals nothing. Also the labels and links of the objects
 * and of the evidence.
 */
import { useMemo } from 'react';
import { formatDateFr } from '../../../engine/dates';
import type { Evidence, FindingObjectKind } from '../../../game/findings';
import { procedureDef } from '../../../game/program';
import { POPULATIONS } from '../../../game/samples';
import { TOOL_DEFS } from '../../../game/recalcs';
import { programmeLabel } from '../../../scenario/documents/request-labels';
import type { DocumentModel } from '../../../scenario/documents';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { useGedDocuments } from '../ged/replies';
import { EVIDENCE_KIND_LABELS } from './labels';

export interface CatalogOption {
  id: string;
  label: string;
}

export interface FindingCatalog {
  options: Readonly<Record<FindingObjectKind, readonly CatalogOption[]>>;
  /** Accounts of the chart (the entry is proposed on them only). */
  accounts: ReadonlySet<string>;
  objectLabel: (o: { kind: string; id: string }) => string;
  /** Documents available at the game date (scenario and replies built on demand), by title. */
  documents: readonly DocumentModel[];
  docTitle: (id: string) => string | undefined;
}

function byLabel(a: CatalogOption, b: CatalogOption): number {
  return a.label.localeCompare(b.label, 'fr');
}

export function useFindingCatalog(): FindingCatalog {
  const c = useCase();
  const { available, byId } = useGedDocuments();
  const statics = useMemo(() => {
    const params = c.params;
    const ds = c.datasets;
    const tpName = new Map(ds.thirdParties.map((t) => [t.id, t.name]));
    const programme: CatalogOption[] = params.programmes.map((p) => ({ id: p.id, label: p.name })).sort(byLabel);
    const thirdParty: CatalogOption[] = ds.thirdParties.map((t) => ({ id: t.id, label: t.name })).sort(byLabel);
    const account: CatalogOption[] = c.presented.chart.accounts.map((a) => ({ id: a.number, label: `${a.number} – ${a.label}` }));
    const loan: CatalogOption[] = ds.loans.map((l) => ({ id: l.id, label: `Prêt ${l.product} n° ${l.contractNumber} – ${tpName.get(l.lenderId) ?? l.lenderId}${l.programmeId ? ` (${programmeLabel(params, l.programmeId)})` : ''}` })).sort(byLabel);
    const subsidy: CatalogOption[] = ds.subsidies
      .map((s) => ({ id: s.id, label: `${programmeLabel(params, s.programmeId)} – ${tpName.get(s.grantorId) ?? s.grantorId} (décision du ${formatDateFr(s.decisionDate)})` }))
      .sort(byLabel);
    const disclosureItem: CatalogOption[] = params.disclosureItems.items.map((i) => ({ id: i.id, label: `${i.document === 'annex' ? 'Annexe' : 'Rapport de gestion'} – ${i.label}` }));
    return { programme, thirdParty, account, loan, subsidy, disclosureItem, accounts: new Set(account.map((a) => a.id)) };
  }, [c]);
  return useMemo(() => {
    const documents = [...available].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    const document: CatalogOption[] = documents.map((d) => ({ id: d.id, label: d.title }));
    const options = { ...statics, document } as Record<FindingObjectKind, readonly CatalogOption[]>;
    const index = new Map<string, string>();
    for (const [kind, list] of Object.entries(options)) for (const o of list) index.set(`${kind}:${o.id}`, o.label);
    const docTitle = (id: string) => byId(id)?.title;
    return {
      options,
      accounts: statics.accounts,
      documents,
      docTitle,
      objectLabel: (o) => index.get(`${o.kind}:${o.id}`) ?? (o.kind === 'document' ? (docTitle(o.id) ?? o.id) : o.kind === 'programme' ? programmeLabel(c.params, o.id) : o.id),
    };
  }, [statics, available, byId, c]);
}

export interface EvidenceView {
  label: string;
  /** Route of the evidence (react-router path), when it has a screen. */
  to?: string;
}

/** Label and link of a piece of evidence (never the internal id of an entry). */
export function useEvidenceView(): (e: Evidence) => EvidenceView {
  const c = useCase();
  const { byId } = useGedDocuments();
  const samples = useGame((s) => s.game.samples.items);
  const recalcs = useGame((s) => s.game.recalcs.items);
  const queries = useGame((s) => s.game.savedQueries);
  const executions = useGame((s) => s.game.program.executions);
  return useMemo(() => {
    const params = c.params;
    const tpName = (id: string) => c.datasets.thirdParties.find((t) => t.id === id)?.name ?? id;
    const procOf = (executionId: string | null) => {
      const e = executionId ? executions.find((x) => x.id === executionId) : undefined;
      return e ? `/travaux?procedure=${encodeURIComponent(e.procedureId)}` : '/travaux';
    };
    return (e: Evidence): EvidenceView => {
      switch (e.kind) {
        case 'doc': {
          const title = byId(e.docId)?.title ?? `Pièce ${e.docId}`;
          return { label: e.block === undefined ? title : `${title} – bloc ${e.block + 1}`, to: `/ged/${encodeURIComponent(e.docId)}${e.block === undefined ? '' : `?bloc=${e.block + 1}`}` };
        }
        case 'fec':
          return { label: `Écriture ${e.num} (FEC ${e.year})`, to: `/fec?ecriture=${encodeURIComponent(e.num)}&exercice=${e.year}` };
        case 'sample': {
          const x = samples.find((s) => s.id === e.id);
          const pop = POPULATIONS.find((p) => p.id === x?.population)?.label;
          return { label: `Échantillon ${e.id}${pop ? ` – ${pop}` : ''}${x ? ` (tiré le ${formatDateFr(x.drawnOn)})` : ''}`, to: procOf(x?.executionId ?? null) };
        }
        case 'recalc': {
          const x = recalcs.find((r) => r.id === e.id);
          const tool = x ? TOOL_DEFS[x.tool as keyof typeof TOOL_DEFS]?.label : undefined;
          return { label: `Recalcul${tool ? ` – ${tool}` : ''}${x ? ` (le ${formatDateFr(x.on)})` : ` ${e.id}`}`, to: procOf(x?.executionId ?? null) };
        }
        case 'query': {
          const q = queries.find((x) => x.id === e.id);
          return { label: `Requête FEC « ${q?.name ?? e.id} »`, to: `/fec?requete=${encodeURIComponent(e.id)}` };
        }
        case 'execution': {
          const x = executions.find((it) => it.id === e.id);
          const def = x ? procedureDef(params, x.procedureId) : undefined;
          return { label: `Feuille de travail – ${def?.title ?? e.id}`, ...(x ? { to: `/travaux?procedure=${encodeURIComponent(x.procedureId)}` } : {}) };
        }
        case 'confirmation': {
          return { label: `Confirmation – ${tpName(e.id)}`, to: '/ged?onglet=demandes' };
        }
      }
    };
  }, [c, byId, samples, recalcs, queries, executions]);
}

/** Options of the evidence pickers that are not documents nor entries (state of the game). */
export function useEvidenceOptions(): Record<'sample' | 'recalc' | 'query' | 'execution' | 'confirmation', CatalogOption[]> {
  const c = useCase();
  const view = useEvidenceView();
  const samples = useGame((s) => s.game.samples.items);
  const recalcs = useGame((s) => s.game.recalcs.items);
  const queries = useGame((s) => s.game.savedQueries);
  const executions = useGame((s) => s.game.program.executions);
  const confirmations = useGame((s) => s.game.confirmations.items);
  return useMemo(
    () => ({
      sample: samples.map((x) => ({ id: x.id, label: view({ kind: 'sample', id: x.id }).label })),
      recalc: recalcs.map((x) => ({ id: x.id, label: view({ kind: 'recalc', id: x.id }).label })),
      query: queries.map((x) => ({ id: x.id, label: view({ kind: 'query', id: x.id }).label })),
      execution: executions.map((x) => ({ id: x.id, label: view({ kind: 'execution', id: x.id }).label })),
      confirmation: confirmations.map((x) => ({ id: x.thirdParty, label: view({ kind: 'confirmation', id: x.thirdParty }).label })),
    }),
    [c, view, samples, recalcs, queries, executions, confirmations], // eslint-disable-line react-hooks/exhaustive-deps
  );
}

export { EVIDENCE_KIND_LABELS };
