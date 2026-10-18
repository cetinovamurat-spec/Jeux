/**
 * Tableau des anomalies (plan J4 §13.3): findings « constat », impacts derived
 * from their entries (all applied at once for the corrected figures), over-
 * and understatements separated, trivial items listed and not cumulated,
 * individually significant items flagged, cumulative against the player's
 * thresholds, net self-financing ratio corrected (year and three-year mean)
 * against the regulatory reference rates. The correction status is filled by
 * the closing meetings (J6). Reference impacts of the key: designer mode only.
 */
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { formatPercent } from '../../../engine/format';
import { misstatementTable, type MisstatementRow } from '../../../game/misstatements';
import { useCase, useDataView } from '../../app/context';
import { useGame } from '../../app/store';
import { Amount } from '../../components/Amount';
import { Badge, Card, cx, EmptyState } from '../../components/ui';
import { DesignerReferenceImpacts } from './DesignerMatching';
import { plural } from './labels';

const DIRECTION_LABELS: Readonly<Record<MisstatementRow['direction'], string>> = { over: 'Surévaluation', under: 'Sous-évaluation', none: 'Sans effet sur le résultat' };

function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cx('border-t border-line px-2 py-1 align-top', className)}>{children}</td>;
}

export function MisstatementsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const c = useCase();
  const params = c.params;
  const view = useDataView();
  const findings = useGame((s) => s.game.findings.items);
  const planning = useGame((s) => s.game.planning);
  const designer = useGame((s) => s.game.settings.designer);
  const t = useMemo(() => misstatementTable(findings, { world: c.presented, params, planning }), [findings, c, params, planning]);
  const cycleName = (id: string) => params.cycles.cycles.find((x) => x.id === id)?.label ?? id;
  const statementsOn = params.game.dataVintages.draftStatements.from;

  return (
    <div className="space-y-4">
      <Card title="Seuils en vigueur">
        <div className="px-3 py-2 text-sm">
          {t.thresholds ? (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Seuil de signification</dt>
                <dd>
                  <Amount cents={t.thresholds.materiality} /> €
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Seuil de planification</dt>
                <dd>
                  <Amount cents={t.thresholds.planning} /> €
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Anomalies manifestement insignifiantes</dt>
                <dd>
                  <Amount cents={t.thresholds.trivial} /> €
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-warn">
              Aucun seuil validé : les anomalies ne peuvent pas être comparées aux seuils.{' '}
              <Link to="/planification" className="text-accent underline-offset-2 hover:underline">
                Fixer les seuils
              </Link>
            </p>
          )}
        </div>
      </Card>

      <Card title={`Anomalies relevées (${t.rows.length})`}>
        {t.rows.length === 0 ? (
          <EmptyState>Aucun constat au statut « constat » : le tableau se construit à partir des constats retenus (les questions et les points écartés n’y figurent pas).</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-xs">
              <caption className="sr-only">Tableau des anomalies : impacts dérivés des écritures proposées (surévaluation du chiffre présenté : positif)</caption>
              <thead className="bg-sunken text-muted">
                <tr>
                  <th scope="col" className="px-2 py-1.5 text-left font-semibold">Constat</th>
                  <th scope="col" className="px-2 py-1.5 text-left font-semibold">Cycle</th>
                  <th scope="col" className="px-2 py-1.5 text-left font-semibold">Sens</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-semibold">Résultat</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-semibold">Capitaux propres</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-semibold">CAF</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-semibold">Autofinancement net</th>
                  <th scope="col" className="px-2 py-1.5 text-left font-semibold">Appréciation</th>
                  <th scope="col" className="px-2 py-1.5 text-left font-semibold">Correction</th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r.findingId} className={cx(r.belowTrivial && 'text-muted')}>
                    <Cell>
                      <button type="button" className="text-left text-accent underline-offset-2 hover:underline" onClick={() => onOpen(r.findingId)}>
                        <span className="font-mono">{r.findingId}</span> {r.title || 'Sans intitulé'}
                      </button>
                    </Cell>
                    <Cell>{cycleName(r.cycle)}</Cell>
                    <Cell>{DIRECTION_LABELS[r.direction]}</Cell>
                    <Cell className="text-right">
                      <Amount cents={r.impact.result} />
                    </Cell>
                    <Cell className="text-right">
                      <Amount cents={r.impact.equity} />
                    </Cell>
                    <Cell className="text-right">
                      <Amount cents={r.impact.caf} />
                    </Cell>
                    <Cell className="text-right">
                      <Amount cents={r.impact.netSelfFinancing} />
                    </Cell>
                    <Cell>
                      <span className="flex flex-wrap gap-1">
                        {!r.quantified && <Badge tone="warn">Non chiffrée</Badge>}
                        {r.belowTrivial && <Badge tone="muted" title="Listée, non cumulée">Insignifiante</Badge>}
                        {r.individuallySignificant && <Badge tone="ko">Individuellement significative</Badge>}
                        {r.direction === 'none' && r.quantified && <Badge tone="muted">Reclassement</Badge>}
                      </span>
                    </Cell>
                    <Cell>
                      <span className="text-muted" title="Renseigné lors des réunions de synthèse">
                        —
                      </span>
                    </Cell>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-semibold">
                <tr>
                  <th scope="row" colSpan={3} className="border-t border-line px-2 py-1 text-left">
                    Surévaluations du résultat
                  </th>
                  <td className="border-t border-line px-2 py-1 text-right">
                    <Amount cents={t.overstatements} />
                  </td>
                  <td colSpan={5} className="border-t border-line" />
                </tr>
                <tr>
                  <th scope="row" colSpan={3} className="px-2 py-1 text-left">
                    Sous-évaluations du résultat
                  </th>
                  <td className="px-2 py-1 text-right">
                    <Amount cents={t.understatements} />
                  </td>
                  <td colSpan={5} />
                </tr>
                <tr>
                  <th scope="row" colSpan={3} className="px-2 py-1 text-left">
                    Cumul net (hors anomalies insignifiantes)
                  </th>
                  <td className="px-2 py-1 text-right">
                    <Amount cents={t.net} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Amount cents={t.equityNet} />
                  </td>
                  <td colSpan={4} className="px-2 py-1">
                    {t.comparison && (
                      <span className="flex flex-wrap gap-1 font-normal">
                        <Badge tone={t.comparison.aboveMateriality ? 'ko' : 'ok'}>{t.comparison.aboveMateriality ? 'Au-delà du seuil de signification' : 'En deçà du seuil de signification'}</Badge>
                        {!t.comparison.aboveMateriality && <Badge tone={t.comparison.abovePlanning ? 'warn' : 'muted'}>{t.comparison.abovePlanning ? 'Au-delà du seuil de planification' : 'En deçà du seuil de planification'}</Badge>}
                      </span>
                    )}
                  </td>
                </tr>
                {t.trivialTotal !== 0 && (
                  <tr className="font-normal text-muted">
                    <th scope="row" colSpan={3} className="px-2 py-1 text-left font-normal">
                      Anomalies insignifiantes (listées, non cumulées)
                    </th>
                    <td className="px-2 py-1 text-right">
                      <Amount cents={t.trivialTotal} />
                    </td>
                    <td colSpan={5} />
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card title="Comptes corrigés de toutes les anomalies (écritures appliquées en une fois)">
        {!view.statements2025 ? (
          <p className="px-3 py-3 text-sm text-muted">Le résultat, la CAF et le ratio d’autofinancement net corrigés seront disponibles avec le projet de comptes (attendu le {formatDateFr(statementsOn)}).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">Chiffres présentés et corrigés</caption>
              <thead className="bg-sunken text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1.5 text-left font-semibold"></th>
                  <th scope="col" className="px-3 py-1.5 text-right font-semibold">Présenté</th>
                  <th scope="col" className="px-3 py-1.5 text-right font-semibold">Corrigé</th>
                  <th scope="col" className="px-3 py-1.5 text-right font-semibold">Écart</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Résultat net', t.presented.result, t.corrected.result],
                    ['Capitaux propres', t.presented.equity, t.corrected.equity],
                    ['Capacité d’autofinancement', t.presented.caf, t.corrected.caf],
                    ['Autofinancement net HLM', t.presented.netSelfFinancing, t.corrected.netSelfFinancing],
                  ] as const
                ).map(([label, p, k]) => (
                  <tr key={label}>
                    <th scope="row" className="border-t border-line px-3 py-1 text-left font-normal">
                      {label}
                    </th>
                    <td className="border-t border-line px-3 py-1 text-right">
                      <Amount cents={p} />
                    </td>
                    <td className="border-t border-line px-3 py-1 text-right">
                      <Amount cents={k} />
                    </td>
                    <td className="border-t border-line px-3 py-1 text-right">
                      <Amount cents={k - p} />
                    </td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="border-t border-line px-3 py-1 text-left font-normal">
                    Ratio d’autofinancement net de l’exercice <span className="text-xs text-muted">(taux de référence {formatPercent(t.referenceRates.year)})</span>
                  </th>
                  <td className="border-t border-line px-3 py-1 text-right font-mono">{formatPercent(t.presented.ratio, 2)}</td>
                  <td className={cx('border-t border-line px-3 py-1 text-right font-mono', t.corrected.ratio < t.referenceRates.year && 'text-ko')}>{formatPercent(t.corrected.ratio, 2)}</td>
                  <td className="border-t border-line px-3 py-1" />
                </tr>
                <tr>
                  <th scope="row" className="border-t border-line px-3 py-1 text-left font-normal">
                    Moyenne sur trois ans <span className="text-xs text-muted">(taux de référence {formatPercent(t.referenceRates.threeYears)})</span>
                  </th>
                  <td className="border-t border-line px-3 py-1 text-right font-mono">{formatPercent(t.threeYear.presented, 2)}</td>
                  <td className={cx('border-t border-line px-3 py-1 text-right font-mono', t.threeYear.corrected < t.referenceRates.threeYears && 'text-ko')}>{formatPercent(t.threeYear.corrected, 2)}</td>
                  <td className="border-t border-line px-3 py-1" />
                </tr>
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-muted">
              Toutes les écritures proposées des {plural(t.rows.length, 'constat', 'constats')} sont appliquées ensemble aux comptes présentés (le ratio n’est pas additif) ; la moyenne triennale reprend les ratios {params.scenario.years.prior - 1} et {params.scenario.years.prior}. Taux de référence paramétrés, à vérifier.
            </p>
          </div>
        )}
      </Card>

      {designer && <DesignerReferenceImpacts />}
    </div>
  );
}
