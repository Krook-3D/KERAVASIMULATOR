import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { INTRO_DOOR_X, PLATFORM, toWorld, type StationLayout } from '../../game/world/station';
import { INTRO_TIMES, lineAt, type IntroLine } from '../../game/world/intro';
import type { WorldXZ } from '../../game/world/projection';
import type { ScriptedPose } from './PlayerCharacter';

interface IntroDirectorProps {
  layout: StationLayout;
  clockRef: MutableRefObject<number>;
  positionRef: MutableRefObject<THREE.Vector3>;
  scriptRef: MutableRefObject<ScriptedPose>;
  onLine: (line: IntroLine | null) => void;
  onVisible: (v: boolean) => void;
  onDone: (landing: WorldXZ) => void;
}

const easeOut = (k: number) => 1 - (1 - k) ** 2;

/** Drives the player through the "no ticket" cutscene on the train clock. */
export function IntroDirector({ layout, clockRef, positionRef, scriptRef, onLine, onVisible, onDone }: IntroDirectorProps) {
  const lastLine = useRef<IntroLine | null>(null);
  const shown = useRef(false);
  const finished = useRef(false);

  const inDoor = toWorld(layout, [INTRO_DOOR_X, 1.75]);
  const landing = toWorld(layout, [INTRO_DOOR_X - 0.6, 5.4]);
  // Facing out of the train (local +z) and back towards it (local -z).
  const yawOut = Math.atan2(layout.dirZ[0], layout.dirZ[1]);
  const yawBack = yawOut + Math.PI;

  useFrame(() => {
    if (finished.current) return;
    const t = clockRef.current;
    const T = INTRO_TIMES;
    const s = scriptRef.current;
    const pos = positionRef.current;
    s.active = true;

    const line = lineAt(t);
    if (line !== lastLine.current) {
      lastLine.current = line;
      onLine(line);
    }
    const visible = t >= T.playerAppears;
    if (visible !== shown.current) {
      shown.current = visible;
      onVisible(visible);
    }

    if (t < T.throwStart) {
      pos.set(inDoor[0], PLATFORM.height, inDoor[1]);
      s.yaw = yawOut;
      s.tilt = 0;
      // nervous fidget while "looking for the ticket"
      s.flail = t > 13.8 && t < 15.7 ? 0.15 : 0;
    } else if (t < T.throwEnd) {
      const k = (t - T.throwStart) / (T.throwEnd - T.throwStart);
      const e = easeOut(k);
      pos.set(
        THREE.MathUtils.lerp(inDoor[0], landing[0], e),
        PLATFORM.height + Math.sin(Math.PI * k) * 1.3,
        THREE.MathUtils.lerp(inDoor[1], landing[1], e),
      );
      s.yaw = yawBack; // thrown backwards, facing the train
      s.tilt = -k * 1.5;
      s.flail = 1;
    } else if (t < T.standUp) {
      pos.set(landing[0], PLATFORM.height + 0.05, landing[1]);
      s.yaw = yawBack;
      s.tilt = -1.45; // flat on the back
      s.flail = 0.1;
    } else if (t < T.stoodUp) {
      const k = (t - T.standUp) / (T.stoodUp - T.standUp);
      pos.set(landing[0], PLATFORM.height, landing[1]);
      s.yaw = yawBack;
      s.tilt = -1.45 * (1 - easeOut(k));
      s.flail = 0;
    } else if (t < T.end) {
      pos.set(landing[0], PLATFORM.height, landing[1]);
      s.yaw = yawBack;
      s.tilt = 0;
      s.flail = 0;
    } else {
      finished.current = true;
      pos.set(landing[0], PLATFORM.height, landing[1]); // also covers "skip"
      s.active = false;
      s.tilt = 0;
      s.flail = 0;
      onLine(null);
      onVisible(true);
      onDone([pos.x, pos.z]);
    }
  });

  return null;
}
