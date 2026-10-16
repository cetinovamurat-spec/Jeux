/**
 * Schema of params/requests.json (owned by J4c): families of document
 * requests (type × object), interlocutors, costs, and the settings of the
 * external confirmations (plan J4 §8 and §9).
 */
import { z } from 'zod';

/** People of params/documents.json who answer the requests of the auditor. */
export const INTERLOCUTORS = ['chiefAccountant', 'cfo', 'assetDirector', 'rentManager', 'ceo'] as const;
export type Interlocutor = (typeof INTERLOCUTORS)[number];

/**
 * Kind of the object of a request:
 * - none: the family has no object;
 * - programme: a programme (or an operation in progress) id;
 * - thirdParty: a third-party id;
 * - fecEntry: 'YYYY:EcritureNum' of an entry of the FEC;
 * - month: 'YYYY-MM';
 * - programmeMonth: 'programmeId:YYYY-MM';
 * - closingDoc: one of the `objects` of the family.
 */
export const REQUEST_PARAMETERS = ['none', 'programme', 'thirdParty', 'fecEntry', 'month', 'programmeMonth', 'closingDoc'] as const;
export type RequestParameter = (typeof REQUEST_PARAMETERS)[number];

/** Which programmes can be the object of a family (built from the data). */
export const PROGRAMME_FILTERS = ['all', 'invoices', 'operations', 'sales', 'components', 'rentRoll'] as const;

const month = z.string().regex(/^\d{4}-\d{2}$/);

const familySchema = z.object({
  id: z.string(),
  /** What is asked, as shown in the catalogue. */
  label: z.string(),
  description: z.string(),
  interlocutor: z.enum(INTERLOCUTORS),
  parameter: z.enum(REQUEST_PARAMETERS),
  /** Label of the object picker. */
  objectLabel: z.string().optional(),
  /** Cycle of the work programme the family serves (cycles of the anomaly signatures). */
  cycle: z.string(),
  programmeFilter: z.enum(PROGRAMME_FILTERS).optional(),
  thirdPartyKinds: z.array(z.string()).optional(),
  months: z.object({ from: month, to: month }).optional(),
  /** Fixed objects (closingDoc), each with its own interlocutor when it differs from the family's. */
  objects: z.array(z.object({ id: z.string(), label: z.string(), interlocutor: z.enum(INTERLOCUTORS).optional() })).optional(),
});

export const requestsParamsSchema = z.object({
  /** Hours of the senior charged by each request and each reminder. */
  costHours: z.object({ request: z.number().min(0), reminder: z.number().min(0) }),
  families: z.array(familySchema),
  confirmations: z.object({
    /** Calendar period (params/game.json → calendar) of the automatic sending. */
    sendingPeriod: z.string(),
    /** Hours charged by the preparation of one confirmation request, and by a reminder. */
    preparationHours: z.number().min(0),
    reminderHours: z.number().min(0),
    /** Suppliers proposed when their 2025 invoices reach this volume (euros). */
    supplierMinVolumeEuros: z.number().min(0),
    /** Suppliers proposed whatever their volume (group entities, disputes, major contracts). */
    suppliersAlways: z.array(z.string()),
    /** Third parties that never reply (the reminder stays without effect). */
    nonResponders: z.array(z.string()),
    /** Scenario replies: delay in business days after the sending (the dates of the third parties' letters). */
    replyBusinessDays: z.record(z.string(), z.number().int().min(0)),
  }),
});
export type RequestsParams = z.infer<typeof requestsParamsSchema>;
export type RequestFamily = z.infer<typeof familySchema>;
