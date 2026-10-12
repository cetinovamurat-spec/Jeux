/**
 * Game store (Zustand): holds the GameState and applies the pure actions of
 * src/game. Autosave in localStorage (guarded: storage may be unavailable).
 */
import { create } from 'zustand';
import { deserialize, serialize } from '../../game/persistence';
import { initialState, type GameState } from '../../game/state';
import { loadParams } from '../../scenario/params';

const AUTOSAVE_KEY = 'val-aurelle:autosave';

function load(): GameState {
  const fresh = initialState(loadParams());
  try {
    const text = globalThis.localStorage?.getItem(AUTOSAVE_KEY);
    if (!text) return fresh;
    const r = deserialize(text, fresh.scenarioId);
    return r.ok ? r.state : fresh;
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

let timer: ReturnType<typeof setTimeout> | null = null;
useGame.subscribe((st) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      globalThis.localStorage?.setItem(AUTOSAVE_KEY, serialize(st.game));
    } catch {
      // storage unavailable (private mode, quota): the game goes on without autosave
    }
  }, 400);
});
