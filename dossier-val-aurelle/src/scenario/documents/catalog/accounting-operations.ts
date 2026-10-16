/** Operational accounting documents: sales, operations, treasury, accruals, tenants, rent interface, payables. */
import { accumulatedDepreciation } from '../../../engine/subledgers/depreciation';
import { postingDate } from '../../generator/posting';
import { supplierPaymentTerms, vacancy } from '../../report';
import { DocBuilder, ENTITY_HEADER, ofProg, creditOf, date, debitOf, euro, euro0, fromEuros, keuro, meuro, pct, person, progName, pts, tpName, type DocContext } from '../context';
import { entryAmount, rentRollByProgramme } from '../data';
import { fillInterfaceJournal, fillRentRoll, interfaceJournalTitle, rentRollTitle } from '../replies';
import type { DocumentModel } from '../model';

export function operationDocuments(c: DocContext): DocumentModel[] {
  const docs: DocumentModel[] = [];
  const sp = c.params.scenario.specific;
  const cfo = person(c, 'cfo');
  const chief = person(c, 'chiefAccountant');
  const rent = person(c, 'rentManager');
  const asset = person(c, 'assetDirector');

  // --- état des ventes HLM 2025 (A03) ---------------------------------------
  {
    const b = new DocBuilder({ id: 'etat-ventes-hlm', title: 'État des ventes HLM comptabilisées en 2025', category: 'accounting', date: '2026-01-26', issuer: ENTITY_HEADER(c) });
    const k = b.clue('A03', 'accounting', `Sept ventes du Clos Fleuri sont comptabilisées au 31/12/2025 alors que les actes sont datés du ${date(sp.closFleuri2026.deedDate)}.`);
    const nbv = (ids: readonly string[], at: string, comps: typeof c.cd.components) => comps.filter((x) => ids.includes(x.id)).reduce((s, x) => s + x.cost - accumulatedDepreciation(x, at), 0);
    const rows = [
      ...c.cd.sales.filter((s) => s.deedDate.startsWith('2025-')).map((s) => [s.id, progName(c, s.programmeId), s.dwellingIds[0]!, date(s.promiseDate), date(s.deedDate), euro0(s.price), euro0(nbv(s.componentIds, s.deedDate, c.cd.components)), date(s.deedDate)]),
      ...c.cd.sales.filter((s) => s.deedDate > '2025-12-31').map((s) => ({ cells: [s.id, progName(c, s.programmeId), s.dwellingIds[0]!, date(s.promiseDate), date(s.deedDate), euro0(s.price), euro0(nbv(s.componentIds, '2025-12-31', c.cd.components)), date('2025-12-31')], clue: k })),
    ];
    b.table(['Vente', 'Programme', 'Logement', 'Promesse', 'Acte authentique', 'Prix', 'Valeur nette comptable', 'Comptabilisation'], rows, { align: ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'left'] });
    b.fields([['Plus-values nettes de cessions 2025 (comptes 7752 – 6752)', euro0(creditOf(c.pb, ['7752']) - debitOf(c.pb, ['6752']))]]);
    b.sign(chief.name, chief.role);
    docs.push(b.build());
  }

  // --- fiche de situation de l’opération des Tilleuls (A01) ------------------
  {
    const t = sp.tilleuls;
    const leases = c.cd.leases.filter((l) => l.programmeId === 'TIL');
    const subs = c.cd.subsidies.filter((s) => s.programmeId === 'TIL');
    const b = new DocBuilder({ id: 'fiche-operation-tilleuls', title: `Fiche de situation financière et comptable de l’opération – ${progName(c, 'TIL')}`, category: 'accounting', date: c.d.A01.operationSheetDate, issuer: `${ENTITY_HEADER(c)} – maîtrise d’ouvrage` });
    const k = b.clue('A01', 'management', `La fiche de l’opération indique « livrée » : réception le ${date(t.receptionDate)}, ${leases.length} logements loués depuis l’été 2025.`);
    b.fields([
      ['Opération', 'Construction de 52 logements PLUS/PLAI'],
      ['Statut', `Livrée – réception prononcée le ${date(t.receptionDate)}`, k],
      ['Mise en location', `${leases.length} baux (premières entrées le ${date(leases.map((l) => l.start).sort()[0]!)})`],
      ['Prix de revient définitif (hors ordre de service n° 7)', euro0(fromEuros(t.costEuros))],
      ['dont foncier', euro0(fromEuros(t.landEuros))],
    ]);
    b.table(['Financeur', 'Montant accordé'], subs.map((s) => [c.d.grantors[s.grantorId] ?? s.grantorId, euro0(s.amount)]), { title: 'Subventions', footer: ['Total', euro0(subs.reduce((a, s) => a + s.amount, 0))] });
    b.sign(asset.name, asset.role, c.d.A01.operationSheetDate);
    docs.push(b.build());
  }

  // --- plan de financement des Charmes (A09) --------------------------------
  {
    const ch = sp.charmes;
    const sub = c.pd.subsidies.find((s) => s.id === 'SUB-CHA-H2026-DEPARTEMENT')!;
    const b = new DocBuilder({ id: 'plan-financement-charmes', title: `Plan de financement – réhabilitation thermique ${ofProg(c, 'CHA')}`, category: 'accounting', date: '2025-11-05', issuer: `${ENTITY_HEADER(c)} – maîtrise d’ouvrage` });
    const k = b.clue('A09', 'management', 'Le plan de financement des Charmes, mis à jour en novembre 2025, compte toujours sur la subvention départementale.');
    b.fields([
      ['Ordre de service', date(ch.worksOrderDate)],
      ['Travaux engagés en 2025', euro0(fromEuros(ch.works2025Euros))],
    ]);
    b.table(['Ressource', 'Montant', 'Situation'], [
      { cells: ['Subvention du Département (arrêté du ' + date(sub.decisionDate) + ')', euro0(sub.amount), 'à recevoir'], clue: k },
      ['Prêts Banque des Territoires (éco-prêt)', '—', 'en cours d’instruction'],
      ['Fonds propres', '—', 'solde'],
    ], { align: ['left', 'right', 'left'] });
    docs.push(b.build());
  }

  // --- rapprochement bancaire (F6) ------------------------------------------
  {
    const f6 = c.d.F6;
    const book = debitOf(c.pb, ['5121']);
    const outstanding = fromEuros(f6.outstandingChequesEuros);
    const b = new DocBuilder({ id: 'rapprochement-bancaire', title: 'État de rapprochement bancaire au 31/12/2025 – compte principal', category: 'accounting', date: '2026-01-12', issuer: ENTITY_HEADER(c) });
    const k = b.clue('F6', 'accounting', `Les ${f6.count} chèques émis non débités (${keuro(outstanding)}) sont tous débités au plus tard le ${date(f6.clearedBy)} : rapprochement correct.`);
    b.table(['', 'Montant'], [
      ['Solde comptable (compte 5121)', euro(book)],
      { cells: [`Chèques émis non encore débités (${f6.count})`, euro(outstanding)], clue: k },
      ['Solde du relevé bancaire', euro(book + outstanding)],
    ]);
    b.note(`Pointage sur le relevé de janvier 2026 : tous les chèques en suspens sont débités au plus tard le ${date(f6.clearedBy)}.`);
    b.sign(chief.name, chief.role, '2026-01-12');
    docs.push(b.build());
  }

  // --- charges à payer, produits à recevoir (A11, A20, F2) -------------------
  const fnp = c.presented.ledgers.current.entries.find((e) => e.pieceRef === 'INV2025-FNP')!;
  {
    const par = c.presented.ledgers.current.entries.filter((e) => e.date === '2025-12-31' && e.lines.some((l) => l.account === '4687' || l.account === '4487') && e.journal === 'OD');
    const gie = c.pd.invoices.find((i) => i.supplierId === 'F0027' && i.serviceYear === 2025 && i.invoiceDate > '2025-12-31');
    const gieAccrued = !!gie && fnp.lines.some((l) => l.account === gie.lines[0]!.account && l.debit === gie.lines[0]!.amount);
    const b = new DocBuilder({ id: 'etat-cap-par', title: 'État des charges à payer et des produits à recevoir au 31/12/2025', category: 'accounting', date: '2026-02-04', issuer: ENTITY_HEADER(c) });
    const k20 = b.clue('A20', 'accounting', 'Aucune charge à payer n’est constituée pour le GIE Altaïr Services.');
    b.table(['Charges à payer', 'Montant'], [
      ['Factures non parvenues (compte 4081)', euro0(creditOf(c.pb, ['4081']))],
      ['Fournisseurs d’immobilisations – factures non parvenues (compte 4084)', euro0(creditOf(c.pb, ['4084']))],
      { cells: [`dont ${tpName(c, 'F0027')}`, gieAccrued ? euro0(gie!.total) : euro0(0)], ...(gieAccrued ? {} : { clue: k20 }) },
    ], { title: 'Charges à payer' });
    const rows = par.map((e) => {
      const isA11 = !e.pieceRef;
      const k = isA11 ? b.clue('A11', 'accounting', 'Produit à recevoir de montant rond sur les foyers, sans pièce justificative (« justificatif à venir »).') : b.clue('F2', 'accounting', 'Le produit à recevoir sur le dégrèvement de TFPB est appuyé par la réclamation déposée le 15/12/2025.');
      return { cells: [e.label, e.pieceRef ?? 'justificatif à venir', euro0(entryAmount(e))], clue: k };
    });
    b.table(['Produits à recevoir', 'Pièce', 'Montant'], rows, { title: 'Produits à recevoir', align: ['left', 'left', 'right'] });
    b.sign(chief.name, chief.role);
    docs.push(b.build());
  }

  // --- rapport actuariel (A13) ----------------------------------------------
  {
    const cm = c.params.scenario.commitments;
    const b = new DocBuilder({ id: 'rapport-actuariel-2025', title: 'Évaluation actuarielle des indemnités de fin de carrière au 31/12/2025', category: 'accounting', date: cm.actuarialReportDate, issuer: person(c, 'actuary').name, recipient: `${cfo.name}, ${cfo.role}` });
    const k = b.clue('A13', 'thirdParty', `L’engagement de fin de carrière est évalué à ${meuro(fromEuros(cm.retirementEuros['2025']!))} au 31/12/2025.`);
    b.fields([
      ['Engagement au 31/12/2025', euro0(fromEuros(cm.retirementEuros['2025']!)), k],
      ['Engagement au 31/12/2024', euro0(fromEuros(cm.retirementEuros['2024']!))],
      ['Effectif évalué', String(c.params.scenario.payroll.headcount['2025'])],
    ]);
    b.p('Hypothèses : départ volontaire à 64 ans, table de mortalité réglementaire, taux d’actualisation de référence de fin d’année, taux de rotation par tranche d’âge.');
    docs.push(b.build());
  }

  // --- régularisation des charges 2025 (A10) --------------------------------
  {
    const regs = c.pd.regularisations.filter((r) => r.year === 2025);
    const cleanRegs = new Map(c.cd.regularisations.filter((r) => r.year === 2025).map((r) => [r.programmeId, r]));
    const caretakerProgs = new Set(c.cd.caretakers.filter((x) => x.role === 'gardien').flatMap((x) => x.programmeIds));
    const b = new DocBuilder({ id: 'regularisation-charges-2025', title: 'Régularisation des charges récupérables 2025 – état par programme', category: 'accounting', date: '2026-01-26', issuer: `${ENTITY_HEADER(c)} – gestion locative` });
    const ka = b.clue('A10', 'management', 'Les honoraires du syndic de la copropriété des Marronniers figurent parmi les charges récupérées.', ['A10.a']);
    const kb = b.clue('A10', 'management', 'La rémunération des gardiens est retenue à 100 % dans les charges récupérables.', ['A10.b']);
    b.p('Gardiennage : rémunération des gardiens retenue pour 100 % de son montant (charges salariales et patronales).', kb);
    b.table(['Programme', 'Provisions appelées', 'dont gardiennage', 'dont honoraires de syndic', 'Charges récupérables', 'Régularisation'], regs.map((r) => {
      const g = r.expenses['gardiennage'] ?? 0;
      const syndic = r.expenses['honoraires_syndic'] ?? 0;
      const clue = syndic ? ka : caretakerProgs.has(r.programmeId) && g !== (cleanRegs.get(r.programmeId)?.expenses['gardiennage'] ?? 0) ? kb : undefined;
      return { cells: [progName(c, r.programmeId), euro0(r.provisionsCalled), g ? euro0(g) : '—', syndic ? euro0(syndic) : '—', euro0(r.recoverable), euro0(r.regularisation)], ...(clue ? { clue } : {}) };
    }), { footer: ['Total', euro0(regs.reduce((s, r) => s + r.provisionsCalled, 0)), '', '', euro0(regs.reduce((s, r) => s + r.recoverable, 0)), euro0(regs.reduce((s, r) => s + r.regularisation, 0))] });
    b.sign(rent.name, rent.role);
    docs.push(b.build());
  }

  // --- états de quittancement (A01, A03) -----------------------------------
  {
    const roll = rentRollByProgramme(c.clean);
    const b = new DocBuilder({ id: 'quittancement-programmes', title: 'État de quittancement 2025 par programme (LOGIGES / LOGIGES 2)', category: 'accounting', date: '2026-01-08', issuer: `${ENTITY_HEADER(c)} – gestion locative` });
    const k = b.clue('A01', 'management', 'Les Tilleuls sont quittancés depuis juillet 2025.');
    const half = (row: number[], from: number) => row.slice(from, from + 6).reduce((s, x) => s + x, 0);
    b.table(['Programme', '1er semestre', '2e semestre', 'Total 2025'], [...roll.entries()].sort((x, y) => progName(c, x[0]).localeCompare(progName(c, y[0]))).map(([p, row]) => ({ cells: [progName(c, p), euro0(half(row, 0)), euro0(half(row, 6)), euro0(row.reduce((s, x) => s + x, 0))], ...(p === 'TIL' ? { clue: k } : {}) })));
    docs.push(b.build());
  }
  {
    const promised = new Set(c.cd.sales.filter((s) => s.deedDate > '2025-12-31').flatMap((s) => s.dwellingIds));
    const b = new DocBuilder({ id: 'quittancement-clf-2025-12', title: rentRollTitle(c, 'CLF', '2025-12'), category: 'accounting', date: '2025-12-01', issuer: `${ENTITY_HEADER(c)} – gestion locative`, availability: { kind: 'onRequest', family: 'programme-rent-roll', object: 'CLF:2025-12', from: 'rentManager' } });
    const k = b.clue('A03', 'management', 'Les sept pavillons sous promesse sont encore quittancés en décembre 2025.');
    fillRentRoll(b, c, 'CLF', '2025-12', (l) => (promised.has(l.dwellingId) ? k : undefined));
    docs.push(b.build());
  }
  {
    const rev = c.params.regulatory.rentRevision.byYear['2025']!;
    const sample = c.cd.leases.filter((l) => l.regulated && l.start < '2024-01-01' && (!l.end || l.end > '2025-02-28')).filter((_, i) => i % 997 === 0).slice(0, 10);
    const b = new DocBuilder({ id: 'quittances-echantillon', title: 'Quittances de décembre 2024 et de janvier 2025 – échantillon de logements conventionnés', category: 'accounting', date: '2025-01-31', issuer: `${ENTITY_HEADER(c)} – gestion locative`, availability: { kind: 'onRequest', family: 'closing-file', object: 'rent-revision', from: 'rentManager' } });
    const k = b.clue('A17', 'management', `Les loyers des logements conventionnés augmentent de ${pts(rev.votedByBoardPct ?? 0)} au 1er janvier 2025.`);
    b.table(['Bail', 'Programme', 'Loyer décembre 2024', 'Loyer janvier 2025', 'Variation'], sample.map((l) => ({ cells: [l.id, progName(c, l.programmeId), euro(l.rent.y2024), euro(l.rent.y2025), pct(l.rent.y2025 / l.rent.y2024 - 1, 2)], clue: k })), { align: ['left', 'left', 'right', 'right', 'right'] });
    docs.push(b.build());
  }

  // --- rapport de vacance (A04, A14-ii) --------------------------------------
  {
    const v = vacancy(c.cd, 2025);
    const glb = c.cd.dwellings.filter((d) => d.technicalVacancy?.reason === 'demolition');
    const heavy = c.cd.dwellings.filter((d) => d.technicalVacancy?.reason === 'heavyRepairs');
    const b = new DocBuilder({ id: 'rapport-vacance', title: 'Rapport de vacance 2025 (gestion locative)', category: 'accounting', date: '2026-01-15', issuer: `${ENTITY_HEADER(c)} – gestion locative` });
    const k14 = b.clue('A14', 'management', `Le taux de vacance 2025, mesuré comme en 2024 (toute vacance confondue), est de ${pct(v.totalRate)}.`, ['A14.ii']);
    const k4 = b.clue('A04', 'management', `${glb.length} logements des Glycines B sont neutralisés pour démolition.`);
    b.fields([
      ['Taux de vacance (ensemble des logements vacants)', pct(v.totalRate), k14],
      ['Taux de vacance commerciale (hors vacance technique)', pct(v.excludingTechnicalRate)],
      ['Logements neutralisés pour démolition (Glycines B)', String(glb.length), k4],
      ['Logements en travaux lourds (non proposés à la location)', String(heavy.length)],
    ]);
    b.sign(rent.name, rent.role);
    docs.push(b.build());
  }

  // --- RLS / APL (bruit) ------------------------------------------------------
  docs.push(
    new DocBuilder({ id: 'rapprochement-rls-apl', title: 'Rapprochement RLS / APL 2025 avec les états de la CAF', category: 'accounting', date: '2026-01-20', issuer: ENTITY_HEADER(c), noise: true })
      .fields([
        ['Réduction de loyer de solidarité 2025 (compte 70491)', euro0(debitOf(c.pb, ['70491']))],
        ['Écart avec les notifications de la CAF', euro0(0)],
      ])
      .p('Aucun écart : les montants de RLS et d’APL en tiers payant concordent avec les états de la caisse d’allocations familiales.')
      .build(),
  );

  // --- TFPB : tableau fiscal (F5), réclamation (F2) ---------------------------
  {
    const t24 = debitOf(c.b24, ['63512']);
    const t25 = debitOf(c.pb, ['63512']);
    const ended = c.cd.taxNotices.filter((n) => n.year === 2025 && n.tfpb > 0 && (c.cd.taxNotices.find((m) => m.year === 2024 && m.programmeId === n.programmeId)?.tfpb ?? 0) === 0);
    const b = new DocBuilder({ id: 'tableau-fiscal-tfpb', title: 'Tableau fiscal – taxe foncière sur les propriétés bâties 2024-2025', category: 'accounting', date: '2025-10-20', issuer: ENTITY_HEADER(c) });
    const k = b.clue('F5', 'accounting', `La hausse de la TFPB (${pct(t25 / t24 - 1)}) s’explique par la revalorisation des bases et la fin d’exonérations sur plusieurs programmes.`);
    b.fields([
      ['TFPB 2024', euro0(t24)],
      ['TFPB 2025', euro0(t25)],
      ['Variation', pct(t25 / t24 - 1), k],
    ]);
    b.p('Facteurs : revalorisation forfaitaire annuelle des valeurs locatives ; fin de la période d’exonération de longue durée pour les programmes suivants.');
    b.table(['Programme', 'TFPB 2025'], ended.map((n) => [progName(c, n.programmeId), euro0(n.tfpb)]));
    docs.push(b.build());
  }
  {
    const rc = c.params.scenario.taxes.reliefClaim2025;
    const relief25 = fromEuros(c.params.scenario.taxes.reliefEuros['2025']!);
    const relief24 = fromEuros(c.params.scenario.taxes.reliefEuros['2024']!);
    const b = new DocBuilder({ id: 'reclamation-tfpb', title: 'Réclamation contentieuse – dégrèvement de TFPB pour travaux d’économie d’énergie', category: 'accounting', date: rc.claimDate, issuer: ENTITY_HEADER(c), recipient: 'Direction départementale des finances publiques' });
    const k = b.clue('F2', 'accounting', `La réclamation déposée le ${date(rc.claimDate)} porte sur ${keuro(relief25)} ; la réclamation de l’an passé (${keuro(relief24)}) a été intégralement accordée.`);
    b.fields([
      ['Date de dépôt', date(rc.claimDate)],
      ['Montant demandé', euro0(relief25), k],
      ['Travaux concernés', 'Isolation, menuiseries et chauffage des programmes réhabilités en 2024'],
      ['Historique', `Réclamation 2023 : ${euro0(relief24)} accordés en juin 2024`],
    ]);
    b.sign(cfo.name, cfo.role, rc.claimDate);
    docs.push(b.build());
  }

  // --- migration et interface de quittancement (A19, F7) ----------------------
  {
    const odm = c.presented.ledgers.current.entries.filter((e) => e.enteredBy === c.params.scenario.users.migration);
    const b = new DocBuilder({ id: 'note-migration', title: 'Note de migration – bascule vers le nouveau progiciel et LOGIGES 2', category: 'accounting', date: c.d.F7.signOffDate, issuer: `${ENTITY_HEADER(c)} – direction financière`, availability: { kind: 'onRequest', family: 'closing-file', object: 'migration', from: 'chiefAccountant' } });
    const k7 = b.clue('F7', 'accounting', `Les ${odm.length} écritures de reprise des soldes saisies par l’utilisateur MIGRATION les ${c.params.scenario.users.migrationWeekend.map(date).join(' et ')} ont été rapprochées et signées.`);
    b.p(`Bascule le ${date(c.params.scenario.users.migrationDate)}. Les soldes des comptes de locataires ont été repris par ${odm.length} écritures d’opérations diverses (utilisateur MIGRATION) les ${c.params.scenario.users.migrationWeekend.map(date).join(' et ')}, rapprochées programme par programme avec l’ancien auxiliaire : écart nul. Rapprochement signé le ${date(c.d.F7.signOffDate)}.`, k7);
    const k19 = b.clue('A19', 'accounting', `Le lot de quittancement d’octobre des Saules a été « rejoué » le ${date(c.d.A19.replayDate)} après une erreur de transmission.`);
    b.h('Incidents');
    b.list([{ text: `${date(c.d.A19.replayDate)} : erreur de transmission du lot de quittancement d’octobre ${ofProg(c, 'SAU')} ; lot rejoué manuellement. Pas de rapprochement de l’auxiliaire prévu avant la clôture annuelle.`, clue: k19 }]);
    b.sign(chief.name, chief.role, c.d.F7.signOffDate);
    docs.push(b.build());
  }
  {
    const b = new DocBuilder({ id: 'journal-interface-octobre', title: interfaceJournalTitle('2025-10'), category: 'accounting', date: '2025-10-31', issuer: ENTITY_HEADER(c), availability: { kind: 'onRequest', family: 'rent-interface', object: '2025-10', from: 'chiefAccountant' } });
    const k = b.clue('A19', 'accounting', 'Le lot d’octobre des Saules figure deux fois dans le journal d’interface.');
    fillInterfaceJournal(b, c, '2025-10', (_e, duplicated) => (duplicated ? k : undefined));
    docs.push(b.build());
  }
  {
    const present = c.pd.tenants.filter((t) => t.byYear.y2025 && t.byYear.y2025.category !== 'former' && t.byYear.y2025.category !== 'procedure');
    const proc = c.pd.tenants.filter((t) => t.byYear.y2025?.category === 'procedure');
    const former = c.pd.tenants.filter((t) => t.byYear.y2025?.category === 'former');
    const sum = (ts: typeof present) => ts.reduce((s, t) => s + t.byYear.y2025!.balance, 0);
    const b = new DocBuilder({ id: 'balance-auxiliaire-logiges', title: 'Balance de l’auxiliaire des locataires LOGIGES 2 au 31/12/2025', category: 'accounting', date: '2026-01-08', issuer: `${ENTITY_HEADER(c)} – gestion locative` });
    const k = b.clue('A19', 'management', `Le total des comptes des locataires présents dans LOGIGES 2 (${euro0(sum(present))}) ne concorde pas avec le compte 4111 de la comptabilité générale.`);
    b.table(['Catégorie', 'Nombre de comptes', 'Solde'], [
      { cells: ['Locataires présents (hors procédure)', String(present.length), euro(sum(present))], clue: k },
      ['Locataires en procédure', String(proc.length), euro(sum(proc))],
      ['Locataires partis', String(former.length), euro(sum(former))],
    ], { align: ['left', 'right', 'right'] });
    docs.push(b.build());
  }

  // --- recouvrement (A07) ------------------------------------------------------
  {
    const rows = [2024, 2025].map((y) => {
      const prevKey = y === 2024 ? 'y2023' : 'y2024';
      const base = c.cd.tenants.reduce((s, t) => { const p = t.byYear[prevKey]; return s + (p && p.category === 'former' ? p.balance - p.depositHeld : 0); }, 0);
      const rec = c.cd.tenants.reduce((s, t) => s + (t.recoveries?.filter((r) => r.year === y).reduce((a, r) => a + r.amount, 0) ?? 0), 0);
      return { y, base, rec };
    });
    const b = new DocBuilder({ id: 'stats-recouvrement', title: 'Statistiques de recouvrement des créances des locataires partis', category: 'accounting', date: '2026-01-15', issuer: `${ENTITY_HEADER(c)} – recouvrement`, availability: { kind: 'onRequest', family: 'closing-file', object: 'impairment', from: 'rentManager' } });
    const k = b.clue('A07', 'management', `Le recouvrement des créances des locataires partis reste d’environ ${pct(rows[1]!.rec / rows[1]!.base, 0)} par an.`, ['A07.a']);
    b.table(['Année', 'Créances nettes à l’ouverture', 'Sommes recouvrées', 'Taux de recouvrement'], rows.map((r) => ({ cells: [String(r.y), euro0(r.base), euro0(r.rec), pct(r.rec / r.base)], clue: k })));
    b.sign(rent.name, rent.role);
    docs.push(b.build());
  }
  {
    const a7 = c.d.A07;
    const formers = c.cd.tenants.filter((t) => t.byYear.y2025?.category === 'former');
    const entrusted = formers.reduce((s, t) => s + t.byYear.y2025!.balance - t.byYear.y2025!.depositHeld, 0);
    const recovered = Math.round((entrusted * a7.providerRecoveredPct) / 100);
    const b = new DocBuilder({ id: 'rapport-prestataire-recouvrement', title: `Premier rapport d’activité – ${person(c, 'provider').name}`, category: 'contracts', date: a7.providerReportDate, issuer: person(c, 'provider').name, recipient: `${rent.name}, ${rent.role}`, availability: { kind: 'onRequest', family: 'closing-file', object: 'impairment', from: 'rentManager' } });
    const k = b.clue('A07', 'thirdParty', `Le prestataire n’a recouvré que ${pts(a7.providerRecoveredPct, 1)} des créances confiées depuis le ${date(a7.providerStart)}.`, ['A07.a']);
    b.fields([
      ['Début de la mission', date(a7.providerStart)],
      ['Dossiers confiés', String(formers.length)],
      ['Montant confié', euro0(entrusted)],
      ['Montant recouvré', euro0(recovered), k],
      ['Taux de recouvrement', pts(a7.providerRecoveredPct, 1)],
    ]);
    docs.push(b.build());
  }
  {
    const prp = c.cd.tenants.filter((t) => t.writeOff?.reason === 'debtDischarge');
    const b = new DocBuilder({ id: 'decisions-surendettement', title: 'Décisions de rétablissement personnel avec effacement des dettes notifiées en 2025', category: 'accounting', date: c.d.A07.commissionDate, issuer: `${ENTITY_HEADER(c)} – recouvrement`, availability: { kind: 'onRequest', family: 'closing-file', object: 'impairment', from: 'rentManager' } });
    const k = b.clue('A07', 'management', `${prp.length} décisions de rétablissement personnel effacent ${keuro(prp.reduce((s, t) => s + t.writeOff!.amount, 0))} de dettes locatives.`, ['A07.b']);
    b.table(['Locataire', 'Programme', 'Dette effacée'], prp.map((t) => ({ cells: [t.name, progName(c, t.programmeId), euro(t.writeOff!.amount)], clue: k })), { align: ['left', 'left', 'right'], footer: ['Total', '', euro(prp.reduce((s, t) => s + t.writeOff!.amount, 0))] });
    docs.push(b.build());
  }

  // --- fournisseurs (A14-i, A20) ------------------------------------------------
  {
    const terms = supplierPaymentTerms(c.pd.invoices, 2025);
    const b = new DocBuilder({ id: 'balance-agee-fournisseurs', title: 'Balance âgée des fournisseurs au 31/12/2025 – factures échues non réglées', category: 'accounting', date: '2026-01-09', issuer: ENTITY_HEADER(c) });
    const k = b.clue('A14', 'accounting', `${terms.count} factures échues restaient impayées à la clôture (${meuro(terms.amount)}).`, ['A14.i']);
    b.table(['Retard', 'Nombre de factures', 'Montant'], terms.buckets.map((x) => [x.label, String(x.count), euro0(x.amount)]), { footer: ['Total', String(terms.count), euro0(terms.amount)] });
    b.note('Factures reçues, échues au 31/12/2025 et réglées en 2026.', k);
    docs.push(b.build());
  }
  {
    const inv = c.pd.invoices.filter((i) => i.serviceYear === 2025 && postingDate(i) > '2025-12-31').sort((a, b) => (a.receivedDate < b.receivedDate ? -1 : 1));
    const accrued = (i: (typeof inv)[number]) => fnp.lines.some((l) => l.account === i.lines[0]!.account && l.debit === i.lines[0]!.amount);
    const b = new DocBuilder({ id: 'factures-2026', title: 'Factures reçues en janvier et février 2026 se rapportant à 2025', category: 'contracts', date: '2026-02-27', issuer: ENTITY_HEADER(c), availability: { kind: 'onRequest', family: 'closing-file', object: 'subsequent-invoices', from: 'chiefAccountant' } });
    const k = b.clue('A20', 'accounting', `La facture du GIE Altaïr Services du 20/01/2026 (complément de frais de structure 2025) n’a pas été provisionnée.`);
    b.table(['Fournisseur', 'Facture', 'Date', 'Objet', 'Montant', 'Provisionnée au 31/12/2025'], inv.slice(0, 40).map((i) => ({ cells: [tpName(c, i.supplierId), i.number, date(i.invoiceDate), i.description, euro(i.total), accrued(i) ? 'oui' : 'non'], ...(i.supplierId === 'F0027' && !accrued(i) ? { clue: k } : {}) })), { align: ['left', 'left', 'left', 'left', 'right', 'left'] });
    docs.push(b.build());
  }

  // --- journal des écritures d’inventaire (A11, A05) -----------------------------
  {
    const closing = c.presented.ledgers.current.entries.filter((e) => e.journal === 'OD' && e.date === '2025-12-31').sort((a, b) => (a.validDate < b.validDate ? -1 : a.validDate > b.validDate ? 1 : 0));
    const b = new DocBuilder({ id: 'journal-ecritures-inventaire', title: 'Journal des écritures d’inventaire 2025 (opérations diverses du 31/12/2025, avec date de validation)', category: 'accounting', date: '2026-02-04', issuer: ENTITY_HEADER(c) });
    const k11 = b.clue('A11', 'accounting', 'Écriture de produit à recevoir validée le 03/02/2026 par la DAF, montant rond, sans pièce, couple 4687 / 7088 inhabituel.');
    const k5 = b.clue('A05', 'accounting', 'La reprise de PGE a été modifiée et revalidée par la DAF fin janvier 2026.');
    b.table(['Libellé', 'Pièce', 'Validée le', 'Utilisateur', 'Montant'], closing.map((e) => {
      const clue = e.origin === 'anomaly:A11' ? k11 : e.origin === 'gen:CLO' && e.pieceRef === 'INV2025-PGE' && e.enteredBy === c.params.scenario.users.cfo.id && e.validDate > '2026-01-28' && e.lines.some((l) => l.account === '78157') ? k5 : undefined;
      return { cells: [e.label, e.pieceRef ?? '', date(e.validDate), e.enteredBy, euro(entryAmount(e))], ...(clue ? { clue } : {}) };
    }), { align: ['left', 'left', 'left', 'left', 'right'] });
    docs.push(b.build());
  }

  // --- comptes d’attente (A18) ----------------------------------------------
  {
    const entries = c.presented.ledgers.current.entries.filter((e) => e.lines.some((l) => l.account === '471'));
    const b = new DocBuilder({ id: 'detail-comptes-attente', title: 'Détail des comptes d’attente au 31/12/2025', category: 'accounting', date: '2026-01-12', issuer: ENTITY_HEADER(c) });
    const k = b.clue('A18', 'accounting', 'Le compte d’attente est créditeur d’un virement rond reçu de la Banque des Territoires le 15/12/2025.');
    b.table(['Date', 'Libellé', 'Débit', 'Crédit'], entries.map((e) => ({ cells: [date(e.date), e.label, euro(e.lines.filter((l) => l.account === '471').reduce((s, l) => s + l.debit, 0)), euro(e.lines.filter((l) => l.account === '471').reduce((s, l) => s + l.credit, 0))], clue: k })), { align: ['left', 'left', 'right', 'right'], footer: ['Solde', '', '', euro(creditOf(c.pb, ['471']))] });
    docs.push(b.build());
  }
  return docs;
}
