/** Derived data shared by the work screen: calendar, scheduling, launch and completion contexts. */
import { useMemo } from 'react';
import type { ScheduledTask, WorkCalendar } from '../../../game/calendar';
import { workCalendar } from '../../../game/calendar';
import { conditionContext } from '../../../game/conditions';
import { procedureProgress, scheduleExecutions, type CompletionContext, type LaunchContext } from '../../../game/program';
import { useCase } from '../../app/context';
import { useAvailableDocuments } from '../../app/hooks';
import { useGame } from '../../app/store';

export interface WorkContext {
  cal: WorkCalendar;
  sched: Map<string, ScheduledTask>;
  launch: LaunchContext;
  completion: CompletionContext;
}

export function useWorkContext(): WorkContext {
  const c = useCase();
  const params = c.params;
  const game = useGame((s) => s.game);
  const docs = useAvailableDocuments();
  const cal = useMemo(() => workCalendar(params), [params]);
  return useMemo(() => {
    const date = game.clock.date;
    const available = new Set(docs.map((d) => d.id));
    const base = conditionContext(game, params, date, {
      isDocumentAvailable: (id) => available.has(id),
      documentTitle: (id) => c.documentsById.get(id)?.title,
      procedureProgress: procedureProgress(game.program, cal, date),
    });
    return {
      cal,
      sched: scheduleExecutions(game.program, cal),
      launch: { ...base, cal },
      completion: {
        params,
        date,
        state: game,
        answered: base.answered,
        ...(c.view.statements2025 ? { annexTables: c.annex().current } : {}),
        availableDocs: docs.map((d) => ({ id: d.id, category: d.category })),
      },
    };
  }, [c, params, game, docs, cal]);
}
