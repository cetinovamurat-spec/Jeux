/** Realistic noise: documents an auditor meets in the file, with no clue. */
import { DocBuilder, ENTITY_HEADER, date, person, pct, progName, tpName, type DocContext } from '../context';
import { vacancy } from '../../report';
import type { DocumentModel } from '../model';

export function noiseDocuments(c: DocContext): DocumentModel[] {
  const ceo = person(c, 'ceo');
  const rent = person(c, 'rentManager');
  const cfo = person(c, 'cfo');
  const leases25 = c.cd.leases.filter((l) => l.start.startsWith('2025-'));
  const departures25 = c.cd.leases.filter((l) => l.end?.startsWith('2025-') && l.endReason === 'departure');
  const v = vacancy(c.cd, 2025);
  const op = c.params.scenario.operationsInProgress[0]!;
  const n = (id: string, title: string, d: string, issuer: string) => new DocBuilder({ id, title, category: 'permanent', date: d, issuer, noise: true });
  const docs = [
    n('rapport-activite-gestion-locative', 'Rapport d’activité 2025 de la gestion locative', '2026-01-28', `${ENTITY_HEADER(c)} – gestion locative`)
      .fields([['Baux signés en 2025', String(leases25.length)], ['Départs de locataires', String(departures25.length)], ['Taux de vacance commerciale', pct(v.excludingTechnicalRate)]])
      .p('Faits marquants : migration vers LOGIGES 2, mise en location des Tilleuls, poursuite des relogements des Glycines B, déploiement du paiement en ligne.')
      .sign(rent.name, rent.role)
      .build(),
    n('pv-commission-attribution', 'Procès-verbal de la commission d’attribution des logements et d’examen de l’occupation (novembre 2025)', '2025-11-13', ENTITY_HEADER(c))
      .p('La commission a examiné 46 dossiers pour 18 logements disponibles ; 18 attributions prononcées, dont 7 au titre des publics prioritaires. Examen de l’occupation : 3 situations de sous-occupation signalées.')
      .build(),
    n('contrat-assurance-multirisque', 'Contrat d’assurance multirisque immeubles – avenant 2025', '2025-01-02', tpName(c, 'F0026'))
      .p('Garanties : dommages aux biens, responsabilité civile propriétaire d’immeubles, catastrophes naturelles. Franchise par sinistre et plafonds selon les conditions particulières. Prime payable annuellement d’avance.')
      .build(),
    n('contrat-ascenseurs', 'Contrat d’entretien des ascenseurs (contrat étendu)', '2023-04-01', tpName(c, 'F0004'))
      .p('Visites mensuelles, dépannage 24 h/24, remplacement des pièces d’usure, rapport annuel de contrôle technique. Durée de cinq ans, révision annuelle des prix selon les indices de la profession.')
      .build(),
    n('contrat-chaufferies', 'Contrat d’exploitation des chaufferies collectives (P2-P3)', '2022-07-01', tpName(c, 'F0007'))
      .p('Conduite et entretien courant des installations (P2), garantie totale avec renouvellement des matériels (P3). Intéressement sur les consommations. Les Érables sortent du périmètre à compter de la mise en service de la pompe à chaleur.')
      .build(),
    n('bail-commercial-lilas', `Bail commercial – local d’activité, résidence ${progName(c, 'LIL')}`, '2019-03-01', ENTITY_HEADER(c))
      .p('Bail de neuf ans à usage de boulangerie-pâtisserie, loyer révisable annuellement selon l’indice des loyers commerciaux, dépôt de garantie de trois mois de loyer.')
      .build(),
    n('pv-cse-2025', 'Procès-verbal du comité social et économique (décembre 2025)', '2025-12-11', ENTITY_HEADER(c))
      .p('Information-consultation sur les orientations stratégiques, bilan de la migration informatique (charge de travail du service comptable), plan de formation 2026.')
      .build(),
    n('procedure-recouvrement', 'Procédure de recouvrement des impayés locatifs (mise à jour 2025)', '2025-05-15', `${ENTITY_HEADER(c)} – recouvrement`)
      .list(['J+10 : relance amiable et proposition de plan d’apurement', 'J+30 : rendez-vous avec le conseiller social', 'J+60 : saisine de la commission de prévention des expulsions', 'Locataires partis : transmission au prestataire de recouvrement amiable'])
      .sign(rent.name, rent.role)
      .build(),
    n('reglement-achats', 'Règlement intérieur des achats et seuils de mise en concurrence', '2024-01-15', ENTITY_HEADER(c))
      .p('Les marchés sont passés selon les règles de la commande publique applicables à l’organisme. Délégations de signature : directeur général, directrice du patrimoine dans la limite de son budget, directrice administrative et financière pour les achats de fonctionnement.')
      .build(),
    n('cahier-recette-migration', 'Cahier de recette de la migration du progiciel comptable', '2025-09-20', `${ENTITY_HEADER(c)} – direction financière`)
      .p('Scénarios testés : reprise des balances, des auxiliaires et des écritures en cours ; interfaces de quittancement, de paie et de banque ; habilitations. Réserves mineures levées avant la bascule.')
      .sign(cfo.name, cfo.role, '2025-09-20')
      .build(),
    n('attestation-urssaf', 'Attestation de vigilance (URSSAF)', '2025-10-06', 'URSSAF')
      .p('L’entreprise est à jour de ses obligations déclaratives et de paiement à la date de délivrance de l’attestation.')
      .build(),
    n('statistiques-reclamations', 'Statistiques des réclamations des locataires 2025', '2026-01-20', `${ENTITY_HEADER(c)} – relation clientèle`)
      .p('Principaux motifs : troubles de voisinage, interventions techniques (chauffage, ascenseurs), propreté des parties communes, régularisation des charges. Délai moyen de traitement en baisse.')
      .build(),
    n('compte-rendu-chantier', `Compte rendu de la réunion de chantier n° 38 – ${op.name}`, '2025-11-26', person(c, 'projectManager').name)
      .p(`Avancement du gros œuvre conforme au planning ; livraison prévue le ${date(op.delivery)}. Points ouverts : coordination des réseaux, choix des finitions des halls.`)
      .build(),
    n('plan-formation-2026', 'Plan de développement des compétences 2026', '2025-12-11', `${ENTITY_HEADER(c)} – ressources humaines`)
      .p('Priorités : prise en main du nouveau progiciel, recouvrement et accompagnement social, sécurité des gardiens, réglementation de la commande publique.')
      .build(),
    n('note-dg-orientations-2026', 'Note du directeur général – orientations 2026', '2025-12-02', ENTITY_HEADER(c))
      .p('Poursuite du programme de réhabilitation thermique, relance de la production neuve, maîtrise des coûts de gestion, amélioration de la qualité de service.')
      .sign(ceo.name, ceo.role, '2025-12-02')
      .build(),
    n('courrier-mairie-voirie', 'Courrier de la mairie – travaux de voirie rue des Acacias', '2025-06-03', 'Mairie d’Aurelle-sur-Marne')
      .p(`La commune réalisera des travaux de réfection de la voirie aux abords de la résidence ${progName(c, 'ACA')} en septembre ; l’accès des véhicules de secours sera maintenu.`)
      .build(),
  ];
  return docs;
}
