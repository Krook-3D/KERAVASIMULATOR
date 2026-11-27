import { useEffect, type MutableRefObject } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { WorldXZ } from '../../../game/world/projection';
import type { Appearance } from '../../../game/player/appearance';
import { PlayerCharacter, type ScriptedPose } from '../PlayerCharacter';
import { KarmaAura } from '../KarmaAura';
import { ClickMarker } from '../ClickMarker';
import { CameraRig } from '../CameraRig';
import type { ControlState } from '../controls';

/** Places the camera once the station is known: a view from the platform towards the train. */
export function PlaceCamera({ offset, follow }: { offset: THREE.Vector3; follow: MutableRefObject<THREE.Vector3> }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.copy(follow.current).add(offset);
    camera.lookAt(follow.current);
  }, [camera, offset, follow]);
  return null;
}

/** The player's character with what they hold, their karma aura, the click marker and the follow camera. */
export function Player(props: {
  color: string;
  appearance: Appearance | undefined;
  positionRef: MutableRefObject<THREE.Vector3>;
  scriptRef: MutableRefObject<ScriptedPose>;
  route: WorldXZ[];
  collider: { isBlocked(p: WorldXZ, radius?: number): boolean } | null;
  groundHeight: (p: WorldXZ) => number;
  extraBlocked: (p: WorldXZ, from?: WorldXZ) => boolean;
  visible: boolean;
  auraVisible: boolean;
  karma: number;
  markerY: number;
  held: { handL?: string; handR?: string };
  onArrive: (p: WorldXZ) => void;
  controlRef: MutableRefObject<ControlState>;
  canSteer: boolean;
  onSteerStart: () => void;
  onSteerEnd: (p: WorldXZ) => void;
  onLockChange: (locked: boolean) => void;
}) {
  const { route, positionRef } = props;
  const target = route[0] ?? null;
  return (
    <>
      <PlayerCharacter
        color={props.color}
        appearance={props.appearance}
        positionRef={positionRef}
        target={target}
        collider={props.collider}
        groundHeight={props.groundHeight}
        extraBlocked={props.extraBlocked}
        visible={props.visible}
        scriptRef={props.scriptRef}
        onArrive={props.onArrive}
        held={{ handL: props.held.handL, handR: props.held.handR }}
        controlRef={props.controlRef}
        canSteer={props.canSteer}
        onSteerStart={props.onSteerStart}
        onSteerEnd={props.onSteerEnd}
      />
      <KarmaAura karma={props.karma} followRef={positionRef} visible={props.auraVisible} />
      {target && <ClickMarker point={route[route.length - 1] ?? target} y={props.markerY} />}
      <CameraRig followRef={positionRef} controlRef={props.controlRef} onLockChange={props.onLockChange} />
    </>
  );
}
