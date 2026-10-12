/// <reference lib="webworker" />
/** Generates the clean world off the main thread. */
import { calibrationRows } from '../../scenario/calibration';
import { generateWorld } from '../../scenario/generator';
import { loadParams } from '../../scenario/params';
import type { DossierData } from '../app/dossier';

self.onmessage = () => {
  const t0 = performance.now();
  const params = loadParams();
  const r = generateWorld(params);
  const data: DossierData = {
    world: r.world,
    figures: r.figures,
    calibration: calibrationRows(r, params),
    metrics: r.state.metrics,
    pge: r.state.pge,
    durationMs: Math.round(performance.now() - t0),
  };
  (self as unknown as Worker).postMessage(data);
};
