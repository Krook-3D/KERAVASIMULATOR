import type { LngLat, Player } from '../../types/game';
import { createPlayer } from '../player/createPlayer';

export interface GameState {
  player: Player | null;
}

export type GameAction =
  | { type: 'createCharacter'; name: string; color: string }
  | { type: 'movePlayer'; position: LngLat }
  | { type: 'resetGame' };

export const initialGameState: GameState = { player: null };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'createCharacter':
      return { player: createPlayer(action.name, action.color) };
    case 'movePlayer':
      return state.player ? { player: { ...state.player, position: action.position } } : state;
    case 'resetGame':
      return initialGameState;
  }
}
