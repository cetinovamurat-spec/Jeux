/** Derived data shared by the work screen: calendar, scheduling, launch and completion contexts. */
import { useMemo } from 'react';
import { useConfirmationRows, useGedDocuments, useRequestDocDates } from '../ged/replies';
import type { ScheduledTask, WorkCalendar } from '../../../game/calendar';
import { workCalendar } from '../../../game/calendar';
import { conditionContext } from '../../../game/conditions';
import { confirmationCandidates, type ConfirmationPopulation } from '../../../game/confirmations';
import { receivedRequests } from '../../../game/requests';
import { procedureProgress, scheduleExecutions, type CompletionContext, type LaunchContext } from '../../../game/program';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';

export interface WorkContext {
  cal: WorkCalendar;
  sched: Map<string, ScheduledTask>;
  launch: LaunchContext;
  completion: CompletionContext;
  /** Population of a third party proposed for confirmation. */
  populationOf: (thirdParty: string) => ConfirmationPopulation | undefined;
}

export function useWorkContext(): WorkContext {
  const c = useCase();
  const params = c.params;
  const game = useGame((s) => s.game);
  const docs = useGedDocuments().available;
  const requestDocDates = useRequestDocDates();
  const confirmationRows = useConfirmationRows();
  const cal = useMemo(() => workCalendar(params), [params]);
  const populationOf = useMemo(() => {
    const m = new Map(confirmationCandidates(params, c.datasets).map((x) => [x.thirdParty, x.population]));
    return (thirdParty: string) => m.get(thirdParty);
  }, [params, c.datasets]);
  return useMemo(() => {
    const date = game.clock.date;
    const available = new Set(docs.map((d) => d.id));
    const confirmationStates = new Map(confirmationRows.map((r) => [r.item.thirdParty, r.state]));
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
        received: receivedRequests(game.requests, params, date, requestDocDates),
        ...(c.view.statements2025 ? { annexTables: c.annex().current } : {}),
        availableDocs: docs.map((d) => ({ id: d.id, category: d.category })),
        populationOf,
        confirmationState: (item) => confirmationStates.get(item.thirdParty) ?? 'prepared',
      },
      populationOf,
    };
  }, [c, params, game, docs, cal, populationOf, requestDocDates, confirmationRows]);
}
