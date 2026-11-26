import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { INTRO_DOOR_X, PLATFORM, type StationLayout } from '../../game/world/station';
import { INTRO_TIMES } from '../../game/world/intro';
import { HumanModel, type Outfit } from './HumanModel';

const UNIFORM: Outfit = {
  top: '#1f2d4d',
  legs: '#1a2238',
  shoes: '#111111',
  hat: 'cap',
  hatColor: '#1f2d4d',
  accent: '#d9b44a',
};

/** The ticket inspector who appears in the train door during the intro. */
export function Inspector({ layout, clockRef }: { layout: StationLayout; clockRef: MutableRefObject<number> }) {
  const root = useRef<THREE.Group>(null);
  const rig = {
    legL: useRef<THREE.Group>(null),
    legR: useRef<THREE.Group>(null),
    armL: useRef<THREE.Group>(null),
    armR: useRef<THREE.Group>(null),
    head: useRef<THREE.Group>(null),
  };

  useFrame(() => {
    const t = clockRef.current;
    const g = root.current;
    if (!g) return;
    g.visible = t > INTRO_TIMES.playerAppears && t < 23;
    const arm = rig.armR.current;
    if (!arm) return;
    if (t > 15.7 && t < INTRO_TIMES.throwEnd) {
      // points out of the door, then shoves
      const push = t > INTRO_TIMES.throwStart ? Math.min(1, (t - INTRO_TIMES.throwStart) * 6) : 0;
      arm.rotation.x = -1.4 - push * 0.2;
      g.position.z = 1.0 + push * 0.5;
    } else if (t > 11.8 && t < 13.8) {
      arm.rotation.x = -0.9; // holding out the card reader
    } else {
      arm.rotation.x = 0;
      g.position.z = 1.0;
    }
  });

  return (
    <group position={[layout.origin[0], 0, layout.origin[1]]} rotation-y={layout.rotationY}>
      <group ref={root} position={[INTRO_DOOR_X + 0.75, PLATFORM.height, 1.0]} visible={false}>
        <HumanModel outfit={UNIFORM} rig={rig} />
      </group>
    </group>
  );
}
