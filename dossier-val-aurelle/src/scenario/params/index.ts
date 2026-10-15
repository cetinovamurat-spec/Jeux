/** Loads and validates the editable scenario parameters. */
import chartCsv from './plan-comptable-ols-2025.csv?raw';
import scenarioJson from './scenario.json';
import programmesJson from './programmes.json';
import componentsJson from './components.json';
import loanProductsJson from './loan-products.json';
import regulatoryJson from './regulatory.json';
import calibrationJson from './calibration.json';
import statementsJson from './statements.json';
import analysisJson from './analysis.json';
import anomaliesJson from './anomalies.json';
import documentsJson from './documents.json';
import gameJson from './game.json';
import referencesJson from './references.json';
import { parseChartCsv } from '../../engine/chart';
import type { AnalysisDefinitions } from '../../engine/analysis';
import type { ChartOfAccounts, StatementLineDef } from '../../engine/types';
import {
  analysisSchema,
  anomaliesParamsSchema,
  documentsParamsSchema,
  gameParamsSchema,
  referencesSchema,
  calibrationSchema,
  componentsSchema,
  loanProductsSchema,
  programmesFileSchema,
  regulatorySchema,
  scenarioSchema,
  statementsSchema,
  type AnalyticalReviewParams,
  type AnomaliesParams,
  type DocumentsParams,
  type GameParams,
  type CalibrationParams,
  type Reference,
  type ComponentsParams,
  type LoanProductsParams,
  type ProgrammeParams,
  type RegulatoryParams,
  type ScenarioParams,
} from '../schema';

/** Analysis conventions of the engine, plus the conventions of the player's analytical review. */
export type AnalysisParams = AnalysisDefinitions & { review: AnalyticalReviewParams };

export const CHART_FRAMEWORK = 'Plan de comptes OLS applicable aux exercices 2025 (proposition à valider)';

export interface Params {
  scenario: ScenarioParams;
  programmes: readonly ProgrammeParams[];
  components: ComponentsParams;
  loanProducts: LoanProductsParams;
  regulatory: RegulatoryParams;
  calibration: CalibrationParams;
  statements: readonly StatementLineDef[];
  analysis: AnalysisParams;
  chart: ChartOfAccounts;
  chartCsv: string;
  anomalies: AnomaliesParams;
  documents: DocumentsParams;
  game: GameParams;
  references: readonly Reference[];
}

let cached: Params | null = null;

export function loadParams(): Params {
  if (cached) return cached;
  const statements = statementsSchema.parse(statementsJson).lines as StatementLineDef[];
  cached = {
    scenario: scenarioSchema.parse(scenarioJson),
    programmes: programmesFileSchema.parse(programmesJson).programmes,
    components: componentsSchema.parse(componentsJson),
    loanProducts: loanProductsSchema.parse(loanProductsJson),
    regulatory: regulatorySchema.parse(regulatoryJson),
    calibration: calibrationSchema.parse(calibrationJson),
    statements,
    analysis: analysisSchema.parse(analysisJson),
    chart: parseChartCsv(chartCsv, CHART_FRAMEWORK),
    chartCsv,
    anomalies: anomaliesParamsSchema.parse(anomaliesJson),
    documents: documentsParamsSchema.parse(documentsJson),
    game: gameParamsSchema.parse(gameJson),
    references: referencesSchema.parse(referencesJson).references,
  };
  return cached;
}
