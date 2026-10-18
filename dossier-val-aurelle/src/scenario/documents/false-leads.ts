/**
 * False leads (§6): observations as credible as real anomalies, explained by
 * documented facts. Dismissed with evidence they earn points; reported they
 * cost points, client relationship and partner trust.
 */
import { DocBuilder, ENTITY_HEADER, creditOf, debitOf, euro0, person, progName, type DocContext } from './context';
import type { DocumentModel, FalseLeadId } from './model';
import type { ObjectRef } from '../../engine/types';
import { acct, doc, tp } from '../anomalies/refs';
import type { Cycle } from '../anomalies/types';

/**
 * Matching signature of a false lead (plan J4 §13.2): cycles under which a
 * finding about it is recognised, its objects and, when neighbouring anomalies
 * share objects with it, the discriminating ones (at least one is required).
 */
export interface FalseLeadSignature {
  cycles: readonly Cycle[];
  objects: readonly ObjectRef[];
  keyObjects?: readonly ObjectRef[];
}

export interface FalseLead {
  id: FalseLeadId;
  title: string;
  /** What looks suspicious. */
  observation: string;
  /** Why it is not an anomaly. */
  explanation: string;
  /** Documents that dismiss it. */
  evidence: readonly string[];
  /** Reporting it without evidence hurts the client relationship (F4). */
  relationshipCost: 'normal' | 'high';
  signature: FalseLeadSignature;
}

export const FALSE_LEADS: readonly FalseLead[] = [
  { id: 'F1', title: 'Honoraires en forte hausse', observation: 'Les honoraires augmentent fortement entre 2024 et 2025.', explanation: 'Études préalables du renouvellement urbain des Glycines et actualisation du plan stratégique de patrimoine, autorisées par le conseil et contractualisées après consultation.', evidence: ['contrats-etudes-npnru', 'pv-ca-2025-03', 'psp-extraits'], relationshipCost: 'normal', signature: { cycles: ['purchases', 'crossCycle'], objects: [acct('6226'), doc('contrats-etudes-npnru'), doc('psp-extraits'), doc('pv-ca-2025-03')] } },
  { id: 'F2', title: 'Produit à recevoir sur dégrèvement de TFPB', observation: 'Produit à recevoir significatif sur un dégrèvement non encore notifié à la clôture.', explanation: 'Réclamation déposée le 15/12/2025 sur des travaux éligibles, historique d’acceptation intégrale, dégrèvement notifié en mars 2026 pour l’essentiel du montant : écart négligeable.', evidence: ['reclamation-tfpb', 'avis-degrevement-tfpb', 'etat-cap-par'], relationshipCost: 'normal', signature: { cycles: ['purchases', 'crossCycle'], objects: [acct('4487'), acct('7718'), tp('DGFIP'), doc('reclamation-tfpb'), doc('avis-degrevement-tfpb'), doc('etat-cap-par')], keyObjects: [doc('reclamation-tfpb'), doc('avis-degrevement-tfpb'), acct('4487')] } },
  { id: 'F3', title: 'Charges de personnel en hausse', observation: 'Les charges de personnel progressent nettement plus vite que l’inflation.', explanation: 'Accord salarial, prime de partage de la valeur, recrutement de gardiens et pourvoi de postes vacants.', evidence: ['accord-nao-2025', 'etat-effectifs-2025'], relationshipCost: 'normal', signature: { cycles: ['purchases', 'crossCycle'], objects: [acct('6411'), acct('6413'), doc('accord-nao-2025'), doc('etat-effectifs-2025')] } },
  { id: 'F4', title: 'Fournisseur dont le gérant porte le nom de la directrice du patrimoine', observation: 'Le gérant de Bâti-Rénov Est porte le même nom que la directrice du patrimoine.', explanation: 'Aucun lien de parenté (homonymie) ; marché attribué après mise en concurrence de quatre offres, au moins-disant, par une commission collégiale.', evidence: ['marche-bati-renov', 'attestation-absence-lien'], relationshipCost: 'high', signature: { cycles: ['purchases', 'fixedAssets', 'crossCycle'], objects: [tp('F0015'), doc('marche-bati-renov'), doc('attestation-absence-lien')], keyObjects: [tp('F0015'), doc('marche-bati-renov')] } },
  { id: 'F5', title: 'Taxe foncière en hausse', observation: 'La TFPB augmente nettement plus que l’inflation.', explanation: 'Revalorisation forfaitaire des bases et fin de périodes d’exonération sur plusieurs programmes.', evidence: ['tableau-fiscal-tfpb', 'avis-tfpb-2025'], relationshipCost: 'normal', signature: { cycles: ['purchases', 'crossCycle'], objects: [acct('63512'), tp('DGFIP'), doc('tableau-fiscal-tfpb'), doc('avis-tfpb-2025')] } },
  { id: 'F6', title: 'Chèques en suspens au rapprochement bancaire', observation: 'Des règlements émis ne sont pas débités à la clôture.', explanation: 'Chèques émis fin décembre, tous débités début janvier 2026 : rapprochement correct.', evidence: ['rapprochement-bancaire', 'releve-bancaire-2026-01'], relationshipCost: 'normal', signature: { cycles: ['debtTreasury', 'crossCycle'], objects: [acct('5121'), doc('rapprochement-bancaire'), doc('releve-bancaire-2026-01')], keyObjects: [doc('rapprochement-bancaire')] } },
  { id: 'F7', title: 'Écritures du week-end saisies par l’utilisateur MIGRATION', observation: 'Écritures d’opérations diverses passées un week-end par un utilisateur technique.', explanation: 'Reprise des soldes des comptes de locataires lors de la migration, rapprochée programme par programme et signée.', evidence: ['note-migration', 'rapprochement-reprise-soldes'], relationshipCost: 'normal', signature: { cycles: ['rentReceivables', 'crossCycle'], objects: [acct('4111'), doc('note-migration'), doc('rapprochement-reprise-soldes')], keyObjects: [doc('note-migration'), doc('rapprochement-reprise-soldes')] } },
];

/** Supporting documents added for false leads and for a second independent clue of A18 and A21. */
export function supportDocuments(c: DocContext): DocumentModel[] {
  const docs: DocumentModel[] = [];
  const chief = person(c, 'chiefAccountant');

  // --- balance générale (extrait) : A18, A21 ---------------------------------
  {
    const b = new DocBuilder({ id: 'balance-generale-2025', title: 'Balance générale au 31/12/2025 (extrait remis avec le projet de comptes)', category: 'accounting', date: '2026-02-06', issuer: ENTITY_HEADER(c) });
    const k21 = b.clue('A21', 'accounting', `La balance fait apparaître ${euro0(debitOf(c.pb, ['68174']))} de dotations aux dépréciations des créances (compte 68174).`);
    const k18 = b.clue('A18', 'accounting', `Le compte d’attente 471 est créditeur de ${euro0(creditOf(c.pb, ['471']))} à la clôture.`);
    const rows: [string, string, string, string?][] = [
      ['1631', 'Emprunts auprès de la Caisse des dépôts', euro0(creditOf(c.pb, ['1631']))],
      ['1651', 'Dépôts de garantie des locataires', euro0(creditOf(c.pb, ['1651']))],
      ['471', 'Compte d’attente', euro0(creditOf(c.pb, ['471'])), k18],
      ['4687', 'Divers – produits à recevoir', euro0(debitOf(c.pb, ['4687']))],
      ['68174', 'Dotations aux dépréciations des créances', euro0(debitOf(c.pb, ['68174'])), k21],
      ['78174', 'Reprises sur dépréciations des créances', euro0(creditOf(c.pb, ['78174']))],
    ];
    b.table(['Compte', 'Libellé', 'Solde'], rows.map(([a, l, v, k]) => ({ cells: [a, l, v], ...(k ? { clue: k } : {}) })), { align: ['left', 'left', 'right'] });
    docs.push(b.build());
  }

  // --- F3 : état des effectifs -----------------------------------------------
  {
    const pr = c.params.scenario.payroll;
    const b = new DocBuilder({ id: 'etat-effectifs-2025', title: 'État des effectifs et des mouvements de personnel 2025', category: 'accounting', date: '2026-01-15', issuer: `${ENTITY_HEADER(c)} – ressources humaines` });
    const k = b.clue('F3', 'management', `L’effectif moyen passe de ${pr.headcount['2024']} à ${pr.headcount['2025']} salariés (recrutement de gardiens, postes vacants pourvus).`);
    b.table(['', '2024', '2025'], [{ cells: ['Effectif moyen', String(pr.headcount['2024']), String(pr.headcount['2025'])], clue: k }, ['dont gardiens', String(pr.caretakers.count - c.d.F3.recruitedCaretakers), String(pr.caretakers.count)]]);
    docs.push(b.build());
  }

  // --- F5 : avis de taxe foncière 2025 ------------------------------------------
  {
    const t24 = debitOf(c.b24, ['63512']);
    const t25 = debitOf(c.pb, ['63512']);
    const ended = c.cd.taxNotices.filter((n) => n.year === 2025 && n.tfpb > 0 && (c.cd.taxNotices.find((m) => m.year === 2024 && m.programmeId === n.programmeId)?.tfpb ?? 0) === 0);
    const b = new DocBuilder({ id: 'avis-tfpb-2025', title: 'Avis de taxe foncière 2025 (récapitulatif)', category: 'mail', date: '2025-09-10', issuer: 'Direction générale des finances publiques', recipient: c.params.scenario.entity.name });
    const k = b.clue('F5', 'thirdParty', `L’avis 2025 fait apparaître la revalorisation des bases et l’imposition de ${ended.length} programmes sortis d’exonération.`);
    b.fields([['Taxe foncière 2025', euro0(t25)], ['Rappel 2024', euro0(t24)], ['Programmes imposés pour la première fois (fin d’exonération)', ended.map((n) => progName(c, n.programmeId)).join(', ') || '—', k]]);
    docs.push(b.build());
  }

  // --- F7 : rapprochement de la reprise des soldes -------------------------
  {
    const odm = c.presented.ledgers.current.entries.filter((e) => e.enteredBy === c.params.scenario.users.migration);
    const b = new DocBuilder({ id: 'rapprochement-reprise-soldes', title: 'Rapprochement de la reprise des soldes des locataires (migration LOGIGES 2)', category: 'accounting', date: c.d.F7.signOffDate, issuer: ENTITY_HEADER(c), availability: { kind: 'onRequest', request: 'Dossier de migration du système d’information', from: 'chiefAccountant' } });
    const k = b.clue('F7', 'accounting', 'La reprise des soldes est rapprochée programme par programme, sans écart, et signée par le chef comptable.');
    b.table(['Programme', 'Solde ancien auxiliaire', 'Solde repris', 'Écart'], odm.map((e) => {
      const x = e.lines.find((l) => l.debit > 0)!.debit;
      return { cells: [e.label.split(' – ').pop() ?? '', euro0(x), euro0(x), euro0(0)], clue: k };
    }), { align: ['left', 'right', 'right', 'right'] });
    b.sign(chief.name, chief.role, c.d.F7.signOffDate);
    docs.push(b.build());
  }
  return docs;
}
