/** Governance documents: board minutes, general meeting, register of agreements, budget. */
import { DocBuilder, ENTITY_HEADER, date, ofProg, euro0, meuro, person, progName, pts, tpName, type DocContext } from '../context';
import type { DocumentModel } from '../model';
import { netResult } from '../../../engine/balance';

export function governanceDocuments(c: DocContext): DocumentModel[] {
  const docs: DocumentModel[] = [];
  const bm = c.d.boardMeetings;
  const chair = person(c, 'chairman');
  const ceo = person(c, 'ceo');
  const cfo = person(c, 'cfo');
  const asset = person(c, 'assetDirector');
  const rev = c.params.regulatory.rentRevision.byYear['2025']!;
  const glb = c.params.scenario.specific.glycinesB;
  const sister = c.params.scenario.specific.sisterAdvance;

  // --- CA du 15/10/2024 : révision des loyers (A17) --------------------------
  {
    const b = new DocBuilder({ id: 'pv-ca-2024-10', title: `Procès-verbal du conseil d’administration du ${date(bm['2024-10']!)}`, category: 'governance', date: bm['2024-10']!, issuer: ENTITY_HEADER(c), reference: 'CA 2024-04' });
    b.p(`Le conseil d’administration s’est réuni sous la présidence de ${chair.name}. Le quorum est atteint (12 administrateurs présents ou représentés sur 15, dont les trois représentants des locataires).`);
    b.h('Ordre du jour');
    b.list(['Approbation du procès-verbal de la séance précédente', 'Révision des loyers au 1er janvier 2025', 'Point d’avancement des opérations de construction (Les Tilleuls, Les Coteaux du Moulin)', 'Questions diverses']);
    b.h('2. Révision des loyers au 1er janvier 2025');
    const k1 = b.clue('A17', 'governance', `Le conseil vote une hausse uniforme de ${pts(rev.votedByBoardPct ?? 0)} en la présentant comme le « plafond légal », sans dérogation.`);
    b.p(
      `Le directeur général rappelle l’évolution des charges de l’organisme et propose d’appliquer aux loyers des logements conventionnés une hausse uniforme de ${pts(rev.votedByBoardPct ?? 0)} au 1er janvier 2025, « correspondant au plafond légal ». Après échange, le conseil adopte la délibération à la majorité, les représentants des locataires votant contre.`,
      k1,
    );
    b.p('Les loyers des logements non conventionnés, des commerces et des stationnements seront révisés selon les clauses des baux.');
    b.h('3. Point d’avancement des opérations');
    b.p(`La directrice du patrimoine indique que la réception ${ofProg(c, 'TIL')} est attendue fin juin 2025.`);
    b.sign(chair.name, chair.role, bm['2024-10']!);
    docs.push(b.build());
  }

  // --- CA du 27/03/2025 : arrêté des comptes 2024, études NPNRU (F1) --------
  {
    const result24 = netResult(c.b24);
    const b = new DocBuilder({ id: 'pv-ca-2025-03', title: `Procès-verbal du conseil d’administration du ${date(bm['2025-03']!)}`, category: 'governance', date: bm['2025-03']!, issuer: ENTITY_HEADER(c), reference: 'CA 2025-01' });
    b.h('Ordre du jour');
    b.list(['Arrêté des comptes de l’exercice 2024', 'Nomination de la directrice administrative et financière', 'Études préalables du projet de renouvellement urbain des Glycines et actualisation du plan stratégique de patrimoine', 'Questions diverses']);
    b.p(`Le conseil arrête les comptes de l’exercice 2024, qui font apparaître un résultat net de ${meuro(result24)}, et propose son affectation en réserves.`);
    b.p(`Le directeur général présente ${cfo.name}, qui prendra ses fonctions de directrice administrative et financière le ${date(c.params.scenario.users.cfo.from)}, en remplacement de ${person(c, 'cfoBefore').name}, admis à faire valoir ses droits à la retraite.`);
    const f1 = b.clue('F1', 'governance', 'Le conseil autorise les études NPNRU et l’actualisation du plan stratégique de patrimoine : la hausse des honoraires 2025 est décidée et documentée.');
    b.p('Le conseil autorise le lancement des études préalables du projet de renouvellement urbain du quartier des Glycines (études urbaines, sociales et techniques) et l’actualisation du plan stratégique de patrimoine, confiées après consultation à des cabinets spécialisés.', f1);
    b.sign(chair.name, chair.role, bm['2025-03']!);
    docs.push(b.build());
  }

  // --- CA du 18/06/2025 : démolition des Glycines B (A04) -------------------
  {
    const b = new DocBuilder({ id: 'pv-ca-2025-06', title: `Procès-verbal du conseil d’administration du ${date(bm['2025-06']!)} (14 pages)`, category: 'governance', date: bm['2025-06']!, issuer: ENTITY_HEADER(c), reference: 'CA 2025-02' });
    b.h('Ordre du jour');
    b.list([
      '1. Approbation du procès-verbal de la séance du 27 mars 2025',
      '2. Rapport d’activité du premier semestre',
      '3. Attribution des logements : compte rendu de la commission',
      '4. Politique de vente HLM : programme 2025-2026 (Le Clos Fleuri, Les Coquelicots)',
      '5. Marchés de travaux : information sur les attributions',
      '6. Contrôle interne : point sur la migration du système d’information',
      '7. Projet de renouvellement urbain du quartier des Glycines',
      '8. Questions diverses',
    ]);
    b.p('Les points 1 à 6 sont détaillés aux pages 2 à 11 du présent procès-verbal (extraits non reproduits).');
    b.h('7. Projet de renouvellement urbain du quartier des Glycines (pages 12 et 13)');
    const k = b.clue('A04', 'governance', `Point 7 : le conseil décide la démolition du bâtiment B des Glycines (${c.cd.dwellings.filter((d) => d.programmeId === 'GLB').length} logements), prévue au 4e trimestre 2027.`);
    b.p(
      `Au vu des conclusions des études préalables et des échanges avec l’ANRU, le conseil décide, à l’unanimité, la démolition du bâtiment B de la résidence ${progName(c, 'GLB')} (${c.cd.dwellings.filter((d) => d.programmeId === 'GLB').length} logements, majoritairement classés G), dans le cadre du nouveau programme national de renouvellement urbain. Les travaux de démolition sont prévus au quatrième trimestre 2027, après relogement de l’ensemble des locataires. Le conseil autorise le directeur général à signer l’avenant à la convention pluriannuelle avec l’ANRU et à engager le plan de relogement.`,
      k,
    );
    b.h('8. Questions diverses (page 14)');
    b.p('Néant.');
    b.sign(chair.name, chair.role, bm['2025-06']!);
    docs.push(b.build());
  }

  // --- CA du 25/09/2025 : relogements, pas d’autorisation de la convention (A04, A12)
  {
    const b = new DocBuilder({ id: 'pv-ca-2025-09', title: `Procès-verbal du conseil d’administration du ${date(bm['2025-09']!)}`, category: 'governance', date: bm['2025-09']!, issuer: ENTITY_HEADER(c), reference: 'CA 2025-03' });
    const k12 = b.clue('A12', 'governance', `Aucun point de l’ordre du jour n’autorise la convention de soutien conclue le ${date(sister.conventionDate)} avec ${tpName(c, 'COTEAUX_SEREIN')}.`, ['A12.ii']);
    b.h('Ordre du jour', k12);
    b.list(['1. Approbation du procès-verbal de la séance du 18 juin 2025', '2. Plan de relogement des locataires du bâtiment B des Glycines', '3. Budget rectificatif 2025', '4. Information sur la vie du groupe Altaïr', '5. Questions diverses']);
    const k4 = b.clue('A04', 'governance', 'Le conseil approuve le plan de relogement des locataires des Glycines B, engagé depuis septembre 2025.');
    b.p(`2. Le conseil approuve le plan de relogement présenté par la directrice du patrimoine (délibération jointe). Les premiers relogements ont eu lieu dès le ${date(glb.relocationStart)}.`, k4);
    b.p('4. Le président informe le conseil des difficultés financières rencontrées par une société du groupe et de la volonté de l’actionnaire de référence de voir les organismes du groupe se soutenir mutuellement. Aucune délibération n’est soumise au vote sur ce point.');
    b.sign(chair.name, chair.role, bm['2025-09']!);
    docs.push(b.build());
  }

  // --- délibération sur le relogement (A04) --------------------------------
  {
    const b = new DocBuilder({ id: 'deliberation-relogement', title: 'Délibération – plan de relogement des locataires du bâtiment B des Glycines', category: 'governance', date: bm['2025-09']!, issuer: ENTITY_HEADER(c), reference: 'DEL 2025-17' });
    const k = b.clue('A04', 'governance', `Le plan de relogement prévoit le relogement de tous les locataires avant la démolition ; ${glb.relocatedBy2025End} ménages relogés d’ici fin 2025.`);
    b.fields([
      ['Opération', `Démolition du bâtiment B – ${progName(c, 'GLB')} (NPNRU)`],
      ['Décision de démolition', `Conseil d’administration du ${date(glb.boardDecision)}`],
      ['Début des relogements', date(glb.relocationStart)],
      ['Objectif fin 2025', `${glb.relocatedBy2025End} ménages relogés`, k],
      ['Démolition prévue', `au plus tard le ${date(glb.demolitionPlannedEnd)}`],
    ]);
    b.p('Les logements libérés sont neutralisés et ne sont plus proposés à la location. Les frais de relogement (déménagement, double loyer, aides à l’installation) sont pris en charge par l’organisme.');
    b.sign(asset.name, asset.role, bm['2025-09']!);
    docs.push(b.build());
  }

  // --- CA du 16/12/2025 : budget 2026, PPE (A05) ----------------------------
  const official = c.cd.maintenancePlan.filter((it) => it.inOfficialPlan && it.plannedYear >= 2026);
  const aca = official.find((it) => it.programmeId === 'ACA')!;
  const bel = official.find((it) => it.programmeId === 'BEL')!;
  {
    const b = new DocBuilder({ id: 'pv-ca-2025-12', title: `Procès-verbal du conseil d’administration du ${date(bm['2025-12']!)}`, category: 'governance', date: bm['2025-12']!, issuer: ENTITY_HEADER(c), reference: 'CA 2025-04' });
    b.h('Ordre du jour');
    b.list(['1. Approbation du procès-verbal de la séance du 25 septembre 2025', '2. Budget 2026', '3. Plan pluriannuel d’entretien 2026-2030', '4. Questions diverses']);
    const k = b.clue('A05', 'governance', `Le conseil vote le budget 2026 et le PPE 2026-2030, qui maintiennent le ravalement des Acacias en 2026 et l’étanchéité du Belvédère en 2027.`);
    b.p(`2 et 3. La directrice du patrimoine présente le plan pluriannuel d’entretien arrêté le ${date(c.params.anomalies.A05.officialPlanDate)}. Elle souligne que le ravalement des façades ${ofProg(c, 'ACA')} (${euro0(aca.amount)}) sera engagé en 2026 et la réfection de l’étanchéité ${ofProg(c, 'BEL')} (${euro0(bel.amount)}) en 2027, conformément au calendrier prévu. Le conseil adopte le budget 2026 et le plan pluriannuel d’entretien à l’unanimité.`, k);
    b.sign(chair.name, chair.role, bm['2025-12']!);
    docs.push(b.build());
  }
  {
    const y2026 = official.filter((it) => it.plannedYear === 2026);
    const b = new DocBuilder({ id: 'budget-2026', title: 'Budget 2026 – travaux de gros entretien (annexe 3 du budget voté le 16/12/2025)', category: 'governance', date: bm['2025-12']!, issuer: ENTITY_HEADER(c), reference: 'BUD 2026 – annexe 3' });
    const k = b.clue('A05', 'governance', 'Le budget 2026 voté inscrit le ravalement des Acacias parmi les travaux de gros entretien de l’année.');
    b.table(
      ['Programme', 'Nature des travaux', 'Montant inscrit'],
      y2026.map((it) => ({ cells: [progName(c, it.programmeId), it.nature, euro0(it.amount)], ...(it.id === aca.id ? { clue: k } : {}) })),
      { footer: ['Total', '', euro0(y2026.reduce((s, it) => s + it.amount, 0))], align: ['left', 'left', 'right'] },
    );
    b.p(`Pour mémoire, la réfection de l’étanchéité ${ofProg(c, 'BEL')} est programmée en 2027 (plan pluriannuel d’entretien).`);
    b.sign(ceo.name, ceo.role);
    docs.push(b.build());
  }

  // --- AG 2025 (bruit) -------------------------------------------------------
  {
    const b = new DocBuilder({ id: 'pv-ag-2025', title: 'Procès-verbal de l’assemblée générale ordinaire annuelle (exercice 2024)', category: 'governance', date: '2025-06-19', issuer: ENTITY_HEADER(c), noise: true });
    b.p(`L’assemblée générale approuve les comptes de l’exercice 2024 et affecte le résultat de ${meuro(netResult(c.b24))} en réserves. Elle prend acte du rapport du commissaire aux comptes sur les conventions réglementées, qui ne mentionne aucune convention nouvelle.`);
    b.p('Elle constate que le mandat du commissaire aux comptes arrivera à échéance à l’issue de l’assemblée appelée à statuer sur les comptes de l’exercice 2025.');
    b.sign(chair.name, chair.role, '2025-06-19');
    docs.push(b.build());
  }

  // --- registre des conventions (A12) --------------------------------------
  {
    const b = new DocBuilder({ id: 'registre-conventions', title: 'Registre des conventions réglementées et des conventions courantes', category: 'governance', date: '2025-12-31', issuer: ENTITY_HEADER(c), availability: { kind: 'onRequest', request: 'Registre des conventions et liste des conventions conclues en 2025', from: 'cfo' } });
    const k = b.clue('A12', 'governance', `La convention de soutien avec ${tpName(c, 'COTEAUX_SEREIN')} ne figure pas au registre.`, ['A12.ii']);
    b.table(
      ['Convention', 'Cocontractant', 'Date', 'Qualification'],
      [
        ['Convention de groupe – prestations de services et clé de répartition', tpName(c, 'F0027'), '12/01/2021', 'Convention courante (conditions normales)'],
        ['Mise à disposition de personnel (direction juridique)', 'Altaïr Habitat SA', '03/05/2022', 'Convention courante (conditions normales)'],
        { cells: ['— aucune autre convention conclue en 2025 —', '', '', ''], clue: k },
      ],
      { align: ['left', 'left', 'left', 'left'] },
    );
    b.sign(cfo.name, cfo.role);
    docs.push(b.build());
  }
  return docs;
}
