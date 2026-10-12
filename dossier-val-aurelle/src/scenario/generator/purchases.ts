/**
 * Supplier invoices (operating expenses and investments), payroll, caretakers,
 * property taxes, maintenance plan (PGE) and recoverable-charges regularisation.
 */
import { addDays, endOfMonth, isoDate, weekday } from '../../engine/dates';
import { allocate, type Cents } from '../../engine/money';
import type { Rng } from '../../engine/rng';
import type { AssetComponent, ComponentFamily } from '../../engine/types';
import { accumulatedDepreciation } from '../../engine/subledgers/depreciation';
import type { Caretaker, ChargesRegularisation, Invoice, MaintenancePlanItem, PayrollMonth, TaxNotice } from '../datasets';
import { addComponent, addOperation, retire, spreadOverBuildings, suppliersOf } from './portfolio';
import { eur, type GenState } from './core';
import type { RentRoll } from './tenancy';

const YEARS = [2024, 2025] as const;

let invoiceSeq = 0;

/** Must be called at the start of each generation (the counter is module state). */
export function resetInvoiceCounter(): void {
  invoiceSeq = 0;
}

function nextThursday(date: string): string {
  let d = date;
  while (weekday(d) !== 4) d = addDays(d, 1);
  return d;
}

interface InvoiceSpec {
  supplierId: string;
  invoiceDate: string;
  receivedDate?: string;
  lines: Invoice['lines'];
  description: string;
  serviceYear: number;
  category: string;
  paymentDays?: number;
  orderRef?: string;
}

function emit(st: GenState, rng: Rng, spec: InvoiceSpec): Invoice {
  invoiceSeq++;
  const total = spec.lines.reduce((s, l) => s + l.amount, 0);
  const received = spec.receivedDate ?? addDays(spec.invoiceDate, rng.int(2, 9));
  const due = addDays(spec.invoiceDate, spec.paymentDays ?? 30);
  const paid = nextThursday(addDays(due, rng.int(-6, 8)));
  const inv: Invoice = {
    id: `FA${String(invoiceSeq).padStart(5, '0')}`,
    supplierId: spec.supplierId,
    number: `${spec.supplierId.slice(1)}-${spec.invoiceDate.slice(2, 4)}${String(invoiceSeq % 9973).padStart(4, '0')}`,
    invoiceDate: spec.invoiceDate,
    receivedDate: received,
    dueDate: due,
    paidDate: paid < received ? nextThursday(received) : paid,
    lines: spec.lines,
    total,
    description: spec.description,
    serviceYear: spec.serviceYear,
    category: spec.category,
  };
  if (spec.orderRef) inv.orderRef = spec.orderRef;
  st.invoices.push(inv);
  return inv;
}

/** Programme weights for recoverable natures. */
function programmeWeights(st: GenState, nature: string, collectiveOnly: boolean): Map<string, number> {
  const w = new Map<string, number>();
  for (const p of st.params.programmes) {
    if (p.kind !== 'family') continue;
    if (collectiveOnly && p.heating !== 'collective') continue;
    if (p.id === 'MAR') continue; // co-ownership: charges called by the syndic
    if (nature === 'ascenseurs' && p.pavilions) continue;
    const units = p.id === 'TIL' ? 52 * 0.5 : p.units;
    w.set(p.id, units);
  }
  return w;
}

function splitLines(total: Cents, weights: Map<string, number>, account: string, nature: string): Invoice['lines'] {
  const ids = [...weights.keys()];
  const parts = allocate(total, ids.map((i) => weights.get(i)!));
  return ids.map((programmeId, k) => ({ account, programmeId, amount: parts[k]!, nature })).filter((l) => l.amount !== 0);
}

const NATURE_SUPPLIER: Record<string, string> = {
  eau: 'F0002',
  chauffage: 'F0001',
  electricite_pc: 'F0003',
  ascenseurs: 'F0004',
  espaces_verts: 'F0005',
  nettoyage: 'F0006',
  contrats_entretien: 'F0007',
};

const NATURE_LABEL: Record<string, string> = {
  eau: 'Fourniture d’eau froide et chaude',
  chauffage: 'Fourniture d’énergie – chauffage collectif',
  electricite_pc: 'Électricité des parties communes',
  ascenseurs: 'Contrat d’entretien des ascenseurs',
  espaces_verts: 'Entretien des espaces verts',
  nettoyage: 'Nettoyage des parties communes',
  contrats_entretien: 'Contrats d’entretien (robinetterie, chaudières, sécurité incendie)',
};

/** Recurring recoverable charges, monthly (water: quarterly), split by programme. */
function recoverableInvoices(st: GenState, rng: Rng, scale: number): void {
  const ch = st.params.scenario.charges;
  for (const [nature, spec] of Object.entries(ch.recoverable)) {
    const weights = programmeWeights(st, nature, !!spec.collectiveOnly);
    const quarterly = nature === 'eau';
    for (const year of YEARS) {
      const total = Math.round(spec[String(year) as '2024' | '2025'] * scale * 100);
      const periods = quarterly ? 4 : 12;
      const seasonal = (k: number) => (nature === 'chauffage' ? [1.8, 1.6, 1.3, 0.8, 0.3, 0.1, 0.1, 0.1, 0.2, 0.8, 1.4, 1.7][k]! : 1);
      const periodWeights = Array.from({ length: periods }, (_, k) => (quarterly ? 1 : seasonal(k)) * rng.uniform(0.95, 1.05));
      const perPeriod = allocate(total, periodWeights);
      perPeriod.forEach((amount, k) => {
        const endMonth = quarterly ? (k + 1) * 3 : k + 1;
        const end = endOfMonth(year, endMonth);
        const invoiceDate = addDays(end, rng.int(4, 12));
        emit(st, rng, {
          supplierId: NATURE_SUPPLIER[nature]!,
          invoiceDate,
          lines: splitLines(amount, weights, spec.account, nature),
          description: `${NATURE_LABEL[nature]} – ${quarterly ? `${k + 1}e trimestre` : `période ${String(endMonth).padStart(2, '0')}`}/${year}`,
          serviceYear: year,
          category: nature,
          paymentDays: 30,
        });
      });
    }
  }
  // services of December 2023 invoiced in January 2024 (accrued at 31/12/2023)
  const fnp2023 = eur(st.params.scenario.openingBalances2023['invoicesNotReceivedEuros']!);
  const natures = ['chauffage', 'electricite_pc', 'nettoyage', 'espaces_verts'];
  const parts = allocate(fnp2023, [0.55, 0.15, 0.2, 0.1]);
  natures.forEach((nature, i) => {
    const spec = ch.recoverable[nature]!;
    emit(st, rng, {
      supplierId: NATURE_SUPPLIER[nature]!,
      invoiceDate: isoDate(2024, 1, 5 + i),
      lines: splitLines(parts[i]!, programmeWeights(st, nature, !!spec.collectiveOnly), spec.account, nature),
      description: `${NATURE_LABEL[nature]} – période 12/2023`,
      serviceYear: 2023,
      category: nature,
    });
  });
}

/** Co-ownership calls of the syndic (Les Marronniers): current charges and syndic fees. */
function coOwnershipInvoices(st: GenState, rng: Rng): void {
  const co = st.params.scenario.charges.coOwnership;
  for (const year of YEARS) {
    const charges = allocate(eur(co.currentChargesEuros[String(year)]!), [1, 1, 1, 1]);
    const fees = allocate(eur(co.syndicFeesEuros[String(year)]!), [1, 1, 1, 1]);
    for (let q = 0; q < 4; q++) {
      emit(st, rng, {
        supplierId: 'F0045',
        invoiceDate: isoDate(year, q * 3 + 1, 10),
        lines: [
          { account: '614', programmeId: 'MAR', amount: charges[q]!, nature: 'copropriete_charges' },
          { account: '614', programmeId: 'MAR', amount: fees[q]!, nature: 'honoraires_syndic' },
        ],
        description: `Appel de fonds de copropriété – Les Marronniers – ${q + 1}e trimestre ${year} (charges courantes et honoraires du syndic)`,
        serviceYear: year,
        category: 'syndic',
      });
    }
  }
}

/** Non-recoverable operating expenses. */
function operatingInvoices(st: GenState, rng: Rng): void {
  const nr = st.params.scenario.charges.nonRecoverable;
  const family = st.params.programmes.filter((p) => p.kind === 'family' && p.id !== 'TIL');
  for (const year of YEARS) {
    for (const [key, spec] of Object.entries(nr)) {
      let total = Math.round(spec[String(year) as '2024' | '2025'] * 100);
      if (key === 'entretien_courant') total = eur(year === 2024 ? st.levers.maintenance2024Euros : st.levers.maintenance2025Euros);
      if (total <= 0) continue;
      if (key === 'assurances') continue; // see insuranceInvoices
      switch (key) {
        case 'entretien_courant': {
          const n = year === 2024 ? 3150 : 3300;
          const suppliers = suppliersOf(st, 'entretien');
          const amounts = allocate(total, Array.from({ length: n }, () => rng.lognormal(1, 1.05)));
          amounts.forEach((amount, i) => {
            const p = rng.weightedPick(family, family.map((f) => f.units));
            const supplier = rng.pick(suppliers);
            const date = isoDate(year, 1 + Math.floor((i / n) * 12), rng.int(1, 27));
            emit(st, rng, {
              supplierId: supplier,
              invoiceDate: date,
              lines: [{ account: '61521', programmeId: p.id, amount, nature: 'entretien' }],
              description: rng.pick(['Dépannage plomberie', 'Remplacement de serrure', 'Remise en état de logement', 'Réparation de volet roulant', 'Intervention électrique', 'Remplacement de vitrage', 'Reprise de peinture', 'Débouchage de colonne', 'Réparation de porte de hall', 'Remise en état après sinistre']) + ` – ${p.name}`,
              serviceYear: year,
              category: 'entretien',
              orderRef: `BC${year}-${String(i + 1).padStart(4, '0')}`,
              paymentDays: 45,
            });
          });
          break;
        }
        case 'gros_entretien_hors_pge': {
          const amounts = allocate(total, [1, 1.3, 0.8, 1.1, 0.9, 1.2]);
          amounts.forEach((amount, i) => {
            const p = rng.weightedPick(family, family.map((f) => f.units));
            emit(st, rng, {
              supplierId: rng.pick(suppliersOf(st, 'gros_entretien')),
              invoiceDate: isoDate(year, 2 + i * 2, rng.int(5, 25)),
              lines: [{ account: '61522', programmeId: p.id, amount, nature: 'gros_entretien' }],
              description: `Travaux de gros entretien non programmés – ${p.name}`,
              serviceYear: year,
              category: 'gros_entretien',
              paymentDays: 45,
            });
          });
          break;
        }
        case 'gie': {
          const months = allocate(total, new Array(12).fill(1));
          months.forEach((amount, m) =>
            emit(st, rng, {
              supplierId: 'F0027',
              invoiceDate: isoDate(year, m + 1, 25),
              lines: [{ account: spec.account, amount, nature: 'gie' }],
              description: `Refacturation des frais de structure du groupe – ${String(m + 1).padStart(2, '0')}/${year} (convention de groupe, clé de répartition)`,
              serviceYear: year,
              category: 'gie',
            }),
          );
          break;
        }
        default: {
          const monthly = ['informatique', 'telecom', 'banque', 'locations'].includes(key);
          const quarterly = ['cglls'].includes(key);
          const count = monthly ? 12 : quarterly ? 4 : rng.int(6, 14);
          const amounts = allocate(total, Array.from({ length: count }, () => (monthly || quarterly ? 1 : rng.lognormal(1, 0.7))));
          const pool = suppliersOf(st, key === 'autres_services' ? 'autres_services' : key);
          amounts.forEach((amount, i) => {
            const month = monthly ? i + 1 : quarterly ? i * 3 + 2 : rng.int(1, 12);
            emit(st, rng, {
              supplierId: pool.length > 0 ? rng.pick(pool) : 'F0046',
              invoiceDate: isoDate(year, month, rng.int(3, 24)),
              lines: [{ account: spec.account, amount, nature: key }],
              description: describe(key, year, rng),
              serviceYear: year,
              category: key,
            });
          });
        }
      }
    }
    // year-end complement of the group GIE (invoiced in January of the next year)
    const complement = eur(st.params.scenario.charges.gieYearEndComplementEuros[String(year)] ?? 0);
    if (complement > 0) {
      emit(st, rng, {
        supplierId: 'F0027',
        invoiceDate: isoDate(year + 1, 1, 20),
        lines: [{ account: '6281', amount: complement, nature: 'gie' }],
        description: `Complément de frais de structure ${year} (régularisation annuelle de la clé de répartition)`,
        serviceYear: year,
        category: 'gie',
      });
    }
  }
}

function describe(key: string, year: number, rng: Rng): string {
  switch (key) {
    case 'honoraires':
      return rng.pick(
        year === 2025
          ? ['Études préalables NPNRU – quartier des Glycines', 'Actualisation du plan stratégique de patrimoine', 'Honoraires du commissaire aux comptes', 'Diagnostics techniques', 'Assistance juridique']
          : ['Honoraires du commissaire aux comptes', 'Diagnostics techniques', 'Assistance juridique', 'Expertise immobilière'],
      );
    case 'actes_contentieux':
      return 'Frais d’huissier – procédures de recouvrement';
    case 'cglls':
      return 'Cotisation à la CGLLS';
    case 'informatique':
      return 'Maintenance et hébergement des applications';
    case 'telecom':
      return 'Abonnements téléphonie et réseaux';
    case 'banque':
      return 'Frais de tenue de compte et commissions';
    case 'annonces':
      return 'Annonces légales et appels d’offres';
    case 'locations':
      return 'Location de véhicules et de copieurs';
    case 'fournitures':
      return 'Fournitures de bureau et petits équipements';
    case 'recouvrement_amiable':
      return 'Commissions de recouvrement amiable des créances d’ex-locataires';
    default:
      return 'Prestations diverses';
  }
}

/** Insurance: annual premium from 1 July to 30 June (prepaid half at year end). */
function insuranceInvoices(st: GenState, rng: Rng): Map<number, Cents> {
  const prepaid = new Map<number, Cents>();
  prepaid.set(2023, eur(st.params.scenario.openingBalances2023['prepaidInsuranceEuros']!));
  const nr = st.params.scenario.charges.nonRecoverable['assurances']!;
  for (const year of YEARS) {
    const expense = eur(nr[String(year) as '2024' | '2025']);
    const premium = 2 * (expense - prepaid.get(year - 1)!);
    prepaid.set(year, Math.round(premium / 2));
    emit(st, rng, {
      supplierId: 'F0026',
      invoiceDate: isoDate(year, 6, 20),
      lines: [{ account: '616', amount: premium, nature: 'assurances' }],
      description: `Prime d’assurance multirisque immeubles – période du 01/07/${year} au 30/06/${year + 1}`,
      serviceYear: year,
      category: 'assurances',
    });
  }
  return prepaid;
}

// ---------------------------------------------------------------------------
// Investments
// ---------------------------------------------------------------------------

function situations(st: GenState, rng: Rng, spec: { supplierId: string; account: '2312' | '2313'; total: Cents; from: string; months: number; label: string; operationId: string; programmeId: string; year: number }): void {
  const parts = allocate(spec.total, Array.from({ length: spec.months }, () => rng.uniform(0.7, 1.3)));
  parts.forEach((amount, i) => {
    const date = endOfMonth(Number(spec.from.slice(0, 4)), Number(spec.from.slice(5, 7)) + i > 12 ? 12 : Number(spec.from.slice(5, 7)) + i);
    const inv = emit(st, rng, {
      supplierId: spec.supplierId,
      invoiceDate: date,
      lines: [{ account: spec.account, programmeId: spec.programmeId, amount, operationId: spec.operationId, nature: 'investissement' }],
      description: `${spec.label} – situation n° ${i + 1}`,
      serviceYear: spec.year,
      category: 'investissement',
      paymentDays: 45,
    });
    st.wip.push({ operationId: spec.operationId, programmeId: spec.programmeId, account: spec.account, date: inv.invoiceDate, amount, invoiceId: inv.id });
  });
}

export function investmentInvoices(st: GenState): void {
  const rng = st.rng.fork('investments');
  const sp = st.params.scenario.specific;
  const cs = st.params.components;

  // --- Les Tilleuls (construction 2023–2025) ---
  const t = sp.tilleuls;
  const til = addOperation(st, { id: 'OP-TIL-C2025', programmeId: 'TIL', kind: 'construction', label: 'Construction de 52 logements PLUS/PLAI – Les Tilleuls', year: 2025 });
  st.wip.push({ operationId: til.id, programmeId: 'TIL', account: '2312', date: '2023-02-10', amount: eur(t.landEuros) });
  st.wip.push({ operationId: til.id, programmeId: 'TIL', account: '2313', date: '2023-12-31', amount: eur(t.spentBefore2024Euros - t.landEuros) });
  situations(st, rng, { supplierId: 'F0022', account: '2313', total: eur(t.spent2024Euros * 0.94), from: '2024-01-31', months: 12, label: 'Les Tilleuls – marché de travaux en entreprise générale', operationId: til.id, programmeId: 'TIL', year: 2024 });
  situations(st, rng, { supplierId: 'F0023', account: '2313', total: eur(t.spent2024Euros * 0.06), from: '2024-03-31', months: 4, label: 'Les Tilleuls – honoraires de maîtrise d’œuvre', operationId: til.id, programmeId: 'TIL', year: 2024 });
  const remaining2025 = eur(t.costEuros - t.spentBefore2024Euros - t.spent2024Euros);
  situations(st, rng, { supplierId: 'F0022', account: '2313', total: remaining2025, from: '2025-01-31', months: 6, label: 'Les Tilleuls – marché de travaux en entreprise générale (dont décompte général, pénalités de retard déduites)', operationId: til.id, programmeId: 'TIL', year: 2025 });
  // components in service on 01/07/2025 (cost 9.55 M€) and OS n° 7 (210 k€, accrued at year end)
  addComponent(st, { programmeId: 'TIL', building: 'TIL-TER', family: 'land', operationId: til.id, cost: eur(t.landEuros), inServiceDate: t.inServiceDate, label: 'Terrain' });
  spreadOverBuildings(st, 'TIL', til.id, eur(t.costEuros - t.landEuros), cs.newConstructionShares, t.inServiceDate);
  spreadOverBuildings(st, 'TIL', til.id, eur(t.os7Euros), cs.newConstructionShares, t.inServiceDate, { suffix: '-OS7' });
  const tilDecisions = ['2022-11-18', '2023-02-09', '2023-05-23', '2023-01-17'];
  t.subsidies.forEach((s, i) => {
    const amount = eur(s.amountEuros);
    const receipts = i === 0 ? [{ date: '2023-06-15', amount: Math.round(amount * 0.3) }, { date: '2025-10-17', amount: amount - Math.round(amount * 0.3) }]
      : i === 1 ? [{ date: '2024-04-12', amount: Math.round(amount * 0.5) }]
      : i === 2 ? [{ date: '2024-09-20', amount: Math.round(amount * 0.4) }, { date: '2025-12-04', amount: Math.round(amount * 0.4) }]
      : [{ date: '2025-09-30', amount }];
    st.subsidies.push({ id: `SUB-TIL-C2025-${s.grantor}`, operationId: til.id, programmeId: 'TIL', grantorId: s.grantor, account: '', amount, decisionDate: tilDecisions[i]!, receipts });
  });

  // --- construction operations in progress (not yet delivered) ---
  for (const o of st.params.scenario.operationsInProgress) {
    const op = addOperation(st, { id: `OP-${o.id}-C${o.delivery.slice(0, 4)}`, programmeId: o.id, kind: 'construction', label: `Construction de ${o.units} logements – ${o.name}`, year: Number(o.delivery.slice(0, 4)) });
    if (o.landEuros > 0) {
      if (o.landDate <= '2023-12-31') st.wip.push({ operationId: op.id, programmeId: o.id, account: '2312', date: o.landDate, amount: eur(o.landEuros) });
      else {
        const inv = emit(st, rng, { supplierId: 'F0032', invoiceDate: o.landDate, lines: [{ account: '2312', programmeId: o.id, amount: eur(o.landEuros), operationId: op.id, nature: 'investissement' }], description: `${o.name} – acquisition du terrain (acte authentique)`, serviceYear: Number(o.landDate.slice(0, 4)), category: 'investissement', paymentDays: 5 });
        st.wip.push({ operationId: op.id, programmeId: o.id, account: '2312', date: inv.invoiceDate, amount: eur(o.landEuros), invoiceId: inv.id });
      }
    }
    const vefa = o.landEuros === 0;
    if (o.spent2024Euros > 0) situations(st, rng, { supplierId: vefa ? 'F0032' : 'F0022', account: '2313', total: eur(o.spent2024Euros), from: o.worksStart.startsWith('2024') ? endOfMonth(2024, Number(o.worksStart.slice(5, 7))) : '2024-01-31', months: o.worksStart.startsWith('2024') ? 13 - Number(o.worksStart.slice(5, 7)) : 12, label: `${o.name} – ${vefa ? 'appels de fonds VEFA' : 'marché de travaux'}`, operationId: op.id, programmeId: o.id, year: 2024 });
    if (o.spent2025Euros > 0) {
      const start = o.worksStart.startsWith('2025') ? Number(o.worksStart.slice(5, 7)) : 1;
      situations(st, rng, { supplierId: vefa ? 'F0032' : o.worksStart > '2025-12-31' ? 'F0023' : 'F0022', account: '2313', total: eur(o.spent2025Euros), from: endOfMonth(2025, start), months: 13 - start, label: `${o.name} – ${o.worksStart > '2025-12-31' ? 'études et honoraires de maîtrise d’œuvre' : vefa ? 'appels de fonds VEFA' : 'marché de travaux'}`, operationId: op.id, programmeId: o.id, year: 2025 });
    }
    const amount = eur(o.costEuros * o.subsidyRate * st.levers.subsidyScale);
    const split = { ETAT: 0.25, REGION: 0.2, DEPARTEMENT: 0.15, CA_VAL_AURELLE: 0.25, ACTION_LOGEMENT: 0.15 };
    const parts = allocate(amount, Object.values(split));
    Object.keys(split).forEach((g, i) => {
      const first = addDays(o.subsidyDecision, 120);
      st.subsidies.push({ id: `SUB-${o.id}-${g}`, operationId: op.id, programmeId: o.id, grantorId: g === 'ANRU' ? 'ANRU' : g, account: '', amount: parts[i]!, decisionDate: o.subsidyDecision, receipts: first <= '2025-12-31' ? [{ date: first, amount: Math.round(parts[i]! * 0.3) }] : [] });
    });
  }

  // --- Les Lilas: thermal rehabilitation 2024 (in service 01/11/2024) ---
  const lil = addOperation(st, { id: 'OP-LIL-H2024', programmeId: 'LIL', kind: 'rehabilitation', label: 'Réhabilitation thermique des Lilas (ITE et menuiseries)', year: 2024 });
  const lilCost = eur(3_600_000);
  situations(st, rng, { supplierId: 'F0025', account: '2313', total: lilCost, from: '2024-02-29', months: 8, label: 'Les Lilas – isolation thermique par l’extérieur et menuiseries', operationId: lil.id, programmeId: 'LIL', year: 2024 });
  spreadOverBuildings(st, 'LIL', lil.id, lilCost, { facade: 0.55, windows: 0.45 }, '2024-11-01', { replaces: true, suffix: '-R24' });
  st.subsidies.push({ id: 'SUB-LIL-H2024-REGION', operationId: lil.id, programmeId: 'LIL', grantorId: 'REGION', account: '', amount: eur(300000), decisionDate: '2023-10-12', receipts: [{ date: '2024-07-05', amount: eur(150000) }, { date: '2025-03-14', amount: eur(150000) }] });

  // --- Les Érables: heat pump replacing the collective boiler (30/06/2025) ---
  const e = sp.erables;
  const era = addOperation(st, { id: 'OP-ERA-R2025', programmeId: 'ERA', kind: 'replacement', label: 'Remplacement de la chaufferie collective par une pompe à chaleur', year: 2025 });
  const pac = eur(e.heatPumpCostEuros);
  const pacParts = allocate(pac, [0.3, 0.35, 0.25, 0.1]);
  const pacLabels = ['acompte à la commande', 'fourniture et pose des pompes à chaleur', 'raccordements hydrauliques et électriques', 'dépose et évacuation de l’ancienne chaufferie, mise en service'];
  pacParts.forEach((amount, i) => {
    const inv = emit(st, rng, {
      supplierId: 'F0024',
      invoiceDate: isoDate(2025, 2 + i, 26),
      lines: [{ account: '2313', programmeId: 'ERA', amount, operationId: era.id, nature: 'investissement' }],
      description: `Les Érables – pompe à chaleur collective : ${pacLabels[i]}`,
      serviceYear: 2025,
      category: 'investissement',
      paymentDays: 45,
    });
    st.wip.push({ operationId: era.id, programmeId: 'ERA', account: '2313', date: inv.invoiceDate, amount, invoiceId: inv.id });
  });
  const boiler = st.components.find((c) => c.programmeId === 'ERA' && c.id.includes('-CHAUF'))!;
  boiler.disposal = { date: e.disposalDate, reason: 'replacement' };
  addComponent(st, { programmeId: 'ERA', building: boiler.building, family: 'heating', operationId: era.id, cost: pac, inServiceDate: e.heatPumpInService, label: 'Pompe à chaleur collective', suffix: '-PAC' }).replacesComponentId = boiler.id;

  // --- Les Charmes: thermal rehabilitation started in June 2025 (work in progress) ---
  const ch = sp.charmes;
  const cha = addOperation(st, { id: 'OP-CHA-H2026', programmeId: 'CHA', kind: 'rehabilitation', label: 'Réhabilitation thermique des Charmes', year: 2026 });
  situations(st, rng, { supplierId: 'F0025', account: '2313', total: eur(ch.works2025Euros), from: '2025-07-31', months: 6, label: 'Les Charmes – réhabilitation thermique (ordre de service du 02/06/2025)', operationId: cha.id, programmeId: 'CHA', year: 2025 });
  st.subsidies.push({
    id: 'SUB-CHA-H2026-DEPARTEMENT',
    operationId: cha.id,
    programmeId: 'CHA',
    grantorId: 'DEPARTEMENT',
    account: '',
    amount: eur(ch.subsidyEuros),
    decisionDate: ch.decisionDate,
    lapse: { worksMustStartBefore: isoDate(Number(ch.decisionDate.slice(0, 4)) + ch.lapseYears, Number(ch.decisionDate.slice(5, 7)), Number(ch.decisionDate.slice(8, 10))), noticeDate: ch.lapseNoticeDate },
    receipts: [],
    cancelledOn: ch.lapseNoticeDate,
  });

  // --- Les Peupliers: 2025 works (doors capitalised, the rest is maintenance) ---
  const pe = sp.peupliers;
  const peu = addOperation(st, { id: 'OP-PEU-A2025', programmeId: 'PEU', kind: 'improvement', label: 'Remplacement des portes palières', year: 2025 });
  const doors = emit(st, rng, {
    supplierId: 'F0013',
    invoiceDate: '2025-08-29',
    lines: [{ account: '2135', programmeId: 'PEU', amount: eur(pe.doorsEuros), operationId: peu.id, nature: 'investissement' }],
    description: 'Les Peupliers – remplacement des portes palières (portes coupe-feu) – programme d’entretien 2025',
    serviceYear: 2025,
    category: 'investissement',
    orderRef: 'BC2025-PE-01',
  });
  void doors;
  addComponent(st, { programmeId: 'PEU', building: 'PEU-B01', family: 'fittings', operationId: peu.id, cost: eur(pe.doorsEuros), inServiceDate: pe.inService, label: 'Portes palières (agencements divers)', suffix: '-PORTES' });
  const peuSuppliers = ['F0012', 'F0010', 'F0014'];
  pe.maintenanceItems.forEach((item, i) =>
    emit(st, rng, {
      supplierId: peuSuppliers[i]!,
      invoiceDate: isoDate(2025, 8, 18 + i * 3),
      lines: [{ account: '61521', programmeId: 'PEU', amount: eur(item.euros), nature: 'entretien' }],
      description: `Les Peupliers – ${item.label} – programme d’entretien 2025`,
      serviceYear: 2025,
      category: 'entretien',
      orderRef: `BC2025-PE-0${i + 2}`,
    }),
  );

  // --- routine component replacements (old components already fully depreciated) ---
  for (const year of YEARS) {
    const candidates = st.components.filter(
      (c) => (c.family === 'heating' || c.family === 'windows') && !c.disposal && c.usefulLifeYears > 0 && c.programmeId !== 'GLB' && c.programmeId !== 'ERA' && c.programmeId !== 'TIL' &&
        accumulatedDepreciation(c, `${year}-06-30`) >= c.cost,
    );
    const chosen = rng.shuffle(candidates).slice(0, 7);
    for (const old of chosen) {
      const date = isoDate(year, rng.int(3, 11), 1);
      const op = addOperation(st, { id: `OP-${old.programmeId}-${old.building}-${year}`, programmeId: old.programmeId, kind: 'replacement', label: old.family === 'heating' ? 'Remplacement de chaudières' : 'Remplacement de menuiseries', year });
      const b = st.buildings.find((x) => x.id === old.building)!;
      const cost = Math.round(b.units * (old.family === 'heating' ? 3100 : 5200) * rng.uniform(0.85, 1.15) * 100);
      retire(st, old.building, old.family as ComponentFamily, addDays(date, -1), 'replacement');
      const comp = addComponent(st, { programmeId: old.programmeId, building: old.building, family: old.family, operationId: op.id, cost, inServiceDate: date, suffix: `-${year}` });
      comp.replacesComponentId = old.id;
      emit(st, rng, {
        supplierId: old.family === 'heating' ? 'F0049' : 'F0013',
        invoiceDate: addDays(date, -3),
        lines: [{ account: comp.account, programmeId: old.programmeId, amount: cost, operationId: op.id, componentId: comp.id, nature: 'investissement' }],
        description: `${op.label} – ${b.label} – ${st.progParams.get(old.programmeId)!.name}`,
        serviceYear: year,
        category: 'investissement',
        paymentDays: 45,
      });
    }
  }

  // --- head office: IT equipment, furniture, new accounting software (migration) ---
  const a = st.params.scenario.assets;
  for (const year of YEARS) {
    const op = addOperation(st, { id: `OP-SIE-I${year}`, programmeId: 'SIE', kind: 'acquisition', label: `Matériel informatique ${year}`, year });
    const cost = eur(a.itEquipmentPerYearEuros * rng.uniform(0.9, 1.1));
    const comp = addComponent(st, { programmeId: 'SIE', building: 'SIE', family: 'other', operationId: op.id, cost, inServiceDate: isoDate(year, 4, 1), label: `Matériel informatique ${year}`, lifeYears: 4, account: '2183', suffix: '-IT' });
    emit(st, rng, { supplierId: 'F0038', invoiceDate: isoDate(year, 3, 28), lines: [{ account: '2183', amount: cost, operationId: op.id, componentId: comp.id, nature: 'investissement' }], description: `Renouvellement du parc informatique ${year}`, serviceYear: year, category: 'investissement' });
  }
  const sw = a.newSoftware;
  const swOp = addOperation(st, { id: 'OP-SIE-L2025', programmeId: 'SIE', kind: 'acquisition', label: 'Nouveau progiciel comptable et interface de gestion locative', year: 2025 });
  const old = st.components.find((c) => c.programmeId === 'SIE' && c.account === '2051' && !c.disposal);
  if (old) old.disposal = { date: '2025-09-30', reason: 'scrapped' };
  const swComp = addComponent(st, { programmeId: 'SIE', building: 'SIE', family: 'other', operationId: swOp.id, cost: eur(sw.costEuros), inServiceDate: sw.inService, label: 'Progiciel comptable et interface LOGIGES (migration du 01/10/2025)', lifeYears: sw.lifeYears, account: '2051', suffix: '-LOG25' });
  const swParts = allocate(eur(sw.costEuros), [0.4, 0.35, 0.25]);
  swParts.forEach((amount, i) =>
    emit(st, rng, { supplierId: 'F0037', invoiceDate: isoDate(2025, 5 + i * 2, 15), lines: [{ account: '2051', amount, operationId: swOp.id, componentId: swComp.id, nature: 'investissement' }], description: `Progiciel comptable – licence et paramétrage – échéance ${i + 1}/3`, serviceYear: 2025, category: 'investissement' }),
  );
}

// ---------------------------------------------------------------------------
// Payroll and caretakers
// ---------------------------------------------------------------------------

export function buildPayroll(st: GenState): void {
  const rng = st.rng.fork('payroll');
  const pr = st.params.scenario.payroll;
  for (const year of YEARS) {
    const total = eur(pr.totalEuros[String(year)]!);
    const bonus = eur(pr.valueSharingBonusEuros[String(year)] ?? 0);
    const salaries = Math.round((total - bonus) / 1.43);
    const monthWeights = Array.from({ length: 12 }, (_, m) => (m === 11 ? 1.9 : m === 5 ? 1.1 : 1) * rng.uniform(0.995, 1.005));
    const gross = allocate(salaries, monthWeights);
    const charges = allocate(total - bonus - salaries, monthWeights);
    for (let m = 0; m < 12; m++) {
      const g = gross[m]!;
      const b = m === 5 ? bonus : 0;
      const c = charges[m]!;
      const employee = Math.round((g + b) * 0.225);
      st.payroll.push({
        year,
        month: m + 1,
        headcount: pr.headcount[String(year)]!,
        gross: g,
        bonuses: b,
        employerUrssaf: Math.round(c * 0.62),
        employerPension: Math.round(c * 0.28),
        employerOther: c - Math.round(c * 0.62) - Math.round(c * 0.28),
        employeeContributions: employee,
        net: g + b - employee,
      });
    }
  }
  // caretakers (gardiens) and building employees
  const big = st.params.programmes.filter((p) => p.kind === 'family' && p.heating === 'collective').sort((a, b) => b.units - a.units);
  const others = st.params.programmes.filter((p) => p.kind === 'family' && p.id !== 'TIL' && p.id !== 'MAR');
  const gCost24 = allocate(eur(pr.caretakers.costEuros['2024']!), new Array(pr.caretakers.count).fill(1).map(() => rng.uniform(0.9, 1.1)));
  const gCost25 = gCost24.map((c) => Math.round((c * eur(pr.caretakers.costEuros['2025']!)) / eur(pr.caretakers.costEuros['2024']!)));
  gCost25[0]! += eur(pr.caretakers.costEuros['2025']!) - gCost25.reduce((a, b) => a + b, 0);
  const cts: Caretaker[] = [];
  for (let i = 0; i < pr.caretakers.count; i++) {
    cts.push({ id: `GAR${String(i + 1).padStart(2, '0')}`, name: `${rng.pick(['DUPONT', 'MARTINEZ', 'BOUZID', 'LEGRAND', 'FERREIRA', 'NIANG', 'COLIN', 'BERNARD', 'TOURE', 'MOREAU', 'LACROIX', 'SAIDI', 'PERRET', 'GOMES'])} ${rng.pick(['Michel', 'Ali', 'Sylvie', 'José', 'Fatima', 'Didier', 'Mamadou', 'Christine', 'Rui', 'Nathalie'])}`, role: 'gardien', programmeIds: [big[i % big.length]!.id], tasks: ['partiesCommunes', 'rejets'], annualCost: { y2024: gCost24[i]!, y2025: gCost25[i]! } });
  }
  const eCost24 = allocate(eur(pr.buildingEmployees.costEuros['2024']!), new Array(pr.buildingEmployees.count).fill(1));
  const eCost25 = allocate(eur(pr.buildingEmployees.costEuros['2025']!), new Array(pr.buildingEmployees.count).fill(1));
  for (let i = 0; i < pr.buildingEmployees.count; i++) {
    cts.push({ id: `EMP${String(i + 1).padStart(2, '0')}`, name: `Employé(e) d’immeuble n° ${i + 1}`, role: 'employeImmeuble', programmeIds: [others[i % others.length]!.id], tasks: ['partiesCommunes', 'rejets'], annualCost: { y2024: eCost24[i]!, y2025: eCost25[i]! } });
  }
  st.caretakers = cts;
}

// ---------------------------------------------------------------------------
// Property taxes
// ---------------------------------------------------------------------------

export function buildTaxes(st: GenState): void {
  const rng = st.rng.fork('taxes');
  const tx = st.params.scenario.taxes;
  const family = st.params.programmes.filter((p) => p.kind === 'family' || p.kind === 'collective');
  for (const year of YEARS) {
    const weights = family.map((p) => {
      const exemptUntil = p.constructionYear >= 1999 ? p.constructionYear + 25 : undefined;
      const exempt = exemptUntil !== undefined && year <= exemptUntil;
      const units = p.id === 'TIL' ? 0 : p.units;
      return { p, w: exempt ? 0 : units * rng.uniform(0.9, 1.1), exemptUntil, units };
    });
    const tfpb = allocate(eur(tx.tfpbEuros[String(year)]!), weights.map((x) => x.w));
    const teom = allocate(eur(tx.teomEuros[String(year)]!), weights.map((x) => x.units));
    weights.forEach((x, i) => {
      const n: TaxNotice = { programmeId: x.p.id, year, tfpb: tfpb[i]!, teom: teom[i]! };
      if (x.exemptUntil) n.exemptUntil = x.exemptUntil;
      st.taxNotices.push(n);
    });
  }
}

// ---------------------------------------------------------------------------
// Maintenance plan (PGE)
// ---------------------------------------------------------------------------

export function buildMaintenancePlan(st: GenState): void {
  const rng = st.rng.fork('pge');
  const pg = st.params.scenario.provisions.pge;
  const y25 = pg.y2025;
  const opening2024 = eur(y25.opening) + eur(pg.reprise2024Euros) - eur(st.levers.pgeDotation2024Euros);
  const family = st.params.programmes.filter((p) => p.kind === 'family' && p.id !== 'TIL' && p.constructionYear < 2015);
  const natures = ['Ravalement de façades', 'Réfection de l’étanchéité des toitures-terrasses', 'Remplacement des colonnes d’eau', 'Réfection des halls et cages d’escalier', 'Mise en conformité électrique des parties communes', 'Réfection des voiries et réseaux divers'];
  const items: MaintenancePlanItem[] = [];
  let n = 0;
  const add = (programmeId: string, nature: string, plannedYear: number, amount: Cents, provisionFrom: number, realisedYear?: number) => {
    n++;
    const it: MaintenancePlanItem = { id: `PPE${String(n).padStart(3, '0')}`, programmeId, nature, plannedYear, amount, provisionFrom, provision: { y2023: 0, y2024: 0, y2025: 0 }, inOfficialPlan: true };
    if (realisedYear) it.realisedYear = realisedYear;
    items.push(it);
    return it;
  };
  // works carried out in 2024 and 2025 (fully provisioned at the previous year end)
  const r24 = allocate(eur(pg.reprise2024Euros), [1.2, 0.9, 1.1, 0.8]).map((amount, i) => add(rng.pick(family).id, natures[i]!, 2024, amount, 2020 + i % 2, 2024));
  const r25 = allocate(eur(y25.reprise), [1.1, 1.0, 0.9, 1.2, 0.8]).map((amount, i) => add(rng.pick(family).id, natures[(i + 2) % natures.length]!, 2025, amount, 2021, 2025));
  // future works: Les Acacias (2026) and Le Belvédère (2027) are the two operations of A05
  const aca = add('ACA', 'Ravalement de façades', 2026, eur(pg.acaciasRavalement2026Euros * 1.6), 2022);
  const bel = add('BEL', 'Réfection de l’étanchéité des toitures-terrasses', 2027, eur(pg.belvedereEtancheite2027Euros * 2.2), 2022);
  const others = Array.from({ length: 16 }, (_, i) => add(rng.pick(family).id, natures[i % natures.length]!, 2026 + (i % 5), eur(rng.uniform(250000, 900000)), 2022 + (i % 3)));
  const future = [aca, bel, ...others];
  // provision balances
  r24.forEach((it) => (it.provision = { y2023: it.amount, y2024: 0, y2025: 0 }));
  r25.forEach((it) => (it.provision = { y2023: Math.round(it.amount * 0.75), y2024: it.amount, y2025: 0 }));
  aca.provision.y2025 = eur(pg.acaciasRavalement2026Euros);
  bel.provision.y2025 = eur(pg.belvedereEtancheite2027Euros);
  const futureEnd2024 = eur(y25.opening) - eur(y25.reprise);
  const futureEnd2025 = eur(y25.closing);
  const r25Open = r25.reduce((s, it) => s + it.provision.y2023, 0);
  const futureEnd2023 = opening2024 - eur(pg.reprise2024Euros) - r25Open;
  const restEnd2025 = allocate(futureEnd2025 - aca.provision.y2025 - bel.provision.y2025, others.map((o) => o.amount));
  others.forEach((o, i) => (o.provision.y2025 = restEnd2025[i]!));
  const end2024 = allocate(futureEnd2024, future.map((f) => f.provision.y2025 * 0.79));
  future.forEach((f, i) => (f.provision.y2024 = end2024[i]!));
  const end2023 = allocate(futureEnd2023, future.map((f) => f.provision.y2024 * 0.8));
  future.forEach((f, i) => (f.provision.y2023 = Math.min(end2023[i]!, f.provision.y2024)));
  const shortfall = futureEnd2023 - future.reduce((s, f) => s + f.provision.y2023, 0);
  if (shortfall !== 0) future[2]!.provision.y2023 += shortfall;
  st.maintenancePlan = items;
  const open24 = items.reduce((s, it) => s + it.provision.y2023, 0);
  const close24 = items.reduce((s, it) => s + it.provision.y2024, 0);
  const close25 = items.reduce((s, it) => s + it.provision.y2025, 0);
  const rep24 = r24.reduce((s, it) => s + it.provision.y2023, 0);
  const rep25 = r25.reduce((s, it) => s + it.provision.y2024, 0);
  st.pge = [
    { year: 2024, opening: open24, dotation: close24 - open24 + rep24, reprise: rep24, closing: close24 },
    { year: 2025, opening: close24, dotation: close25 - close24 + rep25, reprise: rep25, closing: close25 },
  ];
  // works invoices of the provisioned operations
  for (const it of [...r24, ...r25]) {
    const year = it.realisedYear!;
    const parts = allocate(it.amount, [0.4, 0.6]);
    parts.forEach((amount, k) =>
      emit(st, rng, {
        supplierId: rng.pick(suppliersOf(st, 'gros_entretien')),
        invoiceDate: isoDate(year, 4 + k * 4 + (n % 3), 22),
        lines: [{ account: '61522', programmeId: it.programmeId, amount, nature: 'gros_entretien_pge' }],
        description: `${it.nature} – ${st.progParams.get(it.programmeId)!.name} (plan pluriannuel d’entretien, opération ${it.id})`,
        serviceYear: year,
        category: 'gros_entretien_pge',
        paymentDays: 45,
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Operating invoices (entry point) and overdue invoices at year end
// ---------------------------------------------------------------------------

export function buildOperatingInvoices(st: GenState, recoverableScale: number): Map<number, Cents> {
  const rng = st.rng.fork('invoices');
  recoverableInvoices(st, rng, recoverableScale);
  coOwnershipInvoices(st, rng);
  operatingInvoices(st, rng);
  return insuranceInvoices(st, rng);
}

/** Opening suppliers at 31/12/2023 (invoices of late 2023 paid in early 2024). */
export function openingSupplierInvoices(st: GenState): void {
  const rng = st.rng.fork('opening-suppliers');
  const ob = st.params.scenario.openingBalances2023;
  const opsSuppliers = allocate(eur(ob['suppliersEuros']!), Array.from({ length: 180 }, () => rng.lognormal(1, 0.9)));
  const pool = [...suppliersOf(st, 'entretien'), ...suppliersOf(st, 'contrats_entretien'), 'F0001', 'F0002', 'F0003'];
  opsSuppliers.forEach((amount) => {
    const date = isoDate(2023, rng.int(11, 12), rng.int(1, 28));
    const inv = emit(st, rng, { supplierId: rng.pick(pool), invoiceDate: date, lines: [{ account: '61521', amount, nature: 'entretien' }], description: 'Facture 2023 non réglée au 31/12/2023', serviceYear: 2023, category: 'ouverture', paymentDays: 45 });
    inv.receivedDate = addDays(date, 3);
    if (inv.paidDate! < '2024-01-04') inv.paidDate = nextThursday(isoDate(2024, 1, rng.int(4, 25)));
  });
  const fixed = allocate(eur(ob['fixedAssetSuppliersEuros']!), [1, 1, 1]);
  fixed.forEach((amount, i) => {
    const inv = emit(st, rng, { supplierId: 'F0022', invoiceDate: isoDate(2023, 12, 10 + i * 5), lines: [{ account: '2313', programmeId: 'TIL', amount, nature: 'investissement' }], description: 'Les Tilleuls – situation de travaux 2023 non réglée au 31/12/2023', serviceYear: 2023, category: 'ouverture', paymentDays: 45 });
    inv.paidDate = nextThursday(isoDate(2024, 1, 20 + i * 3));
  });
}

/** Invoices received, due and still unpaid at the year end (management report, payment terms). */
export function overdueAtYearEnd(invoices: readonly Invoice[], year: number): Invoice[] {
  const end = `${year}-12-31`;
  return invoices.filter((i) => i.receivedDate <= end && i.dueDate < end && (!i.paidDate || i.paidDate > end));
}

/**
 * Marks overdue invoices still unpaid at year end so that, with the invoices
 * naturally paid late, their count and amount match the management data.
 * Runs after the scaling of the recoverable invoices (amounts are final).
 */
export function markOverdueInvoices(st: GenState): void {
  const rng = st.rng.fork('overdue');
  for (const [year, spec] of Object.entries(st.params.scenario.charges.overdueUnpaidAtYearEnd)) {
    const y = Number(year);
    const end = `${y}-12-31`;
    const natural = overdueAtYearEnd(st.invoices, y);
    const candidates = rng.shuffle(st.invoices.filter((i) => i.category === 'entretien' && i.serviceYear === y && i.dueDate < end && i.dueDate >= `${y}-07-01` && i.receivedDate <= end && !natural.includes(i)));
    const chosen = candidates.slice(0, Math.max(0, spec.count - natural.length));
    const before = chosen.reduce((s, i) => s + i.total, 0);
    const target = eur(spec.euros) - natural.reduce((s, i) => s + i.total, 0);
    const scaled = allocate(target, chosen.map((i) => i.total));
    const delta = target - before;
    chosen.forEach((inv, k) => {
      const amount = scaled[k]!;
      (inv as { lines: Invoice['lines'] }).lines = [{ ...inv.lines[0]!, amount }];
      inv.total = amount;
      inv.paidDate = nextThursday(isoDate(y + 1, rng.int(1, 3), rng.int(1, 28)));
    });
    // keep the yearly maintenance total unchanged
    const others = st.invoices.filter((i) => i.category === 'entretien' && i.serviceYear === y && !chosen.includes(i) && !natural.includes(i) && i.total > Math.abs(delta) * 2);
    const big = others.sort((a, b) => b.total - a.total)[0];
    if (big) {
      const amount = big.total - delta;
      (big as { lines: Invoice['lines'] }).lines = [{ ...big.lines[0]!, amount }];
      big.total = amount;
    }
  }
}

// ---------------------------------------------------------------------------
// Recoverable charges regularisation
// ---------------------------------------------------------------------------

export function caretakerRecoverableShare(st: GenState, c: Caretaker): number {
  const rs = st.params.regulatory.recoverableShares;
  if (c.role === 'employeImmeuble') return rs.buildingEmployee;
  return c.tasks.length >= 2 ? rs.caretakerBothTasks : rs.caretakerOneTask;
}

export function buildRegularisations(st: GenState, roll: RentRoll): void {
  st.regularisations = [];
  const co = st.params.scenario.charges.coOwnership;
  for (const year of YEARS) {
    for (const p of st.programmes.filter((x) => x.kind === 'family')) {
      const months = roll.get(p.id)!.get(year)!;
      const provisions = months.reduce((s, m) => s + m.chargeProvisions, 0);
      const occupied = months.reduce((s, m) => s + m.occupiedUnits, 0);
      const units = months.reduce((s, m) => s + m.units, 0);
      const occupancy = units === 0 ? 0 : occupied / units;
      const expenses: Record<string, Cents> = {};
      const add = (k: string, v: Cents) => (expenses[k] = (expenses[k] ?? 0) + v);
      for (const inv of st.invoices) {
        if (inv.serviceYear !== year) continue;
        for (const l of inv.lines) {
          if (l.programmeId !== p.id || !l.nature) continue;
          if (l.nature in st.params.scenario.charges.recoverable) add(l.nature, l.amount);
          if (l.nature === 'copropriete_charges') add('copropriete', Math.round(l.amount * co.recoverableShare));
        }
      }
      const teom = st.taxNotices.find((t) => t.programmeId === p.id && t.year === year)?.teom ?? 0;
      if (teom) add('teom', teom);
      for (const c of st.caretakers) {
        if (!c.programmeIds.includes(p.id)) continue;
        add(c.role === 'gardien' ? 'gardiennage' : 'employes_immeuble', Math.round((year === 2024 ? c.annualCost.y2024 : c.annualCost.y2025) * caretakerRecoverableShare(st, c)));
      }
      const total = Object.values(expenses).reduce((a, b) => a + b, 0);
      const recoverable = Math.round(total * occupancy);
      st.regularisations.push({ programmeId: p.id, year, provisionsCalled: provisions, expenses, recoverable, regularisation: recoverable - provisions });
    }
  }
}

export type { AssetComponent };
