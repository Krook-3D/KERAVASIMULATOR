import type { MutableRefObject } from 'react';
import type * as THREE from 'three';
import type { Npc } from '../../../game/npc/population';
import type { Terrain } from '../../../game/world/terrain';
import { Crowd, type NpcLive } from '../npc/Crowd';

/** Town life: crews, citizens and families walking around (hidden during the intro). */
export function NPCLayer({ npcs, live, terrain, cutscene, clockRef, playerRef, talkingId, onTalk }: {
  npcs: Npc[];
  live: MutableRefObject<NpcLive>;
  terrain: Terrain;
  cutscene: boolean;
  clockRef: MutableRefObject<number>;
  playerRef: MutableRefObject<THREE.Vector3>;
  talkingId: string | null;
  onTalk: (npc: Npc) => void;
}) {
  if (cutscene || npcs.length === 0) return null;
  return <Crowd npcs={npcs} live={live} clockRef={clockRef} groundAt={(x, z) => terrain.surfaceAt(x, z)} playerRef={playerRef} talkingId={talkingId} onTalk={onTalk} />;
}
