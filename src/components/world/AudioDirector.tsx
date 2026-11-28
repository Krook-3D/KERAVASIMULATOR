import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { CYCLE, trainStateAt } from '../../game/world/trainSchedule';
import { toWorld, type StationLayout } from '../../game/world/station';
import { distanceGain, sfx, updateAmbience } from '../../audio';
import { SURFACE } from '../../audio/footsteps';
import { NIGHT } from './nightState';

const HARD_FLOORS = new Set(['prisma', 'alepa', 'motonet', 'krauta', 'station', 'tunnel', 'prison', 'police', 'barber', 'gym', 'fightgym']);

/**
 * Drives the background sound from inside the 3D scene: ambience by scene and
 * time of day, the footstep surface, and the commuter train's rumble and horn
 * by its distance from the player.
 */
export function AudioDirector({ scene, layout, clockRef, positionRef, dim }: {
  scene: string;
  layout: StationLayout | null;
  clockRef: MutableRefObject<number>;
  positionRef: MutableRefObject<THREE.Vector3>;
  dim: boolean;
}) {
  const acc = useRef(0);
  const lastX = useRef<number | null>(null);
  const lastPhase = useRef(-1);
  useFrame((_, dt) => {
    SURFACE.value = scene === 'pool' ? 'wet' : HARD_FLOORS.has(scene) ? 'hard' : 'soft';
    acc.current += dt;
    if (acc.current < 0.1) return;
    const step = acc.current;
    acc.current = 0;

    let trainDist = Infinity;
    let trainSpeed = 0;
    if (layout) {
      const t = clockRef.current;
      const s = trainStateAt(t);
      // the train's middle, in world metres (local x runs along the track)
      const [wx, wz] = toWorld(layout, [s.x + 40, 0]);
      const p = positionRef.current;
      if (s.visible && scene === 'world') trainDist = Math.hypot(wx - p.x, wz - p.z);
      if (lastX.current !== null) trainSpeed = Math.min(1, Math.abs(s.x - lastX.current) / step / 30);
      lastX.current = s.x;
      // horn as it comes in and as it leaves, if you are near enough to hear
      const tt = ((t % CYCLE.length) + CYCLE.length) % CYCLE.length;
      const phase = tt < 2 ? 0 : tt >= CYCLE.departStart && tt < CYCLE.departStart + 2 ? 1 : -1;
      if (phase !== -1 && phase !== lastPhase.current) {
        const k = distanceGain(Math.max(0, trainDist - 60), 20, 600);
        if (k > 0.02) sfx('trainHorn', { gain: k });
      }
      lastPhase.current = phase;
    }
    updateAmbience({ scene, night: NIGHT.value, trainDist, trainSpeed, dim }, step);
  });
  return null;
}
