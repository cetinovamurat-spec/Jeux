/** Mail, internal exchanges and third-party replies (confirmations, bank statements). */
import { addBusinessDays } from '../../../engine/dates';
import { accruedInterest, outstandingAt } from '../../../engine/subledgers/loans';
import type { LoanScheduleLine } from '../../../engine/types';
import { managerReceivable } from '../../impairment';
import { anomalyImpact } from '../../anomalies/presented';
import { DocBuilder, ENTITY_HEADER, date, ofProg, euro, euro0, fromEuros, keuro, meuro, person, progName, pts, tpName, type DocContext } from '../context';
import type { DocumentModel } from '../model';

export function correspondenceDocuments(c: DocContext): DocumentModel[] {
  const docs: DocumentModel[] = [];
  const sp = c.params.scenario.specific;
  const cfo = person(c, 'cfo');
  const chief = person(c, 'chiefAccountant');
  const cal = c.d.calendar;
  const sent = cal['confirmationsSent']!;
  const reply = (days: number) => addBusinessDays(sent, days);
  const auditor = c.params.game.firmName;

  // ============================== courrier ==============================
  {
    const ch = sp.charmes;
    const b = new DocBuilder({ id: 'courrier-caducite-charmes', title: 'Courrier du Département – caducité de la subvention des Charmes', category: 'mail', date: ch.lapseNoticeDate, issuer: 'Département – direction de l’habitat', recipient: `${person(c, 'ceo').name}, ${person(c, 'ceo').role}`, availability: { kind: 'onRequest', request: 'Registre du courrier arrivé et correspondance des financeurs', from: 'chiefAccountant' } });
    const k = b.clue('A09', 'thirdParty', `Le Département notifie le ${date(ch.lapseNoticeDate)} la caducité de la subvention des Charmes ; le courrier est classé sans suite.`);
    b.p(`Par arrêté du ${date(ch.decisionDate)}, le Département vous a attribué une subvention de ${euro0(fromEuros(ch.subsidyEuros))} pour la réhabilitation thermique ${ofProg(c, 'CHA')}. Les travaux n’ayant pas commencé dans le délai de ${ch.lapseYears} ans prévu par l’article 5 de cet arrêté, et votre demande de prorogation du ${date(ch.prorogationRequest)} n’ayant pas été accordée, je vous informe que cette subvention est caduque. Aucun versement ne pourra intervenir.`, k);
    b.sign(person(c, 'departmentOfficer').name, person(c, 'departmentOfficer').role, ch.lapseNoticeDate);
    b.stamp('Reçu le – classé sans suite', addBusinessDays(ch.lapseNoticeDate, 1), k);
    docs.push(b.build());
  }
  {
    const a = c.d.A15;
    const ah = managerReceivable(c.params, 'ACCUEIL_HORIZONS', '2025-12-31');
    const b = new DocBuilder({ id: 'courrier-mandataire', title: `Courrier du mandataire judiciaire – ${tpName(c, 'ACCUEIL_HORIZONS')}`, category: 'mail', date: a.letterDate, issuer: person(c, 'receiver').name, recipient: c.params.scenario.entity.name, availability: { kind: 'afterDate', from: a.letterDate } });
    const k = b.clue('A15', 'thirdParty', `Le mandataire annonce une perspective de recouvrement d’environ ${a.expectedRecoveryPct} % pour les créanciers chirographaires (redressement judiciaire ouvert le ${date(a.judgmentDate)}).`);
    b.p(`Par jugement du ${date(a.judgmentDate)}, le tribunal judiciaire a ouvert une procédure de redressement judiciaire à l’égard de l’${tpName(c, 'ACCUEIL_HORIZONS')}. Je vous invite à déclarer votre créance (redevances impayées : ${euro0(ah)} selon nos premiers éléments) dans le délai légal.`);
    b.p(`À ce stade, le passif déclaré s’élève à environ ${meuro(fromEuros(a.declaredLiabilitiesEuros))} pour un actif réalisable estimé à ${meuro(fromEuros(a.realisableAssetsEuros))}, soit une perspective de recouvrement de l’ordre de ${a.expectedRecoveryPct} % pour les créanciers chirographaires.`, k);
    b.sign(person(c, 'receiver').name, person(c, 'receiver').role, a.letterDate);
    b.stamp('Reçu le', addBusinessDays(a.letterDate, 1));
    docs.push(b.build());
    const pr = new DocBuilder({ id: 'article-presse-accueil-horizons', title: 'L’Écho du Val – « Le FJT Le Phare dans la tourmente »', category: 'mail', date: a.pressDate, issuer: 'L’Écho du Val (presse locale)', availability: { kind: 'afterDate', from: a.pressDate } });
    const k2 = pr.clue('A15', 'press', `La presse locale annonce le placement en redressement judiciaire de l’${tpName(c, 'ACCUEIL_HORIZONS')}, en difficulté depuis le printemps 2025.`);
    pr.p(`L’${tpName(c, 'ACCUEIL_HORIZONS')}, qui gère le foyer de jeunes travailleurs Le Phare, a été placée en redressement judiciaire le ${date(a.judgmentDate)}. Selon nos informations, elle ne réglait plus ses loyers à son bailleur depuis le printemps dernier.`, k2);
    docs.push(pr.build());
  }
  {
    const b = new DocBuilder({ id: 'courrier-association-locataires', title: 'Courrier de l’association des locataires – contestation de la régularisation des charges 2024', category: 'mail', date: '2025-07-08', issuer: person(c, 'tenantAssociation').name, recipient: `${person(c, 'ceo').name}, ${person(c, 'ceo').role}`, availability: { kind: 'onRequest', request: 'Réclamations des locataires sur les charges', from: 'rentManager' } });
    const k = b.clue('A10', 'thirdParty', 'L’association des locataires conteste la récupération des honoraires de syndic et de la totalité du salaire des gardiens.');
    b.p('Nous contestons la régularisation des charges 2024 : les honoraires du syndic des Marronniers ne sont pas des charges récupérables, et la totalité du salaire des gardiens ne peut pas être récupérée. Nous vous demandons de rectifier les décomptes et, à défaut, nous saisirons la commission départementale de conciliation.', k);
    b.sign(person(c, 'tenantAssociation').name, person(c, 'tenantAssociation').role, '2025-07-08');
    b.stamp('Reçu le', '2025-07-10');
    docs.push(b.build());
  }
  {
    const b = new DocBuilder({ id: 'invitation-inauguration-tilleuls', title: `Invitation – inauguration de la résidence ${progName(c, 'TIL')}`, category: 'mail', date: '2025-08-28', issuer: ENTITY_HEADER(c) });
    const k = b.clue('A01', 'press', `Les Tilleuls sont inaugurés le ${date(c.d.A01.inaugurationDate)}, les locataires étant installés depuis l’été.`);
    b.p(`${person(c, 'chairman').name}, président, et ${person(c, 'ceo').name}, directeur général, ont le plaisir de vous convier à l’inauguration de la résidence ${progName(c, 'TIL')} (52 logements), le ${date(c.d.A01.inaugurationDate)}, en présence des locataires installés depuis l’été.`, k);
    docs.push(b.build());
  }
  {
    const rc = c.params.scenario.taxes.reliefClaim2025;
    const claimed = fromEuros(c.params.scenario.taxes.reliefEuros['2025']!);
    const b = new DocBuilder({ id: 'avis-degrevement-tfpb', title: 'Avis de dégrèvement de taxe foncière sur les propriétés bâties', category: 'mail', date: rc.notifiedDate, issuer: 'Direction départementale des finances publiques', recipient: c.params.scenario.entity.name, availability: { kind: 'afterDate', from: rc.notifiedDate } });
    const k = b.clue('F2', 'thirdParty', `Le dégrèvement est accordé à ${Math.round(rc.acceptedShare * 100)} % du montant demandé : l’écart avec le produit à recevoir est négligeable.`);
    b.fields([['Réclamation du', date(rc.claimDate)], ['Montant demandé', euro0(claimed)], ['Montant dégrevé', euro0(Math.round(claimed * rc.acceptedShare)), k]]);
    docs.push(b.build());
  }

  // ============================== internes ==============================
  {
    const b = new DocBuilder({ id: 'mail-daf-2026-01-28', title: 'Courriel de la DAF au chef comptable – provision pour gros entretien', category: 'internal', date: c.d.A05.cfoMailDate, issuer: cfo.name, recipient: chief.name, availability: { kind: 'conditional', condition: 'chiefAccountantConfides' } });
    const k = b.clue('A05', 'internal', 'La DAF demande au chef comptable de « voir ce qui peut être décalé sur la PGE » pour atteindre l’objectif de résultat.');
    b.p('Karim, on est loin de l’objectif. Vois ce qui peut être décalé sur la PGE, les opérations 2026-2027 notamment. Merci de me faire un point demain. Nathalie', k);
    docs.push(b.build());
  }
  {
    const before = c.key.presentedFigures.figures.netResult - anomalyImpact(c.key, 'A11').result;
    const a11 = c.params.anomalies.A11;
    const b = new DocBuilder({ id: 'mail-daf-2026-01-30', title: 'Courriel de la DAF au chef comptable – produit à recevoir sur les foyers', category: 'internal', date: c.d.A11.cfoMailDate, issuer: cfo.name, recipient: chief.name, availability: { kind: 'conditional', condition: 'chiefAccountantConfides' } });
    const k = b.clue('A11', 'internal', 'La DAF demande de passer un produit à recevoir sur les foyers pour « sécuriser » l’objectif de résultat, le justificatif devant suivre.');
    b.p(`Karim, on est à ${meuro(before, 1)}, il faut sécuriser les ${meuro(fromEuros(c.d.ceoBonusResultTargetEuros), 0)} : passe une PAR de ${keuro(fromEuros(a11.euros), 0)} sur les foyers, je fournirai le justificatif. Nathalie`, k);
    docs.push(b.build());
  }
  {
    const rev = c.params.regulatory.rentRevision.byYear['2025']!;
    const b = new DocBuilder({ id: 'note-gestion-locative-hausse', title: 'Note interne – application de la révision des loyers au 1er janvier 2025', category: 'internal', date: c.d.A17.rentNoteDate, issuer: `${person(c, 'rentManager').name}, ${person(c, 'rentManager').role}`, recipient: 'Agents de la gestion locative' });
    const k = b.clue('A17', 'internal', `La gestion locative paramètre une hausse de ${pts(rev.votedByBoardPct ?? 0)} sur tous les baux conventionnés, sans contrôle du plafond.`);
    b.p(`En application de la délibération du conseil d’administration du ${date(c.d.boardMeetings['2024-10']!)}, les loyers des logements conventionnés seront augmentés de ${pts(rev.votedByBoardPct ?? 0)} au 1er janvier 2025. Le paramétrage de LOGIGES sera effectué le 20 décembre.`, k);
    docs.push(b.build());
  }
  {
    const a11 = c.params.anomalies.A11;
    const places = c.params.programmes.filter((p) => p.kind === 'collective').reduce((s, p) => s + p.units, 0);
    const b = new DocBuilder({ id: 'note-calcul-par-daf', title: 'Note de calcul – refacturation des frais de gestion des foyers 2025', category: 'internal', date: c.d.A11.calculationNoteDate, issuer: cfo.name, recipient: auditor, availability: { kind: 'onRequest', request: 'Justificatif du produit à recevoir sur les foyers', from: 'cfo' } });
    const k = b.clue('A11', 'internal', 'La note de calcul est établie a posteriori (février 2026) et ne s’appuie sur aucune clause contractuelle ni facture.');
    b.p(`Frais de gestion supportés pour le compte des gestionnaires en 2025 (suivi technique, gestion des attributions, assurance) : ${places} places × forfait annuel, arrondi à ${euro0(fromEuros(a11.euros))}. La refacturation sera proposée aux gestionnaires en 2026.`, k);
    b.sign(cfo.name, cfo.role, c.d.A11.calculationNoteDate);
    docs.push(b.build());
  }
  {
    const b = new DocBuilder({ id: 'registre-contentieux', title: 'Registre des contentieux en cours au 31/12/2025 (service juridique)', category: 'internal', date: '2026-01-10', issuer: ENTITY_HEADER(c) });
    const k = b.clue('A16', 'internal', 'Le registre des contentieux ne mentionne pas l’assignation de l’entreprise générale des Tilleuls (novembre 2025).', ['A16.a', 'A16.b']);
    b.table(['Affaire', 'Nature', 'Enjeu estimé', 'Provision'], [
      ['Locataires – impayés (procédures d’expulsion)', 'Recouvrement', '—', '—'],
      ['Sinistre dégât des eaux – Les Lilas', 'Assurance', '—', '—'],
      ['Contestation d’un licenciement (2024)', 'Prud’hommes', '—', 'oui'],
      { cells: ['— fin du registre —', '', '', ''], clue: k },
    ], { align: ['left', 'left', 'right', 'left'] });
    docs.push(b.build());
  }
  docs.push(
    new DocBuilder({ id: 'mail-planning-cloture', title: 'Courriel – planning de clôture 2025', category: 'internal', date: '2025-12-05', issuer: cfo.name, recipient: 'Équipe comptable', noise: true })
      .p('Bonjour à tous, voici le planning de clôture : écritures d’inventaire avant le 23 janvier, balance définitive le 6 février, projet d’annexe le 20 février, arrêté des comptes le 26 mars. La migration nous a pris du retard, merci de prioriser les rapprochements bancaires.')
      .build(),
    new DocBuilder({ id: 'mail-relance-fournisseur', title: 'Courriel – relance d’un fournisseur pour une facture impayée', category: 'internal', date: '2026-01-14', issuer: tpName(c, 'F0012'), recipient: 'Service comptabilité fournisseurs', noise: true })
      .p('Nous vous relançons pour nos factures d’octobre et novembre restées impayées malgré l’échéance. Merci de nous indiquer la date de règlement.')
      .build(),
  );

  // ============================== tiers ==============================
  const allSchedules = new Map<string, LoanScheduleLine[]>();
  for (const l of c.cd.loanSchedules) allSchedules.set(l.loanId, [...(allSchedules.get(l.loanId) ?? []), l]);
  {
    const at = '2025-12-31';
    const bdt = c.cd.loans.filter((l) => l.lenderId === 'BDT' && l.refDate <= at);
    const crd = bdt.reduce((s, l) => s + outstandingAt(l, allSchedules.get(l.id)!, at), 0);
    const icne = bdt.reduce((s, l) => s + accruedInterest(l, allSchedules.get(l.id)!, at), 0);
    const phb = c.cd.loans.find((l) => l.product === 'PHB')!;
    const b = new DocBuilder({ id: 'confirmation-bdt', title: 'Réponse de la Banque des Territoires à la demande de confirmation', category: 'thirdParty', date: reply(14), issuer: 'Caisse des dépôts – Banque des Territoires', recipient: auditor, availability: { kind: 'confirmation', request: 'Banque des Territoires', arrives: reply(14) } });
    const k18 = b.clue('A18', 'thirdParty', `La Banque des Territoires confirme un capital restant dû de ${meuro(crd, 1)} au 31/12/2025, dont un prêt de haut de bilan versé le ${date(phb.refDate)}.`);
    const k8 = b.clue('A08', 'thirdParty', `Les intérêts courus au 31/12/2025 calculés par la Banque des Territoires, prêt par prêt, s’élèvent à ${euro0(icne)}.`);
    b.fields([
      ['Nombre de contrats', String(bdt.length)],
      ['Capital restant dû au 31/12/2025', euro0(crd), k18],
      [`dont prêt de haut de bilan n° ${phb.contractNumber} (versé le ${date(phb.refDate)})`, euro0(phb.refOutstanding)],
      ['Intérêts courus non échus au 31/12/2025', euro0(icne), k8],
      ['Garanties', 'Garanties des collectivités territoriales sur l’ensemble des prêts'],
    ]);
    b.note('Le détail par contrat (capital restant dû, taux en vigueur, date de la prochaine échéance) est joint en annexe.');
    b.sign(person(c, 'bdtOfficer').name, person(c, 'bdtOfficer').role, reply(14));
    docs.push(b.build());
  }
  docs.push(
    new DocBuilder({ id: 'confirmations-banques', title: 'Réponses des banques commerciales et d’Action Logement aux demandes de confirmation', category: 'thirdParty', date: reply(10), issuer: 'Établissements de crédit', recipient: auditor, noise: true, availability: { kind: 'confirmation', request: 'Banques commerciales et Action Logement', arrives: reply(10) } })
      .table(['Établissement', 'Capital restant dû confirmé'], [...new Set(c.cd.loans.filter((l) => l.lenderId !== 'BDT').map((l) => l.lenderId))].map((id) => [tpName(c, id), euro0(c.cd.loans.filter((l) => l.lenderId === id).reduce((s, l) => s + outstandingAt(l, allSchedules.get(l.id)!, '2025-12-31'), 0))]))
      .p('Soldes des comptes courants et des comptes à terme confirmés sans écart ; aucun autre engagement.')
      .build(),
  );
  {
    const cf = sp.closFleuri2026;
    const total = c.cd.sales.filter((s) => s.deedDate === cf.deedDate).reduce((s, x) => s + x.price, 0);
    const b = new DocBuilder({ id: 'confirmation-notaire', title: 'Réponse du notaire à la demande de confirmation', category: 'thirdParty', date: reply(8), issuer: person(c, 'notary').name, recipient: auditor, availability: { kind: 'confirmation', request: 'Notaire (Cabinet Girard)', arrives: reply(8) } });
    const k = b.clue('A03', 'thirdParty', `Le notaire confirme que les actes des sept pavillons ont été signés le ${date(cf.deedDate)} et qu’aucune somme n’était due à l’organisme au 31/12/2025 à ce titre.`);
    b.p(`Au 31/12/2025, aucune somme n’était détenue ni due pour le compte de ${c.params.scenario.entity.name} au titre des ventes ${ofProg(c, 'CLF')}. Les actes authentiques des sept pavillons ont été signés le ${date(cf.deedDate)} ; le prix (${euro0(total)}) a été versé le ${date(cf.notaryPaymentDate)}.`, k);
    b.sign(person(c, 'notary').name, person(c, 'notary').role, reply(8));
    docs.push(b.build());
  }
  {
    const t = sp.tilleuls;
    const a = c.d.A16;
    const b = new DocBuilder({ id: 'reponse-avocate', title: 'Réponse de l’avocate à la demande d’informations sur les litiges', category: 'thirdParty', date: a.lawyerReplyDate, issuer: person(c, 'lawyer').name, recipient: auditor, availability: { kind: 'confirmation', request: 'Avocats (Me Aubert)', arrives: a.lawyerReplyDate } });
    const ka = b.clue('A16', 'thirdParty', `Selon l’avocate, les travaux supplémentaires de l’ordre de service n° 7 (${euro0(fromEuros(t.os7Euros))}) sont dus.`, ['A16.a']);
    const kb = b.clue('A16', 'thirdParty', `Les pénalités de retard retenues (${euro0(fromEuros(t.penaltiesEuros))}) sont « sérieusement contestables », issue incertaine.`, ['A16.b']);
    b.p(`Par assignation du ${date(a.summonsDate)}, ${tpName(c, 'F0022')} réclame le paiement des travaux supplémentaires de l’ordre de service n° 7 et conteste les pénalités de retard retenues sur le décompte général.`);
    b.list([
      { text: `Travaux supplémentaires (${euro0(fromEuros(t.os7Euros))}) : l’ordre de service ayant été signé par le maître d’œuvre et le maître d’ouvrage, la somme nous paraît due.`, clue: ka },
      { text: `Pénalités de retard (${euro0(fromEuros(t.penaltiesEuros))}) : leur application est sérieusement contestable au vu des intempéries et des ordres de service modificatifs ; l’issue est incertaine.`, clue: kb },
    ]);
    b.sign(person(c, 'lawyer').name, person(c, 'lawyer').role, a.lawyerReplyDate);
    docs.push(b.build());
  }
  {
    const ch = sp.charmes;
    const b = new DocBuilder({ id: 'confirmation-departement', title: 'Réponse du Département à la demande de confirmation', category: 'thirdParty', date: reply(20), issuer: 'Département – direction de l’habitat', recipient: auditor, availability: { kind: 'confirmation', request: 'Département (subventions)', arrives: reply(20) } });
    const k = b.clue('A09', 'thirdParty', 'Le Département confirme qu’aucune somme n’est due au titre de la subvention des Charmes, caduque depuis octobre 2025.');
    b.p(`Au 31/12/2025, aucune somme n’est due à ${c.params.scenario.entity.name} au titre de la subvention attribuée le ${date(ch.decisionDate)} pour la réhabilitation ${ofProg(c, 'CHA')}, devenue caduque (notre courrier du ${date(ch.lapseNoticeDate)}).`, k);
    b.sign(person(c, 'departmentOfficer').name, person(c, 'departmentOfficer').role, reply(20));
    docs.push(b.build());
  }
  {
    const b = new DocBuilder({ id: 'confirmations-gestionnaires', title: 'Réponses des gestionnaires de foyers aux demandes de confirmation', category: 'thirdParty', date: reply(12), issuer: 'Gestionnaires de structures collectives', recipient: auditor, availability: { kind: 'confirmation', request: 'Gestionnaires de foyers', arrives: reply(12) } });
    const k11 = b.clue('A11', 'thirdParty', 'Les gestionnaires qui répondent déclarent ne rien devoir au titre de frais de gestion.');
    const k15 = b.clue('A15', 'thirdParty', `${tpName(c, 'ACCUEIL_HORIZONS')} ne répond pas à la demande de confirmation.`);
    b.table(['Gestionnaire', 'Réponse'], [
      { cells: [tpName(c, 'HABITAT_INSERTION'), 'Redevances 2025 réglées ; aucune somme due à ce titre ni au titre de frais de gestion.'], clue: k11 },
      { cells: [tpName(c, 'CCAS_AURELLE'), 'Aucune somme due au 31/12/2025.'], clue: k11 },
      { cells: [tpName(c, 'ACCUEIL_HORIZONS'), 'pas de réponse (relance du ' + date(reply(25)) + ' sans effet)'], clue: k15 },
    ], { align: ['left', 'left'] });
    docs.push(b.build());
  }
  {
    const adv = sp.sisterAdvance;
    const b = new DocBuilder({ id: 'confirmation-csh', title: `Réponse de ${tpName(c, 'COTEAUX_SEREIN')} à la demande de confirmation`, category: 'thirdParty', date: reply(11), issuer: tpName(c, 'COTEAUX_SEREIN'), recipient: auditor, availability: { kind: 'confirmation', request: 'Coteaux du Serein Habitat', arrives: reply(11) } });
    const k = b.clue('A12', 'thirdParty', `L’ESH sœur confirme une avance de ${meuro(fromEuros(adv.euros), 1)} sans intérêt, mobilisable jusqu’à ${meuro(fromEuros(adv.ceilingEuros), 1)}.`, ['A12.i', 'A12.ii']);
    b.p(`Nous confirmons devoir à ${c.params.scenario.entity.name}, au 31/12/2025, une avance en compte courant de ${euro0(fromEuros(adv.euros))}, sans intérêt, consentie en application de la convention du ${date(adv.conventionDate)}, qui prévoit des tirages jusqu’à ${euro0(fromEuros(adv.ceilingEuros))}.`, k);
    b.sign(person(c, 'sisterCeo').name, person(c, 'sisterCeo').role, reply(11));
    docs.push(b.build());
  }
  {
    const gie = c.cd.invoices.find((i) => i.supplierId === 'F0027' && i.serviceYear === 2025 && i.invoiceDate > '2025-12-31')!;
    const b = new DocBuilder({ id: 'confirmation-gie', title: `Réponse du ${tpName(c, 'F0027')} à la demande de confirmation`, category: 'thirdParty', date: reply(9), issuer: tpName(c, 'F0027'), recipient: auditor, availability: { kind: 'confirmation', request: 'GIE Altaïr Services', arrives: reply(9) } });
    const k = b.clue('A20', 'thirdParty', `Le GIE indique avoir facturé le ${date(gie.invoiceDate)} un complément de frais de structure 2025 de ${euro0(gie.total)}.`);
    b.p(`Au 31/12/2025, aucune facture n’était échue et impayée. Nous vous précisons qu’un complément de frais de structure au titre de l’exercice 2025, calculé selon la clé de répartition, a été facturé le ${date(gie.invoiceDate)} pour ${euro0(gie.total)} (facture ${gie.number}).`, k);
    b.sign(person(c, 'gieDirector').name, person(c, 'gieDirector').role, reply(9));
    docs.push(b.build());
  }

  // --- relevés bancaires (A03, A12, A18, F6) ---------------------------------
  {
    const adv = sp.sisterAdvance;
    const b = new DocBuilder({ id: 'releve-bancaire-2025-09', title: 'Relevé bancaire de septembre 2025 – compte principal (extrait)', category: 'thirdParty', date: '2025-09-30', issuer: 'Banque commerciale – compte principal', availability: { kind: 'onRequest', request: 'Relevés bancaires 2025', from: 'chiefAccountant' } });
    const k = b.clue('A12', 'thirdParty', `Virement de ${euro0(fromEuros(adv.euros))} à ${tpName(c, 'COTEAUX_SEREIN')} le ${date(adv.date)}.`, ['A12.i']);
    b.table(['Date', 'Libellé', 'Débit', 'Crédit'], [{ cells: [date(adv.date), `VIR ${tpName(c, 'COTEAUX_SEREIN').toUpperCase()} AVANCE CCT`, euro(fromEuros(adv.euros)), ''], clue: k }], { align: ['left', 'left', 'right', 'right'] });
    docs.push(b.build());
  }
  {
    const phb = c.cd.loans.find((l) => l.product === 'PHB')!;
    const b = new DocBuilder({ id: 'releve-bancaire-2025-12', title: 'Relevé bancaire de décembre 2025 – compte principal (extrait)', category: 'thirdParty', date: '2025-12-31', issuer: 'Banque commerciale – compte principal', availability: { kind: 'onRequest', request: 'Relevés bancaires 2025', from: 'chiefAccountant' } });
    const k = b.clue('A18', 'thirdParty', `Virement rond de ${euro0(phb.refOutstanding)} reçu de la Banque des Territoires le ${date(phb.refDate)} (référence de contrat ${phb.contractNumber}).`);
    b.table(['Date', 'Libellé', 'Débit', 'Crédit'], [{ cells: [date(phb.refDate), `VIR CDC BANQUE DES TERRITOIRES CTR ${phb.contractNumber}`, '', euro(phb.refOutstanding)], clue: k }], { align: ['left', 'left', 'right', 'right'] });
    docs.push(b.build());
  }
  {
    const cf = sp.closFleuri2026;
    const total = c.cd.sales.filter((s) => s.deedDate === cf.deedDate).reduce((s, x) => s + x.price, 0);
    const f6 = c.d.F6;
    const b = new DocBuilder({ id: 'releve-bancaire-2026-01', title: 'Relevé bancaire de janvier 2026 – compte principal (extrait)', category: 'thirdParty', date: '2026-01-31', issuer: 'Banque commerciale – compte principal', availability: { kind: 'onRequest', request: 'Relevés bancaires de janvier et février 2026', from: 'chiefAccountant' } });
    const k3 = b.clue('A03', 'thirdParty', `Le notaire verse le prix des sept pavillons le ${date(cf.notaryPaymentDate)}.`);
    const k6 = b.clue('F6', 'thirdParty', `Les ${f6.count} chèques en suspens au 31/12/2025 sont débités en janvier, au plus tard le ${date(f6.clearedBy)}.`);
    b.table(['Date', 'Libellé', 'Débit', 'Crédit'], [
      { cells: [`du 02/01 au ${date(f6.clearedBy)}`, `${f6.count} chèques émis en décembre 2025`, euro(fromEuros(f6.outstandingChequesEuros)), ''], clue: k6 },
      { cells: [date(cf.notaryPaymentDate), 'VIR OFFICE NOTARIAL GIRARD VENTES CLOS FLEURI', '', euro(total)], clue: k3 },
    ], { align: ['left', 'left', 'right', 'right'] });
    docs.push(b.build());
  }
  return docs;
}
