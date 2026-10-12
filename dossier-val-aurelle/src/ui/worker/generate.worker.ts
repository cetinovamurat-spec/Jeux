/// <reference lib="webworker" />
/**
 * Builds the case off the main thread: clean world (generator), presented
 * world and correction key (anomalies), documents. Progress messages let the
 * loading screen tell what is happening.
 */
import { buildCorrectionKey } from '../../scenario/anomalies/presented';
import { buildSynthesis } from '../../scenario/anomalies/synthesis';
import { calibrationRows, presentedRows } from '../../scenario/calibration';
import { buildDocuments } from '../../scenario/documents';
import { generateWorld } from '../../scenario/generator';
import { loadParams } from '../../scenario/params';
import type { CasePayload, WorkerMessage } from '../app/dossier';

const post = (m: WorkerMessage) => (self as unknown as Worker).postMessage(m);

self.onmessage = () => {
  try {
    const t0 = performance.now();
    const params = loadParams();
    post({ type: 'progress', step: 'Génération des grands livres 2024 et 2025 et des sous-ledgers…' });
    const r = generateWorld(params);
    post({ type: 'progress', step: 'Préparation des comptes présentés par le client…' });
    const key = buildCorrectionKey(r.world, params);
    const synthesis = buildSynthesis(key, r.world, params);
    post({ type: 'progress', step: 'Constitution du dossier documentaire…' });
    const docs = buildDocuments(params, r.world, key);
    const payload: CasePayload = {
      clean: r.world,
      key,
      synthesis,
      documents: [...docs.documents],
      falseLeads: [...docs.falseLeads],
      control: {
        world: r.world,
        figures: r.figures,
        calibration: [...calibrationRows(r, params), ...presentedRows(key, params)],
        metrics: r.state.metrics,
        pge: r.state.pge,
        durationMs: 0,
      },
      durationMs: 0,
    };
    payload.durationMs = payload.control.durationMs = Math.round(performance.now() - t0);
    post({ type: 'ready', payload });
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
