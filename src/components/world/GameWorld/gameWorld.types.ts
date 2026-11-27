import type { Dispatch, MutableRefObject } from 'react';
import type * as THREE from 'three';
import type { Player } from '../../../types/game';
import type { GameAction } from '../../../game/store/gameReducer';
import type { WorldXZ } from '../../../game/world/projection';
import type { InteriorId, Link, SceneId, WorldDoorId } from '../../../game/interiors/interiors';
import type { DialogueView } from '../quest/DialogueBox';

export interface WorldDoor {
  id: WorldDoorId;
  at: WorldXZ;
  /** Points away from the building / stairwell. */
  outward: WorldXZ;
  label: string;
  to?: { scene: InteriorId; exit: string };
}

/** A clickable place: walking onto it calls `use`. */
export interface Spot {
  at: WorldXZ;
  use: () => void;
}

export type TrainStop = { id: 'kerava' | 'savio'; name: string; at: WorldXZ };

/**
 * What every game system gets from the orchestrator: the store, the shared
 * per-session state (scene, route, dialogue, toast) and the scene changers.
 * Re-created each render, like the closures it replaced.
 */
export interface GameCtx {
  player: Player | null;
  dispatch: Dispatch<GameAction>;
  scene: SceneId;
  dialogue: DialogueView | null;
  cutscene: boolean;
  fading: boolean;
  positionRef: MutableRefObject<THREE.Vector3>;
  /** Game clock in seconds (see Clock in GameCanvas). */
  clockRef: MutableRefObject<number>;
  setRoute: (r: WorldXZ[] | ((r: WorldXZ[]) => WorldXZ[])) => void;
  setToast: (t: string | null) => void;
  setDialogue: (d: DialogueView | null) => void;
  setFading: (f: boolean) => void;
  setPlayerVisible: (v: boolean) => void;
  say: (speaker: string, text: string, options: DialogueView['options'], note?: string) => void;
  close: () => void;
  teleport: (scene: SceneId, p: WorldXZ) => void;
  goTo: (link: Link) => void;
}
