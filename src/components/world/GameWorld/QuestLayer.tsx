import { useMemo, type MutableRefObject } from 'react';
import type * as THREE from 'three';
import type { WorldXZ } from '../../../game/world/projection';
import type { PlacedStash } from '../../../game/quests/stashes';
import type { IntroLine } from '../../../game/world/intro';
import { JAILBREAK_STEP } from '../../../game/quests/jailbreak';
import type { ScriptedPose } from '../PlayerCharacter';
import { crewThug, Pursuers } from '../Stashes';
import type { GangAttack } from './systems/useCrewStreet';
import { Jonne } from '../quest/Jonne';
import { Inspector } from '../Inspector';
import { IntroDirector } from '../IntroDirector';
import type { WorldSetup } from './useWorldSetup';

/** Quest actors in the town: the intro (inspector), Jonne at the station and stash pursuers. */
export function QuestLayer({ w, jailStep, chase, gang, cutscene, playerRef, clockRef, scriptRef, onGroundClick, onLine, onVisible, onIntroDone }: {
  w: WorldSetup;
  jailStep: number;
  chase: { stash: PlacedStash; from: WorldXZ; t0: number } | null;
  gang: GangAttack | null;
  cutscene: boolean;
  playerRef: MutableRefObject<THREE.Vector3>;
  clockRef: MutableRefObject<number>;
  scriptRef: MutableRefObject<ScriptedPose>;
  onGroundClick: (p: WorldXZ) => void;
  onLine: (l: IntroLine | null) => void;
  onVisible: (v: boolean) => void;
  onIntroDone: (p: WorldXZ) => void;
}) {
  const gangOutfits = useMemo(() => (gang ? Array.from({ length: gang.size }, (_, i) => crewThug(gang.colour, i)) : undefined), [gang]);
  const terrain = w.terrain!, layout = w.layout!, jonneAt = w.jonneAt;
  return (
    <>
      {chase && <Pursuers owner={chase.stash.owner} from={chase.from} t0={chase.t0} playerRef={playerRef} clockRef={clockRef} groundAt={(x, z) => terrain.surfaceAt(x, z)} />}
      {gang && <Pursuers outfits={gangOutfits} from={gang.from} t0={gang.t0} playerRef={playerRef} clockRef={clockRef} groundAt={(x, z) => terrain.surfaceAt(x, z)} />}
      {jonneAt && <Jonne at={jonneAt} y={0} yaw={w.jonneYaw} onClick={() => onGroundClick(jonneAt)} showMarker={!cutscene && jailStep === JAILBREAK_STEP.notStarted} />}
      {cutscene && <Inspector layout={layout} clockRef={clockRef} />}
      {cutscene && <IntroDirector layout={layout} clockRef={clockRef} positionRef={playerRef} scriptRef={scriptRef} onLine={onLine} onVisible={onVisible} onDone={onIntroDone} />}
    </>
  );
}
