/**
 * Ethics and independence events (plan J5 §9): five events with a stake (E1
 * to E5) and two without (B1, B2). Shared enumeration of the rules
 * (game/ethics.ts) and of the parameter schemas (params/ethics.json).
 */

export const ETHICS_EVENT_IDS = ['E1', 'E2', 'E3', 'E4', 'E5', 'B1', 'B2'] as const;
export type EthicsEventId = (typeof ETHICS_EVENT_IDS)[number];

export function isEthicsEventId(id: string): id is EthicsEventId {
  return (ETHICS_EVENT_IDS as readonly string[]).includes(id);
}
