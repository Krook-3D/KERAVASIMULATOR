import { useEffect, useRef, type ComponentRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface CameraRigProps {
  followRef: MutableRefObject<THREE.Vector3>;
}

const KEY_ROTATE_SPEED = 1.8; // rad/s
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Third-person camera that orbits the player: drag to rotate, scroll to zoom,
 * arrow keys / A-D to spin, W-S to tilt. The orbit target follows the player.
 */
export function CameraRig({ followRef }: CameraRigProps) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const last = useRef(new THREE.Vector3().copy(followRef.current));

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      keys.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const p = followRef.current;
    const lookAt = new THREE.Vector3(p.x, p.y + 1.4, p.z);

    // Move camera with the player so the orbit offset is kept.
    const delta = lookAt.clone().sub(last.current);
    camera.position.add(delta);
    last.current.copy(lookAt);
    c.target.copy(lookAt);

    const k = keys.current;
    const yaw = (k.has('arrowleft') || k.has('a') ? 1 : 0) - (k.has('arrowright') || k.has('d') ? 1 : 0);
    const pitch = (k.has('arrowup') || k.has('w') ? 1 : 0) - (k.has('arrowdown') || k.has('s') ? 1 : 0);
    if (yaw || pitch) {
      const offset = camera.position.clone().sub(lookAt);
      if (yaw) offset.applyAxisAngle(UP, yaw * KEY_ROTATE_SPEED * dt);
      if (pitch) {
        const sph = new THREE.Spherical().setFromVector3(offset);
        sph.phi = THREE.MathUtils.clamp(sph.phi - pitch * KEY_ROTATE_SPEED * dt, c.minPolarAngle, c.maxPolarAngle);
        offset.setFromSpherical(sph);
      }
      camera.position.copy(lookAt).add(offset);
    }
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      minDistance={4}
      maxDistance={70}
      minPolarAngle={0.25}
      maxPolarAngle={1.42}
    />
  );
}
