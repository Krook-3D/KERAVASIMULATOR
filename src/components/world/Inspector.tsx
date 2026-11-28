import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { INTRO_DOOR_X, PLATFORM, type StationLayout } from '../../game/world/station';
import { INTRO_TIMES } from '../../game/world/intro';
import { Humanoid, type HumanBones, type Outfit } from './humanoid/Humanoid';
import { poseHoldOut, poseLocomotion, posePoint, resetPose } from './humanoid/animate';

const UNIFORM: Outfit = {
  top: '#1f2d4d',
  legs: '#1a2238',
  shoes: '#111111',
  hair: '#6b5a4a',
  skin: '#e8b892',
  hat: 'cap',
  hatColor: '#1f2d4d',
  accent: '#d9b44a',
  style: 'jacket',
  prop: 'reader',
  build: 1.08,
};

/** The ticket inspector who appears in the train door during the intro. */
export function Inspector({ layout, clockRef }: { layout: StationLayout; clockRef: MutableRefObject<number> }) {
  const root = useRef<THREE.Group>(null);
  const bones = useRef<HumanBones | null>(null);

  useFrame(() => {
    const t = clockRef.current;
    const g = root.current;
    const b = bones.current;
    if (!g || !b) return;
    g.visible = t > INTRO_TIMES.playerAppears && t < 23;
    resetPose(b);
    poseLocomotion(b, 0, 0, t);
    if (t > 15.7 && t < INTRO_TIMES.throwEnd) {
      // points out of the door, then shoves
      const push = t > INTRO_TIMES.throwStart ? Math.min(1, (t - INTRO_TIMES.throwStart) * 6) : 0;
      posePoint(b, Math.min(1, (t - 15.7) * 4));
      b.spine.rotation.x = push * 0.25;
      g.position.z = 1.7 + push * 0.4;
    } else if (t > 11.8 && t < 13.8) {
      poseHoldOut(b, Math.min(1, (t - 11.8) * 4)); // holding out the card reader
      g.position.z = 1.7;
    } else {
      g.position.z = 1.7;
    }
  });

  return (
    <group position={[layout.origin[0], 0, layout.origin[1]]} rotation-y={layout.rotationY}>
      <group ref={root} position={[INTRO_DOOR_X + 0.85, PLATFORM.height, 1.7]} rotation-y={-0.9} visible={false}>
        <Humanoid outfit={UNIFORM} bonesRef={bones} />
      </group>
    </group>
  );
}
