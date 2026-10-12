/** Provisions and receivables valuation: A05, A07, A15. */
import { credit as C, debit as D } from '../../../engine/ledger';
import type { TenantAccount } from '../../datasets';
import { acct, doc, prog, provision, tp } from '../refs';
import type { AnomalyModule } from '../types';
import { without } from './util';

export const A05: AnomalyModule = {
  id: 'A05',
  title: 'Reprise de provision pour gros entretien sans contrepartie de travaux',
  cycle: 'provisions',
  assertions: ['évaluation', 'estimation comptable'],
  classification: 'judgemental',
  severity: 3,
  difficulty: 3,
  individuallySignificant: true,
  parts: [
    {
      id: 'A05',
      label: 'PGE : annulation de la reprise excédentaire (ravalement des Acacias 2026, étanchéité du Belvédère 2027 maintenus au PPE officiel)',
      signature: { cycle: 'provisions', objects: [provision('pge'), acct('1572'), acct('78157'), prog('ACA'), prog('BEL'), doc('ppe-officiel'), doc('ppe-daf')], natures: ['valuation'] },
      treatment: 'adjust',
    },
  ],
  apply(draft, ctx) {
    const a = ctx.params.anomalies.A05;
    const postponed = draft.data.maintenancePlan.filter((it) => (it.programmeId === 'ACA' || it.programmeId === 'BEL') && it.plannedYear >= 2026 && it.inOfficialPlan);
    const extra = postponed.reduce((s, it) => s + it.provision.y2025, 0);
    const reprise = draft.one((e) => e.pieceRef === 'INV2025-PGE' && e.lines.some((l) => l.account === '78157'), 'la reprise de PGE');
    const amount = reprise.lines.find((l) => l.account === '78157')!.credit + extra;
    draft.replace(reprise, { lines: [D('1572', amount), C('78157', amount)], validDate: a.entryValidDate, enteredBy: ctx.params.scenario.users.cfo.id });
    draft.setDataset('pge', draft.data.pge.map((p) => (p.year === 2025 ? { ...p, reprise: p.reprise + extra, closing: p.closing - extra } : p)));
    draft.facts.documents['pge.dafVersion'] = { file: a.dafFile, postponedItemIds: postponed.map((it) => it.id), amount: extra };
  },
  stance: [
    {
      partId: 'A05',
      stance: 'refuses',
      character: 'ceo',
      argument: 'C’est une décision de politique patrimoniale : le plan sera révisé en 2026, ces travaux ne sont plus prioritaires.',
      requiredEvidence: ['ppe-officiel', 'budget-2026', 'pv-ca-2025-12'],
      requiresPartner: true,
    },
  ],
  debrief: {
    explanation:
      'La reprise de la PGE doit correspondre aux dépenses de gros entretien provisionnées et réalisées. Les deux opérations retirées du fichier de la DAF figurent au PPE officiel de la direction du patrimoine et au budget 2026 voté par le conseil : rien ne justifie leur report. L’estimation est biaisée dans le sens de l’objectif de résultat ; non corrigée, l’anomalie dépasse le seuil de signification et appelle une réserve pour désaccord.',
    references: ['NEP540', 'PCG-PROVISIONS', 'ANC-2015-04', 'NEP450', 'NEP700'],
    goodPractice: 'Rapprocher le fichier de calcul de la PGE du PPE officiel et du budget voté ; analyser les variations d’hypothèses d’une année sur l’autre ; rechercher les indices de biais de la direction.',
    procedures: ['Rapprochement calcul de la PGE / PPE officiel / budget 2026', 'Analyse rétrospective de la provision', 'Entretien avec la directrice du patrimoine'],
  },
};

export const A07: AnomalyModule = {
  id: 'A07',
  title: 'Dépréciation des créances locatives insuffisante',
  cycle: 'rentReceivables',
  assertions: ['évaluation', 'présentation'],
  classification: 'judgemental',
  severity: 3,
  difficulty: 2,
  individuallySignificant: true,
  parts: [
    {
      id: 'A07.a',
      label: 'Ex-locataires : taux de dépréciation ramené à 85 % sans fondement (méthode de l’annexe : 100 % du solde net des dépôts)',
      signature: { cycle: 'rentReceivables', objects: [acct('4915'), acct('4115'), doc('calcul-depreciation-creances'), doc('stats-recouvrement')], natures: ['valuation'] },
      treatment: 'adjust',
      tolerance: { minEuros: 342_000, maxEuros: 467_250 },
    },
    {
      id: 'A07.b',
      label: 'Rétablissement personnel avec effacement : passage en perte des créances effacées et reprise de la dépréciation',
      signature: { cycle: 'rentReceivables', objects: [acct('4911'), acct('6541'), doc('decisions-surendettement')], natures: ['valuation'] },
      treatment: 'adjust',
    },
    {
      id: 'A07.c',
      label: 'Soldes créditeurs de locataires compensés avec les soldes débiteurs : reclassement au passif',
      signature: { cycle: 'rentReceivables', objects: [acct('4111'), acct('4191'), doc('balance-agee-locataires')], natures: ['presentation', 'classification'] },
      treatment: 'reclassify',
    },
  ],
  apply(draft, ctx) {
    if (ctx.isActive('A07.a')) {
      draft.impairmentMethod.formerRate = ctx.params.scenario.tenants.presentedMethod.formerRate;
      draft.impairmentDirty = true;
    }
    if (ctx.isActive('A07.b')) {
      draft.remove(draft.one((e) => e.label.startsWith('Effacement de dettes'), 'l’effacement des dettes de rétablissement personnel'));
      draft.setDataset(
        'tenants',
        draft.data.tenants.map((t): TenantAccount => {
          if (t.writeOff?.reason !== 'debtDischarge') return t;
          const y24 = t.byYear.y2024!;
          return { ...without(t, 'writeOff'), byYear: { ...t.byYear, y2025: { balance: y24.balance, category: 'presentOver6m', ageMonths: y24.ageMonths + 12, depositHeld: 0 } } };
        }),
      );
      draft.impairmentDirty = true;
    }
    if (ctx.isActive('A07.c')) draft.remove(draft.one((e) => e.label === 'Reclassement des soldes créditeurs de locataires au passif', 'le reclassement des soldes créditeurs'));
  },
  stance: [
    {
      partId: 'A07.a',
      stance: 'yieldsOnEvidence',
      character: 'cfo',
      argument: 'Nous avons un nouveau prestataire de recouvrement amiable, très performant : 85 % reste prudent.',
      requiredEvidence: ['stats-recouvrement', 'rapport-prestataire-recouvrement', 'annexe-2025'],
    },
    { partId: 'A07.b', stance: 'accepts', character: 'cfo', argument: 'Effectivement, les décisions d’effacement s’imposent.' },
    { partId: 'A07.c', stance: 'accepts', character: 'chiefAccountant' },
  ],
  debrief: {
    explanation:
      'La méthode décrite en annexe, inchangée, prévoit 100 % pour les ex-locataires : le taux de 85 % n’est fondé ni sur l’historique de recouvrement (≈ 4 % par an) ni sur les premiers résultats du prestataire. Un changement d’estimation doit reposer sur des éléments observables. Les dettes effacées par une décision de rétablissement personnel sont des pertes définitives. Les soldes créditeurs de locataires sont des dettes et ne se compensent pas avec les créances.',
    references: ['NEP540', 'PCG-PROVISIONS', 'PCG-ANNEXE'],
    goodPractice: 'Recalculer la dépréciation selon la méthode de l’annexe, la confronter à l’historique de recouvrement, examiner les décisions des commissions de surendettement et la balance âgée (soldes créditeurs).',
    procedures: ['Recalcul de la dépréciation selon la méthode de l’annexe', 'Analyse des statistiques de recouvrement', 'Revue de la balance âgée des locataires'],
  },
};

export const A15: AnomalyModule = {
  id: 'A15',
  title: 'Gestionnaire de foyer en redressement judiciaire (événement postérieur)',
  cycle: 'rentReceivables',
  assertions: ['évaluation'],
  classification: 'judgemental',
  severity: 2,
  difficulty: 2,
  parts: [
    {
      id: 'A15',
      label: 'Accueil Horizons : dépréciation à 80 % des redevances impayées au vu du courrier du mandataire (événement postérieur)',
      signature: { cycle: 'rentReceivables', objects: [tp('ACCUEIL_HORIZONS'), prog('PHA'), acct('4114'), acct('4914'), doc('courrier-mandataire')], natures: ['valuation'] },
      treatment: 'adjust',
      disclosureFix: 'Information en annexe sur l’ouverture du redressement judiciaire du gestionnaire et sur la créance déclarée.',
    },
  ],
  apply(draft) {
    draft.impairmentMethod.managerRate = 0;
    draft.impairmentDirty = true;
  },
  stance: [
    {
      partId: 'A15',
      stance: 'yieldsOnEvidence',
      character: 'cfo',
      argument: 'Ils ont toujours fini par payer, c’est un partenaire historique.',
      requiredEvidence: ['courrier-mandataire'],
    },
  ],
  debrief: {
    explanation:
      'Le jugement d’ouverture (24/02/2026) et le courrier du mandataire (perspective de recouvrement d’environ 20 %) apportent des informations sur une situation qui existait à la clôture (neuf mois d’impayés) : c’est un événement postérieur qui conduit à ajuster les comptes. Il faut aussi déclarer la créance dans les délais et informer en annexe.',
    references: ['NEP560', 'PCG-PROVISIONS', 'NEP505'],
    goodPractice: 'Suivre les événements postérieurs jusqu’à la date du rapport (courrier arrivé, presse, réponses aux confirmations) ; relancer les tiers qui ne répondent pas.',
    procedures: ['Revue des événements postérieurs à la clôture', 'Balance âgée des redevances des foyers', 'Relance des demandes de confirmation sans réponse'],
  },
};
