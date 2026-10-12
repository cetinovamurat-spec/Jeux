/** Permanent file: by-laws, governance bodies, regulator report, prior-year accounts, audit memos. */
import { vacancy } from '../../report';
import { DocBuilder, ENTITY_HEADER, creditOf, date, euro0, fromEuros, meuro, person, pts, pct, tpName, type DocContext } from '../context';
import type { DocumentModel } from '../model';

export function permanentDocuments(c: DocContext): DocumentModel[] {
  const docs: DocumentModel[] = [];
  const e = c.params.scenario.entity;
  const chair = person(c, 'chairman');
  const ceo = person(c, 'ceo');
  const cfo = person(c, 'cfo');
  const auditFirm = 'Sequana Audit';
  const partner = 'Claire Delmas';

  // --- noise: by-laws, Kbis, organisation chart, CUS, engagement letter, independence
  docs.push(
    new DocBuilder({ id: 'statuts-extraits', title: 'Statuts (extraits)', category: 'permanent', date: '2021-06-17', issuer: ENTITY_HEADER(c), noise: true })
      .fields([
        ['Dénomination', e.name],
        ['Forme', e.legalForm],
        ['Siège', e.registeredOffice],
        ['Capital social', euro0(fromEuros(e.capitalEuros))],
        ['Actionnaire de référence', e.referenceShareholder],
      ])
      .p('Article 3 – Objet : la société a pour objet, dans les conditions fixées par le code de la construction et de l’habitation, de réaliser, gérer et entretenir des logements locatifs sociaux et d’accompagner les politiques locales de l’habitat.')
      .p('Article 15 – Le conseil d’administration comprend notamment des représentants des locataires élus.')
      .build(),
    new DocBuilder({ id: 'kbis', title: 'Extrait d’immatriculation au registre du commerce et des sociétés', category: 'permanent', date: '2025-10-02', issuer: 'Greffe du tribunal de commerce d’Aurelle-sur-Marne', noise: true })
      .fields([
        ['Dénomination', e.name],
        ['Forme juridique', e.legalForm],
        ['Capital', euro0(fromEuros(e.capitalEuros))],
        ['Président du conseil d’administration', chair.name],
        ['Directeur général', ceo.name],
        ['Commissaire aux comptes titulaire', auditFirm],
      ])
      .build(),
    new DocBuilder({ id: 'organigramme', title: 'Organigramme de direction au 1er octobre 2025', category: 'permanent', date: '2025-10-01', issuer: ENTITY_HEADER(c), noise: true })
      .list([
        `${ceo.role} : ${ceo.name}`,
        `${cfo.role} : ${cfo.name} (depuis le ${date(c.params.scenario.users.cfo.from)})`,
        `${person(c, 'chiefAccountant').role} : ${person(c, 'chiefAccountant').name} – équipe comptable de quatre personnes (un poste vacant)`,
        `${person(c, 'assetDirector').role} : ${person(c, 'assetDirector').name}`,
        `${person(c, 'rentManager').role} : ${person(c, 'rentManager').name}`,
      ])
      .note('Migration du progiciel comptable et de l’interface de gestion locative (LOGIGES 2) le 1er octobre 2025.')
      .build(),
    new DocBuilder({ id: 'cus-extraits', title: 'Convention d’utilité sociale 2021-2026 (extraits)', category: 'permanent', date: '2021-07-01', issuer: ENTITY_HEADER(c), noise: true })
      .p('Engagements : production de logements neufs, réhabilitation thermique du parc classé F et G, maîtrise des loyers et des charges, accompagnement des ménages en difficulté.')
      .p('Indicateurs : taux de rotation, délai de relocation, part des attributions aux ménages prioritaires, coût de gestion au logement.')
      .build(),
    new DocBuilder({ id: 'lettre-mission', title: 'Lettre de mission du commissaire aux comptes – exercice 2025', category: 'permanent', date: '2025-07-04', issuer: auditFirm, recipient: `${ceo.name}, ${ceo.role}`, noise: true })
      .p('Nous vous confirmons les termes de notre mission de certification des comptes annuels de l’exercice clos le 31 décembre 2025 : nature et étendue des travaux, calendrier (intérim en novembre 2025, final en février-mars 2026), équipe, honoraires et responsabilités respectives.')
      .sign(partner, 'Associée signataire', '2025-07-04')
      .build(),
    new DocBuilder({ id: 'declarations-independance', title: 'Déclarations d’indépendance de l’équipe d’audit', category: 'permanent', date: '2025-11-03', issuer: auditFirm, noise: true })
      .p('Chaque membre de l’équipe déclare n’avoir aucun lien personnel, financier ou professionnel avec l’entité, ses dirigeants ou les sociétés du groupe Altaïr, de nature à compromettre son indépendance.')
      .build(),
  );

  // --- composition des conseils (A12) -------------------------------------
  {
    const b = new DocBuilder({ id: 'composition-ca', title: 'Composition des conseils d’administration – Val d’Aurelle Habitat et Coteaux du Serein Habitat', category: 'permanent', date: '2025-07-01', issuer: ENTITY_HEADER(c), availability: { kind: 'onRequest', request: 'Composition des conseils des sociétés du groupe', from: 'cfo' } });
    const k = b.clue('A12', 'governance', `${chair.name}, président du conseil, est aussi administrateur de ${tpName(c, 'COTEAUX_SEREIN')} : la convention de soutien relève des conventions réglementées.`, ['A12.ii']);
    b.table(['Administrateur', e.name, tpName(c, 'COTEAUX_SEREIN')], [
      { cells: [chair.name, 'Président', 'Administrateur'], clue: k },
      ['Altaïr Habitat SA (représentée par Mme Hélène Roy)', 'Administrateur', 'Administrateur'],
      ['Communauté d’agglomération du Val d’Aurelle', 'Administrateur', '—'],
      ['Département', 'Administrateur', '—'],
      ['Représentants des locataires (3)', 'Administrateurs', '—'],
    ], { align: ['left', 'left', 'left'] });
    docs.push(b.build());
  }

  // --- plan stratégique de patrimoine (F1) ---------------------------------
  {
    const b = new DocBuilder({ id: 'psp-extraits', title: 'Plan stratégique de patrimoine 2019-2028 (extraits) et cahier des charges de l’actualisation 2025', category: 'permanent', date: '2025-04-10', issuer: ENTITY_HEADER(c) });
    const k = b.clue('F1', 'governance', 'L’actualisation du plan stratégique de patrimoine a été lancée en 2025 avec un cahier des charges et une consultation.');
    b.p('Le plan stratégique de patrimoine classe les programmes selon leur attractivité et leur état technique et fixe les orientations : réhabilitation, vente, démolition-reconstruction. Son actualisation, prévue tous les six ans, a été engagée en 2025 (consultation de trois cabinets, cahier des charges joint).', k);
    docs.push(b.build());
  }

  // --- rapport ANCOLS 2022 (A10, contexte A07 et A09) -----------------------
  {
    const b = new DocBuilder({ id: 'rapport-ancols-2022', title: 'Rapport de contrôle de l’ANCOLS (2022) – extraits', category: 'permanent', date: '2022-11-28', issuer: 'Agence nationale de contrôle du logement social' });
    b.h('Recommandations');
    const k = b.clue('A10', 'regulatory', 'L’ANCOLS recommandait déjà de limiter les charges récupérées à la liste réglementaire, notamment pour la rémunération des gardiens.');
    b.list([
      'Renforcer le recouvrement des créances des locataires partis et fiabiliser leur dépréciation.',
      { text: 'Fiabiliser la régularisation des charges récupérables : n’y intégrer que les charges limitativement énumérées par la réglementation et appliquer aux gardiens la quote-part récupérable correspondant à leurs tâches.', clue: k },
      'Assurer un suivi rigoureux des subventions à recevoir et de leurs conditions de versement (délais de commencement des travaux).',
    ]);
    docs.push(b.build());
  }

  // --- comptes certifiés 2024 (A22) ----------------------------------------
  {
    const deposits24 = creditOf(c.b24, ['1651']);
    const b = new DocBuilder({ id: 'comptes-certifies-2024', title: 'Comptes annuels 2024 certifiés (bilan – passif, extrait)', category: 'permanent', date: c.d.boardMeetings['2025-03']!, issuer: ENTITY_HEADER(c) });
    const k = b.clue('A22', 'accounting', `Dans les comptes certifiés 2024, les dépôts de garantie (${euro0(deposits24)}) figurent dans les dettes financières.`);
    const prior = (id: string) => euro0(c.cs.lines[id]!.prior);
    b.table(['Passif', '31/12/2024'], [
      ['Capitaux propres', prior('P_CP')],
      ['Provisions', prior('P_PROV')],
      ['Dettes financières', prior('P_DETTES_FIN')],
      { cells: ['dont dépôts et cautionnements reçus (dépôts de garantie des locataires)', prior('P_DEPOTS')], clue: k },
      ['Dettes fournisseurs et comptes rattachés', prior('P_FOURNISSEURS')],
      ['Autres dettes', prior('P_AUTRES_DETTES')],
      ['Total du passif', prior('PASSIF_TOTAL')],
    ]);
    docs.push(b.build());
  }
  docs.push(
    new DocBuilder({ id: 'rapport-cac-2024', title: 'Rapport du commissaire aux comptes sur les comptes annuels 2024', category: 'permanent', date: '2025-05-12', issuer: auditFirm, noise: true })
      .p('Opinion : nous certifions que les comptes annuels sont, au regard des règles et principes comptables français, réguliers et sincères et donnent une image fidèle du résultat des opérations de l’exercice écoulé ainsi que de la situation financière et du patrimoine de la société à la fin de cet exercice.')
      .p('Justification des appréciations : provision pour gros entretien, dépréciation des créances locatives, approche par composants.')
      .sign(partner, 'Associée signataire', '2025-05-12')
      .build(),
  );

  // --- annexe 2024 (A07, A13) ------------------------------------------------
  {
    const ifc24 = fromEuros(c.params.scenario.commitments.retirementEuros['2024']!);
    const m = c.params.scenario.tenants.cleanMethod;
    const b = new DocBuilder({ id: 'annexe-2024', title: 'Annexe des comptes 2024 (extraits)', category: 'permanent', date: c.d.boardMeetings['2025-03']!, issuer: ENTITY_HEADER(c) });
    b.h('Règles et méthodes – créances locatives');
    const k7 = b.clue('A07', 'accounting', 'La méthode de dépréciation décrite en annexe 2024 prévoit 100 % pour les ex-locataires.', ['A07.a']);
    b.p(`Les créances sur les locataires partis sont dépréciées à ${pct(m.formerRate, 0)} de leur montant net des dépôts de garantie conservés ; celles des locataires présents à ${pct(m.over6mRate, 0)} au-delà de six mois d’ancienneté ; les dossiers en procédure et en surendettement à ${pct(m.procedureRate, 0)}.`, k7);
    b.h('Engagements hors bilan');
    const k13 = b.clue('A13', 'accounting', `L’annexe 2024 mentionne les indemnités de fin de carrière non provisionnées (${meuro(ifc24)}).`);
    b.fields([['Engagements de retraite (indemnités de fin de carrière, non provisionnés)', euro0(ifc24), k13]]);
    docs.push(b.build());
  }

  // --- rapport de gestion 2024 (A14-ii) -------------------------------------
  {
    const v24 = vacancy(c.cd, 2024);
    const b = new DocBuilder({ id: 'rapport-gestion-2024', title: 'Rapport de gestion 2024 (extraits)', category: 'permanent', date: c.d.boardMeetings['2025-03']!, issuer: ENTITY_HEADER(c) });
    const k = b.clue('A14', 'management', `En 2024, le taux de vacance (${pct(v24.totalRate)}) portait sur l’ensemble des logements vacants, vacance technique comprise.`, ['A14.ii']);
    b.fields([
      ['Taux de vacance au 31/12/2024 (ensemble des logements vacants, y compris vacance technique)', pct(v24.totalRate), k],
      ['Ratio d’autofinancement net HLM 2024', pct(c.f24.netSelfFinancingRatio)],
    ]);
    docs.push(b.build());
  }

  // --- mémos réglementaires du cabinet (A10, A17) -------------------------
  {
    const irl = c.params.regulatory.irl;
    const q2 = irl.values.find((v) => v.quarter === '2024-T2')!;
    const b = new DocBuilder({ id: 'memo-irl', title: 'Mémo technique – révision des loyers des logements conventionnés', category: 'permanent', date: '2025-09-15', issuer: `${auditFirm} – département technique` });
    const k = b.clue('A17', 'regulatory', `La hausse 2025 est plafonnée à la variation annuelle de l’IRL du 2e trimestre 2024 (${pts(q2.annualChangePct)}) ; le plafonnement à ${pts(irl.capPct, 1)} a pris fin.`);
    b.p(`La révision annuelle des loyers des logements conventionnés ne peut excéder la variation annuelle de l’indice de référence des loyers (IRL) du deuxième trimestre de l’année précédente, soit ${pts(q2.annualChangePct)} pour 2025. Le plafonnement de la variation de l’IRL à ${pts(irl.capPct, 1)}, applicable ${irl.capPeriod}, a pris fin. Les dérogations sont limitées (plan de redressement, travaux ouvrant droit à un dépassement).`, k);
    b.note('Références à confirmer par le département technique (point à vérifier).');
    docs.push(b.build());
  }
  {
    const rs = c.params.regulatory.recoverableShares;
    const b = new DocBuilder({ id: 'memo-charges-recuperables', title: 'Mémo technique – charges récupérables dans les logements HLM', category: 'permanent', date: '2025-09-15', issuer: `${auditFirm} – département technique` });
    const k = b.clue('A10', 'regulatory', `Ni les honoraires de syndic ni la totalité de la rémunération des gardiens ne sont récupérables (quote-part de ${pct(rs.caretakerBothTasks, 0)} lorsque le gardien assure l’entretien et l’élimination des rejets).`);
    b.p(`Les charges récupérables sont limitativement énumérées par la réglementation (décret n° 82-955 modifié pour les logements HLM). Les honoraires de gestion d’un syndic de copropriété n’y figurent pas. La rémunération d’un gardien est récupérable à hauteur de ${pct(rs.caretakerBothTasks, 0)} lorsqu’il assure à la fois l’entretien des parties communes et l’élimination des rejets, et de ${pct(rs.caretakerOneTask, 0)} lorsqu’il n’assure que l’une de ces tâches.`, k);
    b.note('Quotes-parts à confirmer par le département technique (point à vérifier).');
    docs.push(b.build());
  }
  return docs;
}
