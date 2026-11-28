import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { soundForAction, soundForProgress } from '../../audio';
import { loadPlayer, savePlayer } from '../../services/persistence';
import { gameReducer, type GameAction, type GameState } from './gameReducer';

interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(gameReducer, undefined, () => ({ player: loadPlayer() }));
  // every action can make a sound as it happens
  const dispatch = useCallback<Dispatch<GameAction>>((a) => {
    soundForAction(a);
    rawDispatch(a);
  }, []);

  // Autosave on every state change, and a fanfare when a level went up.
  const prevPlayer = useRef(state.player);
  useEffect(() => {
    savePlayer(state.player);
    soundForProgress(prevPlayer.current, state.player);
    prevPlayer.current = state.player;
  }, [state.player]);

  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
