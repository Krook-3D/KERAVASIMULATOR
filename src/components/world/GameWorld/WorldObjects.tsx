import type { MutableRefObject } from 'react';
import type * as THREE from 'three';
import type { WorldXZ } from '../../../game/world/projection';
import type { SavedPiece } from '../../../game/art/graffiti';
import { GraffitiWall } from '../art/GraffitiWall';
import { Stashes } from '../Stashes';
import { CookSpots } from '../CookSpots';
import { LootField } from '../items/LootField';
import { Hotspot } from '../interiors/kit';
import type { WorldSetup } from './useWorldSetup';
import { Plots } from '../Plots';
import type { PlotState } from '../../../game/world/plots';

/** Things in the town you can use: graffiti on the walls, forest stashes, grills and fires, loot on the ground. */
export function WorldObjects({ w, pieces, stashTaken, lootTaken, owned, cutscene, playerRef, onGroundClick }: {
  owned: Record<string, PlotState>;
  w: WorldSetup;
  pieces: SavedPiece[];
  stashTaken: Set<string>;
  lootTaken: string[];
  cutscene: boolean;
  playerRef: MutableRefObject<THREE.Vector3>;
  onGroundClick: (p: WorldXZ) => void;
}) {
  const terrain = w.terrain!;
  const groundAt = (x: number, z: number) => terrain.surfaceAt(x, z);
  return (
    <>
      <GraffitiWall pieces={pieces} />
      {!cutscene && <Stashes stashes={w.stashes} taken={stashTaken} playerRef={playerRef} groundAt={groundAt} onClick={(st) => onGroundClick(st.at)} />}
      <Plots plots={w.plots} owned={owned} groundAt={(x, z) => terrain.heightAt(x, z)} onClick={onGroundClick} />
      <CookSpots spots={w.cookSpots} groundAt={groundAt} />
      {!cutscene && w.cookSpots.map((c) => <Hotspot key={c.id} at={c.at} y={groundAt(c.at[0], c.at[1])} label={`🍳 ${c.name}`} onClick={() => onGroundClick(c.at)} />)}
      {!cutscene && <LootField spots={w.loot} taken={lootTaken} playerRef={playerRef} onPick={(l) => onGroundClick([l.x, l.z])} />}
    </>
  );
}
