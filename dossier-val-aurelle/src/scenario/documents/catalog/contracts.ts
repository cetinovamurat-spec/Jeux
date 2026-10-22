/** Contracts and supporting documents. */
import { addYears, type IsoDate } from '../../../engine/dates';
import type { Invoice } from '../../datasets';
import { DocBuilder, ENTITY_HEADER, date, ofProg, debitOf, euro, euro0, fromEuros, meuro, pct, person, progName, tpName, type DocContext } from '../context';
import type { DocumentModel } from '../model';
import { operationAcceptance, operationOrders, programmeInvoices } from '../replies';

/**
 * Replies of the scenario's objects in the families dated on the request
 * (plan J4 §8.2, replies.ts → REQUEST_DATED_FAMILIES): the documents of their
 * neighbours, built on the date of the request from the same data, with the
 * clues tagged on them (registered when a row carries them). The catalogue
 * keeps a reference version, built at the start of the final and never served
 * as such (`rebuiltOnRequest`); documents/index.ts → requestReply builds the
 * version of each request.
 */
export const SCENARIO_REPLIES: Readonly<Record<string, (c: DocContext, asOf: IsoDate, update: boolean) => DocumentModel[]>> = {
  // Les Peupliers (A06): maintenance works capitalised
  'programme-invoices:PEU': (c, asOf, update) => {
    const capitalised = (i: Invoice) => !!i.orderRef?.startsWith('BC2025-PE-') && i.lines.some((l) => l.account === '61521');
    return programmeInvoices(c, 'PEU', asOf, update, {
      invoicesId: 'factures-peupliers',
      ordersId: 'bons-commande-peupliers',
      invoice: (b) => {
        const k = b.clueOnUse('A06', 'contract', 'Les factures décrivent de la peinture des cages d’escalier, un remplacement ponctuel de robinetterie et une réparation de toiture après infiltrations : de l’entretien.');
        return (i) => (capitalised(i) ? k() : undefined);
      },
      order: (b) => {
        const k = b.clueOnUse('A06', 'management', 'Les bons de commande rattachent la peinture, la robinetterie et la réparation de toiture au « programme d’entretien 2025 ».');
        return (i) => (capitalised(i) ? k() : undefined);
      },
    });
  },
  // Les Érables (A02): invoice of the heat pump
  'programme-invoices:ERA': (c, asOf, update) => {
    const pac = c.cd.invoices.filter((i) => i.supplierId === 'F0024' && i.lines.some((l) => l.programmeId === 'ERA'));
    const last = pac[pac.length - 1]!;
    return programmeInvoices(c, 'ERA', asOf, update, {
      invoicesId: 'facture-pac-erables',
      ordersId: 'bons-commande-erables',
      invoice: (b) => {
        const k = b.clueOnUse('A02', 'contract', 'La facture de la pompe à chaleur mentionne la dépose et l’évacuation de l’ancienne chaufferie.');
        return (i) => (i.id === last.id ? k() : undefined);
      },
    });
  },
  // Les Tilleuls (A16): work order n° 7, signed and not invoiced
  'operation-orders:TIL': (c, asOf, update) => {
    const t = c.params.scenario.specific.tilleuls;
    const os7 = c.d.A16.os7Date;
    const moe = person(c, 'projectManager');
    const asset = person(c, 'assetDirector');
    return [
      operationOrders(c, 'TIL', asOf, update, {
        id: 'os7-tilleuls',
        ...(os7 <= asOf
          ? {
              amendments: 'Ordre de service modificatif : ordre de service n° 7 (travaux supplémentaires), reproduit ci-dessous.',
              annex: (b: DocBuilder) => {
                b.h(`Ordre de service n° 7 – travaux supplémentaires (${tpName(c, 'F0022')})`);
                const k = b.clue('A16', 'contract', `L’ordre de service n° 7 (${euro0(fromEuros(t.os7Euros))}) est signé par le maître d’œuvre et la maîtrise d’ouvrage : les travaux supplémentaires sont dus.`, ['A16.a']);
                b.fields([['Objet', 'Travaux supplémentaires : renforcement des fondations du bâtiment B et adaptation des réseaux'], ['Montant HT', euro0(fromEuros(t.os7Euros)), k], ['Délai', 'sans incidence sur le délai contractuel']]);
                b.sign(moe.name, moe.role, os7);
                b.sign(asset.name, `${asset.role}, pour le maître de l’ouvrage`, os7);
              },
            }
          : {}),
      }),
    ];
  },
  // Les Tilleuls (A01): reception pronounced, the operation is still in progress in the books
  'operation-acceptance:TIL': (c, asOf, update) => {
    const t = c.params.scenario.specific.tilleuls;
    return [
      operationAcceptance(c, 'TIL', asOf, update, {
        id: 'pv-reception-tilleuls',
        reception: (b, operationId) => {
          const comps = c.cd.components.filter((x) => x.operationId === operationId);
          if (!comps.length || t.receptionDate > asOf) return undefined;
          return { on: t.receptionDate, buildings: comps.map((x) => x.building), clue: b.clue('A01', 'contract', `La réception des travaux des Tilleuls est prononcée le ${date(t.receptionDate)}.`) };
        },
      }),
    ];
  },
};

/** Reference version of a scenario reply dated on the request (start of the final): clues, designer mode, review pack. */
function referenceReply(c: DocContext, key: string): DocumentModel[] {
  return SCENARIO_REPLIES[key]!(c, c.d.calendar['finalStart']!, false).map((d) => (d.availability.kind === 'onRequest' ? { ...d, availability: { ...d.availability, rebuiltOnRequest: true as const } } : d));
}

export function contractDocuments(c: DocContext): DocumentModel[] {
  const docs: DocumentModel[] = [];
  const sp = c.params.scenario.specific;
  const ceo = person(c, 'ceo');
  const asset = person(c, 'assetDirector');

  // --- conventions avec les gestionnaires de foyers (A11) -------------------
  {
    const collective = c.params.programmes.filter((p) => p.kind === 'collective');
    const b = new DocBuilder({ id: 'conventions-gestionnaires-foyers', title: 'Conventions de location et de gestion avec les gestionnaires des structures collectives', category: 'contracts', date: '2019-01-01', issuer: ENTITY_HEADER(c), availability: { kind: 'onRequest', family: 'third-party-agreements', object: 'ACCUEIL_HORIZONS', also: ['HABITAT_INSERTION', 'CCAS_AURELLE'], from: 'cfo' } });
    b.table(['Structure', 'Gestionnaire', 'Redevance mensuelle'], collective.map((p) => [p.name, tpName(c, p.managerId!), euro0(fromEuros(p.monthlyFeeEuros ?? 0))]), { align: ['left', 'left', 'right'] });
    const k = b.clue('A11', 'contract', 'Les conventions ne prévoient aucune refacturation de frais de gestion aux gestionnaires de foyers.');
    b.p('Article 4 – Redevance : le gestionnaire verse une redevance mensuelle, révisée chaque année selon l’indice de référence des loyers ; elle couvre le loyer, les charges d’emprunt et la provision pour gros entretien.');
    b.p('Article 5 – Charges : les charges récupérables sont refacturées au réel. Aucune autre somme n’est due par le gestionnaire au titre de la présente convention.', k);
    docs.push(b.build());
  }

  // --- convention de groupe avec le GIE (A20) -------------------------------
  {
    const b = new DocBuilder({ id: 'convention-gie', title: `Convention de groupe – ${tpName(c, 'F0027')}`, category: 'contracts', date: '2021-01-12', issuer: tpName(c, 'F0027'), availability: { kind: 'onRequest', family: 'third-party-agreements', object: 'F0027', from: 'cfo' } });
    const k = b.clue('A20', 'contract', 'La convention prévoit un complément de fin d’année facturé en janvier selon les charges réelles du GIE.');
    b.p('Article 6 – Rémunération : le GIE facture trimestriellement à chaque membre une quote-part de ses frais de structure selon la clé de répartition (nombre de logements gérés).');
    b.p('Article 7 – Régularisation : au vu des charges réelles de l’exercice, le GIE facture en janvier de l’exercice suivant un complément (ou un avoir) de fin d’année, qui se rattache à l’exercice écoulé.', k);
    b.fields([['Frais de structure facturés en 2025 (compte 6281)', euro0(debitOf(c.pb, ['6281']))]]);
    docs.push(b.build());
  }

  // --- convention de soutien à l’ESH sœur (A12) ------------------------------
  {
    const adv = sp.sisterAdvance;
    const b = new DocBuilder({ id: 'convention-soutien-csh', title: `Convention de soutien financier – ${tpName(c, 'COTEAUX_SEREIN')}`, category: 'contracts', date: adv.conventionDate, issuer: ENTITY_HEADER(c), recipient: tpName(c, 'COTEAUX_SEREIN'), availability: { kind: 'onRequest', family: 'third-party-agreements', object: 'COTEAUX_SEREIN', from: 'cfo' } });
    const ki = b.clue('A12', 'contract', `L’avance est plafonnée à ${meuro(fromEuros(adv.ceilingEuros))} : le solde non tiré (${meuro(fromEuros(adv.ceilingEuros - adv.euros))}) est un engagement donné.`, ['A12.i']);
    const kii = b.clue('A12', 'contract', 'L’avance ne porte pas intérêt : la convention n’est pas conclue à des conditions normales.', ['A12.ii', 'A12.iii']);
    b.p(`Article 1 – ${c.params.scenario.entity.name} consent à ${tpName(c, 'COTEAUX_SEREIN')} une avance en compte courant d’un montant maximal de ${euro0(fromEuros(adv.ceilingEuros))}, mobilisable par tirages jusqu’au 31/12/2026.`, ki);
    b.p('Article 2 – L’avance ne porte pas intérêt. Elle est remboursable in fine au plus tard le 31/12/2030.', kii);
    b.p(`Article 3 – Un premier tirage de ${euro0(fromEuros(adv.euros))} est effectué le ${date(adv.date)}.`);
    b.sign(ceo.name, ceo.role, adv.conventionDate);
    b.sign(person(c, 'sisterCeo').name, person(c, 'sisterCeo').role, adv.conventionDate);
    docs.push(b.build());
  }

  // --- Les Peupliers : factures et bons de commande (A06) --------------------
  docs.push(...referenceReply(c, 'programme-invoices:PEU'));

  // --- Les Érables : facture de la PAC (A02) ---------------------------------
  docs.push(...referenceReply(c, 'programme-invoices:ERA'));

  // --- Les Tilleuls : réception, OS n° 7 (A01, A16) ---------------------------
  docs.push(...referenceReply(c, 'operation-acceptance:TIL'), ...referenceReply(c, 'operation-orders:TIL'));

  // --- Les Charmes : arrêté de subvention, ordre de service (A09) -----------
  {
    const ch = sp.charmes;
    const b = new DocBuilder({ id: 'arrete-subvention-charmes', title: 'Arrêté attributif de subvention – réhabilitation thermique des Charmes', category: 'contracts', date: ch.decisionDate, issuer: 'Département – direction de l’habitat', availability: { kind: 'onRequest', family: 'closing-file', object: 'subsidies', from: 'cfo' } });
    const k = b.clue('A09', 'contract', `L’arrêté prévoit la caducité si les travaux ne commencent pas dans un délai de ${ch.lapseYears} ans (soit avant le ${date(addYears(ch.decisionDate, ch.lapseYears))}).`);
    b.fields([['Bénéficiaire', c.params.scenario.entity.name], ['Opération', `Réhabilitation thermique ${ofProg(c, 'CHA')}`], ['Montant', euro0(fromEuros(ch.subsidyEuros))]]);
    b.p(`Article 5 – La subvention devient caduque si les travaux ne sont pas commencés dans un délai de ${ch.lapseYears} ans à compter de la date du présent arrêté. Une prorogation peut être sollicitée avant l’expiration de ce délai.`, k);
    docs.push(b.build());
    const os = new DocBuilder({ id: 'os-charmes', title: `Ordre de service de démarrage des travaux – ${progName(c, 'CHA')}`, category: 'contracts', date: ch.worksOrderDate, issuer: `${ENTITY_HEADER(c)} – maîtrise d’ouvrage`, recipient: tpName(c, 'F0025') });
    const k2 = os.clue('A09', 'contract', `Les travaux des Charmes ne démarrent que le ${date(ch.worksOrderDate)}, après l’expiration du délai fixé par l’arrêté.`);
    os.p(`Ordre est donné à l’entreprise de commencer les travaux à compter du ${date(ch.worksOrderDate)}.`, k2);
    os.sign(asset.name, asset.role, ch.worksOrderDate);
    docs.push(os.build());
    const due = c.pd.subsidies
      .filter((s) => s.decisionDate <= '2025-12-31' && !(s.cancelledOn && s.cancelledOn <= '2025-12-31'))
      .map((s) => ({ s, rest: s.amount - s.receipts.filter((r) => r.date <= '2025-12-31').reduce((a, r) => a + r.amount, 0) }))
      .filter((x) => x.rest > 0)
      .sort((x, y) => (x.s.decisionDate < y.s.decisionDate ? -1 : 1));
    const list = new DocBuilder({ id: 'etat-subventions-a-recevoir', title: 'État des subventions d’investissement restant à recevoir au 31/12/2025 et références des arrêtés', category: 'accounting', date: '2026-02-06', issuer: `${ENTITY_HEADER(c)} – direction financière`, availability: { kind: 'onRequest', family: 'closing-file', object: 'subsidies', from: 'cfo' } });
    list.table(['Financeur', 'Programme', 'Arrêté du', 'Montant accordé', 'Reste à recevoir'], due.map((x) => [c.d.grantors[x.s.grantorId] ?? x.s.grantorId, progName(c, x.s.programmeId), date(x.s.decisionDate), euro0(x.s.amount), euro0(x.rest)]), {
      align: ['left', 'left', 'left', 'right', 'right'],
      footer: ['Total', '', '', '', euro0(due.reduce((a, x) => a + x.rest, 0))],
    });
    list.note('Les arrêtés attributifs sont joints pour les subventions dont le versement reste subordonné au commencement ou à l’achèvement des travaux.');
    docs.push(list.build());
  }

  // --- avenant ANRU (A04) ---------------------------------------------------
  {
    const g = sp.glycinesB;
    const b = new DocBuilder({ id: 'avenant-anru-glycines', title: 'Avenant n° 2 à la convention pluriannuelle de renouvellement urbain – quartier des Glycines', category: 'contracts', date: g.anruAmendment, issuer: 'Agence nationale pour la rénovation urbaine', availability: { kind: 'onRequest', family: 'closing-file', object: 'urban-renewal', from: 'assetDirector' } });
    const k = b.clue('A04', 'contract', `L’avenant ANRU du ${date(g.anruAmendment)} intègre la démolition du bâtiment B des Glycines au programme et fixe son calendrier.`);
    b.p(`Le présent avenant intègre au programme la démolition du bâtiment B de la résidence ${progName(c, 'GLB')} (${c.cd.dwellings.filter((d) => d.programmeId === 'GLB').length} logements), sous maîtrise d’ouvrage de ${c.params.scenario.entity.name}. Calendrier : relogements de septembre 2025 à mi-2027, démolition au plus tard le ${date(g.demolitionPlannedEnd)}. Les financements de l’ANRU (démolition, relogement) seront engagés par décisions attributives successives.`, k);
    b.sign(ceo.name, ceo.role, g.anruAmendment);
    docs.push(b.build());
  }

  // --- fiches de poste des gardiens (A10-b) ----------------------------------
  {
    const g = c.cd.caretakers.filter((x) => x.role === 'gardien');
    const b = new DocBuilder({ id: 'fiches-poste-gardiens', title: 'Fiches de poste des gardiens d’immeubles', category: 'contracts', date: '2023-09-01', issuer: `${ENTITY_HEADER(c)} – ressources humaines`, availability: { kind: 'onRequest', family: 'closing-file', object: 'recoverable-charges', from: 'rentManager' } });
    const k = b.clue('A10', 'contract', 'Les gardiens assurent l’entretien des parties communes et l’élimination des rejets, mais aussi des missions de gestion (états des lieux, accueil, réclamations).', ['A10.b']);
    b.p('Missions : entretien des parties communes ; sortie et rentrée des conteneurs, élimination des rejets ; accueil des locataires et traitement des réclamations ; états des lieux d’entrée et de sortie ; surveillance technique et relations avec les entreprises.', k);
    b.table(['Gardien', 'Programme', 'Missions d’entretien et d’élimination des rejets'], g.map((x) => [x.name, x.programmeIds.map((p) => progName(c, p)).join(', '), x.tasks.length >= 2 ? 'les deux' : 'une seule']), { align: ['left', 'left', 'left'] });
    docs.push(b.build());
  }

  // --- fausses pistes : F1, F3, F4 -------------------------------------------
  {
    const h24 = debitOf(c.b24, ['6226']);
    const h25 = debitOf(c.pb, ['6226']);
    const studies = c.cd.invoices.filter((i) => i.serviceYear === 2025 && i.lines.some((l) => l.account === '6226') && /NPNRU|plan stratégique/.test(i.description));
    const b = new DocBuilder({ id: 'contrats-etudes-npnru', title: 'Contrats d’études 2025 – renouvellement urbain des Glycines et plan stratégique de patrimoine', category: 'contracts', date: '2025-04-22', issuer: ENTITY_HEADER(c) });
    const k = b.clue('F1', 'contract', `La hausse des honoraires (${pct(h25 / h24 - 1, 0)}) correspond aux études NPNRU et à l’actualisation du plan stratégique, contractualisées après consultation.`);
    b.fields([['Honoraires 2024 (compte 6226)', euro0(h24)], ['Honoraires 2025 (compte 6226)', euro0(h25), k]]);
    b.table(['Facture', 'Prestataire', 'Objet', 'Montant'], studies.map((i) => [i.number, tpName(c, i.supplierId), i.description, euro(i.total)]), { align: ['left', 'left', 'left', 'right'] });
    docs.push(b.build());
  }
  {
    const pr = c.params.scenario.payroll;
    const p24 = debitOf(c.b24, ['641', '645']);
    const p25 = debitOf(c.pb, ['641', '645']);
    const b = new DocBuilder({ id: 'accord-nao-2025', title: 'Accord de négociation annuelle obligatoire 2025 et note sur l’évolution de la masse salariale', category: 'contracts', date: '2025-02-20', issuer: `${ENTITY_HEADER(c)} – ressources humaines` });
    const k = b.clue('F3', 'contract', `La hausse des charges de personnel (${pct(p25 / p24 - 1)}) s’explique par l’accord salarial, la prime de partage de la valeur, les recrutements de gardiens et des postes vacants pourvus.`);
    b.fields([
      ['Charges de personnel 2024', euro0(p24)],
      ['Charges de personnel 2025', euro0(p25), k],
      ['Prime de partage de la valeur 2025', euro0(fromEuros(pr.valueSharingBonusEuros['2025']!))],
      ['Effectif moyen 2024 / 2025', `${pr.headcount['2024']} / ${pr.headcount['2025']}`],
    ]);
    b.p(`Mesures : augmentation générale des salaires, ${c.d.F3.recruitedCaretakers} recrutements de gardiens, pourvoi des postes vacants de la direction financière et de la gestion locative.`);
    docs.push(b.build());
  }
  {
    const f4 = c.d.F4;
    const inv = c.cd.invoices.filter((i) => i.supplierId === 'F0015' && i.serviceYear === 2025);
    const base = inv.reduce((s, i) => s + i.total, 0);
    const bidders = [tpName(c, 'F0015'), 'Rénovation Marnaise SAS', 'Entreprise Duval Bâtiment', 'Groupe Habitat Services'];
    const b = new DocBuilder({ id: 'marche-bati-renov', title: `Rapport d’analyse des offres – marché d’entretien attribué à ${tpName(c, 'F0015')}`, category: 'contracts', date: f4.awardDate, issuer: `${ENTITY_HEADER(c)} – commission d’appel d’offres`, availability: { kind: 'onRequest', family: 'supplier-tender', object: 'F0015', from: 'assetDirector' } });
    const k = b.clue('F4', 'contract', 'Le marché a été attribué après mise en concurrence (quatre offres) au moins-disant, par une commission collégiale.');
    b.table(['Candidat', 'Offre (base annuelle)', 'Classement'], f4.offersFactors.map((f, i) => ({ cells: [bidders[i] ?? `Candidat ${i + 1}`, euro0(Math.round(base * f)), String(i + 1)], ...(i === 0 ? { clue: k } : {}) })), { align: ['left', 'right', 'right'] });
    b.p('La commission (directeur général, directrice administrative et financière, un administrateur) retient l’offre économiquement la plus avantageuse.');
    docs.push(b.build());
    const at = new DocBuilder({ id: 'attestation-absence-lien', title: 'Déclaration d’absence de conflit d’intérêts – direction du patrimoine', category: 'contracts', date: f4.awardDate, issuer: ENTITY_HEADER(c), availability: { kind: 'onRequest', family: 'supplier-tender', object: 'F0015', from: 'assetDirector' } });
    const k2 = at.clue('F4', 'internal', `${asset.name} déclare n’avoir aucun lien de parenté avec ${person(c, 'contractorManager').name}, gérant de ${tpName(c, 'F0015')}.`);
    at.p(`Je soussignée, ${asset.name}, déclare n’avoir aucun lien de parenté ni intérêt personnel avec ${person(c, 'contractorManager').name}, ${person(c, 'contractorManager').role}, ni avec aucun des candidats au marché. L’homonymie est fortuite.`, k2);
    at.sign(asset.name, asset.role, f4.awardDate);
    docs.push(at.build());
  }

  // --- Le Clos Fleuri : promesses, levée des conditions, actes (A03) ---------
  {
    const cf = sp.closFleuri2026;
    const sales = c.cd.sales.filter((s) => s.deedDate === cf.deedDate);
    const b = new DocBuilder({ id: 'promesses-clos-fleuri', title: `Promesses de vente – ${progName(c, 'CLF')} (7 pavillons)`, category: 'contracts', date: cf.promiseDate, issuer: person(c, 'notary').name, availability: { kind: 'onRequest', family: 'sale-notary', object: 'CLF', from: 'cfo' } });
    b.table(['Promesse', 'Logement', 'Acquéreur (locataire en place)', 'Prix'], sales.map((s) => [s.id, s.dwellingIds[0]!, s.buyer, euro0(s.price)]), { align: ['left', 'left', 'left', 'right'] });
    const k1 = b.clue('A03', 'contract', 'Les promesses stipulent que le transfert de propriété et l’entrée en jouissance interviennent à la signature de l’acte authentique.');
    const k2 = b.clue('A03', 'contract', 'Les ventes sont conclues sous la condition suspensive de l’obtention d’un prêt par chaque acquéreur.');
    b.p('Article 6 – Transfert de propriété et jouissance : le transfert de propriété et l’entrée en jouissance de l’acquéreur n’interviendront qu’à la signature de l’acte authentique de vente.', k1);
    b.p('Article 8 – Condition suspensive : la vente est conclue sous la condition suspensive de l’obtention par l’acquéreur d’un ou plusieurs prêts destinés à financer l’acquisition.', k2);
    b.sign(person(c, 'notary').name, person(c, 'notary').role, cf.promiseDate);
    docs.push(b.build());
    const lv = new DocBuilder({ id: 'levee-condition-clos-fleuri', title: 'Courrier du notaire – réalisation des conditions suspensives', category: 'contracts', date: c.d.A03.conditionLiftedDate, issuer: person(c, 'notary').name, recipient: `${person(c, 'cfo').name}, ${person(c, 'cfo').role}`, availability: { kind: 'onRequest', family: 'sale-notary', object: 'CLF', from: 'cfo' } });
    const k3 = lv.clue('A03', 'thirdParty', `Les conditions suspensives des sept promesses ne sont réalisées que le ${date(c.d.A03.conditionLiftedDate)}.`);
    lv.p(`Je vous informe que l’ensemble des acquéreurs ont obtenu leur financement ; les conditions suspensives des promesses du ${date(cf.promiseDate)} sont réalisées à la date du ${date(c.d.A03.conditionLiftedDate)}. Je vous propose de signer les actes authentiques le ${date(cf.deedDate)}.`, k3);
    lv.sign(person(c, 'notary').name, person(c, 'notary').role, c.d.A03.conditionLiftedDate);
    docs.push(lv.build());
    const ac = new DocBuilder({ id: 'actes-clos-fleuri', title: `Actes authentiques de vente – ${progName(c, 'CLF')} (7 pavillons)`, category: 'contracts', date: cf.deedDate, issuer: person(c, 'notary').name, availability: { kind: 'afterDate', from: cf.deedDate } });
    const k4 = ac.clue('A03', 'thirdParty', `Les actes authentiques des sept pavillons sont signés le ${date(cf.deedDate)}.`);
    ac.table(['Acte', 'Logement', 'Acquéreur', 'Prix', 'Date de signature'], sales.map((s) => ({ cells: [s.id, s.dwellingIds[0]!, s.buyer, euro0(s.price), date(s.deedDate)], clue: k4 })), { align: ['left', 'left', 'left', 'right', 'left'] });
    docs.push(ac.build());
  }

  // --- bruit : contrat du prestataire de recouvrement ---------------------------
  docs.push(
    new DocBuilder({ id: 'contrat-prestataire-recouvrement', title: `Contrat de recouvrement amiable – ${person(c, 'provider').name}`, category: 'contracts', date: c.d.A07.providerStart, issuer: ENTITY_HEADER(c), noise: true })
      .p('Objet : recouvrement amiable des créances des locataires partis confiées par l’organisme. Rémunération au résultat (commission sur les sommes encaissées). Reporting trimestriel.')
      .sign(person(c, 'ceo').name, person(c, 'ceo').role, c.d.A07.providerStart)
      .build(),
  );
  return docs;
}
