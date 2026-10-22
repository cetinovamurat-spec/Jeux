/**
 * Game store (Zustand): holds the GameState and applies the pure actions of
 * src/game. Autosave in localStorage (guarded: storage may be unavailable).
 */
import { create } from 'zustand';
import { deserialize, serialize } from '../../game/persistence';
import { initialState, type GameState } from '../../game/state';
import { loadParams } from '../../scenario/params';

const AUTOSAVE_KEY = 'val-aurelle:autosave';

/** What happened to the saved game at load (shown on the desk until closed). */
export interface LoadNotice {
  /** The save was in an older format: the engagement restarted. */
  restarted: boolean;
  /** The save was made with other content (generated world, content version or parameters). */
  contentChanged: boolean;
  /** References of the save the current content no longer knows, removed (French, one line per kind). */
  removed: readonly string[];
}
let loadNotice: LoadNotice | null = null;

function load(): GameState {
  const fresh = initialState(loadParams());
  try {
    const text = globalThis.localStorage?.getItem(AUTOSAVE_KEY);
    if (!text) return fresh;
    const r = deserialize(text, fresh);
    if (!r.ok) return fresh;
    if (r.migratedFrom !== undefined) loadNotice = { restarted: true, contentChanged: false, removed: [] };
    else if (r.contentChanged) loadNotice = { restarted: false, contentChanged: true, removed: [] };
    return r.state;
  } catch {
    return fresh;
  }
}

interface Store {
  game: GameState;
  /** Applies a pure action: `act((s) => markRead(s, id))`. */
  act: (f: (s: GameState) => GameState) => void;
  reset: () => void;
}

export const useGame = create<Store>((set) => ({
  game: load(),
  act: (f) => set((st) => ({ game: f(st.game) })),
  reset: () => set({ game: initialState(loadParams()) }),
}));

/** Notice of the load (not saved): set by the load, completed by the cleaning of the orphan references (orphans.ts). */
export const useLoadNotice = create<{ notice: LoadNotice | null }>(() => ({ notice: loadNotice }));

export function dismissLoadNotice(): void {
  useLoadNotice.setState({ notice: null });
}

/** Adds the references removed from the save to the notice (the content has changed). */
export function reportRemovedReferences(lines: readonly string[]): void {
  if (lines.length === 0) return;
  useLoadNotice.setState(({ notice }) => ({ notice: { restarted: notice?.restarted ?? false, contentChanged: true, removed: [...(notice?.removed ?? []), ...lines] } }));
}

const AUTOSAVE_DELAY_MS = 400;
let timer: ReturnType<typeof setTimeout> | null = null;

function save(): void {
  timer = null;
  try {
    globalThis.localStorage?.setItem(AUTOSAVE_KEY, serialize(useGame.getState().game));
  } catch {
    // storage unavailable (private mode, quota): the game goes on without autosave
  }
}

/** Writes a pending autosave at once (the page is being hidden, closed or reloaded). */
function flush(): void {
  if (!timer) return;
  clearTimeout(timer);
  save();
}

useGame.subscribe(() => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(save, AUTOSAVE_DELAY_MS);
});

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
