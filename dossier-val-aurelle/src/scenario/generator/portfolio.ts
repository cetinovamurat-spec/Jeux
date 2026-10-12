/**
 * Third parties, programmes, buildings, dwellings, fixed-asset register and
 * investment subsidies.
 */
import { addDays, isoDate } from '../../engine/dates';
import { allocate, type Cents } from '../../engine/money';
import { accumulatedDepreciation } from '../../engine/subledgers/depreciation';
import type { AssetComponent, ComponentFamily, Operation, Programme, Subsidy, ThirdParty } from '../../engine/types';
import type { Building, Dwelling, Typology } from '../datasets';
import { eur, interp, type GenState } from './core';

// ---------------------------------------------------------------------------
// Third parties
// ---------------------------------------------------------------------------

const SUPPLIERS: readonly [string, string, string][] = [
  // id, name, category
  ['F0001', 'Énergies du Val', 'energie'],
  ['F0002', "Compagnie des Eaux de l'Aurelle", 'eau'],
  ['F0003', 'Électricité Marne Distribution', 'electricite'],
  ['F0004', 'Ascenseurs Marne Services', 'ascenseurs'],
  ['F0005', 'Les Jardiniers du Val', 'espaces_verts'],
  ['F0006', "Net'Aurelle Propreté", 'nettoyage'],
  ['F0007', 'Thermiservices Est', 'contrats_entretien'],
  ['F0008', 'Aqua-Contrôle Robinetterie', 'contrats_entretien'],
  ['F0009', 'Multiservices Habitat Marne', 'entretien'],
  ['F0010', 'Plomberie Vasseur & Fils', 'entretien'],
  ['F0011', 'Électricité Générale Brienne', 'entretien'],
  ['F0012', 'Peintures Lemoine & Fils', 'entretien'],
  ['F0013', 'Menuiseries de la Vallée', 'entretien'],
  ['F0014', 'Étanchéité Toitures Champenoises', 'entretien'],
  ['F0015', 'Bâti-Rénov Est', 'entretien'],
  ['F0016', 'Serrurerie Aurelloise', 'entretien'],
  ['F0017', 'Vitrerie Moderne', 'entretien'],
  ['F0018', 'Sols et Revêtements du Val', 'entretien'],
  ['F0019', 'Dératisation Hygiène Services', 'entretien'],
  ['F0020', 'Façades et Ravalement Marnais', 'gros_entretien'],
  ['F0021', 'Couverture Charpente Dubreuil', 'gros_entretien'],
  ['F0022', 'Constructions Bertin-Lagarde', 'construction'],
  ['F0023', 'Atelier Lumen Architectes', 'maitrise_oeuvre'],
  ['F0024', 'Climatech Pompes à Chaleur', 'construction'],
  ['F0025', 'Isolation Thermique du Val', 'construction'],
  ['F0026', 'Mutuelle Assurance des Bailleurs', 'assurances'],
  ['F0027', 'GIE Altaïr Services', 'gie'],
  ['F0028', 'Caisse de garantie du logement locatif social', 'cglls'],
  ['F0029', 'Agence nationale de contrôle du logement social', 'cglls'],
  ['F0030', 'Arpège Urbanisme', 'honoraires'],
  ['F0031', 'Stratégie & Patrimoine Conseil', 'honoraires'],
  ['F0032', 'Cabinet Girard, notaires associés', 'honoraires'],
  ['F0033', 'Aubert Avocats', 'honoraires'],
  ['F0034', 'Sequana Audit', 'honoraires'],
  ['F0035', 'Expertises Diagnostics Immobiliers', 'honoraires'],
  ['F0036', 'Huissiers Associés de la Marne', 'actes_contentieux'],
  ['F0037', 'Logiciels Immo Solutions', 'informatique'],
  ['F0038', 'Infogérance Val Numérique', 'informatique'],
  ['F0039', 'Télécom Pro Est', 'telecom'],
  ['F0040', 'Crédit Marnais', 'banque'],
  ['F0041', 'Le Courrier de la Marne', 'annonces'],
  ['F0042', 'Locaflotte Véhicules', 'locations'],
  ['F0043', 'Bureau Équipement Services', 'fournitures'],
  ['F0044', "Recouvr'Action", 'recouvrement_amiable'],
  ['F0045', 'Gestimmo Aurelle (syndic)', 'syndic'],
  ['F0046', 'Archives et Courrier Services', 'autres_services'],
  ['F0047', 'Sécurité Incendie Marne', 'contrats_entretien'],
  ['F0048', 'Quincaillerie Professionnelle du Val', 'fournitures'],
  ['F0049', 'Chauffage Collectif Dalmas', 'gros_entretien'],
  ['F0050', 'Réseaux et Voirie Champagne', 'gros_entretien'],
];

export function buildThirdParties(st: GenState): void {
  const tp: ThirdParty[] = [];
  for (const [id, name] of SUPPLIERS) {
    const kind: ThirdParty['kind'] = id === 'F0027' ? 'groupEntity' : id === 'F0032' ? 'notary' : id === 'F0033' ? 'lawyer' : 'supplier';
    tp.push({ id, name, kind, relatedParty: id === 'F0027', aux: id });
  }
  const others: ThirdParty[] = [
    { id: 'BDT', name: 'Caisse des dépôts – Banque des Territoires', kind: 'lender', relatedParty: false, aux: 'BDT' },
    { id: 'BANK1', name: 'Crédit Marnais', kind: 'lender', relatedParty: false, aux: 'BQ01' },
    { id: 'BANK2', name: "Banque de l'Aurelle", kind: 'lender', relatedParty: false, aux: 'BQ02' },
    { id: 'BANK3', name: 'Société Financière du Val', kind: 'lender', relatedParty: false, aux: 'BQ03' },
    { id: 'AL', name: 'Action Logement Services', kind: 'lender', relatedParty: false, aux: 'ALS' },
    { id: 'ETAT', name: 'État', kind: 'publicBody', relatedParty: false },
    { id: 'REGION', name: 'Région', kind: 'publicBody', relatedParty: false },
    { id: 'DEPARTEMENT', name: 'Département', kind: 'publicBody', relatedParty: false },
    { id: 'CA_VAL_AURELLE', name: "Communauté d'agglomération du Val d'Aurelle", kind: 'publicBody', relatedParty: false },
    { id: 'COMMUNES', name: 'Communes du territoire', kind: 'publicBody', relatedParty: false },
    { id: 'ACTION_LOGEMENT', name: 'Action Logement Services', kind: 'publicBody', relatedParty: false },
    { id: 'ANRU', name: 'Agence nationale pour la rénovation urbaine', kind: 'publicBody', relatedParty: false },
    { id: 'CAF', name: "Caisse d'allocations familiales", kind: 'socialBody', relatedParty: false, aux: 'CAF' },
    { id: 'DGFIP', name: 'Direction générale des finances publiques', kind: 'publicBody', relatedParty: false },
    { id: 'ACCUEIL_HORIZONS', name: 'Association Accueil Horizons', kind: 'residenceManager', relatedParty: false, aux: 'G001' },
    { id: 'HABITAT_INSERTION', name: 'Association Habitat & Insertion', kind: 'residenceManager', relatedParty: false, aux: 'G002' },
    { id: 'CCAS_AURELLE', name: "Centre communal d'action sociale d'Aurelle-sur-Marne", kind: 'residenceManager', relatedParty: false, aux: 'G003' },
    { id: 'ALTAIR', name: 'Altaïr Habitat SA', kind: 'groupEntity', relatedParty: true },
    { id: 'COTEAUX_SEREIN', name: 'Coteaux du Serein Habitat', kind: 'groupEntity', relatedParty: true, aux: 'CSH' },
    { id: 'NOTAIRE_GIRARD', name: 'Me Laurent Girard, notaire', kind: 'notary', relatedParty: false, aux: 'N001' },
    { id: 'NOTAIRE_LECLERC', name: 'Me Hélène Leclerc, notaire', kind: 'notary', relatedParty: false, aux: 'N002' },
    { id: 'ASSO_LOCATAIRES', name: "Association des locataires du Val d'Aurelle", kind: 'tenantAssociation', relatedParty: false },
  ];
  st.thirdParties = [...tp, ...others];
}

export function suppliersOf(st: GenState, category: string): string[] {
  return SUPPLIERS.filter(([, , c]) => c === category).map(([id]) => id);
}

// ---------------------------------------------------------------------------
// Programmes, buildings, dwellings
// ---------------------------------------------------------------------------

const TYPOLOGIES: readonly Typology[] = ['T1', 'T2', 'T3', 'T4', 'T5'];
const TYPO_WEIGHTS = [0.1, 0.22, 0.35, 0.25, 0.08];
const TYPO_SURFACE = { T1: 31, T2: 47, T3: 64, T4: 79, T5: 94 } as const;

export function buildProgrammes(st: GenState): void {
  const rng = st.rng.fork('programmes');
  const { scenario } = st.params;
  for (const p of st.params.programmes) {
    st.progParams.set(p.id, p);
    const inServiceDate = isoDate(p.constructionYear, p.inServiceMonth, 1);
    const programme: Programme = {
      id: p.id,
      name: p.name,
      commune: p.commune,
      kind: p.kind,
      units: p.id === 'TIL' ? 0 : p.units,
      constructionYear: p.constructionYear,
      inServiceDate,
      financing: p.financing,
      regulated: p.regulated,
      commercialUnits: p.commercialUnits,
      parkingSpaces: p.parkingSpaces,
      energyClassGUnits: p.energyClassGUnits,
      buildings: p.buildings,
    };
    if (p.managerId) programme.managerId = p.managerId;
    if (p.coOwnership) programme.coOwnership = true;
    st.programmes.push(programme);

    const unitsPerBuilding = allocate(p.units, new Array(p.buildings).fill(1));
    unitsPerBuilding.forEach((units, i) => {
      const label = p.pavilions ? `Pavillon ${String(i + 1).padStart(2, '0')}` : p.kind === 'collective' ? 'Résidence' : `Bâtiment ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? i : ''}`;
      st.buildings.push({ id: `${p.id}-B${String(i + 1).padStart(2, '0')}`, programmeId: p.id, label, units, pavilion: p.pavilions });
    });
    if (p.kind !== 'family') continue;

    // dwellings
    const perM2 = interp(scenario.rents.perM2ByYear, p.constructionYear) * (p.pavilions ? 1.06 : 1);
    let gLeft = p.energyClassGUnits;
    let counter = 0;
    for (const b of st.buildings.filter((x) => x.programmeId === p.id)) {
      for (let u = 0; u < b.units; u++) {
        counter++;
        const typology = p.pavilions ? rng.weightedPick(['T3', 'T4', 'T5'] as Typology[], [0.3, 0.5, 0.2]) : rng.weightedPick(TYPOLOGIES, TYPO_WEIGHTS);
        const surface = Math.round(TYPO_SURFACE[typology] * rng.uniform(0.92, 1.1));
        const rent = Math.round(surface * perM2 * rng.uniform(0.94, 1.06) * 100);
        const provision = Math.round(surface * scenario.rents.chargeProvisionPerM2 * (p.heating === 'collective' ? 1.25 : 0.85) * rng.uniform(0.92, 1.08) * 100);
        let energyClass: Dwelling['energyClass'];
        if (gLeft > 0) {
          energyClass = 'G';
          gLeft--;
        } else if (p.constructionYear >= 2012) energyClass = rng.pick(['A', 'B', 'B', 'C'] as const);
        else if (p.constructionYear >= 1995) energyClass = rng.pick(['C', 'C', 'D', 'D'] as const);
        else energyClass = rng.pick(['D', 'D', 'E', 'E', 'F'] as const);
        st.dwellings.push({
          id: `${p.id}-${String(counter).padStart(4, '0')}`,
          programmeId: p.id,
          buildingId: b.id,
          typology,
          surface,
          rent2024: rent,
          chargeProvision: provision,
          regulated: p.regulated,
          energyClass,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Fixed assets and subsidies
// ---------------------------------------------------------------------------

function family(st: GenState, f: string): { account: string; lifeYears: number; label: string } {
  const fam = st.params.components.families[f];
  if (!fam) throw new Error(`unknown component family ${f}`);
  return fam;
}

function addOperation(st: GenState, op: Operation): Operation {
  st.operations.push(op);
  return op;
}

function addComponent(
  st: GenState,
  c: { programmeId: string; building: string; family: ComponentFamily; operationId: string; cost: Cents; inServiceDate: string; suffix?: string; label?: string; lifeYears?: number; account?: string },
): AssetComponent {
  const fam = family(st, c.family);
  const component: AssetComponent = {
    id: `${c.building}-${c.family.toUpperCase().slice(0, 4)}-${c.inServiceDate.slice(0, 4)}${c.suffix ?? ''}`,
    programmeId: c.programmeId,
    building: c.building,
    family: c.family,
    label: c.label ?? fam.label,
    operationId: c.operationId,
    account: c.account ?? fam.account,
    cost: c.cost,
    inServiceDate: c.inServiceDate,
    usefulLifeYears: c.lifeYears ?? fam.lifeYears,
  };
  if (st.components.some((x) => x.id === component.id)) component.id += `-${st.components.length}`;
  st.components.push(component);
  return component;
}

/** Splits a cost over buildings (by units) and families (by shares). */
function spreadOverBuildings(
  st: GenState,
  programmeId: string,
  operationId: string,
  depreciable: Cents,
  shares: Readonly<Record<string, number>>,
  inServiceDate: string,
  options: { replaces?: boolean; suffix?: string; buildings?: readonly Building[] } = {},
): AssetComponent[] {
  const buildings = options.buildings ?? st.buildings.filter((b) => b.programmeId === programmeId);
  const perBuilding = allocate(depreciable, buildings.map((b) => b.units));
  const families = Object.keys(shares);
  const created: AssetComponent[] = [];
  buildings.forEach((b, i) => {
    const parts = allocate(perBuilding[i]!, families.map((f) => shares[f]!));
    families.forEach((f, k) => {
      if (parts[k] === 0) return;
      if (options.replaces && f !== 'structure') retire(st, b.id, f as ComponentFamily, addDays(inServiceDate, -1), 'replacement');
      const comp = addComponent(st, { programmeId, building: b.id, family: f as ComponentFamily, operationId, cost: parts[k]!, inServiceDate, ...(options.suffix ? { suffix: options.suffix } : {}) });
      created.push(comp);
    });
  });
  return created;
}

/** Retires the active component of a family in a building. */
function retire(st: GenState, building: string, fam: ComponentFamily, date: string, reason: 'replacement' | 'scrapped'): AssetComponent | undefined {
  const active = st.components.filter((c) => c.building === building && c.family === fam && !c.disposal && c.inServiceDate <= date);
  for (const c of active) c.disposal = { date, reason };
  return active[active.length - 1];
}

function addSubsidies(st: GenState, op: Operation, base: Cents, rate: number, decisionDate: string, split: Record<string, number>, receiptsDates: readonly [string, number][]): void {
  const total = Math.round(base * rate);
  const grantors = Object.keys(split);
  const parts = allocate(total, grantors.map((g) => split[g]!));
  grantors.forEach((g, i) => {
    const amount = parts[i]!;
    if (amount <= 0) return;
    const receipts = receiptsDates.map(([date, share]) => ({ date, amount: Math.round(amount * share) }));
    const diff = amount - receipts.reduce((a, r) => a + r.amount, 0);
    if (receipts.length > 0) receipts[receipts.length - 1]!.amount += diff;
    st.subsidies.push({
      id: `SUB-${op.id.replace('OP-', '')}-${g}`,
      operationId: op.id,
      programmeId: op.programmeId,
      grantorId: g,
      account: '',
      amount,
      decisionDate,
      receipts,
    });
  });
}

function grantorSplit(year: number, rehab: boolean): Record<string, number> {
  if (rehab) return { ETAT: 0.5, REGION: 0.2, COMMUNES: 0.3 };
  if (year < 1977) return { ETAT: 0.7, COMMUNES: 0.3 };
  if (year < 2000) return { ETAT: 0.5, REGION: 0.15, DEPARTEMENT: 0.15, COMMUNES: 0.2 };
  return { ETAT: 0.25, REGION: 0.2, DEPARTEMENT: 0.15, CA_VAL_AURELLE: 0.25, ACTION_LOGEMENT: 0.15 };
}

function costPerUnit(st: GenState, year: number, p: { kind: string; pavilions: boolean }): number {
  const a = st.params.scenario.assets;
  let c = interp(a.costPerUnitByYear, year) * st.levers.constructionCostScale;
  if (p.kind === 'collective') c *= a.collectivePlaceFactor;
  if (p.pavilions) c *= a.pavilionFactor;
  return c;
}

export function buildAssets(st: GenState): void {
  const rng = st.rng.fork('assets');
  const a = st.params.scenario.assets;
  const sp = st.params.scenario.specific;
  const cs = st.params.components;
  const levers = st.levers;

  for (const p of st.params.programmes) {
    const inService = isoDate(p.constructionYear, p.inServiceMonth, 1);
    if (p.id === 'TIL') continue; // built in 2025, see buildTilleuls

    // initial construction
    const op = addOperation(st, { id: `OP-${p.id}-C${p.constructionYear}`, programmeId: p.id, kind: 'construction', label: `Construction du programme ${p.name}`, year: p.constructionYear });
    const total = Math.round(p.units * costPerUnit(st, p.constructionYear, p) * rng.uniform(0.95, 1.05) * 100);
    const land = Math.round(total * interp(a.landShareByYear, p.constructionYear));
    addComponent(st, { programmeId: p.id, building: `${p.id}-TER`, family: 'land', operationId: op.id, cost: land, inServiceDate: inService, label: 'Terrain' });
    const shares = p.constructionYear < cs.retrospectiveBefore
      ? Object.fromEntries(Object.entries(cs.retrospectiveShares).filter(([, v]) => typeof v === 'number')) as Record<string, number>
      : cs.newConstructionShares;
    spreadOverBuildings(st, p.id, op.id, total - land, shares, inService);
    const rate = interp(a.subsidyRateByYear, p.constructionYear) * levers.subsidyScale * rng.uniform(0.85, 1.15);
    const dec = isoDate(p.constructionYear - 1, rng.int(2, 10), rng.int(1, 28));
    addSubsidies(st, op, total, rate, dec, grantorSplit(p.constructionYear, false), [
      [addDays(dec, 180), 0.4],
      [addDays(inService, 90), 0.6],
    ]);

    // rehabilitations
    const rehabYears: number[] = [];
    if (p.id === 'GLB') {
      // explicit, see below
    } else if (p.constructionYear < a.rehab.builtBefore) {
      let y = p.constructionYear + rng.int(a.rehab.minAge, a.rehab.maxAge);
      if (p.id === 'ERA') y = 2014;
      if (y <= 2022) rehabYears.push(y);
      const second = y + a.rehab.secondWaveAfterYears + rng.int(0, 4);
      if (p.id !== 'LIL' && p.id !== 'ERA' && second <= 2022) rehabYears.push(second);
    } else if (p.constructionYear + 23 <= 2023 && p.kind === 'family') {
      // heating renewal for recent programmes (individual boilers)
      const y = p.constructionYear + rng.int(22, 25);
      if (y <= 2023) {
        const rop = addOperation(st, { id: `OP-${p.id}-R${y}`, programmeId: p.id, kind: 'replacement', label: 'Remplacement des chaudières individuelles', year: y });
        const cost = Math.round(p.units * 2600 * rng.uniform(0.9, 1.1) * 100);
        spreadOverBuildings(st, p.id, rop.id, cost, { heating: 1 }, isoDate(y, rng.int(3, 10), 1), { replaces: true });
      }
    }
    for (const y of rehabYears) {
      const rop = addOperation(st, { id: `OP-${p.id}-H${y}`, programmeId: p.id, kind: 'rehabilitation', label: `Réhabilitation ${y}`, year: y });
      const cost = Math.round(p.units * interp(a.rehab.costPerUnitByYear, y) * levers.constructionCostScale * (p.pavilions ? 1.2 : 1) * (p.kind === 'collective' ? 0.6 : 1) * rng.uniform(0.9, 1.1) * 100);
      const shares = p.id === 'ERA' ? { windows: 0.3, facade: 0.3, roofing: 0.14, electricity: 0.14, plumbing: 0.12 } : cs.rehabilitationShares;
      const date = isoDate(y, rng.int(3, 11), 1);
      spreadOverBuildings(st, p.id, rop.id, cost, shares, date, { replaces: true, suffix: '-R' });
      const rdec = isoDate(y - 1, rng.int(3, 11), rng.int(1, 28));
      addSubsidies(st, rop, cost, a.rehabSubsidyRate * levers.subsidyScale * rng.uniform(0.8, 1.2), rdec, grantorSplit(y, true), [
        [addDays(rdec, 200), 0.5],
        [addDays(date, 120), 0.5],
      ]);
    }
  }

  buildGlycinesB(st);
  buildErables(st);
  buildClosFleuriImprovement(st);
  buildHeadOffice(st);
}

function buildGlycinesB(st: GenState): void {
  const g = st.params.scenario.specific.glycinesB;
  const op = addOperation(st, { id: 'OP-GLB-H2015', programmeId: 'GLB', kind: 'rehabilitation', label: 'Réhabilitation lourde du bâtiment B (PNRU)', year: 2015 });
  const cost = eur(g.rehabCostEuros);
  const structure = Math.round(cost * g.rehabStructureShare);
  const rest = cost - structure;
  const shares = { windows: 0.25, heating: 0.25, electricity: 0.1666667, plumbing: 0.1666667, roofing: 0.1666666 };
  const buildings = st.buildings.filter((b) => b.programmeId === 'GLB');
  // the 1968 components of these families are retired
  const comps = spreadOverBuildings(st, 'GLB', op.id, rest, shares, g.rehabInService, { replaces: true, suffix: '-R' });
  void comps;
  const perBuilding = allocate(structure, buildings.map((b) => b.units));
  buildings.forEach((b, i) =>
    addComponent(st, { programmeId: 'GLB', building: b.id, family: 'structure', operationId: op.id, cost: perBuilding[i]!, inServiceDate: g.rehabInService, suffix: '-R', label: 'Restructuration lourde (gros œuvre)' }),
  );
  st.subsidies.push({
    id: 'SUB-GLB-H2015-ANRU',
    operationId: op.id,
    programmeId: 'GLB',
    grantorId: 'ANRU',
    account: '',
    amount: eur(g.rehabSubsidyEuros),
    decisionDate: '2014-11-14',
    receipts: [
      { date: '2015-03-20', amount: eur(g.rehabSubsidyEuros * 0.5) },
      { date: '2016-02-12', amount: eur(g.rehabSubsidyEuros * 0.5) },
    ],
  });
}

function buildErables(st: GenState): void {
  const e = st.params.scenario.specific.erables;
  const op = addOperation(st, { id: 'OP-ERA-R2008', programmeId: 'ERA', kind: 'replacement', label: 'Chaufferie collective gaz', year: 2008 });
  const boilerBuilding = 'ERA-B01';
  // the original heating of building B01 represents the whole collective heating plant
  for (const c of st.components.filter((x) => x.programmeId === 'ERA' && x.family === 'heating' && !x.disposal)) c.disposal = { date: '2007-12-31', reason: 'replacement' };
  addComponent(st, { programmeId: 'ERA', building: boilerBuilding, family: 'heating', operationId: op.id, cost: eur(e.boilerCostEuros), inServiceDate: e.boilerInService, label: 'Chaufferie collective (chaudières gaz)', suffix: '-CHAUF' });
}

/** Thermal improvement of the Clos Fleuri pavilions (2018), sized so that the 7 pavilions sold in 2026 have the target book value. */
function buildClosFleuriImprovement(st: GenState): void {
  const target = eur(st.params.scenario.specific.closFleuri2026.nbvTargetEuros);
  const sold = closFleuri2026Buildings(st);
  const date = '2018-10-01';
  const op = addOperation(st, { id: 'OP-CLF-A2018', programmeId: 'CLF', kind: 'improvement', label: 'Amélioration énergétique des pavillons (isolation, menuiseries, chaudières)', year: 2018 });
  const shares = { windows: 0.35, heating: 0.3, facade: 0.35 };
  // book value at 31/12/2025 of the existing components of the sold pavilions + share of land
  const nbvExisting = (ids: readonly string[]) =>
    st.components
      .filter((c) => ids.includes(c.building) && !c.disposal && !(c.family in shares))
      .reduce((s, c) => s + c.cost - accumulatedDepreciation(c, '2025-12-31'), 0);
  const land = st.components.find((c) => c.programmeId === 'CLF' && c.family === 'land')!;
  const landShare = Math.round((land.cost * sold.length) / st.buildings.filter((b) => b.programmeId === 'CLF').length);
  const existing = nbvExisting(sold) + landShare;
  // NBV at 31/12/2025 of a 2018-10-01 component: windows/heating 25 y, facade 20 y
  const elapsed = 92 / 365 + 7;
  const nbvPerEuro = shares.windows * (1 - elapsed / 25) + shares.heating * (1 - elapsed / 25) + shares.facade * (1 - elapsed / 20);
  const perPavilion = Math.max(0, (target - existing) / sold.length / nbvPerEuro);
  const all = st.buildings.filter((b) => b.programmeId === 'CLF');
  spreadOverBuildings(st, 'CLF', op.id, Math.round(perPavilion * all.length), shares, date, { replaces: true, suffix: '-A' });
}

export function closFleuri2026Buildings(st: GenState): string[] {
  const all = st.buildings.filter((b) => b.programmeId === 'CLF').map((b) => b.id);
  // pavilions 01–10 are sold in 2024–2025, 11–17 under promise in December 2025
  return all.slice(10, 10 + st.params.scenario.specific.closFleuri2026.units);
}

function buildHeadOffice(st: GenState): void {
  const h = st.params.scenario.assets.headOffice;
  const op = addOperation(st, { id: 'OP-SIE-1999', programmeId: 'SIE', kind: 'acquisition', label: 'Siège social', year: 1999 });
  addComponent(st, { programmeId: 'SIE', building: 'SIE-TER', family: 'land', operationId: op.id, cost: eur(h.landEuros), inServiceDate: h.inService, label: 'Terrain du siège' });
  addComponent(st, { programmeId: 'SIE', building: 'SIE', family: 'structure', operationId: op.id, cost: eur(h.costEuros), inServiceDate: h.inService, label: 'Siège social', lifeYears: h.lifeYears, account: '2138' });
  const rng = st.rng.fork('office');
  for (let y = 2016; y <= 2023; y++) {
    const iop = addOperation(st, { id: `OP-SIE-I${y}`, programmeId: 'SIE', kind: 'acquisition', label: `Matériel informatique ${y}`, year: y });
    addComponent(st, { programmeId: 'SIE', building: 'SIE', family: 'other', operationId: iop.id, cost: eur(st.params.scenario.assets.itEquipmentPerYearEuros * rng.uniform(0.85, 1.15)), inServiceDate: isoDate(y, 4, 1), label: `Matériel informatique ${y}`, lifeYears: 4, account: '2183', suffix: '-IT' });
  }
  for (let y = 2014; y <= 2023; y += 3) {
    const fop = addOperation(st, { id: `OP-SIE-M${y}`, programmeId: 'SIE', kind: 'acquisition', label: `Mobilier ${y}`, year: y });
    addComponent(st, { programmeId: 'SIE', building: 'SIE', family: 'other', operationId: fop.id, cost: eur(st.params.scenario.assets.furniturePerYearEuros * 3 * rng.uniform(0.85, 1.15)), inServiceDate: isoDate(y, 9, 1), label: `Mobilier ${y}`, lifeYears: 10, account: '2184', suffix: '-MOB' });
  }
  const sop = addOperation(st, { id: 'OP-SIE-L2019', programmeId: 'SIE', kind: 'acquisition', label: 'Progiciel comptable (ancien système)', year: 2019 });
  addComponent(st, { programmeId: 'SIE', building: 'SIE', family: 'other', operationId: sop.id, cost: eur(310000), inServiceDate: '2019-01-01', label: 'Progiciel comptable (ancien système)', lifeYears: 5, account: '2051', suffix: '-LOG' });
}

/** Subsidy accounts follow the grantor. */
export function finaliseSubsidies(st: GenState): void {
  for (const s of st.subsidies) {
    s.account = s.grantorId === 'ETAT' ? '1311' : s.grantorId === 'REGION' ? '1312' : s.grantorId === 'DEPARTEMENT' ? '1313' : s.grantorId === 'ACTION_LOGEMENT' ? '1317' : s.grantorId === 'ANRU' ? '1318' : '1314';
  }
}

export { addComponent, addOperation, spreadOverBuildings, retire };
export type { Subsidy };
