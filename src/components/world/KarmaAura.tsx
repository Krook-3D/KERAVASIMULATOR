import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AURA_COLORS, auraTier } from '../../game/shop/shop';

/** Soft glow around the player's feet and body; colour and strength follow karma. */
export function KarmaAura({ karma, followRef, visible }: { karma: number; followRef: MutableRefObject<THREE.Vector3>; visible: boolean }) {
  const g = useRef<THREE.Group>(null);
  const tier = auraTier(karma);
  const strength = Math.min(1, Math.abs(karma) / 100);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  const dark = karma < 0;
  useFrame(({ clock }) => {
    const m = g.current;
    if (!m) return;
    m.position.copy(followRef.current);
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.08;
    m.scale.setScalar(pulse);
  });
  if (tier === 'neutral' && strength < 0.15) return null;
  const opacity = 0.15 + strength * 0.5;
  return (
    <group ref={g} visible={visible}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.05} raycast={() => null}>
        <planeGeometry args={[2.6 + strength * 1.6, 2.6 + strength * 1.6]} />
        <meshBasicMaterial map={tex} color={AURA_COLORS[tier]} transparent opacity={opacity} depthWrite={false} toneMapped={false} blending={dark ? THREE.NormalBlending : THREE.AdditiveBlending} />
      </mesh>
      <sprite position-y={1.0} scale={[1.8 + strength, 2.6 + strength, 1]} raycast={() => null}>
        <spriteMaterial map={tex} color={AURA_COLORS[tier]} transparent opacity={opacity * 0.55} depthWrite={false} toneMapped={false} blending={dark ? THREE.NormalBlending : THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}
