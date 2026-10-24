/**
 * Matching of the findings to the key (plan J4 §13.2, §18): a hand-written
 * fixture of « expert » findings written from §5 of the specification (at
 * least two wordings per part, a minimal variant, the combined A10 finding),
 * independent of the signatures; a collision matrix (sibling parts, false
 * leads, generic documents); negative cases (catch-all finding, wrong third
 * party, wrong programme); points « clos » never reported; parts without
 * result impact credited on their basis; the extrapolated A08 (and no wider
 * tolerance without a sample); and the import guard of game/matching.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFec } from '../../src/engine/fec';
import type { Evidence, Finding, FindingObject, FindingStatus, FindingTreatment } from '../../src/game/findings';
import { draftErrors, FINDING_TREATMENTS } from '../../src/game/findings';
import { acceptedRange, accountsMatch, matchFindings, type MatchInput } from '../../src/game/matching';
import { initialRecalcs } from '../../src/game/recalcs';
import { initialSamples, type SamplesState } from '../../src/game/samples';
import { PART_KEYS } from '../../src/scenario/anomalies/modules';
import type { Classification, Nature } from '../../src/scenario/anomalies/types';
import type { ScenarioDatasets } from '../../src/scenario/datasets';
import { correctionKey, documents } from '../helpers/scenario';
import { params } from '../helpers/world';

const P = params();
const key = correctionKey();
const docs = documents();
const world = key.presented.world;
const ds = world.datasets as unknown as ScenarioDatasets;

// ---------------------------------------------------------------------------
// fixture builder
// ---------------------------------------------------------------------------

const prog = (id: string): FindingObject => ({ kind: 'programme', id });
const tp = (id: string): FindingObject => ({ kind: 'thirdParty', id });
const acc = (id: string): FindingObject => ({ kind: 'account', id });
const doc = (id: string): FindingObject => ({ kind: 'document', id });
const item = (id: string): FindingObject => ({ kind: 'disclosureItem', id });
const sub = (id: string): FindingObject => ({ kind: 'subsidy', id });
const d = (docId: string, block?: number): Evidence => (block === undefined ? { kind: 'doc', docId } : { kind: 'doc', docId, block });
const conf = (id: string): Evidence => ({ kind: 'confirmation', id });

/** Line of an entry: account, debit and credit in euros. */
type L = [string, number, number];

interface Spec {
  cycle: string;
  objects?: FindingObject[];
  natures?: Nature[];
  classification?: Classification;
  treatments: FindingTreatment[];
  entry?: L[];
  fix?: string;
  evidence?: Evidence[];
  status?: FindingStatus;
}

let counter = 0;
function F(s: Spec): Finding {
  counter++;
  return {
    id: `T${counter}`,
    title: '',
    cycle: s.cycle,
    objects: s.objects ?? [],
    natures: s.natures ?? [],
    classification: s.classification ?? 'factual',
    treatments: s.treatments,
    proposedEntry: (s.entry ?? []).map(([account, debit, credit]) => ({ account, debit: Math.round(debit * 100), credit: Math.round(credit * 100) })),
    disclosureFix: s.fix ?? null,
    evidence: s.evidence ?? [],
    status: s.status ?? 'finding',
    history: [{ on: '2026-03-02', status: s.status ?? 'finding' }],
    escalatedToPartnerOn: null,
    comment: '',
    createdOn: '2026-03-02',
    suspicion: false,
  };
}

/** Entry D account / C account of an amount in euros. */
const dc = (debit: string, credit: string, euros: number): L[] => [
  [debit, euros, 0],
  [credit, 0, euros],
];

function fecNumber(pred: (e: (typeof world.ledgers.current.entries)[number]) => boolean): string {
  const e = world.ledgers.current.entries.find(pred);
  if (!e) throw new Error('écriture introuvable');
  const line = buildFec(world.ledgers.current, world.chart, world.journals, world.auxiliaries).find((l) => l.entryId === e.id)!;
  return line.EcritureNum;
}
const A06_ENTRY = fecNumber((e) => e.pieceRef === 'MES-OP-PEU-A2025');
const A11_ENTRY = fecNumber((e) => e.label === P.anomalies.A11.label && e.validDate === P.anomalies.A11.validDate);
const fec = (num: string): Evidence => ({ kind: 'fec', year: 2025, num });
const chaSubsidy = ds.subsidies.find((s) => s.programmeId === 'CHA' && s.grantorId === 'DEPARTEMENT')?.id ?? 'SUB-CHA';

/** Expert findings by part: at least two wordings and a minimal variant (the first one is the « full » finding). */
const EXPERT: Record<string, Finding[]> = {
  A01: [
    F({ cycle: 'fixedAssets', objects: [prog('TIL'), acc('2313')], natures: ['classification', 'valuation'], treatments: ['adjust'], entry: [...dc('2131', '2313', 9_550_000), ...dc('68111', '28131', 120_100), ...dc('13911', '777', 19_800)], evidence: [d('pv-reception-tilleuls'), d('fiche-operation-tilleuls')] }),
    F({ cycle: 'fixedAssets', objects: [prog('TIL'), doc('quittancement-programmes')], natures: ['valuation'], treatments: ['adjust'], entry: [...dc('68111', '28131', 120_000), ...dc('13911', '777', 19_800)], evidence: [d('invitation-inauguration-tilleuls')] }),
    F({ cycle: 'fixedAssets', objects: [prog('TIL')], treatments: ['adjust'], entry: dc('2131', '2313', 9_550_000) }),
  ],
  A02: [
    F({ cycle: 'fixedAssets', objects: [prog('ERA'), doc('registre-composants')], natures: ['occurrence', 'valuation'], treatments: ['adjust'], entry: [['28131', 734_800, 0], ['6758', 315_200, 0], ['2131', 0, 1_050_000], ...dc('28131', '68111', 21_200)], evidence: [d('facture-pac-erables')] }),
    F({ cycle: 'fixedAssets', objects: [prog('ERA'), acc('2131')], natures: ['valuation'], treatments: ['adjust'], entry: dc('6758', '28131', 294_000), evidence: [d('registre-composants')] }),
    F({ cycle: 'fixedAssets', objects: [prog('ERA')], treatments: ['adjust'], entry: dc('6758', '2131', 300_000) }),
  ],
  A03: [
    F({ cycle: 'fixedAssets', objects: [prog('CLF'), tp('NOTAIRE_GIRARD'), acc('7752')], natures: ['cutoff', 'occurrence'], treatments: ['adjust'], entry: [...dc('7752', '462', 1_060_000), ...dc('2131', '6752', 289_500)], evidence: [d('actes-clos-fleuri'), d('promesses-clos-fleuri')] }),
    F({ cycle: 'fixedAssets', objects: [prog('CLF'), doc('actes-clos-fleuri')], natures: ['cutoff'], treatments: ['adjust'], entry: dc('7752', '462', 770_500), evidence: [d('confirmation-notaire')] }),
    F({ cycle: 'fixedAssets', objects: [prog('CLF')], treatments: ['adjust'], entry: dc('7752', '462', 760_000) }),
  ],
  A04: [
    F({ cycle: 'fixedAssets', objects: [prog('GLB'), doc('pv-ca-2025-06')], natures: ['valuation'], classification: 'judgemental', treatments: ['adjust'], entry: [...dc('68111', '28131', 422_700), ...dc('13918', '777', 79_200)], evidence: [d('avenant-anru-glycines'), d('pv-ca-2025-06', 6)] }),
    F({ cycle: 'fixedAssets', objects: [prog('GLB')], natures: ['valuation'], classification: 'judgemental', treatments: ['adjust'], entry: dc('68111', '28131', 343_000), evidence: [d('deliberation-relogement')] }),
    F({ cycle: 'fixedAssets', objects: [prog('GLB')], treatments: ['adjust'], entry: dc('68111', '28131', 330_000) }),
  ],
  A05: [
    F({ cycle: 'provisions', objects: [acc('1572'), prog('ACA'), doc('ppe-officiel')], natures: ['valuation'], classification: 'judgemental', treatments: ['adjust'], entry: dc('78157', '1572', 780_000), evidence: [d('ppe-officiel'), d('ppe-daf'), d('budget-2026')] }),
    F({ cycle: 'provisions', objects: [prog('BEL'), acc('78157')], treatments: ['adjust'], classification: 'judgemental', entry: dc('78157', '1572', 780_000), evidence: [d('pv-ca-2025-12')] }),
    F({ cycle: 'provisions', objects: [acc('1572')], treatments: ['adjust'], entry: dc('78157', '1572', 780_000) }),
  ],
  A06: [
    F({ cycle: 'fixedAssets', objects: [prog('PEU'), acc('2135')], natures: ['classification'], treatments: ['adjust'], entry: [...dc('61521', '2135', 378_000), ...dc('28135', '68111', 8_400)], evidence: [d('factures-peupliers'), d('bons-commande-peupliers')] }),
    F({ cycle: 'purchases', objects: [prog('PEU'), acc('61521')], natures: ['classification'], treatments: ['adjust'], entry: dc('61521', '2135', 370_000), evidence: [fec(A06_ENTRY)] }),
    F({ cycle: 'fixedAssets', objects: [prog('PEU')], treatments: ['adjust'], entry: dc('61521', '2135', 378_000) }),
  ],
  'A07.a': [
    F({ cycle: 'rentReceivables', objects: [acc('4915'), doc('stats-recouvrement')], natures: ['valuation'], classification: 'judgemental', treatments: ['adjust'], entry: dc('68174', '4915', 467_250), evidence: [d('stats-recouvrement'), d('rapport-prestataire-recouvrement'), d('calcul-depreciation-creances')] }),
    // rate based on the recovery history, duly justified (§5: from 342 k€)
    F({ cycle: 'provisions', objects: [acc('4915')], classification: 'judgemental', treatments: ['adjust'], entry: dc('68174', '4915', 350_000), evidence: [d('stats-recouvrement')] }),
    F({ cycle: 'rentReceivables', objects: [acc('4915')], treatments: ['adjust'], entry: dc('68174', '4915', 467_000) }),
  ],
  'A07.b': [
    F({ cycle: 'rentReceivables', objects: [acc('6541'), doc('decisions-surendettement')], natures: ['valuation'], classification: 'judgemental', treatments: ['adjust'], entry: [...dc('6541', '4111', 238_000), ...dc('4911', '78174', 119_000)], evidence: [d('decisions-surendettement')] }),
    F({ cycle: 'rentReceivables', objects: [acc('4911')], natures: ['valuation'], treatments: ['adjust'], entry: [...dc('6541', '4111', 238_000), ...dc('4911', '78174', 119_000)], evidence: [d('calcul-depreciation-creances')] }),
    F({ cycle: 'provisions', objects: [acc('6541')], treatments: ['adjust'], entry: dc('6541', '4111', 119_000) }),
  ],
  'A07.c': [
    F({ cycle: 'rentReceivables', objects: [acc('4191'), doc('balance-agee-locataires')], natures: ['presentation', 'classification'], treatments: ['reclassify'], entry: dc('4111', '4191', 910_000), evidence: [d('balance-agee-locataires')] }),
    F({ cycle: 'rentReceivables', objects: [acc('4111'), acc('4191')], natures: ['presentation'], treatments: ['reclassify'], entry: dc('4111', '4191', 900_000) }),
    F({ cycle: 'provisions', objects: [acc('4191')], treatments: ['reclassify'], entry: dc('4111', '4191', 910_000) }),
  ],
  A08: [
    F({ cycle: 'debtTreasury', objects: [acc('1688'), tp('BDT'), doc('calcul-icne')], natures: ['valuation', 'cutoff'], treatments: ['adjust'], entry: dc('1688', '6611', 236_000), evidence: [d('calcul-icne'), d('etat-dette')] }),
    F({ cycle: 'debtTreasury', objects: [acc('6611')], natures: ['valuation'], treatments: ['adjust'], entry: dc('1688', '6611', 230_000), evidence: [d('confirmation-bdt')] }),
    F({ cycle: 'debtTreasury', objects: [acc('1688')], treatments: ['adjust'], entry: dc('1688', '6611', 236_000) }),
  ],
  A09: [
    F({ cycle: 'equitySubsidies', objects: [prog('CHA'), acc('4413'), doc('courrier-caducite-charmes')], natures: ['occurrence', 'valuation'], treatments: ['adjust'], entry: dc('1313', '4413', 420_000), evidence: [d('arrete-subvention-charmes'), d('courrier-caducite-charmes')] }),
    F({ cycle: 'fixedAssets', objects: [prog('CHA'), sub(chaSubsidy)], natures: ['valuation'], treatments: ['adjust'], entry: dc('1313', '4413', 420_000), evidence: [conf('DEPARTEMENT')] }),
    F({ cycle: 'equitySubsidies', objects: [prog('CHA')], treatments: ['adjust'], entry: dc('1313', '4413', 410_000) }),
  ],
  'A10.a': [
    F({ cycle: 'rentReceivables', objects: [prog('MAR'), acc('4181')], natures: ['valuation', 'compliance'], treatments: ['adjust'], entry: dc('7031', '4181', 96_000), evidence: [d('regularisation-charges-2025'), d('memo-charges-recuperables')] }),
    F({ cycle: 'rentReceivables', objects: [prog('MAR'), acc('7031')], natures: ['compliance'], treatments: ['adjust'], entry: dc('7031', '4181', 96_000), evidence: [d('rapport-ancols-2022')] }),
    F({ cycle: 'rentReceivables', objects: [prog('MAR')], treatments: ['adjust'], entry: dc('7031', '4181', 90_000) }),
  ],
  'A10.b': [
    F({ cycle: 'rentReceivables', objects: [acc('4181'), doc('fiches-poste-gardiens')], natures: ['valuation', 'compliance'], treatments: ['adjust'], entry: dc('7031', '4181', 158_000), evidence: [d('fiches-poste-gardiens'), d('regularisation-charges-2025')] }),
    F({ cycle: 'rentReceivables', objects: [acc('7031'), doc('fiches-poste-gardiens')], natures: ['compliance'], treatments: ['adjust'], entry: dc('7031', '4196', 158_000) }),
    F({ cycle: 'rentReceivables', objects: [doc('fiches-poste-gardiens')], treatments: ['adjust'], entry: dc('7031', '4181', 150_000) }),
  ],
  A11: [
    F({ cycle: 'crossCycle', objects: [acc('4687'), acc('7088'), tp('ACCUEIL_HORIZONS')], natures: ['occurrence'], treatments: ['adjust', 'governance'], fix: 'governance-communication', entry: dc('7088', '4687', 300_000), evidence: [fec(A11_ENTRY), d('conventions-gestionnaires-foyers'), d('confirmations-gestionnaires'), d('etat-cap-par')] }),
    F({ cycle: 'rentReceivables', objects: [acc('4687'), tp('HABITAT_INSERTION')], natures: ['occurrence', 'cutoff'], treatments: ['adjust'], entry: dc('7088', '4687', 300_000), evidence: [d('confirmation-ccas-aurelle')] }),
    F({ cycle: 'crossCycle', objects: [acc('4687')], treatments: ['adjust'], entry: dc('7088', '4687', 300_000) }),
  ],
  'A12.i': [
    F({ cycle: 'crossCycle', objects: [tp('COTEAUX_SEREIN'), item('off-balance-commitments'), item('related-parties')], natures: ['completeness', 'presentation'], treatments: ['disclose'], fix: 'add-missing', evidence: [d('convention-soutien-csh'), d('releve-bancaire-2025-09')] }),
    F({ cycle: 'debtTreasury', objects: [tp('COTEAUX_SEREIN'), acc('2748')], natures: ['completeness'], treatments: ['disclose'], fix: 'add-missing', evidence: [d('convention-soutien-csh')] }),
    F({ cycle: 'disclosures', objects: [item('off-balance-commitments')], treatments: ['disclose'], fix: 'add-missing' }),
  ],
  'A12.ii': [
    F({ cycle: 'crossCycle', objects: [tp('COTEAUX_SEREIN'), doc('composition-ca')], natures: ['compliance'], treatments: ['specialReport'], fix: 'special-report', evidence: [d('registre-conventions'), d('pv-ca-2025-09'), d('convention-soutien-csh')] }),
    F({ cycle: 'crossCycle', objects: [doc('registre-conventions')], natures: ['compliance'], treatments: ['specialReport'], fix: 'special-report', evidence: [d('composition-ca')] }),
    F({ cycle: 'crossCycle', objects: [tp('COTEAUX_SEREIN')], treatments: ['specialReport'], fix: 'special-report', evidence: [d('composition-ca')] }),
  ],
  'A12.iii': [
    F({ cycle: 'crossCycle', objects: [tp('COTEAUX_SEREIN')], natures: ['compliance'], treatments: ['governance'], fix: 'request-justification', evidence: [d('convention-soutien-csh')] }),
    F({ cycle: 'debtTreasury', objects: [tp('COTEAUX_SEREIN'), doc('convention-soutien-csh')], treatments: ['governance'], fix: 'governance-irregularity' }),
    F({ cycle: 'crossCycle', objects: [tp('COTEAUX_SEREIN')], treatments: ['governance'], fix: 'governance-irregularity' }),
  ],
  A13: [
    F({ cycle: 'disclosures', objects: [item('retirement-commitments'), doc('rapport-actuariel-2025')], natures: ['completeness'], treatments: ['disclose'], fix: 'add-missing', evidence: [d('annexe-2024'), d('rapport-actuariel-2025')] }),
    F({ cycle: 'provisions', objects: [item('retirement-commitments')], treatments: ['disclose'], fix: 'add-missing', evidence: [d('annexe-2025')] }),
    F({ cycle: 'disclosures', objects: [doc('rapport-actuariel-2025')], treatments: ['disclose'], fix: 'add-missing' }),
  ],
  'A14.i': [
    F({ cycle: 'disclosures', objects: [item('payment-terms'), doc('balance-agee-fournisseurs')], natures: ['compliance'], treatments: ['report'], fix: 'correct-amount', evidence: [d('rapport-gestion-2025')] }),
    F({ cycle: 'crossCycle', objects: [item('payment-terms')], treatments: ['report'], fix: 'correct-amount', evidence: [d('balance-agee-fournisseurs')] }),
    F({ cycle: 'disclosures', objects: [item('payment-terms')], treatments: ['report'], fix: 'correct-amount' }),
  ],
  'A14.ii': [
    F({ cycle: 'disclosures', objects: [item('vacancy'), doc('rapport-vacance')], natures: ['presentation'], treatments: ['report'], fix: 'specify-definition', evidence: [d('rapport-gestion-2024'), d('rapport-gestion-2025')] }),
    F({ cycle: 'disclosures', objects: [item('vacancy')], treatments: ['report'], fix: 'correct-amount', evidence: [d('rapport-vacance')] }),
    F({ cycle: 'disclosures', objects: [item('vacancy')], treatments: ['report'], fix: 'specify-definition' }),
  ],
  'A14.iii': [
    F({ cycle: 'disclosures', objects: [item('net-self-financing'), doc('rapport-gestion-2025')], natures: ['presentation'], treatments: ['report'], fix: 'update-after-corrections' }),
    F({ cycle: 'crossCycle', objects: [item('net-self-financing')], treatments: ['report'], fix: 'correct-amount', evidence: [d('rapport-gestion-2025')] }),
    F({ cycle: 'disclosures', objects: [item('net-self-financing')], treatments: ['report'], fix: 'update-after-corrections' }),
  ],
  A15: [
    F({ cycle: 'rentReceivables', objects: [tp('ACCUEIL_HORIZONS'), acc('4914')], natures: ['valuation'], classification: 'judgemental', treatments: ['adjust'], entry: dc('68174', '4914', 468_000), evidence: [d('courrier-mandataire'), conf('ACCUEIL_HORIZONS'), d('balance-agee-locataires')] }),
    F({ cycle: 'crossCycle', objects: [tp('ACCUEIL_HORIZONS'), doc('courrier-mandataire')], classification: 'judgemental', treatments: ['adjust'], entry: dc('68174', '4914', 460_000), evidence: [d('article-presse-accueil-horizons')] }),
    F({ cycle: 'provisions', objects: [acc('4914')], treatments: ['adjust'], entry: dc('68174', '4914', 468_000) }),
  ],
  'A16.a': [
    F({ cycle: 'fixedAssets', objects: [prog('TIL'), tp('F0022'), acc('4084')], natures: ['completeness'], classification: 'judgemental', treatments: ['adjust'], entry: dc('2131', '4084', 210_000), evidence: [d('os7-tilleuls'), d('reponse-avocate')] }),
    F({ cycle: 'provisions', objects: [tp('F0022'), doc('os7-tilleuls')], classification: 'judgemental', treatments: ['adjust'], entry: dc('2313', '4041', 210_000) }),
    F({ cycle: 'fixedAssets', objects: [doc('os7-tilleuls')], treatments: ['adjust'], entry: dc('2131', '4084', 210_000) }),
  ],
  'A16.b': [
    F({ cycle: 'fixedAssets', objects: [tp('F0022'), item('contingent-liabilities'), doc('reponse-avocate')], natures: ['completeness', 'presentation'], classification: 'judgemental', treatments: ['disclose'], fix: 'add-missing', evidence: [d('registre-contentieux'), d('reponse-avocate')] }),
    F({ cycle: 'disclosures', objects: [item('contingent-liabilities')], treatments: ['disclose'], fix: 'add-missing', evidence: [d('reponse-avocate')] }),
    F({ cycle: 'provisions', objects: [doc('registre-contentieux')], treatments: ['disclose'], fix: 'add-missing' }),
  ],
  A17: [
    F({ cycle: 'rentReceivables', objects: [acc('70411'), acc('4196'), doc('pv-ca-2024-10')], natures: ['compliance', 'completeness'], treatments: ['adjust', 'governance'], fix: 'governance-irregularity', entry: dc('70411', '4196', 96_600), evidence: [d('quittances-echantillon'), d('memo-irl')] }),
    F({ cycle: 'rentReceivables', objects: [doc('pv-ca-2024-10')], natures: ['compliance'], treatments: ['adjust'], entry: dc('70411', '4196', 98_000), evidence: [d('note-gestion-locative-hausse')] }),
    F({ cycle: 'rentReceivables', objects: [acc('4196')], treatments: ['adjust'], entry: dc('70411', '4196', 96_000) }),
  ],
  A18: [
    F({ cycle: 'debtTreasury', objects: [acc('471'), acc('1631'), tp('BDT')], natures: ['classification', 'completeness'], treatments: ['reclassify'], entry: dc('471', '1631', 2_500_000), evidence: [d('confirmation-bdt'), d('releve-bancaire-2025-12')] }),
    F({ cycle: 'debtTreasury', objects: [acc('471')], natures: ['classification'], treatments: ['reclassify'], entry: dc('471', '1631', 2_500_000), evidence: [d('detail-comptes-attente')] }),
    F({ cycle: 'debtTreasury', objects: [tp('BDT')], treatments: ['reclassify'], entry: dc('471', '1631', 2_500_000) }),
  ],
  A19: [
    F({ cycle: 'rentReceivables', objects: [prog('SAU'), acc('4111'), doc('journal-interface-octobre')], natures: ['occurrence'], treatments: ['adjust', 'internalControl'], fix: 'control-recommendation', entry: dc('70411', '4111', 52_750), evidence: [d('journal-interface-octobre'), d('balance-auxiliaire-logiges'), d('note-migration')] }),
    F({ cycle: 'rentReceivables', objects: [prog('SAU')], natures: ['occurrence'], treatments: ['adjust'], entry: dc('70411', '4111', 50_000), evidence: [d('balance-auxiliaire-logiges')] }),
    F({ cycle: 'rentReceivables', objects: [doc('journal-interface-octobre')], treatments: ['adjust'], entry: dc('70411', '4111', 52_000) }),
  ],
  A20: [
    F({ cycle: 'purchases', objects: [tp('F0027'), acc('6281'), acc('4081')], natures: ['completeness', 'cutoff'], treatments: ['adjust'], entry: dc('6281', '4081', 184_000), evidence: [d('confirmation-gie'), d('convention-gie'), d('factures-2026')] }),
    F({ cycle: 'purchases', objects: [tp('F0027')], natures: ['cutoff'], treatments: ['adjust'], entry: dc('6281', '4081', 180_000), evidence: [conf('F0027')] }),
    F({ cycle: 'purchases', objects: [acc('4081')], treatments: ['adjust'], entry: dc('6281', '4081', 184_000) }),
  ],
  A21: [
    F({ cycle: 'disclosures', objects: [item('provisions-table'), acc('68174'), doc('annexe-2025')], natures: ['presentation'], treatments: ['disclose'], fix: 'correct-amount', evidence: [d('balance-generale-2025')] }),
    F({ cycle: 'provisions', objects: [item('provisions-table')], treatments: ['disclose'], fix: 'reconcile-table', evidence: [d('annexe-2025')] }),
    F({ cycle: 'disclosures', objects: [item('provisions-table')], treatments: ['disclose'], fix: 'correct-amount' }),
  ],
  A22: [
    F({ cycle: 'disclosures', objects: [acc('1651'), doc('comptes-certifies-2024'), doc('etats-financiers-2025')], natures: ['presentation', 'classification'], treatments: ['reclassify'], fix: 'restate-classification', evidence: [d('comptes-certifies-2024')] }),
    F({ cycle: 'debtTreasury', objects: [acc('1651')], natures: ['classification'], treatments: ['disclose'], fix: 'restate-classification', evidence: [d('etats-financiers-2025')] }),
    F({ cycle: 'disclosures', objects: [acc('1651')], treatments: ['reclassify'], fix: 'restate-classification' }),
  ],
};

const input: MatchInput = { params: P, key, documents: docs.documents, falseLeads: docs.falseLeads, state: { samples: initialSamples(), recalcs: initialRecalcs(), savedQueries: [] } };
const accounts = new Set(world.chart.accounts.map((a) => a.number));

function only(f: Finding, extra: Partial<MatchInput> = {}) {
  return matchFindings([f], { ...input, ...extra }).findings[0]!;
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('expert fixture', () => {
  it('covers every part of the key with at least two wordings and a minimal variant, all valid for the form', () => {
    expect(Object.keys(EXPERT).sort()).toEqual([...PART_KEYS].sort());
    for (const [part, list] of Object.entries(EXPERT)) {
      expect(list.length, part).toBeGreaterThanOrEqual(3);
      for (const f of list) expect(draftErrors(f, { params: P, accounts }), `${part} ${f.id}`).toEqual([]);
    }
  });

  for (const [part, list] of Object.entries(EXPERT)) {
    it(`${part}: every wording alone is detected and quantified on the part's basis`, () => {
      list.forEach((f, i) => {
        const m = only(f);
        expect(m.outcome, `${part} wording ${i + 1}`).toBe('matched');
        expect(m.partIds, `${part} wording ${i + 1}`).toEqual([part]);
        expect(m.detected).toBe(true);
        expect(m.quantified, `${part} wording ${i + 1}: ${m.basis} ${m.measure} vs ${m.expected} ${JSON.stringify(m.range)}`).toBe(true);
        expect(m.treatmentOk, `${part} wording ${i + 1}`).toBe(true);
      });
    });
  }

  it('the full findings carry their evidence (clue documents, entries, confirmations)', () => {
    for (const [part, list] of Object.entries(EXPERT)) {
      const f = list[0]!;
      if (f.evidence.length === 0) continue;
      expect(only(f).evidenceOk, part).toBe(true);
    }
    expect(only(EXPERT['A01']![2]!).evidenceOk).toBe(false);
  });

  it('all the full findings at once: one-to-one, each part credited to its own finding', () => {
    const all = Object.entries(EXPERT).map(([part, list]) => ({ part, f: list[0]! }));
    const r = matchFindings(
      all.map((x) => x.f),
      input,
    );
    for (const { part, f } of all) {
      const m = r.findings.find((x) => x.findingId === f.id)!;
      expect(m.partIds, part).toEqual([part]);
    }
    expect(r.parts.every((p) => p.detected && p.quantified)).toBe(true);
    expect(r.findings.some((x) => x.outcome === 'falsePositive' || x.outcome === 'duplicate')).toBe(false);
  });

  it('every wording of every part at once: each part detected, the other wordings neutral duplicates', () => {
    const all = Object.values(EXPERT).flat();
    const r = matchFindings(all, input);
    expect(r.parts.filter((p) => !p.detected).map((p) => p.partId)).toEqual([]);
    expect(r.findings.filter((x) => x.outcome !== 'matched' && x.outcome !== 'duplicate').map((x) => x.findingId)).toEqual([]);
    for (const [part, list] of Object.entries(EXPERT)) for (const f of list) expect(r.findings.find((x) => x.findingId === f.id)!.partIds, `${part} ${f.id}`).toContain(part);
  });
});

describe('aggregation of sibling parts', () => {
  it('the combined A10 finding covers both parts when its amount is their sum', () => {
    const combined = F({ cycle: 'rentReceivables', objects: [prog('MAR'), doc('fiches-poste-gardiens'), acc('4181')], natures: ['valuation', 'compliance'], treatments: ['adjust'], entry: dc('7031', '4181', 254_000), evidence: [d('regularisation-charges-2025')] });
    const m = only(combined);
    expect(m.partIds).toEqual(['A10.a', 'A10.b']);
    expect(m.quantified).toBe(true);
    const r = matchFindings([combined], input);
    expect(r.parts.filter((p) => p.anomalyId === 'A10').every((p) => p.detected && p.quantified)).toBe(true);
  });

  it('the combined A07 (a + b) finding covers both parts; the reclassification stays separate', () => {
    const combined = F({ cycle: 'rentReceivables', objects: [acc('4915'), acc('6541')], classification: 'judgemental', treatments: ['adjust'], entry: [...dc('68174', '4915', 467_250), ...dc('6541', '4111', 238_000), ...dc('4911', '78174', 119_000)], evidence: [d('stats-recouvrement'), d('decisions-surendettement')] });
    expect(only(combined).partIds).toEqual(['A07.a', 'A07.b']);
  });

  it('the combined A07 (a + b) finding at a justified estimate of A07.a (75 % to 90 %) keeps both parts, quantified: the estimate range is carried into the sum', () => {
    for (const share of [0.75, 0.8, 0.9]) {
      const combined = F({ cycle: 'rentReceivables', objects: [acc('4915'), acc('6541')], classification: 'judgemental', treatments: ['adjust'], entry: [...dc('68174', '4915', Math.round(467_250 * share)), ...dc('6541', '4111', 238_000), ...dc('4911', '78174', 119_000)], evidence: [d('stats-recouvrement'), d('decisions-surendettement')] });
      const m = only(combined);
      expect(m.partIds, `${share}`).toEqual(['A07.a', 'A07.b']);
      expect(m.quantified, `${share}`).toBe(true);
    }
    // without an estimate range, the tolerance of the sum is applied once (A10: not the sum of the parts' tolerances)
    const a10 = (euros: number) => only(F({ cycle: 'rentReceivables', objects: [prog('MAR'), doc('fiches-poste-gardiens'), acc('4181')], treatments: ['adjust'], entry: dc('7031', '4181', euros), evidence: [d('regularisation-charges-2025')] }));
    expect(a10(254_000 - 40_000).quantified).toBe(false);
  });

  it('a finding proposing the adjustment and its disclosure (A16.a + A16.b) covers both parts, each credited on its own basis', () => {
    const both = F({ cycle: 'fixedAssets', objects: [prog('TIL'), tp('F0022'), item('contingent-liabilities')], natures: ['completeness'], classification: 'judgemental', treatments: ['adjust', 'disclose'], fix: 'add-missing', entry: dc('2131', '4084', 210_000), evidence: [d('os7-tilleuls'), d('registre-contentieux'), d('reponse-avocate')] });
    expect(draftErrors(both, { params: P, accounts })).toEqual([]);
    const m = only(both);
    expect(m.partIds).toEqual(['A16.a', 'A16.b']);
    const r = matchFindings([both], input);
    expect(r.parts.filter((p) => p.anomalyId === 'A16').map((p) => [p.partId, p.detected, p.quantified, p.treatmentOk])).toEqual([
      ['A16.a', true, true, true],
      ['A16.b', true, true, true],
    ]);
    // without the disclosure treatment, the adjustment alone
    expect(only({ ...both, id: 'X-A16', treatments: ['adjust'], disclosureFix: null }).partIds).toEqual(['A16.a']);
  });

  it('a single finding on the three disclosures of A12 (annex, special report, irregularity) covers the three parts', () => {
    const all3 = F({ cycle: 'crossCycle', objects: [tp('COTEAUX_SEREIN'), item('off-balance-commitments'), doc('composition-ca')], natures: ['compliance', 'completeness'], treatments: ['disclose', 'specialReport', 'governance'], fix: 'add-missing', evidence: [d('convention-soutien-csh')] });
    const m = only(all3);
    expect(m.partIds).toEqual(['A12.i', 'A12.ii', 'A12.iii']);
    const r = matchFindings([all3], input);
    const a12 = r.parts.filter((p) => p.anomalyId === 'A12');
    expect(a12.every((p) => p.detected)).toBe(true);
    expect(a12.map((p) => p.quantified)).toEqual([true, false, false]); // one disclosure fix only
  });

  it('a group partly credited elsewhere: the free part is detected, the amount (a sum) is not credited', () => {
    const a = EXPERT['A10.a']![0]!;
    const combined = F({ cycle: 'rentReceivables', objects: [prog('MAR'), doc('fiches-poste-gardiens')], treatments: ['adjust'], entry: dc('7031', '4181', 254_000) });
    const r = matchFindings([a, combined], input);
    const parts = r.parts.filter((p) => p.anomalyId === 'A10');
    expect(parts.every((p) => p.detected)).toBe(true);
  });
});

describe('collision matrix', () => {
  // each finding is the expert finding of `part`: it must never be credited to a sibling or to a false lead
  const SIBLINGS: [string, string][] = [
    ['A01', 'A16.a'],
    ['A16.a', 'A01'],
    ['A16.a', 'A16.b'],
    ['A16.b', 'A16.a'],
    ['A07.a', 'A07.b'],
    ['A07.a', 'A15'],
    ['A15', 'A07.a'],
    ['A07.b', 'A07.a'],
    ['A07.c', 'A19'],
    ['A10.a', 'A10.b'],
    ['A10.b', 'A10.a'],
    ['A11', 'A15'],
    ['A15', 'A11'],
    ['A12.i', 'A12.ii'],
    ['A12.i', 'A12.iii'],
    ['A12.ii', 'A12.iii'],
    ['A12.iii', 'A12.ii'],
    ['A14.i', 'A14.ii'],
    ['A14.ii', 'A14.iii'],
    ['A14.iii', 'A14.i'],
    ['A08', 'A18'],
    ['A18', 'A08'],
    ['A13', 'A12.i'],
    ['A21', 'A07.a'],
    ['A22', 'A18'],
    ['A19', 'A07.c'],
  ];
  for (const [part, sibling] of SIBLINGS) {
    it(`${part} is not credited to ${sibling}`, () => {
      for (const f of EXPERT[part]!) {
        const m = only(f);
        expect(m.partIds).not.toContain(sibling);
        expect(m.falseLeadId).toBeNull();
      }
    });
  }

  it('A07.a and A15 (amounts within 1 k€ of each other) are told apart by their key objects', () => {
    const r = matchFindings([EXPERT['A15']![2]!, EXPERT['A07.a']![2]!], input);
    expect(r.findings.map((x) => x.partIds)).toEqual([['A15'], ['A07.a']]);
  });

  it('a real anomaly always wins over a false lead (A19 linking the migration note, A11 linking the accrued income schedule)', () => {
    expect(only(EXPERT['A19']![0]!).partIds).toEqual(['A19']);
    expect(only(EXPERT['A11']![0]!).partIds).toEqual(['A11']);
    // the migration note alone, on the duplicated batch of Les Saules
    const f = F({ cycle: 'rentReceivables', objects: [prog('SAU'), doc('note-migration')], treatments: ['adjust'], entry: dc('70411', '4111', 52_750), evidence: [d('rapprochement-reprise-soldes'), d('journal-interface-octobre')] });
    expect(only(f).partIds).toEqual(['A19']);
  });

  it('a false lead finding is not credited to a real part (F2, F4, F6, F7)', () => {
    const f2 = F({ cycle: 'crossCycle', objects: [acc('4487'), doc('reclamation-tfpb')], treatments: ['adjust'], entry: dc('7718', '4487', 120_000) });
    const f4 = F({ cycle: 'fixedAssets', objects: [tp('F0015')], treatments: ['governance'], fix: 'governance-communication', evidence: [d('marche-bati-renov')] });
    const f6 = F({ cycle: 'debtTreasury', objects: [acc('5121')], treatments: ['adjust'], entry: dc('5121', '401', 38_000), evidence: [d('rapprochement-bancaire')] });
    const f7 = F({ cycle: 'rentReceivables', objects: [doc('note-migration')], treatments: ['adjust'], entry: dc('4111', '70411', 40_000), evidence: [d('rapprochement-reprise-soldes')] });
    expect([f2, f4, f6, f7].map((f) => [only(f).partId, only(f).falseLeadId])).toEqual([
      [null, 'F2'],
      [null, 'F4'],
      [null, 'F6'],
      [null, 'F7'],
    ]);
  });

  it('a false lead tied to its natural documents stays a false lead (F6 with the bank statement of December is not A18)', () => {
    const dismissed = (evidence: Evidence[]) => F({ cycle: 'debtTreasury', objects: [acc('5121')], treatments: [], status: 'dismissed', evidence });
    for (const ev of [
      [d('rapprochement-bancaire'), d('releve-bancaire-2025-12')],
      [d('rapprochement-bancaire'), d('releve-bancaire-2025-12'), d('releve-bancaire-2026-01')],
    ]) {
      const r = matchFindings([dismissed(ev)], input);
      expect(r.findings[0]).toMatchObject({ outcome: 'falseLeadDismissed', falseLeadId: 'F6', partIds: [] });
      expect(r.parts.find((p) => p.partId === 'A18')!.dismissedBy).toEqual([]);
    }
    const reported = F({ cycle: 'debtTreasury', objects: [acc('5121')], treatments: ['internalControl'], fix: 'control-recommendation', evidence: [d('rapprochement-bancaire'), d('releve-bancaire-2025-12')] });
    const r = matchFindings([reported], input);
    expect(r.findings[0]).toMatchObject({ outcome: 'falseLeadReported', falseLeadId: 'F6', detected: false });
    expect(r.parts.find((p) => p.partId === 'A18')!.detected).toBe(false);
  });

  it('a part reached only through a linked document gives way to a false lead whose evidence is linked (F7 and the LOGIGES balance); a named object of the part still wins', () => {
    const f7 = (status: FindingStatus, objects: FindingObject[]) => F({ cycle: 'rentReceivables', objects, treatments: status === 'finding' ? ['adjust'] : [], status, evidence: [d('rapprochement-reprise-soldes'), d('balance-auxiliaire-logiges')] });
    expect(only(f7('dismissed', [doc('note-migration')]))).toMatchObject({ outcome: 'falseLeadDismissed', falseLeadId: 'F7' });
    expect(only(f7('finding', [doc('note-migration')]))).toMatchObject({ outcome: 'falseLeadReported', falseLeadId: 'F7', detected: false });
    expect(only(f7('finding', [doc('note-migration'), prog('SAU')]))).toMatchObject({ outcome: 'matched', partIds: ['A19'] });
  });

  it('a generic document (bank statement, fixed-asset table, rent roll, aged balance, prior-year accounts, management report) alone detects nothing', () => {
    const generic = ['releve-bancaire-2025-12', 'releve-bancaire-2025-09', 'tableau-immobilisations', 'quittancement-programmes', 'comptes-certifies-2024', 'rapport-gestion-2024', 'balance-agee-locataires', 'balance-agee-fournisseurs'];
    for (const id of generic) {
      expect(docs.byId.has(id), id).toBe(true);
      for (const cycle of P.cycles.cycles.map((c) => c.id))
        for (const treatment of FINDING_TREATMENTS) {
          const m = only(F({ cycle, objects: [doc(id)], treatments: [treatment], evidence: [d(id)] }));
          expect(m.detected, `${id} ${cycle} ${treatment}: ${m.partIds.join(',')}`).toBe(false);
        }
    }
  });
});

describe('false leads', () => {
  const dismissed: Record<string, Finding> = {
    F1: F({ cycle: 'purchases', objects: [acc('6226')], treatments: [], status: 'dismissed', evidence: [d('contrats-etudes-npnru')] }),
    F2: F({ cycle: 'crossCycle', objects: [acc('4487')], treatments: [], status: 'dismissed', evidence: [d('reclamation-tfpb'), d('avis-degrevement-tfpb')] }),
    F3: F({ cycle: 'purchases', objects: [acc('6411')], treatments: [], status: 'dismissed', evidence: [d('accord-nao-2025')] }),
    F4: F({ cycle: 'purchases', objects: [tp('F0015')], treatments: [], status: 'dismissed', evidence: [d('marche-bati-renov'), d('attestation-absence-lien')] }),
    F5: F({ cycle: 'purchases', objects: [acc('63512')], treatments: [], status: 'dismissed', evidence: [d('tableau-fiscal-tfpb')] }),
    F6: F({ cycle: 'debtTreasury', objects: [acc('5121')], treatments: [], status: 'dismissed', evidence: [d('rapprochement-bancaire'), d('releve-bancaire-2026-01')] }),
    F7: F({ cycle: 'crossCycle', objects: [doc('note-migration')], treatments: [], status: 'dismissed', evidence: [d('rapprochement-reprise-soldes')] }),
  };
  it('« écartée avec preuves »: each false lead dismissed with one of its evidence documents', () => {
    const r = matchFindings(Object.values(dismissed), input);
    for (const [id, f] of Object.entries(dismissed)) {
      expect(r.findings.find((x) => x.findingId === f.id)!.outcome, id).toBe('falseLeadDismissed');
      expect(r.falseLeads.find((x) => x.id === id)!.dismissedWithEvidence, id).toBe(true);
    }
    expect(r.findings.some((x) => x.detected)).toBe(false);
  });

  it('dismissed without its evidence: not « avec preuves »', () => {
    const f = F({ cycle: 'purchases', objects: [acc('63512'), tp('DGFIP')], treatments: [], status: 'dismissed' });
    expect(only(f).outcome).toBe('falseLeadDismissedWithoutEvidence');
  });

  it('« signalée à tort »: a finding above the trivial threshold, or without entry; at or below the threshold it is only noted', () => {
    const big = F({ cycle: 'crossCycle', objects: [acc('4487'), doc('reclamation-tfpb')], treatments: ['adjust'], entry: dc('7718', '4487', 120_000) });
    const accusation = F({ cycle: 'purchases', objects: [tp('F0015')], treatments: ['governance'], fix: 'governance-communication', evidence: [d('marche-bati-renov')] });
    const small = F({ cycle: 'debtTreasury', objects: [acc('5121')], treatments: ['adjust'], entry: dc('5121', '401', 20_000), evidence: [d('rapprochement-bancaire')] });
    const r = matchFindings([big, accusation, small], input);
    expect(r.findings.map((x) => x.outcome)).toEqual(['falseLeadReported', 'falseLeadReported', 'falseLeadTrivial']);
    expect(r.falseLeads.filter((x) => x.reportedWrongly).map((x) => x.id)).toEqual(['F2', 'F4']);
    expect(r.falseLeads.find((x) => x.id === 'F6')!.reportedTrivial).toBe(true);
  });

  it('« clos » is a point settled with nothing to report: never a reported finding (false lead closed with its evidence, unrelated point, real anomaly closed)', () => {
    const f2 = F({ cycle: 'crossCycle', objects: [acc('4487')], treatments: [], status: 'closed', evidence: [d('reclamation-tfpb'), d('avis-degrevement-tfpb')] });
    const unrelated = F({ cycle: 'purchases', objects: [acc('6064')], treatments: [], status: 'closed' });
    const a20 = { ...EXPERT['A20']![0]!, id: 'X-A20', status: 'closed' as const };
    const r = matchFindings([f2, unrelated, a20], input);
    expect(r.findings.map((x) => x.outcome)).toEqual(['falseLeadDismissed', 'none', 'dismissedAnomaly']);
    expect(r.falseLeads.find((x) => x.id === 'F2')).toMatchObject({ dismissedWithEvidence: true, reportedWrongly: false });
    expect(r.parts.find((p) => p.partId === 'A20')).toMatchObject({ detected: false, dismissedBy: ['X-A20'] });
  });

  it('a dismissed finding about a real anomaly is not credited (A18 dismissed as a mere timing difference)', () => {
    const f = { ...EXPERT['A18']![0]!, id: 'X-A18', status: 'dismissed' as const };
    const r = matchFindings([f], input);
    expect(r.findings[0]!.outcome).toBe('dismissedAnomaly');
    expect(r.parts.find((p) => p.partId === 'A18')).toMatchObject({ detected: false, dismissedBy: ['X-A18'] });
    expect(r.falseLeads.some((x) => x.findingIds.includes('X-A18'))).toBe(false);
  });
});

describe('versioned replies', () => {
  it('evidence linked from a later version of a reply (`<id>~date`) counts as the document it updates', () => {
    const versioned = (e: Evidence): Evidence => (e.kind === 'doc' && e.docId === 'factures-peupliers' ? { ...e, docId: 'factures-peupliers~2026-02-23' } : e);
    const strip = ({ findingId: _id, ...m }: ReturnType<typeof only>) => m;
    const base = [EXPERT['A06']![0]!, F({ cycle: 'fixedAssets', treatments: ['adjust'], entry: dc('61521', '2135', 378_000), evidence: [d('factures-peupliers')] })];
    for (const f of base) {
      const v = { ...f, id: `${f.id}-v`, evidence: f.evidence.map(versioned) };
      expect(v.evidence).not.toEqual(f.evidence);
      expect(strip(only(v))).toEqual(strip(only(f)));
    }
    expect(only({ ...base[0]!, evidence: base[0]!.evidence.map(versioned) })).toMatchObject({ outcome: 'matched', partIds: ['A06'], evidenceOk: true });
  });
});

describe('negative cases', () => {
  it('catch-all finding: several programmes and evidence of several anomalies — nothing', () => {
    const f = F({ cycle: 'crossCycle', objects: [prog('TIL'), prog('CLF'), prog('PEU')], natures: ['valuation', 'occurrence'], treatments: ['adjust'], entry: dc('6758', '2131', 1_000_000), evidence: [d('pv-reception-tilleuls'), d('actes-clos-fleuri'), d('factures-peupliers')] });
    expect(only(f).outcome).toBe('falsePositive');
    const g = F({ cycle: 'fixedAssets', objects: [prog('TIL'), prog('ERA'), prog('GLB')], treatments: ['adjust'], entry: dc('68111', '28131', 500_000) });
    expect(only(g).outcome).toBe('falsePositive');
  });

  it('wrong third party: the GIE invoice attributed to another supplier', () => {
    const used = new Set(['F0015', 'F0022', 'F0027', 'F0033']);
    const other = ds.thirdParties.find((t) => t.kind === 'supplier' && !used.has(t.id))!;
    const f = F({ cycle: 'purchases', objects: [tp(other.id)], treatments: ['adjust'], entry: dc('6281', '4081', 184_000), evidence: [d('factures-2026')] });
    expect(only(f).outcome).toBe('falsePositive');
  });

  it('wrong programme: the maintenance capitalised at Les Peupliers attributed to Les Érables; the sale of Le Clos Fleuri to Les Acacias', () => {
    expect(only(F({ cycle: 'fixedAssets', objects: [prog('ERA')], treatments: ['adjust'], entry: dc('61521', '2135', 378_000) })).outcome).toBe('falsePositive');
    expect(only(F({ cycle: 'fixedAssets', objects: [prog('ACA')], treatments: ['adjust'], entry: dc('7752', '462', 770_500) })).outcome).toBe('falsePositive');
  });

  it('wrong cycle, no common object, no key object', () => {
    expect(only(F({ cycle: 'purchases', objects: [prog('CLF')], treatments: ['adjust'], entry: dc('7752', '462', 770_500) })).outcome).toBe('falsePositive');
    expect(only(F({ cycle: 'fixedAssets', treatments: ['adjust'], entry: dc('68111', '28131', 343_000) })).outcome).toBe('falsePositive');
    // A10.a needs the Marronniers (key object): the bare charges regularisation is not enough
    expect(only(F({ cycle: 'rentReceivables', objects: [acc('4181')], treatments: ['adjust'], entry: dc('7031', '4181', 96_000) })).outcome).toBe('falsePositive');
  });

  it('duplicates are neutral and do not fall back on a neighbouring part', () => {
    // the wording linking the detail of the suspense accounts (a key object) holds the part
    const [a, b] = [EXPERT['A18']![1]!, EXPERT['A18']![0]!];
    const r = matchFindings([a, b], input);
    expect(r.findings[1]).toMatchObject({ outcome: 'duplicate', duplicateOf: a.id, detected: false });
    expect(r.parts.find((p) => p.partId === 'A08')!.detected).toBe(false);
    expect(r.parts.find((p) => p.partId === 'A18')!.duplicates).toEqual([b.id]);
  });

  it('questions are not credited; still open after the final, they are pending points', () => {
    const q = { ...EXPERT['A11']![0]!, id: 'Q-A11', status: 'question' as const };
    const during = matchFindings([q], { ...input, date: '2026-03-10' });
    expect(during.findings[0]).toMatchObject({ outcome: 'question', partId: 'A11', detected: false });
    expect(during.pending).toEqual([]);
    expect(during.parts.find((p) => p.partId === 'A11')!.questions).toEqual(['Q-A11']);
    expect(matchFindings([q], { ...input, date: '2026-03-16' }).pending).toEqual(['Q-A11']);
  });
});

describe('quantification', () => {
  it('parts without result impact are credited on their basis: equity (A09), amount reclassified (A01, A07.c, A16.a, A18), disclosure fix', () => {
    const basis = (f: Finding) => only(f).basis;
    expect(basis(EXPERT['A09']![0]!)).toBe('equity');
    expect(basis(EXPERT['A01']![2]!)).toBe('reclassified');
    expect(basis(EXPERT['A07.c']![0]!)).toBe('reclassified');
    expect(basis(EXPERT['A16.a']![0]!)).toBe('reclassified');
    expect(basis(EXPERT['A18']![0]!)).toBe('reclassified');
    expect(basis(EXPERT['A13']![0]!)).toBe('disclosure');
    // wrong amounts or wrong fix: detected, not quantified
    const a09 = only(F({ cycle: 'equitySubsidies', objects: [prog('CHA')], treatments: ['adjust'], entry: dc('1313', '4413', 100_000) }));
    expect([a09.detected, a09.quantified]).toEqual([true, false]);
    const a13 = only(F({ cycle: 'disclosures', objects: [item('retirement-commitments')], treatments: ['disclose'], fix: 'correct-amount' }));
    expect([a13.detected, a13.quantified]).toEqual([true, false]);
    const a18 = only(F({ cycle: 'debtTreasury', objects: [acc('471')], treatments: ['reclassify'], entry: dc('471', '1631', 1_000_000) }));
    expect([a18.detected, a18.quantified]).toEqual([true, false]);
  });

  it('signed amounts: A08 is an understatement (a reversed entry is not quantified)', () => {
    const m = only(EXPERT['A08']![0]!);
    expect(m.expected).toBeLessThan(0);
    expect(m.measure).toBeLessThan(0);
    const reversed = only(F({ cycle: 'debtTreasury', objects: [acc('1688')], treatments: ['adjust'], entry: dc('6611', '1688', 236_000) }));
    expect([reversed.detected, reversed.quantified]).toEqual([true, false]);
  });

  it('extrapolated A08 on a sample of loans: detected, quantified in the wider range of projected misstatements', () => {
    const samples: SamplesState = { items: [{ id: 'S1', executionId: null, population: 'loans', method: 'random', seed: 'x', parameters: {}, items: [], drawnOn: '2026-02-25', exceptions: {} }] };
    const projected = F({ cycle: 'debtTreasury', classification: 'projected', treatments: ['adjust'], entry: dc('1688', '6611', 180_000), evidence: [{ kind: 'sample', id: 'S1' }] });
    const m = only(projected, { state: { samples, recalcs: initialRecalcs(), savedQueries: [] } });
    expect(m).toMatchObject({ partId: 'A08', detected: true, quantified: true, classificationOk: true });
    const factual = only({ ...projected, classification: 'factual' }, { state: { samples, recalcs: initialRecalcs(), savedQueries: [] } });
    expect([factual.detected, factual.quantified]).toEqual([true, false]);
  });

  it('« extrapolée » widens the tolerance only with a linked sample drawn otherwise than on specific items (A20 at 100 k€ for 184 k€)', () => {
    const samples: SamplesState = {
      items: [
        { id: 'S1', executionId: null, population: 'invoices-2026', method: 'random', seed: 'x', parameters: {}, items: [], drawnOn: '2026-02-25', exceptions: {} },
        { id: 'S2', executionId: null, population: 'invoices-2026', method: 'specific', seed: 'x', parameters: {}, items: [], drawnOn: '2026-02-25', exceptions: {} },
      ],
    };
    const state = { samples, recalcs: initialRecalcs(), savedQueries: [] };
    const a20 = (evidence: Evidence[]) => only(F({ cycle: 'purchases', objects: [tp('F0027')], classification: 'projected', treatments: ['adjust'], entry: dc('6281', '4081', 100_000), evidence }), { state });
    expect(a20([])).toMatchObject({ partId: 'A20', detected: true, quantified: false, classificationOk: false });
    expect(a20([{ kind: 'sample', id: 'S2' }])).toMatchObject({ partId: 'A20', quantified: false, classificationOk: false });
    expect(a20([{ kind: 'sample', id: 'S9' }])).toMatchObject({ partId: 'A20', quantified: false, classificationOk: false });
    expect(a20([{ kind: 'sample', id: 'S1' }])).toMatchObject({ partId: 'A20', quantified: true, classificationOk: true });
  });

  it('tolerance: max(± tolerance %, reference clearly-trivial threshold); A07.a widened to its share range', () => {
    const trivial = Math.round(P.regulatory.materiality.reference.trivialEuros * 100);
    expect(acceptedRange(100_000_00, P)).toEqual([100_000_00 - trivial, 100_000_00 + trivial]);
    expect(acceptedRange(2_500_000_00, P)).toEqual([2_375_000_00, 2_625_000_00]);
    expect(acceptedRange(-236_000_00, P)).toEqual([-236_000_00 - trivial, -236_000_00 + trivial]);
    const a = key.corrections.find((c) => c.key === 'A07.a')!.impact.result;
    const [lo] = acceptedRange(a, P, { share: { min: 0.73, max: 1 } });
    expect(lo).toBeLessThanOrEqual(342_000_00);
    expect(accountsMatch('4915', '491')).toBe(true);
    expect(accountsMatch('4915', '4914')).toBe(false);
    expect(accountsMatch('16', '1688')).toBe(false);
  });
});

describe('player catalogue', () => {
  it('every signature, key and false-lead object of a catalogue kind exists in the presented data or the parameters', () => {
    const progIds = new Set(P.programmes.map((p) => p.id));
    const tps = new Set(ds.thirdParties.map((t) => t.id));
    const docIds = new Set(docs.documents.map((x) => x.id));
    const items = new Set(P.disclosureItems.items.map((x) => x.id));
    const subs = new Set(ds.subsidies.map((s) => s.id));
    const check = (o: { kind: string; id: string }, where: string) => {
      const ok = { programme: progIds, thirdParty: tps, account: accounts, document: docIds, disclosureItem: items, subsidy: subs }[o.kind as 'programme'];
      if (ok) expect(ok.has(o.id), `${where}: ${o.kind} ${o.id}`).toBe(true);
    };
    for (const c of key.corrections) for (const o of [...c.part.signature.objects, ...(c.part.keyObjects ?? [])]) check(o, c.key);
    for (const f of docs.falseLeads) for (const o of [...f.signature.objects, ...(f.signature.keyObjects ?? [])]) check(o, f.id);
    for (const c of key.corrections) for (const x of c.part.expectedFixes ?? []) expect(P.disclosureItems.fixes.some((f) => f.id === x), `${c.key} ${x}`).toBe(true);
    for (const c of key.corrections) for (const x of c.part.disclosureItems ?? []) expect(items.has(x), `${c.key} ${x}`).toBe(true);
  });
});

describe('guard: the matching and the correction key stay out of the player screens', () => {
  const SRC = resolve(import.meta.dirname, '../../src');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
    });
  /** Designer-mode files and J6 rules allowed to read the key. */
  const MATCHING_ALLOWED = [/^game\/matching\.ts$/, /^game\/j6\//, /^ui\/screens\/findings\/Designer[A-Za-z]*\.tsx$/];
  const KEY_ALLOWED = [...MATCHING_ALLOWED, /^ui\/app\/(case|dossier)\.ts$/, /^ui\/worker\//, /^ui\/screens\/control\//, /^ui\/screens\/analysis\/(VariationReview\.tsx|model\.ts)$/];
  const rel = (f: string) => relative(SRC, f).split('\\').join('/');
  it('game/matching is imported only by designer-mode files and J6 rules', () => {
    for (const f of files(SRC)) {
      const r = rel(f);
      if (!/from\s+['"][^'"]*game\/matching['"]|from\s+['"]\.\/matching['"]/.test(readFileSync(f, 'utf8'))) continue;
      expect(MATCHING_ALLOWED.some((x) => x.test(r)), r).toBe(true);
    }
  });
  it('the correction key of the case (case.key) is read only by the allowed files', () => {
    for (const f of files(join(SRC, 'ui'))) {
      const r = rel(f);
      const text = readFileSync(f, 'utf8');
      if (!/\.key\.(corrections|presentedFigures|cleanFigures|presented)\b|\bpayload\.key\b|\bkey\s*\}\s*=\s*(c|useFullCase\(\)|useCase\(\))\b/.test(text)) continue;
      expect(KEY_ALLOWED.some((x) => x.test(r)), r).toBe(true);
    }
  });
});
