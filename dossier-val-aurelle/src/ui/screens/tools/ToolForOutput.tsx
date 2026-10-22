/**
 * Tool opened by a procedure of the programme (plan J4 §7.2), according to
 * its typed output (params/procedures.json → output): sample, recalculation,
 * document requests, confirmations; a screen of J3 or a working note
 * otherwise.
 */
import { Link } from 'react-router';
import { populationsOfProcedure } from '../../../game/confirmations';
import { procedureDef } from '../../../game/program';
import type { RecalcToolId } from '../../../game/recalcs';
import type { ProcedureOutput } from '../../../scenario/schemas/procedures';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { CATEGORY_LABELS } from '../ged/labels';
import { ConfirmationsPanel } from './ConfirmationsPanel';
import { RecalcTool } from './RecalcTool';
import { RequestList } from './RequestControls';
import { SampleTool } from './SampleTool';

/** Output of a procedure (kept loose for the callers that only know its kind). */
export interface ToolOutput {
  kind: string;
  [key: string]: unknown;
}

const SCREEN_LABELS: Readonly<Record<string, string>> = {
  '/fec': 'FEC – tests d’écritures',
  '/etats': 'États financiers et pointage',
  '/ged': 'Gestion documentaire',
  '/analyse': 'Revue analytique',
  '/balance': 'Balance N / N-1',
  '/grand-livre': 'Grand livre',
};

export function ToolForOutput({ executionId, output }: { executionId: string; output: ProcedureOutput | ToolOutput }) {
  const c = useCase();
  const execution = useGame((s) => s.game.program.executions.find((e) => e.id === executionId));
  const def = execution ? procedureDef(c.params, execution.procedureId) : undefined;
  const o = output as ProcedureOutput;
  switch (o.kind) {
    case 'sample':
      return <SampleTool executionId={executionId} population={o.population} {...(def ? { cycle: def.cycle } : {})} />;
    case 'recalc':
      return <RecalcTool executionId={executionId} tool={o.tool as RecalcToolId} {...(def ? { cycle: def.cycle } : {})} />;
    case 'requests':
      return <RequestList requests={o.requests} />;
    case 'confirmations':
      return (
        <ConfirmationsPanel
          populations={populationsOfProcedure(c.params, execution?.procedureId)}
          idPrefix={`conf-${executionId}`}
          {...(execution ? { execution: { id: execution.id, by: execution.assignee } } : {})}
        />
      );
    case 'view': {
      // the GED opens filtered on the first category the procedure examines (the others through its links)
      const categories = o.screen === '/ged' ? (o.categories ?? []) : [];
      const link = 'text-accent underline-offset-2 hover:underline';
      return (
        <p className="text-sm">
          Travail sur l’écran{' '}
          <Link to={categories[0] ? `/ged?categorie=${categories[0]}` : o.screen} className={link}>
            {SCREEN_LABELS[o.screen] ?? o.screen}
          </Link>
          {categories.length > 0 && (
            <>
              {' '}
              ({categories.length > 1 ? 'catégories' : 'catégorie'}{' '}
              {categories.map((cat, i) => (
                <span key={cat}>
                  {i > 0 && ', '}
                  <Link to={`/ged?categorie=${cat}`} className={link}>
                    {CATEGORY_LABELS[cat]}
                  </Link>
                </span>
              ))}
              )
            </>
          )}{' '}
          : les requêtes enregistrées, les cases pointées et les pièces annotées sont rattachées à la feuille.
        </p>
      );
    }
    case 'memo':
      return <p className="text-sm text-muted">Note de travail du cabinet : rédigez la conclusion et citez les pièces examinées dans la feuille.</p>;
    default:
      return <p className="text-sm text-muted">Outil « {String((output as ToolOutput).kind)} » non disponible.</p>;
  }
}
