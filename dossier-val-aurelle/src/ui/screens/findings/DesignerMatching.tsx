/**
 * Designer mode only (cahier des charges §10.10): matching of the findings to
 * the correction key (game/matching.ts) — result by finding (part or false
 * lead, axes detected / quantified / treatment / classification / evidence),
 * by part of the key (with its reference impact) and by false lead — and the
 * reference impacts next to the player's in the table of misstatements.
 * This file is one of the few allowed to read the key (guard in
 * tests/game/matching.test.ts).
 */
import { useMemo, useState } from 'react';
import { formatAmount } from '../../../engine/format';
import type { Finding } from '../../../game/findings';
import { explainFinding, matchFindings, type FindingOutcome, type MatchInput, type MatchReport } from '../../../game/matching';
import type { Tone } from '../../../game/state';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Amount } from '../../components/Amount';
import { Badge, Card, cx, EmptyState, Select } from '../../components/ui';

const OUTCOME: Readonly<Record<FindingOutcome, { label: string; tone: Tone }>> = {
  matched: { label: 'Apparié', tone: 'ok' },
  duplicate: { label: 'Doublon (neutre)', tone: 'muted' },
  falsePositive: { label: 'Faux positif', tone: 'ko' },
  falseLeadReported: { label: 'Fausse piste signalée à tort', tone: 'ko' },
  falseLeadTrivial: { label: 'Fausse piste (insignifiant)', tone: 'warn' },
  falseLeadDismissed: { label: 'Fausse piste écartée avec preuves', tone: 'ok' },
  falseLeadDismissedWithoutEvidence: { label: 'Fausse piste écartée sans preuve', tone: 'warn' },
  dismissedAnomaly: { label: 'Anomalie écartée à tort', tone: 'ko' },
  question: { label: 'Question', tone: 'muted' },
  none: { label: 'Sans correspondance', tone: 'muted' },
};

function Mark({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cx('font-mono', ok ? 'text-ok' : 'text-muted')} title={`${label} : ${ok ? 'oui' : 'non'}`}>
      {ok ? '✓' : '·'}
      <span className="sr-only">{ok ? 'oui' : 'non'}</span>
    </span>
  );
}

function useMatchInput(): MatchInput {
  const c = useCase();
  const samples = useGame((s) => s.game.samples);
  const recalcs = useGame((s) => s.game.recalcs);
  const savedQueries = useGame((s) => s.game.savedQueries);
  const date = useGame((s) => s.game.clock.date);
  return useMemo(() => ({ params: c.params, key: c.key, documents: c.documents, falseLeads: c.falseLeads, state: { samples, recalcs, savedQueries }, date }), [c, samples, recalcs, savedQueries, date]);
}

function useMatchReport(): { report: MatchReport; input: MatchInput; findings: readonly Finding[] } {
  const findings = useGame((s) => s.game.findings.items);
  const input = useMatchInput();
  const report = useMemo(() => matchFindings(findings, input), [findings, input]);
  return { report, input, findings };
}

function euros(c: number | null): string {
  return c === null ? '—' : formatAmount(c, 0);
}

export function DesignerMatchingPanel() {
  const c = useCase();
  const { report, input, findings } = useMatchReport();
  const [explain, setExplain] = useState('');
  const explained = useMemo(() => {
    const f = findings.find((x) => x.id === explain);
    return f ? explainFinding(f, input).sort((a, b) => b.evaluation.score - a.evaluation.score).slice(0, 8) : [];
  }, [explain, findings, input]);
  const corrections = new Map(c.key.corrections.map((k) => [k.key, k]));
  const detected = report.parts.filter((p) => p.detected).length;
  const quantified = report.parts.filter((p) => p.quantified).length;

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn">Mode concepteur : appariement des constats à la clé de correction (jamais visible du joueur). Calcul pur, recalculé à chaque modification.</p>

      <Card title={`Par constat (${report.findings.length})`}>
        {report.findings.length === 0 ? (
          <EmptyState>Aucun constat.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-xs">
              <caption className="sr-only">Appariement par constat</caption>
              <thead className="bg-sunken text-muted">
                <tr>
                  {['Constat', 'Résultat', 'Cible', 'Dét.', 'Chiff.', 'Trait.', 'Classif.', 'Preuves', 'Natures', 'Base', 'Proposé', 'Attendu', 'Plage acceptée', 'Score'].map((h) => (
                    <th key={h} scope="col" className="px-2 py-1.5 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.findings.map((m) => {
                  const f = findings.find((x) => x.id === m.findingId);
                  return (
                    <tr key={m.findingId} className="border-t border-line align-top">
                      <td className="px-2 py-1">
                        <span className="font-mono">{m.findingId}</span> {f?.title}
                      </td>
                      <td className="px-2 py-1">
                        <Badge tone={OUTCOME[m.outcome].tone}>{OUTCOME[m.outcome].label}</Badge>
                        {m.duplicateOf && <span className="block text-muted">de {m.duplicateOf}</span>}
                        {m.pending && <span className="block text-warn">point en suspens</span>}
                      </td>
                      <td className="px-2 py-1 font-mono">{m.partIds.length ? m.partIds.join(' + ') : (m.falseLeadId ?? '—')}</td>
                      <td className="px-2 py-1"><Mark ok={m.detected} label="Détecté" /></td>
                      <td className="px-2 py-1"><Mark ok={m.quantified} label="Chiffré" /></td>
                      <td className="px-2 py-1"><Mark ok={m.treatmentOk} label="Traitement" /></td>
                      <td className="px-2 py-1"><Mark ok={m.classificationOk} label="Classification" /></td>
                      <td className="px-2 py-1"><Mark ok={m.evidenceOk} label="Preuves" /></td>
                      <td className="px-2 py-1"><Mark ok={m.naturesOk} label="Natures" /></td>
                      <td className="px-2 py-1">{m.basis ?? '—'}</td>
                      <td className="px-2 py-1 text-right font-mono">{euros(m.measure)}</td>
                      <td className="px-2 py-1 text-right font-mono">{euros(m.expected)}</td>
                      <td className="px-2 py-1 font-mono">{m.range ? `${euros(m.range[0])} à ${euros(m.range[1])}` : '—'}</td>
                      <td className="px-2 py-1 text-right font-mono">{m.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {findings.length > 0 && (
          <div className="border-t border-line px-3 py-2 text-xs">
            <label htmlFor="designer-explain" className="mr-2 text-muted">
              Expliquer un constat
            </label>
            <Select id="designer-explain" value={explain} onChange={(e) => setExplain(e.target.value)} className="py-0.5 text-xs">
              <option value="">Choisir…</option>
              {findings.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id} {f.title}
                </option>
              ))}
            </Select>
            {explained.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {explained.map((x) => (
                  <li key={x.target}>
                    <span className="font-mono">{x.target}</span> – score {x.evaluation.score} – {x.evaluation.eligible ? <span className="text-ok">éligible</span> : <span className="text-muted">non éligible : {x.evaluation.reasons.join(', ')}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card title={`Par partie de la clé : ${detected} détectées, ${quantified} chiffrées sur ${report.parts.length}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-xs">
            <caption className="sr-only">Appariement par partie de la clé</caption>
            <thead className="bg-sunken text-muted">
              <tr>
                {['Partie', 'Libellé', 'Constat', 'Dét.', 'Chiff.', 'Trait.', 'Classif.', 'Preuves', 'Impact résultat', 'Base de crédit', 'Doublons, questions, écartés'].map((h) => (
                  <th key={h} scope="col" className="px-2 py-1.5 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.parts.map((p) => {
                const k = corrections.get(p.partId);
                return (
                  <tr key={p.partId} className="border-t border-line align-top">
                    <td className="px-2 py-1 font-mono">{p.partId}</td>
                    <td className="max-w-[22rem] px-2 py-1">{k?.part.label}</td>
                    <td className="px-2 py-1 font-mono">{p.findingId ?? '—'}</td>
                    <td className="px-2 py-1"><Mark ok={p.detected} label="Détectée" /></td>
                    <td className="px-2 py-1"><Mark ok={p.quantified} label="Chiffrée" /></td>
                    <td className="px-2 py-1"><Mark ok={p.treatmentOk} label="Traitement" /></td>
                    <td className="px-2 py-1"><Mark ok={p.classificationOk} label="Classification" /></td>
                    <td className="px-2 py-1"><Mark ok={p.evidenceOk} label="Preuves" /></td>
                    <td className="px-2 py-1 text-right">{k ? <Amount cents={k.impact.result} /> : '—'}</td>
                    <td className="px-2 py-1">{k?.part.creditBasis.join(', ')}</td>
                    <td className="px-2 py-1 font-mono">{[...p.duplicates, ...p.questions.map((q) => `${q}?`), ...p.dismissedBy.map((q) => `${q}✕`)].join(' ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Fausses pistes">
        <ul className="divide-y divide-line text-xs">
          {report.falseLeads.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
              <span className="font-mono">{f.id}</span>
              <span className="min-w-0 flex-1">{c.falseLeads.find((x) => x.id === f.id)?.title}</span>
              {f.dismissedWithEvidence && <Badge tone="ok">Écartée avec preuves</Badge>}
              {f.reportedWrongly && <Badge tone="ko">Signalée à tort</Badge>}
              {f.reportedTrivial && <Badge tone="warn">Signalée (insignifiant)</Badge>}
              {f.findingIds.length === 0 && <span className="text-muted">non traitée</span>}
              {f.findingIds.length > 0 && <span className="font-mono text-muted">{f.findingIds.join(', ')}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Reference impacts of the key next to the table of misstatements (designer mode). */
export function DesignerReferenceImpacts() {
  const c = useCase();
  const { report, findings } = useMatchReport();
  const corrections = new Map(c.key.corrections.map((k) => [k.key, k]));
  const rows = report.findings.filter((m) => findings.find((f) => f.id === m.findingId)?.status === 'finding');
  return (
    <Card className="border-warn/50" title={<span className="text-warn">Mode concepteur – impacts de référence de la clé</span>}>
      {rows.length === 0 ? (
        <EmptyState>Aucun constat au statut « constat ».</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-xs">
            <caption className="sr-only">Impacts de référence des parties appariées</caption>
            <thead className="bg-sunken text-muted">
              <tr>
                {['Constat', 'Appariement', 'Partie(s)', 'Impact résultat de référence', 'Capitaux propres de référence', 'Chiffré'].map((h) => (
                  <th key={h} scope="col" className="px-2 py-1.5 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const parts = m.partIds.map((id) => corrections.get(id)).filter((x) => !!x);
                return (
                  <tr key={m.findingId} className="border-t border-line">
                    <td className="px-2 py-1 font-mono">{m.findingId}</td>
                    <td className="px-2 py-1">
                      <Badge tone={OUTCOME[m.outcome].tone}>{OUTCOME[m.outcome].label}</Badge>
                    </td>
                    <td className="px-2 py-1 font-mono">{m.partIds.join(' + ') || m.falseLeadId || '—'}</td>
                    <td className="px-2 py-1 text-right">{parts.length ? <Amount cents={parts.reduce((s, k) => s + k!.impact.result, 0)} /> : '—'}</td>
                    <td className="px-2 py-1 text-right">{parts.length ? <Amount cents={parts.reduce((s, k) => s + k!.impact.equity, 0)} /> : '—'}</td>
                    <td className="px-2 py-1"><Mark ok={m.quantified} label="Chiffré" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
