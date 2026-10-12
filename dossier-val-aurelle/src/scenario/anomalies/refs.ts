/** Object references used by anomaly signatures and clues. */
import type { ObjectRef } from '../../engine/types';

export const prog = (id: string): ObjectRef => ({ kind: 'programme', id });
export const acct = (id: string): ObjectRef => ({ kind: 'account', id });
export const doc = (id: string): ObjectRef => ({ kind: 'document', id });
export const tp = (id: string): ObjectRef => ({ kind: 'thirdParty', id });
export const sub = (id: string): ObjectRef => ({ kind: 'subsidy', id });
export const loan = (id: string): ObjectRef => ({ kind: 'loan', id });
export const provision = (id: string): ObjectRef => ({ kind: 'provision', id });
export const comp = (id: string): ObjectRef => ({ kind: 'component', id });
