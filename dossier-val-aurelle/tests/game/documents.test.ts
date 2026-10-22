/** GED rules (src/game/documents.ts): availability, full-text search, block text, list filters. */
import { describe, expect, it } from 'vitest';
import {
  blockText,
  buildDocumentIndex,
  DEFAULT_DOCUMENT_FILTER,
  foldText,
  isAvailable,
  listDocuments,
  matchesStatus,
  receivedOn,
  searchWords,
  type AvailabilityContext,
} from '../../src/game/documents';
import { addWorkingDays, workCalendar } from '../../src/game/calendar';
import { delayDays, requestArrivals } from '../../src/game/requests';
import { params } from '../helpers/world';
import type { DocumentState } from '../../src/game/state';
import type { Block, DocumentModel } from '../../src/scenario/documents';

const P = params();

function doc(id: string, over: Partial<DocumentModel> = {}): DocumentModel {
  return {
    id,
    title: `Document ${id}`,
    category: 'accounting',
    date: '2026-01-15',
    issuer: 'Émetteur',
    availability: { kind: 'initial' },
    blocks: [],
    clues: [],
    ...over,
  };
}

function ctx(over: Partial<AvailabilityContext> = {}): AvailabilityContext {
  return { date: '2026-02-23', answeredRequests: new Set(), sentConfirmations: new Set(), conditions: new Set(), designer: false, ...over };
}

describe('isAvailable', () => {
  it('initial: available once the document is dated on or before the game date', () => {
    expect(isAvailable(doc('a', { date: '2026-02-23' }), ctx())).toBe(true);
    expect(isAvailable(doc('a', { date: '2025-06-30' }), ctx())).toBe(true);
    expect(isAvailable(doc('a', { date: '2026-03-02' }), ctx())).toBe(false);
  });
  it('afterDate: available from its date of receipt', () => {
    const d = doc('a', { date: '2025-12-01', availability: { kind: 'afterDate', from: '2026-03-03' } });
    expect(isAvailable(d, ctx())).toBe(false);
    expect(isAvailable(d, ctx({ date: '2026-03-03' }))).toBe(true);
    expect(isAvailable(d, ctx({ date: '2026-04-01' }))).toBe(true);
  });
  it('onRequest: available only once the precise request is answered', () => {
    const d = doc('a', { availability: { kind: 'onRequest', request: 'Registre des conventions', from: 'cfo' } });
    expect(isAvailable(d, ctx())).toBe(false);
    expect(isAvailable(d, ctx({ answeredRequests: new Set(['Autre demande']) }))).toBe(false);
    expect(isAvailable(d, ctx({ answeredRequests: new Set(['Registre des conventions']) }))).toBe(true);
  });
  it('onRequest, replies dated on the request: a version is served by its own request; the reference version comes with the first answer', () => {
    const requests = { items: [
      { id: 'req1', family: 'programme-invoices', object: 'PEU', sentOn: '2025-11-04' },
      { id: 'req2', family: 'programme-invoices', object: 'PEU', sentOn: '2025-11-05' },
      { id: 'req3', family: 'sale-notary', object: 'CLF', sentOn: '2025-11-17' },
    ] };
    const at = (date: string) => ctx({ date, requestArrival: requestArrivals(requests, P) });
    const onRequest = (object: string, over: object = {}) => ({ kind: 'onRequest' as const, request: 'Factures', from: 'chiefAccountant' as const, family: 'programme-invoices', object, ...over });
    // the version built for the second request (05/11) is not served by the answer to the first one (05/11)
    const v2 = doc('factures-peupliers~2025-11-05', { date: '2025-11-05', availability: onRequest('PEU', { asOf: '2025-11-05' }) });
    expect(isAvailable(v2, at('2025-11-05'))).toBe(false);
    expect(isAvailable(v2, at('2025-11-06'))).toBe(true);
    // the reference version (dated at the final) is received with the first answer, as its first version
    const ref = doc('factures-peupliers', { date: '2026-02-23', availability: onRequest('PEU', { rebuiltOnRequest: true }) });
    expect(isAvailable(ref, at('2025-11-04'))).toBe(false);
    expect(isAvailable(ref, at('2025-11-05'))).toBe(true);
    expect(receivedOn(ref, at('2026-03-01'), '2025-11-03')).toBe('2025-11-05');
    expect(isAvailable(doc('x', { availability: onRequest('ERA', { rebuiltOnRequest: true }) }), at('2026-03-01'))).toBe(false);
    // a scenario piece established after the request reaches the auditor as mail, at its date plus the delay
    const promises = doc('promesses', { date: '2025-12-12', availability: { kind: 'onRequest', request: 'Ventes', from: 'cfo', family: 'sale-notary', object: 'CLF' } });
    expect(isAvailable(promises, at('2025-12-12'))).toBe(false);
    expect(receivedOn(promises, at('2026-01-05'), '2025-11-03')).toBe(addWorkingDays(workCalendar(P), '2025-12-12', delayDays(P, 'sale-notary', 'CLF')));
  });
  it('confirmation: the request must have been sent and the reply arrived', () => {
    const d = doc('a', { availability: { kind: 'confirmation', request: 'Notaire', arrives: '2026-01-16' } });
    expect(isAvailable(d, ctx())).toBe(false);
    expect(isAvailable(d, ctx({ sentConfirmations: new Set(['Notaire']), date: '2026-01-15' }))).toBe(false);
    expect(isAvailable(d, ctx({ sentConfirmations: new Set(['Notaire']), date: '2026-01-16' }))).toBe(true);
    expect(isAvailable(d, ctx({ sentConfirmations: new Set(['Banques']) }))).toBe(false);
  });
  it('conditional: available only once the game condition is met', () => {
    const d = doc('a', { availability: { kind: 'conditional', condition: 'chiefAccountantConfides' } });
    expect(isAvailable(d, ctx())).toBe(false);
    expect(isAvailable(d, ctx({ conditions: new Set(['tenantAssociationContact']) }))).toBe(false);
    expect(isAvailable(d, ctx({ conditions: new Set(['chiefAccountantConfides']) }))).toBe(true);
  });
  it('designer mode unlocks every document', () => {
    const all = [
      doc('a', { date: '2027-01-01' }),
      doc('b', { availability: { kind: 'afterDate', from: '2027-01-01' } }),
      doc('c', { availability: { kind: 'onRequest', request: 'x', from: 'ceo' } }),
      doc('d', { availability: { kind: 'confirmation', request: 'y', arrives: '2027-01-01' } }),
      doc('e', { availability: { kind: 'conditional', condition: 'tenantAssociationContact' } }),
    ];
    for (const d of all) {
      expect(isAvailable(d, ctx()), d.id).toBe(false);
      expect(isAvailable(d, ctx({ designer: true })), d.id).toBe(true);
    }
  });
});

describe('blockText', () => {
  it('returns the plain text of every kind of block', () => {
    const cases: [Block, string][] = [
      [{ kind: 'heading', text: 'Titre' }, 'Titre'],
      [{ kind: 'paragraph', text: 'Un paragraphe.', clue: 'k1' }, 'Un paragraphe.'],
      [{ kind: 'note', text: 'Une note.' }, 'Une note.'],
      [{ kind: 'fields', rows: [{ label: 'Siège', value: 'Aurelle' }, { label: 'Forme', value: 'SA' }] }, 'Siège Aurelle Forme SA'],
      [{ kind: 'list', items: [{ text: 'premier' }, { text: 'second', clue: 'k2' }] }, 'premier second'],
      [{ kind: 'signature', name: 'N. Ferrand', role: 'DAF', date: '28/01/2026' }, 'N. Ferrand DAF 28/01/2026'],
      [{ kind: 'signature', name: 'K. Haddad', role: 'Chef comptable' }, 'K. Haddad Chef comptable '],
      [{ kind: 'stamp', text: 'Reçu le', date: '16/01/2026' }, 'Reçu le 16/01/2026'],
      [{ kind: 'table', title: 'Tableau', columns: ['Programme', 'Montant'], rows: [{ cells: ['Tilleuls', 'x1'] }, { cells: ['Charmes', 'x2'] }], footer: ['Total', 'x3'] }, 'Tableau Programme Montant Tilleuls x1 Charmes x2 Total x3'],
      [{ kind: 'table', columns: ['A'], rows: [{ cells: ['b'] }] }, ' A b '],
    ];
    for (const [b, text] of cases) expect(blockText(b), b.kind).toBe(text);
  });
});

describe('foldText and searchWords', () => {
  it('folds accents, case, ligatures and apostrophes and maps back to the raw text', () => {
    const raw = 'Maîtrise d’Œuvre';
    const f = foldText(raw);
    expect(f.text).toBe('maitrise d oeuvre');
    expect(f.map).toHaveLength(f.text.length);
    const p = f.text.indexOf('oeuvre');
    expect(raw.slice(f.map[p]!)).toBe('Œuvre');
    expect(f.map[p + 1]).toBe(f.map[p]);
  });
  it('keeps words longer than one character, folded and without duplicates', () => {
    expect(searchWords('  À l’Échéance, n° 7 : échéance ')).toEqual(['echeance']);
    expect(searchWords('a b c')).toEqual([]);
    expect(searchWords('PGE 2025')).toEqual(['pge', '2025']);
  });
});

describe('buildDocumentIndex', () => {
  const docs: DocumentModel[] = [
    doc('pv', {
      title: 'Procès-verbal du conseil',
      issuer: 'Conseil d’administration',
      blocks: [
        { kind: 'heading', text: 'Ordre du jour' },
        { kind: 'paragraph', text: 'Le conseil approuve la démolition du bâtiment B et le relogement des locataires.' },
        { kind: 'paragraph', text: 'Questions diverses : maîtrise d’œuvre des Charmes.' },
      ],
    }),
    doc('note', {
      title: 'Note interne',
      issuer: 'Gestion locative',
      blocks: [
        { kind: 'paragraph', text: 'Révision des loyers au 1er janvier : écart avec le plafond légal.' },
        { kind: 'list', items: [{ text: 'Démolition prévue' }, { text: 'Relogement en cours' }] },
      ],
    }),
    doc('demolition', {
      title: 'Démolition des Glycines – délibération',
      issuer: 'Direction du patrimoine',
      blocks: [{ kind: 'paragraph', text: 'Plan de relogement.' }],
    }),
    doc('long', {
      title: 'Annexe',
      issuer: 'Comptabilité',
      blocks: [{ kind: 'paragraph', text: `${'Lorem ipsum dolor sit amet '.repeat(6)}provision pour gros entretien${' consectetur adipiscing elit'.repeat(8)}` }],
    }),
  ];
  const index = buildDocumentIndex(docs);

  it('is accent- and case-insensitive in both directions', () => {
    expect(index.search('ECART').map((h) => h.docId)).toEqual(['note']);
    expect(index.search('révision').map((h) => h.docId)).toEqual(['note']);
    expect(index.search('revision').map((h) => h.docId)).toEqual(['note']);
    expect(index.search('Procès').map((h) => h.docId)).toEqual(['pv']);
  });
  it('finds ligatures typed without them (œ → oe)', () => {
    const hits = index.search('maitrise d oeuvre');
    expect(hits.map((h) => h.docId)).toEqual(['pv']);
    expect(hits[0]!.snippet).toContain('maîtrise d’œuvre');
  });
  it('requires every word of the query (AND)', () => {
    expect(index.search('relogement').map((h) => h.docId).sort()).toEqual(['demolition', 'note', 'pv']);
    expect(index.search('relogement loyers').map((h) => h.docId)).toEqual(['note']);
    expect(index.search('relogement licenciement')).toEqual([]);
  });
  it('weighs the title, issuer and references above the body', () => {
    const hits = index.search('démolition');
    // title match (5) first; equal body scores (1) are ordered by id
    expect(hits.map((h) => h.docId)).toEqual(['demolition', 'note', 'pv']);
    expect(hits.map((h) => h.score)).toEqual([5, 1, 1]);
    // title and body add up
    const both = buildDocumentIndex([doc('x', { title: 'Relogement', blocks: [{ kind: 'paragraph', text: 'relogement' }, { kind: 'note', text: 'relogement' }] })]).search('relogement');
    expect(both[0]!.score).toBe(7);
  });
  it('reports the first matching block, every matching block and a snippet of the raw text', () => {
    const [hit] = index.search('relogement locataires');
    expect(hit!.docId).toBe('pv');
    expect(hit!.block).toBe(1);
    expect(hit!.blocks).toEqual([1]);
    expect(hit!.snippet).toBe('Le conseil approuve la démolition du bâtiment B et le relogement des locataires.');
    const note = index.search('relogement').find((h) => h.docId === 'note')!;
    expect(note.blocks).toEqual([1]);
  });
  it('cuts long snippets around the first occurrence, on word boundaries, with ellipses', () => {
    const [hit] = index.search('entretien');
    expect(hit!.docId).toBe('long');
    expect(hit!.snippet.startsWith('…')).toBe(true);
    expect(hit!.snippet.endsWith('…')).toBe(true);
    expect(hit!.snippet).toContain('provision pour gros entretien');
    expect(hit!.snippet.length).toBeLessThanOrEqual(185);
    expect(hit!.snippet).toMatch(/^…[A-Za-z]/);
  });
  it('reports block -1 and no snippet when only the title or issuer matches', () => {
    const [hit] = index.search('Glycines');
    expect(hit).toMatchObject({ docId: 'demolition', block: -1, blocks: [], snippet: '' });
    expect(index.search('patrimoine').map((h) => h.docId)).toEqual(['demolition']);
  });
  it('restricts the search to the given documents', () => {
    expect(index.search('relogement', new Set(['pv', 'long'])).map((h) => h.docId)).toEqual(['pv']);
    expect(index.search('relogement', new Set())).toEqual([]);
  });
  it('ignores words of one character and empty queries', () => {
    expect(index.search('')).toEqual([]);
    expect(index.search('a')).toEqual([]);
    expect(index.search('  B  ')).toEqual([]);
    expect(index.search('B relogement des')).toEqual(index.search('relogement des'));
  });
});

describe('listDocuments', () => {
  const docs: DocumentModel[] = [
    doc('a', { title: 'Balance âgée', date: '2026-01-08', category: 'accounting' }),
    doc('b', { title: 'arrêté de subvention', date: '2021-03-12', category: 'contracts' }),
    doc('c', { title: 'Courrier du Département', date: '2025-10-10', category: 'mail' }),
    doc('d', { title: 'État de la dette', date: '2026-01-08', category: 'accounting' }),
  ];
  const states: Record<string, DocumentState> = {
    a: { readOn: '2026-02-23', annotations: [], evidence: true },
    c: { readOn: '2026-02-23', annotations: [{ id: 'note1', text: 'À voir', createdOn: '2026-02-23' }], evidence: false },
    d: { annotations: [], evidence: false },
  };
  const ids = (l: ReturnType<typeof listDocuments>) => l.map((x) => x.doc.id);

  it('sorts by date (most recent first by default, ties by title), ascending date or title', () => {
    expect(ids(listDocuments(docs, states, DEFAULT_DOCUMENT_FILTER, null))).toEqual(['a', 'd', 'c', 'b']);
    expect(ids(listDocuments(docs, states, { ...DEFAULT_DOCUMENT_FILTER, sort: 'dateAsc' }, null))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(listDocuments(docs, states, { ...DEFAULT_DOCUMENT_FILTER, sort: 'title' }, null))).toEqual(['b', 'a', 'c', 'd']);
    expect(ids(listDocuments(docs, states, { ...DEFAULT_DOCUMENT_FILTER, sort: 'relevance' }, null))).toEqual(['a', 'd', 'c', 'b']);
  });
  it('filters by category and by status', () => {
    expect(ids(listDocuments(docs, states, { ...DEFAULT_DOCUMENT_FILTER, category: 'accounting' }, null))).toEqual(['a', 'd']);
    expect(ids(listDocuments(docs, states, { ...DEFAULT_DOCUMENT_FILTER, status: 'unread' }, null))).toEqual(['d', 'b']);
    expect(ids(listDocuments(docs, states, { ...DEFAULT_DOCUMENT_FILTER, status: 'evidence' }, null))).toEqual(['a']);
    expect(ids(listDocuments(docs, states, { ...DEFAULT_DOCUMENT_FILTER, status: 'annotated' }, null))).toEqual(['c']);
    expect(matchesStatus(undefined, 'unread')).toBe(true);
    expect(matchesStatus(undefined, 'evidence')).toBe(false);
  });
  it('keeps the document being read whatever its status', () => {
    expect(ids(listDocuments(docs, states, { ...DEFAULT_DOCUMENT_FILTER, status: 'unread' }, null, 'a'))).toEqual(['a', 'd', 'b']);
    expect(ids(listDocuments(docs, states, { ...DEFAULT_DOCUMENT_FILTER, status: 'unread', category: 'mail' }, null, 'a'))).toEqual([]);
  });
  it('keeps only the search hits, sorted by relevance on request', () => {
    const hits = [
      { docId: 'b', score: 2, block: 0, blocks: [0], snippet: '' },
      { docId: 'd', score: 6, block: -1, blocks: [], snippet: '' },
    ];
    const byDate = listDocuments(docs, states, DEFAULT_DOCUMENT_FILTER, hits);
    expect(ids(byDate)).toEqual(['d', 'b']);
    expect(byDate[0]!.hit?.score).toBe(6);
    expect(ids(listDocuments(docs, states, { ...DEFAULT_DOCUMENT_FILTER, sort: 'dateAsc' }, hits))).toEqual(['b', 'd']);
    expect(ids(listDocuments(docs, states, { ...DEFAULT_DOCUMENT_FILTER, sort: 'relevance' }, [...hits, { docId: 'c', score: 9, block: 0, blocks: [0], snippet: '' }]))).toEqual(['c', 'd', 'b']);
    expect(ids(listDocuments(docs, states, DEFAULT_DOCUMENT_FILTER, []))).toEqual([]);
    expect(listDocuments(docs, states, DEFAULT_DOCUMENT_FILTER, null).every((x) => x.hit === null)).toBe(true);
  });
});
