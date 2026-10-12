import { useEffect, useState } from 'react';
import type { KeyFigures } from '../../engine/analysis';
import type { World } from '../../engine/types';
import type { CalibrationRow } from '../../scenario/calibration';
import type { PgeMovements } from '../../scenario/datasets';
import GenerateWorker from '../worker/generate.worker.ts?worker&inline';

export interface DossierData {
  world: World;
  figures: { y2024: KeyFigures; y2025: KeyFigures };
  calibration: CalibrationRow[];
  metrics: Record<string, number>;
  pge: PgeMovements[];
  durationMs: number;
}

export type DossierState = { status: 'loading' } | { status: 'ready'; data: DossierData } | { status: 'error'; message: string };

/** Generates the dossier once, in a worker. */
export function useDossier(): DossierState {
  const [state, setState] = useState<DossierState>({ status: 'loading' });
  useEffect(() => {
    const worker = new GenerateWorker();
    worker.onmessage = (e: MessageEvent<DossierData>) => setState({ status: 'ready', data: e.data });
    worker.onerror = (e) => setState({ status: 'error', message: e.message });
    worker.postMessage('generate');
    return () => worker.terminate();
  }, []);
  return state;
}
