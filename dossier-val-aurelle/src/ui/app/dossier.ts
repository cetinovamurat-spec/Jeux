import { useEffect, useState } from 'react';
import type { KeyFigures } from '../../engine/analysis';
import type { World } from '../../engine/types';
import type { CorrectionKey } from '../../scenario/anomalies/presented';
import type { Synthesis } from '../../scenario/anomalies/synthesis';
import type { CalibrationRow } from '../../scenario/calibration';
import type { PgeMovements } from '../../scenario/datasets';
import type { DocumentModel, FalseLead } from '../../scenario/documents';
import GenerateWorker from '../worker/generate.worker.ts?worker&inline';

/** Data of the J1 control screens (clean world). */
export interface DossierData {
  world: World;
  figures: { y2024: KeyFigures; y2025: KeyFigures };
  calibration: CalibrationRow[];
  metrics: Record<string, number>;
  pge: PgeMovements[];
  durationMs: number;
}

/** Everything the worker builds; the presented world is `key.presented.world`. */
export interface CasePayload {
  clean: World;
  key: CorrectionKey;
  synthesis: Synthesis;
  documents: DocumentModel[];
  falseLeads: FalseLead[];
  control: DossierData;
  durationMs: number;
}

export type WorkerMessage = { type: 'progress'; step: string } | { type: 'ready'; payload: CasePayload } | { type: 'error'; message: string };

export type LoadState = { status: 'loading'; step: string } | { status: 'ready'; payload: CasePayload } | { status: 'error'; message: string };

/** Builds the case once, in a worker. */
export function useCaseLoader(): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading', step: 'Démarrage…' });
  useEffect(() => {
    const worker = new GenerateWorker();
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data;
      if (m.type === 'progress') setState({ status: 'loading', step: m.step });
      else if (m.type === 'ready') setState({ status: 'ready', payload: m.payload });
      else setState({ status: 'error', message: m.message });
    };
    worker.onerror = (e) => setState({ status: 'error', message: e.message });
    worker.postMessage('generate');
    return () => worker.terminate();
  }, []);
  return state;
}
