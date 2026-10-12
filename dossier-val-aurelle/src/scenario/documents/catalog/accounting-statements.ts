/** Draft statements, annex, management report, fixed assets, debt and provisions of the presented accounts. */
import { addDays, daysBetween } from '../../../engine/dates';
import { accumulatedDepreciation, accumulatedSubsidyRelease } from '../../../engine/subledgers/depreciation';
import { outstandingAt } from '../../../engine/subledgers/loans';
import type { LoanScheduleLine } from '../../../engine/types';
import { buildAnnex, type AnnexTable } from '../../annex';
import { managerReceivable } from '../../impairment';
import { managementReport } from '../../report';
import { DocBuilder, ENTITY_HEADER, amount0, creditOf, date, euro, euro0, keuro, meuro, pct, person, progName, pts, tpName, type DocContext } from '../context';
import { creditsOn, wipByProgramme } from '../data';
import type { DocumentModel } from '../model';

function annexTableBlock(b: DocBuilder, t: AnnexTable, clueByRow: Record<string, string> = {}): void {
  b.table(
    ['', ...t.columns.map((col) => col.label)],
    t.rows.map((r) => ({ cells: [r.label, ...t.columns.map((col) => (r.values[col.id] === undefined ? '' : amount0(r.values[col.id]!)))], ...(clueByRow[r.id] ? { clue: clueByRow[r.id] } : {}) })),
    { title: t.title },
  );
}

export function statementDocuments(c: DocContext): DocumentModel[] {
  const docs: DocumentModel[] = [];
  const cfo = person(c, 'cfo');
  const draft = { kind: 'initial' } as const;
  const pf = c.key.presentedFigures.figures;

  // --- projet d'états financiers 2025 (A22) --------------------------------
  {
    const b = new DocBuilder({ id: 'etats-financiers-2025', title: 'Projet de comptes annuels 2025 – bilan et compte de résultat', category: 'accounting', date: '2026-02-20', issuer: ENTITY_HEADER(c), availability: draft });
    const line = (id: string) => [c.ps.lines[id] ? euro0(c.ps.lines[id]!.current) : '', c.ps.lines[id] ? euro0(c.ps.lines[id]!.prior) : ''];
    const label = (id: string) => c.params.statements.find((s) => s.id === id)!.label;
    const k22 = b.clue('A22', 'accounting', 'Les dépôts de garantie des locataires sont présentés en « autres dettes », y compris dans la colonne 2024, qui ne concorde plus avec les comptes certifiés.');
    b.table(['Passif', '31/12/2025', '31/12/2024'], [
      ...['P_CAPITAL', 'P_RESERVES', 'P_RESULTAT', 'P_SUBV', 'P_CP', 'P_PGE', 'P_PROV_RISQUES', 'P_EMPRUNTS_CDC', 'P_EMPRUNTS_EC', 'P_EMPRUNTS_AUTRES', 'P_DEPOTS', 'P_ICNE', 'P_DETTES_FIN', 'P_FOURNISSEURS', 'P_DETTES_IMMO', 'P_FISC_SOC'].map((id) => [label(id), ...line(id)]),
      { cells: [label('P_AUTRES_DETTES'), ...line('P_AUTRES_DETTES')], clue: k22 },
      [label('PASSIF_TOTAL'), ...line('PASSIF_TOTAL')],
    ], { title: 'Bilan – passif' });
    b.table(['Actif (net)', '31/12/2025', '31/12/2024'], ['A_TERRAINS', 'A_CONSTRUCTIONS', 'A_AUTRES_CORP', 'A_IMMO_COURS', 'A_IMMO_FIN', 'A_LOCATAIRES', 'A_SUBV_RECEVOIR', 'A_AUTRES_CREANCES', 'A_DISPO', 'A_CCA', 'ACTIF_TOTAL'].map((id) => [label(id), ...line(id)]), { title: 'Bilan – actif' });
    b.table(['Compte de résultat', '2025', '2024'], ['CR_LOYERS', 'CR_RECUP', 'CR_ANNEXES', 'CR_REPRISES_EXPL', 'CR_ENTRETIEN', 'CR_SERV_EXT', 'CR_IMPOTS', 'CR_PERSONNEL_SAL', 'CR_DOT_AMORT', 'CR_DOT_PROV', 'CR_DOT_DEPR', 'CR_RESULTAT_EXPL', 'CR_RESULTAT_FIN', 'CR_RESULTAT_EXC', 'CR_RESULTAT'].map((id) => [label(id), ...line(id)]), { title: 'Compte de résultat (extraits)' });
    b.sign(cfo.name, cfo.role);
    docs.push(b.build());
  }

  // --- projet d'annexe 2025 (A06, A07, A12, A13, A21) ----------------------
  {
    const tables = buildAnnex(c.presented, c.params, 'current');
    const t = (id: string) => tables.find((x) => x.id === id)!;
    const b = new DocBuilder({ id: 'annexe-2025', title: 'Projet d’annexe des comptes 2025', category: 'accounting', date: '2026-02-20', issuer: ENTITY_HEADER(c) });
    const m = c.params.scenario.tenants.cleanMethod;
    b.h('1. Règles et méthodes comptables');
    const families = Object.entries(c.params.components.families).filter(([, f]) => f.inNomenclature !== false && f.lifeYears > 0);
    const k6 = b.clue('A06', 'accounting', 'La nomenclature de composants de l’organisme ne comporte pas de composant « agencements divers » amorti sur 15 ans.');
    b.p(`Immobilisations : les immeubles sont décomposés selon la nomenclature de l’organisme (${families.map(([, f]) => `${f.label.toLowerCase()} ${f.lifeYears} ans`).join(', ')}). Les dépenses d’entretien et de réparation sont comptabilisées en charges.`, k6);
    const k7 = b.clue('A07', 'accounting', `La note de méthode, présentée comme inchangée, prévoit ${pct(m.formerRate, 0)} pour les ex-locataires : le calcul retient pourtant un autre taux.`, ['A07.a']);
    b.p(`Créances locatives (méthode inchangée par rapport à l’exercice précédent) : créances sur les locataires partis dépréciées à ${pct(m.formerRate, 0)} de leur montant net des dépôts de garantie conservés ; locataires présents à ${pct(m.over6mRate, 0)} au-delà de six mois d’ancienneté ; dossiers en procédure et en surendettement à ${pct(m.procedureRate, 0)}.`, k7);
    b.h('2. Tableaux');
    annexTableBlock(b, t('immobilisations'));
    annexTableBlock(b, t('amortissements'));
    const shown = t('provisions').rows.find((r) => r.id === 'creances-locataires')?.values['dotations'] ?? 0;
    const actual = creditsOn(c.presented, ['4911', '4915', '4916']);
    const k21 = b.clue('A21', 'accounting', `Le tableau des provisions indique une dotation de ${keuro(shown)} aux dépréciations des créances locatives ; la balance fait apparaître ${keuro(actual)}.`);
    annexTableBlock(b, t('provisions'), { 'creances-locataires': k21 });
    annexTableBlock(b, t('subventions'));
    annexTableBlock(b, t('dettes'));
    annexTableBlock(b, t('creances'));
    const k12 = b.clue('A12', 'accounting', 'Le tableau des engagements ne mentionne pas le solde non tiré de l’avance consentie à Coteaux du Serein Habitat.', ['A12.i']);
    const k13 = b.clue('A13', 'accounting', 'Le tableau des engagements ne mentionne plus les indemnités de fin de carrière.');
    const k16 = b.clue('A16', 'accounting', 'Aucune information sur le litige avec l’entreprise générale des Tilleuls.', ['A16.b']);
    b.h('Engagements hors bilan', k12);
    annexTableBlock(b, t('engagements'));
    b.note('Aucun autre engagement donné ou reçu. Aucune transaction significative avec des parties liées conclue à des conditions anormales.', k13);
    b.note('Litiges : néant.', k16);
    docs.push(b.build());
  }

  // --- projet de rapport de gestion 2025 (A14) ------------------------------
  {
    const r = managementReport(c.presented, pf, c.facts);
    const hist = c.params.scenario.history.find((h) => h.year === 2023)!;
    const avg = (hist.netSelfFinancingRatioPct / 100 + c.f24.netSelfFinancingRatio + r.netSelfFinancing.shownRatio) / 3;
    const b = new DocBuilder({ id: 'rapport-gestion-2025', title: 'Projet de rapport de gestion du conseil d’administration – exercice 2025 (extraits)', category: 'accounting', date: '2026-03-02', issuer: ENTITY_HEADER(c) });
    b.fields([
      ['Résultat net', euro0(r.netResult)],
      ['Loyers (nets de RLS)', euro0(r.rents)],
    ]);
    const k3 = b.clue('A14', 'management', `Le ratio d’autofinancement net annoncé (${pct(r.netSelfFinancing.shownRatio)}) et sa moyenne sur trois ans reposent sur les comptes avant corrections.`, ['A14.iii']);
    b.fields([
      ['Ratio d’autofinancement net HLM 2025', pct(r.netSelfFinancing.shownRatio), k3],
      ['Moyenne sur les trois derniers exercices', pct(avg)],
    ]);
    const k2 = b.clue('A14', 'management', `Le taux de vacance annoncé (${pct(r.vacancy.shownRate)}) n’est pas défini et exclut la vacance technique, à la différence de 2024.`, ['A14.ii']);
    b.fields([['Taux de vacance', pct(r.vacancy.shownRate), k2]]);
    b.h('Délais de paiement des fournisseurs (factures reçues non réglées à la date de clôture dont le terme est échu)');
    const k1 = b.clue('A14', 'management', 'Le tableau des délais de paiement indique qu’aucune facture échue n’était impayée à la clôture.', ['A14.i']);
    b.table(['', '1 à 30 jours', '31 à 60 jours', '61 à 90 jours', '91 jours et plus', 'Total'], [
      { cells: ['Nombre de factures', '0', '0', '0', '0', String(r.paymentTerms.shown.count)], clue: k1 },
      ['Montant total TTC', euro0(0), euro0(0), euro0(0), euro0(0), euro0(r.paymentTerms.shown.amount)],
    ]);
    docs.push(b.build());
  }

  // --- tableau des immobilisations et immobilisations en cours (A01) --------
  {
    const tables = buildAnnex(c.presented, c.params, 'current');
    const wip = wipByProgramme(c.presented);
    const b = new DocBuilder({ id: 'tableau-immobilisations', title: 'Tableau des immobilisations 2025 et détail des immobilisations en cours par opération', category: 'accounting', date: '2026-02-06', issuer: ENTITY_HEADER(c) });
    annexTableBlock(b, tables.find((t) => t.id === 'immobilisations')!);
    const k1 = b.clue('A01', 'accounting', `${progName(c, 'TIL')} figurent toujours en immobilisations en cours au 31/12/2025.`);
    b.table(['Opération', 'Immobilisations en cours au 31/12/2025'], [...wip.entries()].sort((x, y) => y[1] - x[1]).map(([p, v]) => ({ cells: [progName(c, p), euro0(v)], ...(p === 'TIL' ? { clue: k1 } : {}) })), { title: 'Détail des immobilisations en cours' });
    const mes = c.presented.ledgers.current.entries.filter((e) => e.pieceRef?.startsWith('MES-'));
    const k2 = b.clue('A01', 'accounting', 'Aucune mise en service n’est enregistrée pour Les Tilleuls en 2025.');
    b.table(['Mises en service de l’exercice', 'Date', 'Montant'], mes.map((e) => [e.label, date(e.date), euro0(e.lines.reduce((s, l) => s + (l.account.startsWith('21') ? l.debit : 0), 0))]), { title: 'Mises en service 2025' });
    b.note('Liste exhaustive des mises en service comptabilisées en 2025.', k2);
    docs.push(b.build());
  }

  // --- registre des composants (A01, A02, A04, A06) --------------------------
  {
    const b = new DocBuilder({ id: 'registre-composants', title: 'Registre des composants – extraits (Les Érables, Les Peupliers, Les Glycines B, Les Tilleuls)', category: 'accounting', date: '2026-02-06', issuer: ENTITY_HEADER(c), availability: { kind: 'onRequest', request: 'Registre des immobilisations par composant', from: 'chiefAccountant' } });
    const active = (pid: string) => c.pd.components.filter((x) => x.programmeId === pid && x.inServiceDate <= '2025-12-31' && !(x.disposal && x.disposal.date <= '2025-12-31'));
    const row = (x: (typeof c.pd.components)[number]) => [x.building, x.label, date(x.inServiceDate), x.usefulLifeYears ? `${x.usefulLifeYears} ans` : '—', euro0(x.cost), euro0(x.cost - accumulatedDepreciation(x, '2025-12-31'))];
    const cols = ['Bâtiment', 'Composant', 'Mise en service', 'Durée', 'Valeur brute', 'Valeur nette au 31/12/2025'];
    const era = active('ERA').filter((x) => x.family === 'heating');
    const k2 = b.clue('A02', 'accounting', 'Deux composants « chauffage » sont actifs sur le même bâtiment des Érables : la chaufferie de 2008 et la pompe à chaleur de 2025.');
    b.table(cols, era.map((x) => ({ cells: row(x), clue: k2 })), { title: `${progName(c, 'ERA')} – famille chauffage` });
    const peu = active('PEU').filter((x) => x.inServiceDate.startsWith('2025'));
    const k6 = b.clue('A06', 'accounting', 'Un composant « travaux d’amélioration (agencements divers) » de 15 ans est créé aux Peupliers en 2025.');
    b.table(cols, peu.map((x) => ({ cells: row(x), clue: k6 })), { title: `${progName(c, 'PEU')} – composants mis en service en 2025` });
    const glb = active('GLB').filter((x) => x.operationId === 'OP-GLB-H2015');
    const k4 = b.clue('A04', 'accounting', 'Les composants de la réhabilitation des Glycines B restent amortis sur leur durée initiale malgré la démolition décidée.');
    b.table(cols, glb.slice(0, 6).map((x) => ({ cells: row(x), clue: k4 })), { title: `${progName(c, 'GLB')} – réhabilitation 2015 (extrait)` });
    const til = active('TIL');
    const k1 = b.clue('A01', 'accounting', 'Le registre ne comporte aucun composant pour Les Tilleuls.');
    b.p(til.length ? `${progName(c, 'TIL')} : ${til.length} composants.` : `${progName(c, 'TIL')} : aucun composant enregistré.`, k1);
    docs.push(b.build());
  }

  // --- tableau des subventions (A09, A01) -----------------------------------
  {
    const subs = c.pd.subsidies.filter((s) => s.decisionDate <= '2025-12-31');
    const due = (s: (typeof subs)[number]) => (s.cancelledOn && s.cancelledOn <= '2025-12-31' ? 0 : s.amount - s.receipts.filter((r) => r.date <= '2025-12-31').reduce((a, r) => a + r.amount, 0));
    const shown = subs.filter((s) => due(s) > 0 || s.programmeId === 'TIL');
    const b = new DocBuilder({ id: 'tableau-subventions', title: 'Tableau de suivi des subventions d’investissement (subventions à recevoir et opérations récentes)', category: 'accounting', date: '2026-02-06', issuer: ENTITY_HEADER(c) });
    const k9 = b.clue('A09', 'accounting', 'La subvention départementale des Charmes, accordée en 2021, reste intégralement à recevoir.');
    const k1 = b.clue('A01', 'accounting', 'Aucune quote-part des subventions des Tilleuls n’est virée au résultat en 2025.');
    b.table(['Subvention', 'Programme', 'Décision', 'Montant', 'Reste à recevoir', 'Quote-part cumulée'], shown.map((s) => ({
      cells: [s.id, progName(c, s.programmeId), date(s.decisionDate), euro0(s.amount), euro0(due(s)), euro0(accumulatedSubsidyRelease(s, c.pd.components, '2025-12-31'))],
      ...(s.programmeId === 'CHA' ? { clue: k9 } : s.programmeId === 'TIL' ? { clue: k1 } : {}),
    })), { align: ['left', 'left', 'left', 'right', 'right', 'right'] });
    docs.push(b.build());
  }

  // --- état de la dette (A08, A18) -----------------------------------------
  const schedules = new Map<string, LoanScheduleLine[]>();
  for (const l of c.pd.loanSchedules) schedules.set(l.loanId, [...(schedules.get(l.loanId) ?? []), l]);
  const at = '2025-12-31';
  const current = (id: string) => schedules.get(id)!.find((l) => l.periodStart <= at && at < l.dueDate);
  {
    const loans = c.pd.loans.filter((l) => l.refDate <= at);
    const b = new DocBuilder({ id: 'etat-dette', title: 'État de la dette au 31/12/2025', category: 'accounting', date: '2026-01-14', issuer: ENTITY_HEADER(c) });
    const la = loans.filter((l) => l.rate.kind === 'livretA').map((l) => current(l.id)?.ratePct ?? 0);
    const k8 = b.clue('A08', 'accounting', `Les taux en vigueur des prêts indexés sur le Livret A vont de ${pts(Math.min(...la))} à ${pts(Math.max(...la))} selon la date de révision et la marge de chaque produit.`);
    const byLender = new Map<string, number>();
    const rows = loans.map((l) => {
      const crd = outstandingAt(l, schedules.get(l.id)!, at);
      byLender.set(l.lenderId, (byLender.get(l.lenderId) ?? 0) + crd);
      const cur = current(l.id);
      const rate = l.rate.kind === 'fixed' ? `fixe ${pts(l.rate.ratePct)}` : l.rate.kind === 'livretA' ? `LA + ${pts(l.rate.marginPct)}` : `0 % puis LA + ${pts(l.rate.marginPct)}`;
      return { cells: [l.contractNumber, tpName(c, l.lenderId), l.product, l.programmeId ? progName(c, l.programmeId) : '—', euro0(crd), rate, cur ? pts(cur.ratePct) : '—', cur ? date(cur.dueDate) : '—'], ...(l.rate.kind === 'livretA' ? { clue: k8 } : {}) };
    });
    b.table(['Contrat', 'Prêteur', 'Produit', 'Programme', 'Capital restant dû', 'Taux', 'Taux en vigueur', 'Prochaine échéance'], rows, { align: ['left', 'left', 'left', 'left', 'right', 'left', 'right', 'left'] });
    const k18 = b.clue('A18', 'accounting', `L’état de la dette arrête le capital dû à la Banque des Territoires à ${meuro(byLender.get('BDT') ?? 0)}.`);
    b.table(['Prêteur', 'Capital restant dû'], [...byLender.entries()].map(([id, v]) => ({ cells: [tpName(c, id), euro0(v)], ...(id === 'BDT' ? { clue: k18 } : {}) })), { title: 'Récapitulatif par prêteur', footer: ['Total', euro0([...byLender.values()].reduce((s, v) => s + v, 0))] });
    docs.push(b.build());
  }

  // --- calcul des ICNE (A08) -------------------------------------------------
  {
    const icne = c.presented.ledgers.current.entries.find((e) => e.pieceRef === 'INV2025-ICNE')!;
    const loans = new Map(c.pd.loans.map((l) => [l.id, l]));
    const b = new DocBuilder({ id: 'calcul-icne', title: 'Calcul des intérêts courus non échus au 31/12/2025 (fichier ICNE_2025.xlsx)', category: 'accounting', date: '2026-01-14', issuer: ENTITY_HEADER(c), availability: { kind: 'onRequest', request: 'Fichier de calcul des intérêts courus', from: 'chiefAccountant' } });
    const flat = c.params.anomalies.A08.flatRatePct;
    const k = b.clue('A08', 'accounting', `Les intérêts courus des prêts indexés sont calculés au taux unique de ${pts(flat)}, quel que soit le taux de chaque prêt.`);
    b.p(`Méthode : capital restant dû × taux × nombre de jours depuis la dernière échéance / 365. Prêts indexés sur le Livret A : taux forfaitaire de ${pts(flat)} (« taux du Livret A + marge moyenne »).`, k);
    const rows = icne.lines.filter((l) => l.account === '1688').map((l) => {
      const loan = loans.get(l.refs?.find((r) => r.startsWith('loan:'))?.slice(5) ?? '');
      if (!loan) return ['?', '', '', '', euro(l.credit)];
      const cur = current(loan.id)!;
      const days = daysBetween(cur.periodStart, addDays(at, 1));
      const rate = loan.rate.kind === 'livretA' ? flat : cur.ratePct;
      return [loan.contractNumber, euro0(outstandingAt(loan, schedules.get(loan.id)!, at)), pts(rate), String(days), euro(l.credit)];
    });
    b.table(['Contrat', 'Capital restant dû', 'Taux retenu', 'Jours', 'ICNE'], rows, { footer: ['Total', '', '', '', euro(icne.lines.find((l) => l.account === '6611')!.debit)] });
    docs.push(b.build());
  }

  // --- tableau des provisions (A05) -----------------------------------------
  {
    const pge = c.pd.pge.find((p) => p.year === 2025)!;
    const works = c.pd.invoices.filter((i) => i.serviceYear === 2025 && i.category === 'gros_entretien_pge').reduce((s, i) => s + i.total, 0);
    const b = new DocBuilder({ id: 'tableau-provisions', title: 'Tableau des provisions et dépréciations 2025 (dossier de clôture)', category: 'accounting', date: '2026-01-30', issuer: ENTITY_HEADER(c) });
    const k = b.clue('A05', 'accounting', `La reprise de PGE (${meuro(pge.reprise)}) excède les travaux de gros entretien provisionnés réalisés en 2025 (${meuro(works)}).`);
    b.table(['Provision pour gros entretien', 'Montant'], [
      ['Solde au 01/01/2025', euro0(pge.opening)],
      ['Dotation 2025 (plan pluriannuel d’entretien)', euro0(pge.dotation)],
      { cells: ['Reprise 2025', euro0(pge.reprise)], clue: k },
      ['Solde au 31/12/2025', euro0(pge.closing)],
    ]);
    b.fields([['Travaux de gros entretien provisionnés réalisés en 2025 (comptes 61522)', euro0(works)]]);
    const dep = (acc: string[]) => ({ dot: creditsOn(c.presented, acc), bal: creditOf(c.pb, acc) });
    const tenants = dep(['4911', '4915', '4916']);
    const foyers = dep(['4914']);
    b.table(['Dépréciations', 'Dotations 2025', 'Solde au 31/12/2025'], [
      ['Créances locatives', euro0(tenants.dot), euro0(tenants.bal)],
      ['Créances sur gestionnaires de foyers', euro0(foyers.dot), euro0(foyers.bal)],
    ]);
    b.sign(cfo.name, cfo.role);
    docs.push(b.build());
  }

  // --- PPE : version officielle et version de la DAF (A05) -----------------
  const daf = c.facts.documents['pge.dafVersion'] as { file: string; postponedItemIds: string[] } | undefined;
  {
    const items = c.cd.maintenancePlan.filter((it) => it.plannedYear >= 2026);
    const b = new DocBuilder({ id: 'ppe-officiel', title: `Plan pluriannuel d’entretien 2026-2030 – direction du patrimoine (version du ${date(c.params.anomalies.A05.officialPlanDate)})`, category: 'accounting', date: c.params.anomalies.A05.officialPlanDate, issuer: `${ENTITY_HEADER(c)} – direction du patrimoine`, availability: { kind: 'onRequest', request: 'Plan pluriannuel d’entretien de la direction du patrimoine', from: 'assetDirector' } });
    const k = b.clue('A05', 'management', 'Le PPE officiel maintient le ravalement des Acacias en 2026 et l’étanchéité du Belvédère en 2027.');
    b.table(['Opération', 'Programme', 'Nature', 'Année prévue', 'Montant estimé'], items.map((it) => ({ cells: [it.id, progName(c, it.programmeId), it.nature, String(it.plannedYear), euro0(it.amount)], ...(it.programmeId === 'ACA' || it.programmeId === 'BEL' ? { clue: k } : {}) })), { align: ['left', 'left', 'left', 'right', 'right'] });
    b.sign(person(c, 'assetDirector').name, person(c, 'assetDirector').role, c.params.anomalies.A05.officialPlanDate);
    docs.push(b.build());
  }
  {
    const items = c.cd.maintenancePlan.filter((it) => it.plannedYear >= 2026);
    const postponed = new Set(daf?.postponedItemIds ?? []);
    const b = new DocBuilder({ id: 'ppe-daf', title: `Calcul de la provision pour gros entretien au 31/12/2025 (${daf?.file ?? c.params.anomalies.A05.dafFile})`, category: 'accounting', date: '2026-01-29', issuer: `${ENTITY_HEADER(c)} – direction financière` });
    const k = b.clue('A05', 'accounting', 'Dans le fichier de la DAF, le ravalement des Acacias et l’étanchéité du Belvédère sont « reportés » et ne sont plus provisionnés.');
    b.table(['Opération', 'Programme', 'Nature', 'Année', 'Provision au 31/12/2025'], items.map((it) => postponed.has(it.id)
      ? { cells: [it.id, progName(c, it.programmeId), it.nature, 'reporté', euro0(0)], clue: k }
      : { cells: [it.id, progName(c, it.programmeId), it.nature, String(it.plannedYear), euro0(it.provision.y2025)] }), { align: ['left', 'left', 'left', 'right', 'right'], footer: ['Total', '', '', '', euro0(c.pd.pge.find((p) => p.year === 2025)!.closing)] });
    docs.push(b.build());
  }

  // --- calcul de la dépréciation des créances (A07, A15) --------------------
  {
    const pm = c.params.scenario.tenants.presentedMethod;
    const m = c.params.scenario.tenants.cleanMethod;
    let former = 0;
    let over6 = 0;
    let discharge = 0;
    let proc = 0;
    for (const t of c.pd.tenants) {
      const y = t.byYear.y2025;
      if (!y || y.balance <= 0) continue;
      if (y.category === 'former') former += Math.max(0, y.balance - y.depositHeld);
      else if (y.category === 'presentOver6m') {
        over6 += y.balance;
        if (c.cd.tenants.find((x) => x.id === t.id)?.writeOff?.reason === 'debtDischarge') discharge += y.balance;
      } else if (y.category === 'procedure') proc += y.balance;
    }
    const ah = managerReceivable(c.params, 'ACCUEIL_HORIZONS', '2025-12-31');
    // rates actually applied: allowance booked / base
    const rate = (acc: string, base: number) => (base === 0 ? 0 : creditOf(c.pb, [acc]) / base);
    const formerRate = rate('4915', former);
    const managerRate = rate('4914', ah);
    const b = new DocBuilder({ id: 'calcul-depreciation-creances', title: 'Calcul de la dépréciation des créances locatives au 31/12/2025 (fichier de la direction financière)', category: 'accounting', date: '2026-01-22', issuer: `${ENTITY_HEADER(c)} – direction financière` });
    const ka = b.clue('A07', 'accounting', `Le taux appliqué aux ex-locataires est ramené à ${pct(pm.formerRate, 0)} « compte tenu du nouveau prestataire de recouvrement ».`, ['A07.a']);
    const kb = b.clue('A07', 'accounting', 'Les dossiers de rétablissement personnel avec effacement sont maintenus parmi les locataires présents de plus de six mois, à 50 %.', ['A07.b']);
    const k15 = b.clue('A15', 'accounting', `La créance sur Accueil Horizons (${keuro(ah)}) n’est pas dépréciée.`);
    b.table(['Catégorie', 'Base', 'Taux', 'Dépréciation'], [
      { cells: ['Ex-locataires (solde net des dépôts conservés)', euro0(former), pct(formerRate, 0), euro0(Math.round(former * formerRate))], clue: ka },
      ['Locataires présents – ancienneté supérieure à 6 mois', euro0(over6), pct(m.over6mRate, 0), euro0(Math.round(over6 * m.over6mRate))],
      { cells: ['  dont dossiers de rétablissement personnel (décisions 2025)', euro0(discharge), pct(m.over6mRate, 0), euro0(Math.round(discharge * m.over6mRate))], clue: kb },
      ['Dossiers en procédure et surendettement', euro0(proc), pct(m.procedureRate, 0), euro0(Math.round(proc * m.procedureRate))],
      { cells: [`Redevances du foyer ${progName(c, 'PHA')} (${tpName(c, 'ACCUEIL_HORIZONS')})`, euro0(ah), pct(managerRate, 0), euro0(Math.round(ah * managerRate))], clue: k15 },
    ], { align: ['left', 'right', 'right', 'right'] });
    b.note('Commentaire de la DAF : taux des ex-locataires révisé à la suite de la mise en place d’un prestataire de recouvrement amiable ; partenaire historique (foyer), pas de risque identifié.');
    docs.push(b.build());
  }

  // --- balance âgée des locataires (A07-c, A15) -----------------------------
  {
    const buckets = [['≤ 3 mois', 0, 3], ['4 à 6 mois', 4, 6], ['7 à 12 mois', 7, 12], ['> 12 mois', 13, 999]] as const;
    const present = c.pd.tenants.filter((t) => t.byYear.y2025 && t.byYear.y2025.category !== 'former');
    const credit = present.reduce((s, t) => s + Math.min(0, t.byYear.y2025!.balance), 0);
    const b = new DocBuilder({ id: 'balance-agee-locataires', title: 'Balance âgée des comptes de locataires au 31/12/2025 (LOGIGES 2)', category: 'accounting', date: '2026-01-08', issuer: `${ENTITY_HEADER(c)} – gestion locative` });
    b.table(['Ancienneté de la dette (locataires présents)', 'Nombre', 'Montant'], buckets.map(([label, lo, hi]) => {
      const sel = present.filter((t) => t.byYear.y2025!.balance > 0 && t.byYear.y2025!.ageMonths >= lo && t.byYear.y2025!.ageMonths <= hi);
      return [label, String(sel.length), euro0(sel.reduce((s, t) => s + t.byYear.y2025!.balance, 0))];
    }));
    const kc = b.clue('A07', 'management', `Les soldes créditeurs de locataires présents s’élèvent à ${keuro(-credit)} : ils sont compensés avec les soldes débiteurs dans les comptes.`, ['A07.c']);
    b.fields([
      ['Soldes créditeurs (trop-perçus, avances)', euro0(credit), kc],
      ['Locataires partis (comptes 4115)', euro0(c.pd.tenants.reduce((s, t) => s + (t.byYear.y2025?.category === 'former' ? t.byYear.y2025.balance : 0), 0))],
    ]);
    const ah = managerReceivable(c.params, 'ACCUEIL_HORIZONS', '2025-12-31');
    const fee = c.params.programmes.find((p) => p.managerId === 'ACCUEIL_HORIZONS')!.monthlyFeeEuros ?? 0;
    const months = Math.round(ah / Math.round(fee * 100));
    const k15 = b.clue('A15', 'management', `Accueil Horizons n’a réglé aucune redevance depuis ${months} mois (${keuro(ah)}).`);
    b.table(['Gestionnaire de foyer', 'Redevances impayées', 'Nombre de mois'], [{ cells: [tpName(c, 'ACCUEIL_HORIZONS'), euro0(ah), String(months)], clue: k15 }], { title: 'Redevances des structures collectives' });
    docs.push(b.build());
  }
  return docs;
}
