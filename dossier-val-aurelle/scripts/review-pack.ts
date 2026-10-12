/**
 * Business review pack (end of J2): `npm run review-pack` writes
 * docs/revue-metier/ — trial balance N / N-1, presented and corrected
 * statements, anomalies with computed impacts and correction entries, clues
 * per anomaly, false leads, rendering of every document, calibration report.
 * HTML pages for reading, CSV files (semicolon, UTF-8 with BOM) for Excel.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { accountMap } from '../src/engine/chart';
import { closingBalances } from '../src/engine/balance';
import { formatAmount, formatPercent } from '../src/engine/format';
import { formatDateFr } from '../src/engine/dates';
import type { Cents } from '../src/engine/money';
import { ANOMALIES } from '../src/scenario/anomalies/modules';
import { buildCorrectionKey } from '../src/scenario/anomalies/presented';
import { buildSynthesis } from '../src/scenario/anomalies/synthesis';
import { calibrationRows, presentedRows } from '../src/scenario/calibration';
import { buildDocuments } from '../src/scenario/documents';
import type { Block, DocumentModel } from '../src/scenario/documents';
import { generateWorld } from '../src/scenario/generator';
import { loadParams } from '../src/scenario/params';
import { managementReport } from '../src/scenario/report';

const OUT = resolve(import.meta.dirname, '../docs/revue-metier');
mkdirSync(OUT, { recursive: true });

const t0 = Date.now();
const params = loadParams();
const gen = generateWorld(params);
const clean = gen.world;
const key = buildCorrectionKey(clean, params);
const syn = buildSynthesis(key, clean, params);
const docs = buildDocuments(params, clean, key);
const presented = key.presented.world;
const chart = accountMap(clean.chart);
const refLabel = new Map(params.references.map((r) => [r.id, r]));

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const amt = (c: Cents) => formatAmount(c, 2);
const amt0 = (c: Cents) => formatAmount(c, 0);
const k = (c: Cents) => formatAmount(Math.round(c / 1000) * 1000, 0);
const csvCell = (v: string | number) => {
  const s = typeof v === 'number' ? String(v).replace('.', ',') : v;
  return /[;"\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const csvAmount = (c: Cents) => (c / 100).toFixed(2).replace('.', ',');
function writeCsv(name: string, header: string[], rows: (string | number)[][]): void {
  writeFileSync(resolve(OUT, name), '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n');
}

const CSS = `
:root{--bg:#fbfaf7;--fg:#1d1d1b;--muted:#6b6b66;--line:#dedbd2;--head:#f0ede5;--accent:#1f4e79;--warn:#9a3412;--ok:#166534;--clue:#fff3c4;--clue-line:#e0b400;--card:#ffffff}
@media (prefers-color-scheme: dark){:root{--bg:#161615;--fg:#ecebe6;--muted:#a3a29b;--line:#3a3935;--head:#23221f;--accent:#8ab4e0;--warn:#f0a07a;--ok:#86d39b;--clue:#4a3f12;--clue-line:#c9a20a;--card:#1d1c1a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px 64px}h1{font-size:1.6rem;margin:.2em 0 .4em}h2{font-size:1.25rem;margin:2em 0 .6em;border-bottom:2px solid var(--line);padding-bottom:.2em}h3{font-size:1.05rem;margin:1.6em 0 .4em}h4{margin:1em 0 .3em}
a{color:var(--accent)}nav{display:flex;flex-wrap:wrap;gap:6px 16px;margin:8px 0 20px;font-size:.95rem}
.muted{color:var(--muted)}.warn{color:var(--warn)}.ok{color:var(--ok)}
.scroll{overflow-x:auto;margin:.4em 0 1em}table{border-collapse:collapse;width:100%;font-size:.88rem;background:var(--card)}
th,td{border:1px solid var(--line);padding:4px 7px;vertical-align:top}th{background:var(--head);text-align:left;font-weight:600}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}tr.sub td{font-weight:600;background:var(--head)}tr.diff td{background:var(--clue)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:12px 0}.kpi{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:10px 12px}.kpi b{display:block;font-size:1.2rem}
.doc{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:14px 16px;margin:18px 0}.doc header{border-bottom:1px solid var(--line);margin-bottom:8px;padding-bottom:6px}
.doc .meta{font-size:.82rem;color:var(--muted)}.clue{background:var(--clue);outline:1px dashed var(--clue-line)}.tag{display:inline-block;font-size:.72rem;border:1px solid var(--clue-line);border-radius:3px;padding:0 4px;margin-left:4px;color:var(--fg)}
.stamp{display:inline-block;border:2px solid var(--warn);color:var(--warn);padding:2px 8px;transform:rotate(-3deg);font-weight:600;margin:6px 0}.sig{margin:10px 0 0;font-style:italic}.note{font-size:.88rem;color:var(--muted)}
dl.fields{display:grid;grid-template-columns:minmax(180px,40%) 1fr;gap:2px 12px;margin:.4em 0}dl.fields dt{color:var(--muted)}dl.fields dd{margin:0}
@media (max-width:640px){dl.fields{grid-template-columns:1fr}main{padding:16px}}
`;

function page(file: string, title: string, body: string): void {
  const nav = [
    ['index.html', 'Synthèse'],
    ['balance.html', 'Balance N / N-1'],
    ['etats.html', 'États présentés / corrigés'],
    ['anomalies.html', 'Anomalies et corrections'],
    ['indices.html', 'Indices et fausses pistes'],
    ['documents.html', 'Documents'],
    ['calibrage.html', 'Calibrage'],
  ]
    .map(([f, l]) => (f === file ? `<strong>${l}</strong>` : `<a href="${f}">${l}</a>`))
    .join('');
  writeFileSync(
    resolve(OUT, file),
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><main><p class="muted">Dossier Val d’Aurelle — revue métier de fin de J2 (données fictives générées par le moteur)</p><h1>${esc(title)}</h1><nav>${nav}</nav>${body}</main></body></html>\n`,
  );
}

function table(head: string[], rows: string[][], opts: { numeric?: number[]; rowClass?: (i: number) => string } = {}): string {
  const num = new Set(opts.numeric ?? []);
  return `<div class="scroll"><table><thead><tr>${head.map((h, i) => `<th${num.has(i) ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r, ri) => `<tr${opts.rowClass?.(ri) ? ` class="${opts.rowClass(ri)}"` : ''}>${r.map((c, i) => `<td${num.has(i) ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}

// ---------------------------------------------------------------------------
// 1. balance N / N-1
// ---------------------------------------------------------------------------
{
  const bp = closingBalances(presented.ledgers.current);
  const bc = closingBalances(clean.ledgers.current);
  const b24 = closingBalances(clean.ledgers.prior);
  const accounts = [...new Set([...bp.keys(), ...bc.keys(), ...b24.keys()])].sort();
  const rows = accounts.map((a) => ({ a, label: chart.get(a)?.label ?? '?', p: bp.get(a) ?? 0, c: bc.get(a) ?? 0, n1: b24.get(a) ?? 0 }));
  writeCsv('balance.csv', ['Compte', 'Libellé', 'Solde 2025 présenté', 'Solde 2025 corrigé', 'Écart (présenté − corrigé)', 'Solde 2024 certifié'], rows.map((r) => [r.a, r.label, csvAmount(r.p), csvAmount(r.c), csvAmount(r.p - r.c), csvAmount(r.n1)]));
  const tot = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  page(
    'balance.html',
    'Balance générale N / N-1',
    `<p>Soldes de clôture (débit positif, crédit négatif). <strong>Présenté</strong> = comptes du client (22 anomalies non corrigées) ; <strong>corrigé</strong> = comptes propres ; les lignes surlignées portent un écart. Total des soldes : ${amt(tot((r) => r.p))} / ${amt(tot((r) => r.c))} / ${amt(tot((r) => r.n1))} (balance équilibrée). <a href="balance.csv">Télécharger le CSV</a>.</p>` +
      table(['Compte', 'Libellé', '2025 présenté', '2025 corrigé', 'Écart', '2024 certifié'], rows.map((r) => [r.a, esc(r.label), amt(r.p), amt(r.c), r.p === r.c ? '' : amt(r.p - r.c), amt(r.n1)]), { numeric: [2, 3, 4, 5], rowClass: (i) => (rows[i]!.p !== rows[i]!.c ? 'diff' : '') }),
  );
}

// ---------------------------------------------------------------------------
// 2. statements presented / corrected
// ---------------------------------------------------------------------------
{
  const ps = key.presentedFigures.statements;
  const cs = key.cleanFigures.statements;
  const csvRows: (string | number)[][] = [];
  const section = (statement: 'assets' | 'liabilities' | 'income', title: string) => {
    const defs = params.statements.filter((d) => d.statement === statement);
    const rows = defs.map((d) => {
      const p = ps.lines[d.id]!;
      const c = cs.lines[d.id]!;
      csvRows.push([title, d.id, d.label, csvAmount(p.current), csvAmount(c.current), csvAmount(p.current - c.current), csvAmount(p.prior), csvAmount(c.prior)]);
      return { d, cells: [`${d.kind === 'detail' ? '&nbsp;&nbsp;' : ''}${esc(d.label)}`, amt0(p.current), amt0(c.current), p.current === c.current ? '' : amt0(p.current - c.current), amt0(p.prior), p.prior === c.prior ? amt0(c.prior) : `<span class="warn">${amt0(c.prior)}</span>`] };
    });
    return `<h2>${title}</h2>` + table(['Rubrique', '2025 présenté', '2025 corrigé', 'Écart', '2024 présenté', '2024 certifié'], rows.map((r) => r.cells), { numeric: [1, 2, 3, 4, 5], rowClass: (i) => (rows[i]!.d.kind !== 'detail' ? 'sub' : ps.lines[rows[i]!.d.id]!.current !== cs.lines[rows[i]!.d.id]!.current ? 'diff' : '') });
  };
  const pf = key.presentedFigures.figures;
  const cf = key.cleanFigures.figures;
  const kfRows = [
    ['Résultat net', amt0(pf.netResult), amt0(cf.netResult)],
    ['Loyers nets de RLS', amt0(pf.rents), amt0(cf.rents)],
    ['Excédent brut d’exploitation / loyers', formatPercent(pf.ebeOnRents, 2), formatPercent(cf.ebeOnRents, 2)],
    ['Capacité d’autofinancement', amt0(pf.caf), amt0(cf.caf)],
    ['Remboursements d’emprunts (activité locative, hors anticipés)', amt0(pf.loanRepayments), amt0(cf.loanRepayments)],
    ['Autofinancement net HLM', amt0(pf.netSelfFinancing), amt0(cf.netSelfFinancing)],
    ['Dénominateur (produits d’activité hors récupérations + produits financiers)', amt0(pf.denominator), amt0(cf.denominator)],
    ['Ratio d’autofinancement net', formatPercent(pf.netSelfFinancingRatio, 2), formatPercent(cf.netSelfFinancingRatio, 2)],
  ];
  const sections = section('assets', 'Bilan – actif') + section('liabilities', 'Bilan – passif') + section('income', 'Compte de résultat');
  writeCsv('etats.csv', ['État', 'Rubrique', 'Libellé', '2025 présenté', '2025 corrigé', 'Écart', '2024 présenté', '2024 certifié'], csvRows);
  page(
    'etats.html',
    'États financiers présentés et corrigés',
    `<p>Bilan (valeurs nettes) et compte de résultat 2025 présentés par le client et corrigés de toutes les anomalies ; colonne 2024 telle que présentée (A22 : dépôts de garantie reclassés en « autres dettes ») et telle que certifiée (en orange quand elle diffère). <a href="etats.csv">CSV</a>.</p>` +
      `<h2>Agrégats et autofinancement net HLM</h2>` + table(['Agrégat', '2025 présenté', '2025 corrigé'], kfRows, { numeric: [1, 2] }) + sections,
  );
}

// ---------------------------------------------------------------------------
// 3. anomalies, impacts, correction entries
// ---------------------------------------------------------------------------
{
  const targetText = (t: { value?: number; tol?: number; tolPct?: number } | undefined) => (t?.value === undefined ? '' : `${formatAmount(Math.round(t.value * 100), 0)}${t.tolPct ? ` ± ${t.tolPct} %` : t.tol ? ` ± ${formatAmount(Math.round(t.tol * 100), 0)}` : ''}`);
  const summaryRows = syn.anomalies.map((a) => {
    const m = ANOMALIES.find((x) => x.id === a.id)!;
    return [
      `<a href="#${a.id}">${a.id}</a>`,
      esc(a.title),
      '★'.repeat(m.difficulty),
      amt0(a.impact.result),
      esc(targetText(a.target)),
      a.withinTarget ? '<span class="ok">oui</span>' : '<span class="warn">non</span>',
      amt0(a.impact.equity),
      amt0(a.impact.caf),
      amt0(a.impact.netSelfFinancing),
      amt0(a.impact.totalAssets),
    ];
  });
  writeCsv('anomalies.csv', ['Anomalie', 'Partie', 'Libellé', 'Traitement', 'Impact résultat', 'Impact capitaux propres', 'Impact CAF', 'Impact autofinancement net', 'Impact total du bilan', 'Cible §5 (anomalie)', 'Conforme'], key.corrections.map((c) => {
    const a = syn.anomalies.find((x) => x.id === c.anomalyId)!;
    return [c.anomalyId, c.key, c.part.label, c.part.treatment, csvAmount(c.impact.result), csvAmount(c.impact.equity), csvAmount(c.impact.caf), csvAmount(c.impact.netSelfFinancing), csvAmount(c.impact.totalAssets), targetText(a.target), a.withinTarget ? 'oui' : 'non'];
  }));
  writeCsv('corrections.csv', ['Partie', 'Écriture', 'Compte', 'Libellé du compte', 'Compte auxiliaire', 'Débit', 'Crédit'], key.corrections.flatMap((c) => (c.entry?.lines ?? []).map((l) => [c.key, c.entry!.id, l.account, chart.get(l.account)?.label ?? '', l.aux ?? '', csvAmount(l.debit), csvAmount(l.credit)])));
  const treat: Record<string, string> = { adjust: 'écriture de correction', reclassify: 'reclassement', disclose: 'information en annexe', report: 'rapport de gestion', specialReport: 'rapport spécial', governance: 'gouvernance / signalement' };
  const stanceText: Record<string, string> = { accepts: 'accepte', contests: 'conteste', yieldsOnEvidence: 'cède sur preuves', refuses: 'refuse' };
  const who: Record<string, string> = { cfo: 'DAF', ceo: 'DG', chiefAccountant: 'chef comptable', assetDirector: 'directrice du patrimoine' };
  const details = ANOMALIES.map((m) => {
    const a = syn.anomalies.find((x) => x.id === m.id)!;
    const parts = key.corrections.filter((c) => c.anomalyId === m.id).map((c) => {
      const entry = c.entry
        ? table(['Compte', 'Libellé', 'Auxiliaire', 'Débit', 'Crédit'], c.entry.lines.map((l) => [l.account, esc(chart.get(l.account)?.label ?? ''), l.aux ?? '', l.debit ? amt(l.debit) : '', l.credit ? amt(l.credit) : '']), { numeric: [3, 4] })
        : `<p class="muted">Pas d’écriture : ${esc(c.part.disclosureFix ?? treat[c.part.treatment] ?? '')}</p>`;
      const stance = m.stance.filter((s) => s.partId === c.key).map((s) => `${who[s.character]} : ${stanceText[s.stance]}${s.argument ? ` — « ${esc(s.argument)} »` : ''}${s.requiredEvidence?.length ? ` <span class="muted">(preuves : ${s.requiredEvidence.join(', ')}${s.requiresPartner ? ' ; associée requise' : ''})</span>` : ''}`).join('<br>');
      return `<h4>${c.key} — ${esc(c.part.label)}</h4><p class="muted">Traitement : ${treat[c.part.treatment]} · impact résultat ${amt0(c.impact.result)} · capitaux propres ${amt0(c.impact.equity)} · CAF ${amt0(c.impact.caf)} · autofinancement net ${amt0(c.impact.netSelfFinancing)}${c.part.tolerance ? ` · tolérance acceptée ${formatAmount(c.part.tolerance.minEuros * 100, 0)} à ${formatAmount(c.part.tolerance.maxEuros * 100, 0)}` : ''}</p>${entry}${c.part.disclosureFix && c.entry ? `<p class="note">Et : ${esc(c.part.disclosureFix)}</p>` : ''}<p>Négociation : ${stance}</p>`;
    }).join('');
    const refs = m.debrief.references.map((r) => `${esc(refLabel.get(r)?.label ?? r)}${refLabel.get(r)?.status !== 'validated' ? ' <span class="muted">(à vérifier)</span>' : ''}`).join(' ; ');
    return `<h3 id="${m.id}">${m.id} — ${esc(m.title)}</h3><p class="muted">Cycle ${m.cycle} · ${m.classification} · gravité ${m.severity} · difficulté ${'★'.repeat(m.difficulty)}${m.individuallySignificant ? ' · individuellement significative' : ''} · impact total ${amt0(a.impact.result)} (cible ${esc(targetText(a.target))})</p>${parts}<p><strong>Débrief.</strong> ${esc(m.debrief.explanation)}</p><p><strong>Bonne pratique.</strong> ${esc(m.debrief.goodPractice)}</p><p class="muted">Procédures efficaces : ${m.debrief.procedures.map(esc).join(' ; ')}. Références : ${refs}.</p>`;
  }).join('');
  page(
    'anomalies.html',
    'Anomalies : impacts calculés et écritures de correction',
    `<p>Impacts = surévaluation du résultat présenté (« + » = résultat présenté trop élevé), lus sur les écritures de correction calculées par le moteur, dans l’ordre canonique (une partie corrigée après les précédentes). Contrôle : présenté + Σ corrections = propre (test bloquant). <a href="anomalies.csv">CSV des impacts</a> · <a href="corrections.csv">CSV des écritures</a>.</p>` +
      table(['Id', 'Anomalie', 'Diff.', 'Impact résultat', 'Cible §5', 'Conforme', 'Capitaux propres', 'CAF', 'Autofin. net', 'Total bilan'], summaryRows, { numeric: [3, 4, 6, 7, 8, 9] }) +
      `<h2>Détail par anomalie</h2>${details}`,
  );
}

// ---------------------------------------------------------------------------
// 4. clues per anomaly, false leads
// ---------------------------------------------------------------------------
{
  const avail = (d: DocumentModel) => {
    const a = d.availability;
    switch (a.kind) {
      case 'initial': return 'dossier initial';
      case 'onRequest': return `sur demande (${a.request})`;
      case 'confirmation': return `confirmation (${a.request}), reçue le ${formatDateFr(a.arrives)}`;
      case 'afterDate': return `à partir du ${formatDateFr(a.from)}`;
      case 'conditional': return a.condition === 'chiefAccountantConfides' ? 'si le chef comptable se confie' : 'si l’association des locataires prend contact';
    }
  };
  const rows: (string | number)[][] = [];
  const blocks = [...ANOMALIES.map((m) => ({ id: m.id, title: m.title })), ...docs.falseLeads.map((f) => ({ id: f.id, title: f.title }))].map(({ id, title }) => {
    const clues = docs.cluesOf(id as never);
    for (const c of clues) rows.push([id, c.parts?.join(', ') ?? '', c.documentId, docs.byId.get(c.documentId)!.title, c.source, avail(docs.byId.get(c.documentId)!), c.text]);
    const fl = docs.falseLeads.find((f) => f.id === id);
    return `<h3 id="${id}">${id} — ${esc(title)}</h3>${fl ? `<p><strong>Observation :</strong> ${esc(fl.observation)} <strong>Explication :</strong> ${esc(fl.explanation)}${fl.relationshipCost === 'high' ? ' <span class="warn">(accusation sans preuve : coût relationnel élevé)</span>' : ''}</p>` : ''}` +
      table(['Partie', 'Document', 'Source', 'Accès', 'Indice'], clues.map((c) => [c.parts?.join(', ') ?? '—', `<a href="documents.html#${c.documentId}">${esc(docs.byId.get(c.documentId)!.title)}</a>`, c.source, esc(avail(docs.byId.get(c.documentId)!)), esc(c.text)]));
  }).join('');
  writeCsv('indices.csv', ['Cible', 'Parties', 'Document', 'Titre du document', 'Source', 'Accès', 'Indice'], rows);
  page('indices.html', 'Indices par anomalie et fausses pistes', `<p>${docs.clues.length} indices répartis dans ${new Set(docs.clues.map((c) => c.documentId)).size} documents. Chaque anomalie a au moins deux indices dans des documents distincts (test bloquant). <a href="indices.csv">CSV</a>.</p>${blocks}`);
}

// ---------------------------------------------------------------------------
// 5. documents
// ---------------------------------------------------------------------------
{
  const clueTargets = new Map(docs.clues.map((c) => [c.id, `${c.target}${c.parts ? ` (${c.parts.join(', ')})` : ''}`]));
  const tag = (clue?: string) => (clue ? `<span class="tag">${esc(clueTargets.get(clue) ?? '')}</span>` : '');
  const cls = (clue?: string) => (clue ? ' class="clue"' : '');
  const render = (b: Block): string => {
    switch (b.kind) {
      case 'heading': return `<h4${cls(b.clue)}>${esc(b.text)}${tag(b.clue)}</h4>`;
      case 'paragraph': return `<p${cls(b.clue)}>${esc(b.text)}${tag(b.clue)}</p>`;
      case 'note': return `<p class="note${b.clue ? ' clue' : ''}">${esc(b.text)}${tag(b.clue)}</p>`;
      case 'fields': return `<dl class="fields">${b.rows.map((r) => `<dt>${esc(r.label)}</dt><dd${cls(r.clue)}>${esc(r.value)}${tag(r.clue)}</dd>`).join('')}</dl>`;
      case 'list': return `<ul>${b.items.map((i) => `<li${cls(i.clue)}>${esc(i.text)}${tag(i.clue)}</li>`).join('')}</ul>`;
      case 'signature': return `<p class="sig">${esc(b.name)}, ${esc(b.role)}${b.date ? ` — le ${esc(b.date)}` : ''}</p>`;
      case 'stamp': return `<p><span class="stamp${b.clue ? ' clue' : ''}">${esc(b.text)} ${esc(b.date)}</span>${tag(b.clue)}</p>`;
      case 'table': {
        const right = new Set((b.align ?? []).map((a, i) => (a === 'right' ? i : -1)).filter((i) => i >= 0));
        return `${b.title ? `<p><strong>${esc(b.title)}</strong></p>` : ''}<div class="scroll"><table><thead><tr>${b.columns.map((c, i) => `<th${right.has(i) ? ' class="n"' : ''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr${cls(r.clue)}>${r.cells.map((c, i) => `<td${right.has(i) ? ' class="n"' : ''}>${esc(c)}${i === r.cells.length - 1 ? tag(r.clue) : ''}</td>`).join('')}</tr>`).join('')}</tbody>${b.footer ? `<tfoot><tr>${b.footer.map((c, i) => `<th${right.has(i) ? ' class="n"' : ''}>${esc(c)}</th>`).join('')}</tr></tfoot>` : ''}</table></div>`;
      }
    }
  };
  const cat: Record<string, string> = { permanent: 'Dossier permanent', governance: 'Gouvernance', accounting: 'Comptabilité', contracts: 'Contrats et pièces', mail: 'Courrier', internal: 'Échanges internes', thirdParty: 'Réponses de tiers' };
  const order = Object.keys(cat);
  const sorted = [...docs.documents].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || (a.date < b.date ? -1 : 1));
  const toc = order.map((c) => `<h3>${cat[c]}</h3><ul>${sorted.filter((d) => d.category === c).map((d) => `<li><a href="#${d.id}">${esc(d.title)}</a> <span class="muted">(${formatDateFr(d.date)}${d.noise ? ', bruit' : `, ${d.clues.length} indice(s)`})</span></li>`).join('')}</ul>`).join('');
  const body = sorted.map((d) => `<article class="doc" id="${d.id}"><header><strong>${esc(d.title)}</strong><div class="meta">${esc(d.issuer)}${d.recipient ? ` → ${esc(d.recipient)}` : ''} · ${formatDateFr(d.date)}${d.reference ? ` · réf. ${esc(d.reference)}` : ''} · ${cat[d.category]} · id <code>${d.id}</code>${d.noise ? ' · bruit' : ''}</div></header>${d.blocks.map(render).join('')}</article>`).join('');
  page('documents.html', 'Documents du dossier', `<p>${docs.documents.length} documents, dont ${docs.documents.filter((d) => d.noise).length} de « bruit ». Les passages portant un indice sont surlignés et étiquetés (anomalie ciblée) : en jeu, ce marquage n’apparaît qu’en mode concepteur.</p>${toc}${body}`);
}

// ---------------------------------------------------------------------------
// 6. calibration, 7. index
// ---------------------------------------------------------------------------
{
  const rows = [...calibrationRows(gen, params), ...presentedRows(key, params)];
  writeCsv('calibrage.csv', ['Exercice', 'Agrégat', 'Cible', 'Obtenu', 'Statut'], rows.map((r) => [String(r.year), r.label, r.targetText, r.valueText, r.ok ? 'OK' : 'HORS TOLÉRANCE']));
  page('calibrage.html', 'Calibrage : cibles et valeurs obtenues', `<p>${rows.filter((r) => r.ok).length}/${rows.length} cibles atteintes (comptes propres 2024-2025, métriques des anomalies, comptes présentés 2025 du §4.3). <a href="calibrage.csv">CSV</a>.</p>` + table(['Exercice', 'Agrégat', 'Cible', 'Obtenu', 'Statut'], rows.map((r) => [String(r.year), esc(r.label), esc(r.targetText), esc(r.valueText), r.ok ? '<span class="ok">OK</span>' : '<span class="warn">hors tolérance</span>']), { numeric: [3] }));
}
{
  const report = managementReport(presented, key.presentedFigures.figures, key.presented.facts);
  const kpi = (label: string, value: string, sub = '') => `<div class="kpi">${label}<b>${value}</b><span class="muted">${sub}</span></div>`;
  const m = syn.materiality;
  const body =
    `<p>Ce dossier rassemble ce que la validation métier de fin de J2 doit examiner (cahier des charges, §0 et §12). Tout chiffre est calculé par le moteur à partir des écritures ; rien n’est saisi à la main. Régénération : <code>npm run review-pack</code>.</p>` +
    `<div class="kpis">${kpi('Résultat présenté', `${k(syn.presentedResult)} €`, 'cible 9,20 M€')}${kpi('Résultat corrigé', `${k(syn.correctedResult)} €`, 'cible ≈ 4,83 M€')}${kpi('Surévaluations', `${k(syn.overstatements)} €`, 'cible ≈ 4,60 M€')}${kpi('Sous-évaluation (A08)', `${k(syn.understatements)} €`, 'cible ≈ −0,24 M€')}${kpi('Ratio d’autofinancement net', `${formatPercent(syn.presentedRatio)} → ${formatPercent(syn.correctedRatio)}`, 'présenté → corrigé')}${kpi('Moyenne sur 3 ans', `${formatPercent(syn.threeYearPresented)} → ${formatPercent(syn.threeYearCorrected)}`, `taux de référence ${formatPercent(syn.referenceRates.threeYears, 0)}`)}${kpi('Autofinancement net surévalué de', `${k(syn.netSelfFinancingOverstatement)} €`, 'cible ≈ 1,27 M€')}${kpi('Documents / indices', `${docs.documents.length} / ${docs.clues.length}`, `${docs.documents.filter((d) => d.noise).length} documents de bruit`)}</div>` +
    `<h2>Synthèse de référence (§5)</h2>` +
    `<p>Seuil de signification ${amt0(m.overall)} ; seuil de planification ${amt0(m.performance)} ; anomalies manifestement insignifiantes ${amt0(m.trivial)}. Individuellement supérieures au seuil de signification : <strong>${syn.aboveOverall.join(', ')}</strong>. Entre le seuil de planification et le seuil de signification : ${syn.betweenPerformanceAndOverall.join(', ')}.</p>` +
    table(['Anomalie', 'Impact résultat', 'Cible §5', 'Conforme', 'Capitaux propres', 'Autofinancement net'], syn.anomalies.map((a) => [`<a href="anomalies.html#${a.id}">${a.id}</a> ${esc(a.title)}`, amt0(a.impact.result), a.target?.value !== undefined ? formatAmount(Math.round(a.target.value * 100), 0) : '', a.withinTarget ? '<span class="ok">oui</span>' : '<span class="warn">non</span>', amt0(a.impact.equity), amt0(a.impact.netSelfFinancing)]), { numeric: [1, 2, 4, 5] }) +
    `<h2>Rapport de gestion présenté (A14)</h2>` +
    table(['Information', 'Présentée', 'Selon les données'], [
      ['Factures fournisseurs échues non réglées', `${report.paymentTerms.shown.count} – ${amt0(report.paymentTerms.shown.amount)}`, `${report.paymentTerms.computed.count} – ${amt0(report.paymentTerms.computed.amount)}`],
      ['Taux de vacance', formatPercent(report.vacancy.shownRate), `${formatPercent(report.vacancy.computed.totalRate)} (définition 2024, vacance technique comprise)`],
      ['Ratio d’autofinancement net', formatPercent(report.netSelfFinancing.shownRatio), `${formatPercent(syn.correctedRatio)} après corrections`],
    ]) +
    `<h2>Contenu du dossier</h2><ul><li><a href="balance.html">Balance N / N-1</a> : soldes 2025 présentés et corrigés, 2024 certifiés (CSV).</li><li><a href="etats.html">États présentés et corrigés</a> : bilan, compte de résultat, CAF et autofinancement net (CSV).</li><li><a href="anomalies.html">Anomalies</a> : impacts calculés, écritures de correction, positions de négociation, débriefs (CSV).</li><li><a href="indices.html">Indices et fausses pistes</a> : indices par anomalie, documents et conditions d’accès (CSV).</li><li><a href="documents.html">Documents</a> : rendu des ${docs.documents.length} documents, indices surlignés.</li><li><a href="calibrage.html">Calibrage</a> : cibles du §4.3 et des comptes propres (CSV).</li></ul>` +
    `<h2>Points soumis à validation</h2><p>Voir <code>docs/points-a-verifier.md</code> (références réglementaires, conventions de calcul, choix de modélisation de J2).</p>`;
  page('index.html', 'Revue métier – fin de J2', body);
}
console.log(`Dossier de revue métier écrit dans ${OUT} en ${Date.now() - t0} ms.`);
