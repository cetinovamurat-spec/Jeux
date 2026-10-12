/** Fixed-asset cycle: A01, A02, A03, A04, A06, A16. */
import { credit as C, debit as D } from '../../../engine/ledger';
import { accumulatedDepreciation } from '../../../engine/subledgers/depreciation';
import type { AssetComponent, EntryLine } from '../../../engine/types';
import { depreciationAccount } from '../closing';
import { acct, comp, doc, prog, tp } from '../refs';
import type { AnomalyModule } from '../types';
import { programmeName, without } from './util';

const TIL_OPERATION = 'OP-TIL-C2025';

export const A01: AnomalyModule = {
  id: 'A01',
  title: 'Programme livré resté en immobilisations en cours',
  cycle: 'fixedAssets',
  assertions: ['classement', 'évaluation (amortissement)', 'rattachement de la quote-part de subventions'],
  classification: 'factual',
  severity: 2,
  difficulty: 2,
  parts: [
    {
      id: 'A01',
      label: 'Les Tilleuls : mise en service par composants au 01/07/2025, amortissement et quote-part de subventions du 2e semestre',
      signature: { cycle: 'fixedAssets', objects: [prog('TIL'), acct('2313'), acct('2312'), doc('pv-reception-tilleuls')], natures: ['classification', 'valuation'] },
      treatment: 'adjust',
    },
  ],
  apply(draft) {
    draft.remove(draft.one((e) => e.pieceRef === `MES-${TIL_OPERATION}`, 'la mise en service des Tilleuls'));
    // the additional works (OS n° 7), when booked, stay in work in progress like the rest of the programme
    const os7 = draft.byPiece('OS7-TIL')[0];
    if (os7) draft.replace(os7, { lines: os7.lines.map((l) => (l.account.startsWith('21') ? { ...l, account: '2313' } : l)) });
    draft.setDataset('components', draft.data.components.filter((c) => c.operationId !== TIL_OPERATION));
    draft.markProgramme('TIL');
  },
  stance: [{ partId: 'A01', stance: 'accepts', character: 'cfo', argument: 'Un oubli lié à la migration : la mise en service n’a pas été saisie dans le nouveau logiciel.' }],
  debrief: {
    explanation:
      'Un programme réceptionné et loué est mis en service à la date de réception : il quitte les immobilisations en cours, est ventilé par composants et amorti à compter de cette date ; les subventions qui le financent sont reprises au même rythme. Laisser le programme en cours surévalue le résultat (pas de dotation) et fausse le tableau des immobilisations.',
    references: ['PCG-COMPOSANTS', 'PCG-SUBVENTIONS', 'ANC-2015-04'],
    goodPractice: 'Rapprocher la liste des programmes quittancés de la liste des programmes en service au registre ; revoir chaque ligne d’immobilisations en cours ancienne ou importante avec la maîtrise d’ouvrage (PV de réception, fiche de situation financière et comptable).',
    procedures: ['Rapprochement programmes quittancés / registre des immobilisations', 'Revue des immobilisations en cours', 'Lecture des PV de réception'],
  },
};

export const A02: AnomalyModule = {
  id: 'A02',
  title: 'Composant remplacé non sorti de l’actif',
  cycle: 'fixedAssets',
  assertions: ['existence', 'évaluation'],
  classification: 'factual',
  severity: 2,
  difficulty: 2,
  parts: [
    {
      id: 'A02',
      label: 'Les Érables : sortie de la chaufferie collective remplacée par la pompe à chaleur au 30/06/2025',
      signature: { cycle: 'fixedAssets', objects: [prog('ERA'), doc('registre-composants'), doc('facture-pac-erables')], natures: ['occurrence', 'valuation'] },
      treatment: 'adjust',
    },
  ],
  apply(draft) {
    const boiler = draft.data.components.find((c) => c.programmeId === 'ERA' && c.id.includes('-CHAUF'));
    if (!boiler) throw new Error('A02 : chaufferie des Érables introuvable');
    draft.remove(draft.one((e) => e.origin === 'gen:ODS' && e.lines.some((l) => l.refs?.includes(`comp:${boiler.id}`)), 'la sortie de la chaufferie des Érables'));
    draft.setDataset('components', draft.data.components.map((c) => (c.id === boiler.id ? without(c, 'disposal') : c)));
    draft.markProgramme('ERA');
  },
  stance: [{ partId: 'A02', stance: 'accepts', character: 'cfo', argument: 'Le remplacement n’a pas été signalé à la comptabilité par la maîtrise d’ouvrage.' }],
  debrief: {
    explanation:
      'Quand un composant est remplacé, le composant remplacé sort de l’actif à la date de remplacement : amortissement jusqu’à cette date, puis sortie de la valeur nette comptable en charges. Le maintenir à l’actif fait coexister deux composants « chauffage » et surévalue l’actif et le résultat.',
    references: ['PCG-COMPOSANTS', 'NEP450'],
    goodPractice: 'Pour chaque remplacement de l’exercice, vérifier la sortie du composant remplacé ; étendre la revue aux autres remplacements de l’année avant de conclure (évaluation des anomalies relevées).',
    procedures: ['Revue du registre des composants (doublons de familles par bâtiment)', 'Lecture des factures de travaux (dépose de l’existant)', 'Extension aux autres remplacements 2025'],
  },
};

export const A03: AnomalyModule = {
  id: 'A03',
  title: 'Vente HLM comptabilisée avant l’acte authentique',
  cycle: 'fixedAssets',
  assertions: ['séparation des exercices', 'réalité des cessions'],
  classification: 'factual',
  severity: 3,
  difficulty: 2,
  individuallySignificant: true,
  parts: [
    {
      id: 'A03',
      label: 'Le Clos Fleuri : annulation en 2025 de la cession des 7 pavillons (actes du 14/01/2026) et information sur l’événement postérieur',
      signature: { cycle: 'fixedAssets', objects: [prog('CLF'), acct('7752'), acct('462'), tp('NOTAIRE_GIRARD'), doc('actes-clos-fleuri')], natures: ['cutoff', 'occurrence'] },
      treatment: 'adjust',
    },
  ],
  apply(draft, ctx) {
    const users = ctx.params.scenario.users;
    const sales = draft.data.sales.filter((s) => s.programmeId === 'CLF' && s.deedDate > '2025-12-31');
    if (sales.length === 0) throw new Error('A03 : ventes du Clos Fleuri introuvables');
    const byId = new Map(draft.data.components.map((c) => [c.id, c]));
    const sold = new Map<string, string>();
    for (const s of sales) {
      const lines: EntryLine[] = [];
      let nbv = 0;
      for (const id of s.componentIds) {
        const c = byId.get(id)!;
        const ref = { refs: [`comp:${c.id}`, 'prog:CLF'] };
        if (c.usefulLifeYears > 0) {
          const acc = accumulatedDepreciation(c, '2025-12-31');
          lines.push(D(depreciationAccount(c.account), acc, ref));
          nbv += c.cost - acc;
        } else nbv += c.cost;
        lines.push(C(c.account, c.cost, ref));
        sold.set(c.id, s.id);
      }
      const notaryAux = draft.data.thirdParties.find((t) => t.id === s.notaryId)?.aux ?? s.notaryId;
      lines.push(D('6752', nbv, { refs: ['prog:CLF'] }), D('462', s.price, { aux: notaryAux, refs: ['prog:CLF'] }), C('7752', s.price, { refs: ['prog:CLF'] }));
      draft.add({
        journal: 'OD',
        date: '2025-12-31',
        label: `Vente HLM – ${programmeName(ctx, 'CLF')} – logement ${s.dwellingIds[0]} – promesse du ${s.promiseDate.slice(8, 10)}/${s.promiseDate.slice(5, 7)}/${s.promiseDate.slice(0, 4)}`,
        lines,
        validDate: ctx.params.anomalies.A03.entryValidDate,
        enteredBy: users.chiefAccountant,
        pieceRef: `PROM-${s.id}`,
        pieceDate: s.promiseDate,
      });
    }
    // the client's register shows the pavilions as sold at 31/12/2025 (the subsidies were not released)
    draft.setDataset(
      'components',
      draft.data.components.map((c): AssetComponent => (sold.has(c.id) ? { ...c, disposal: { date: '2025-12-31', reason: 'sale', saleId: sold.get(c.id)! } } : c)),
    );
  },
  stance: [
    {
      partId: 'A03',
      stance: 'yieldsOnEvidence',
      character: 'cfo',
      argument: 'La vente est parfaite dès l’accord sur la chose et sur le prix (article 1583 du Code civil) : les promesses sont signées le 12 décembre, le produit est acquis à l’exercice.',
      requiredEvidence: ['promesses-clos-fleuri', 'levee-condition-clos-fleuri'],
    },
  ],
  debrief: {
    explanation:
      'Les promesses stipulent que le transfert de propriété et de jouissance intervient à la signature de l’acte authentique, et la condition suspensive d’obtention de prêt n’a été levée que le 05/01/2026. À la clôture, ni le transfert ni la jouissance n’ont eu lieu : la cession relève de 2026 (les loyers de décembre ont d’ailleurs été quittancés). La signature des actes en janvier 2026 est un événement postérieur à mentionner.',
    references: ['CCIV-1583', 'PCG-SEPARATION', 'NEP560', 'NEP450'],
    goodPractice: 'Rapprocher l’état des ventes des actes authentiques et des versements du notaire ; lire les clauses de transfert et les conditions suspensives des promesses ; confirmer auprès du notaire.',
    procedures: ['Rapprochement état des ventes / actes / relevés bancaires', 'Demande de confirmation au notaire', 'Lecture des promesses de vente', 'Revue des événements postérieurs'],
  },
};

export const A04: AnomalyModule = {
  id: 'A04',
  title: 'Démolition décidée sans révision du plan d’amortissement',
  cycle: 'fixedAssets',
  assertions: ['évaluation'],
  classification: 'judgemental',
  severity: 2,
  difficulty: 3,
  parts: [
    {
      id: 'A04',
      label: 'Les Glycines, bâtiment B : révision prospective du plan d’amortissement jusqu’au 31/12/2027 et reprise accélérée des subventions',
      signature: { cycle: 'fixedAssets', objects: [prog('GLB'), doc('pv-ca-2025-06'), doc('avenant-anru-glycines')], natures: ['valuation'] },
      treatment: 'adjust',
    },
  ],
  apply(draft) {
    draft.setDataset('components', draft.data.components.map((c) => (c.programmeId === 'GLB' && c.revisedPlan ? without(c, 'revisedPlan') : c)));
    draft.markProgramme('GLB');
  },
  stance: [
    {
      partId: 'A04',
      stance: 'yieldsOnEvidence',
      character: 'ceo',
      argument: 'Tant que les financements ANRU ne sont pas notifiés, rien n’est certain : on ne va pas accélérer les amortissements sur une hypothèse.',
      requiredEvidence: ['pv-ca-2025-06', 'avenant-anru-glycines', 'deliberation-relogement'],
    },
  ],
  debrief: {
    explanation:
      'La démolition est décidée par le conseil (18/06/2025), contractualisée par l’avenant ANRU (09/10/2025) et engagée (relogements depuis septembre). La durée d’utilisation du bâtiment est raccourcie : le plan d’amortissement est révisé de manière prospective, la valeur nette résiduelle étant amortie jusqu’à la date prévue de démolition ; les subventions sont reprises au même rythme. Une approche par dépréciation, dûment justifiée, est discutée au débrief (point à valider par l’expert).',
    references: ['PCG-COMPOSANTS', 'PCG-SUBVENTIONS', 'NEP540'],
    goodPractice: 'Lire l’intégralité des PV du conseil, y compris les points techniques en fin d’ordre du jour ; rapprocher les décisions patrimoniales (démolitions, ventes, réhabilitations) des plans d’amortissement.',
    procedures: ['Lecture des PV du conseil d’administration', 'Revue de l’état de la vacance (logements neutralisés)', 'Entretien avec la directrice du patrimoine'],
  },
};

export const A06: AnomalyModule = {
  id: 'A06',
  title: 'Dépenses d’entretien immobilisées',
  cycle: 'fixedAssets',
  assertions: ['classement', 'réalité des immobilisations'],
  classification: 'factual',
  severity: 2,
  difficulty: 1,
  parts: [
    {
      id: 'A06',
      label: 'Les Peupliers : reclassement en charges de l’entretien immobilisé (peinture, robinetterie, réparation de toiture) et extourne de l’amortissement',
      signature: { cycle: 'fixedAssets', objects: [prog('PEU'), acct('2135'), doc('factures-peupliers')], natures: ['classification'] },
      treatment: 'adjust',
    },
  ],
  apply(draft, ctx) {
    const a = ctx.params.anomalies.A06;
    const maintenance = draft.data.invoices.filter((i) => i.orderRef?.startsWith('BC2025-PE-') && i.lines.some((l) => l.programmeId === 'PEU' && l.account === '61521'));
    const total = maintenance.reduce((s, i) => s + i.total, 0);
    draft.add({
      journal: 'OD',
      date: a.transferDate,
      label: `${programmeName(ctx, 'PEU')} – travaux d’amélioration 2025 : transfert en immobilisations (mise en service du 01/09/2025)`,
      lines: [D('2135', total, { refs: ['prog:PEU', ...maintenance.map((i) => `inv:${i.id}`)] }), C('61521', total, { refs: ['prog:PEU'] })],
      validDate: a.transferValidDate,
      enteredBy: ctx.params.scenario.users.chiefAccountant,
      pieceRef: 'MES-OP-PEU-A2025',
    });
    const doors = draft.data.components.find((c) => c.operationId === 'OP-PEU-A2025');
    if (!doors) throw new Error('A06 : composant des Peupliers introuvable');
    draft.setDataset('components', draft.data.components.map((c) => (c.id === doors.id ? { ...c, cost: c.cost + total, label: a.componentLabel } : c)));
    draft.markProgramme('PEU');
  },
  stance: [{ partId: 'A06', stance: 'yieldsOnEvidence', character: 'cfo', argument: 'Ce sont des travaux d’amélioration, ils allongent la durée de vie de l’immeuble.', requiredEvidence: ['factures-peupliers'] }],
  debrief: {
    explanation:
      'Peinture des cages d’escalier, remplacement ponctuel de robinetterie et réparation de toiture après infiltrations maintiennent l’immeuble en état : ce sont des charges d’entretien. Seul le remplacement des portes palières constitue un remplacement de composant. Le composant « agencements divers 15 ans » n’existe d’ailleurs pas dans la nomenclature de l’organisme.',
    references: ['PCG-COMPOSANTS', 'ANC-2015-04'],
    goodPractice: 'Tester les acquisitions de l’exercice par un échantillon représentatif (et pas seulement les montants élevés) ; lire les libellés des factures et les bons de commande ; comparer avec la politique d’immobilisation décrite en annexe.',
    procedures: ['Test des acquisitions d’immobilisations (échantillonnage)', 'Lecture des factures et bons de commande', 'Revue de la nomenclature des composants'],
  },
};

export const A16: AnomalyModule = {
  id: 'A16',
  title: 'Litige avec l’entreprise générale des Tilleuls',
  cycle: 'fixedAssets',
  assertions: ['exhaustivité des dettes', 'information en annexe'],
  classification: 'judgemental',
  severity: 1,
  difficulty: 3,
  parts: [
    {
      id: 'A16.a',
      label: 'Travaux supplémentaires dus (ordre de service n° 7) : dette fournisseur d’immobilisations en contrepartie du coût du programme',
      signature: { cycle: 'fixedAssets', objects: [prog('TIL'), tp('F0022'), acct('4084'), doc('os7-tilleuls'), doc('reponse-avocate')], natures: ['completeness'] },
      treatment: 'adjust',
    },
    {
      id: 'A16.b',
      label: 'Pénalités de retard contestées : information en annexe sur le passif éventuel',
      signature: { cycle: 'fixedAssets', objects: [prog('TIL'), tp('F0022'), doc('reponse-avocate'), doc('registre-contentieux')], natures: ['completeness', 'presentation'] },
      treatment: 'disclose',
      disclosureFix: 'Mentionner en annexe le litige avec l’entreprise générale des Tilleuls : pénalités de retard retenues et contestées, issue incertaine (passif éventuel).',
    },
  ],
  apply(draft, ctx) {
    if (ctx.isActive('A16.a')) {
      const os7 = draft.byPiece('OS7-TIL')[0];
      if (os7) draft.remove(os7);
      draft.setDataset('components', draft.data.components.filter((c) => !(c.operationId === TIL_OPERATION && c.id.includes('-OS7'))));
      draft.markProgramme('TIL');
    }
    if (ctx.isActive('A16.b')) draft.annexCells.push({ table: 'engagements', rowId: 'passif-eventuel-tilleuls', column: '*', transform: 'omit' });
  },
  stance: [
    { partId: 'A16.a', stance: 'accepts', character: 'cfo' },
    { partId: 'A16.b', stance: 'accepts', character: 'cfo' },
  ],
  debrief: {
    explanation:
      'Les travaux supplémentaires de l’ordre de service n° 7, signé par le maître d’œuvre et la maîtrise d’ouvrage, sont dus : c’est une dette, dont la contrepartie est le coût du programme (et non une charge) ; l’effet sur le résultat se limite à l’amortissement du semestre. Les pénalités contestées, d’issue incertaine selon l’avocate, relèvent de l’information en annexe.',
    references: ['PCG-PROVISIONS', 'PCG-ANNEXE', 'NEP505'],
    goodPractice: 'Interroger les avocats (demande de confirmation) et rapprocher leur réponse du registre des contentieux ; toute dette n’a pas une contrepartie en charges.',
    procedures: ['Demande de confirmation aux avocats', 'Revue du registre des contentieux', 'Lecture des ordres de service des opérations livrées'],
  },
};
