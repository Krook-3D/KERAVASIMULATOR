import { useRef, type MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Humanoid, type HumanBones, type Outfit } from '../world/humanoid/Humanoid';
import { poseLocomotion, resetPose } from '../world/humanoid/animate';

function Model({ outfit, yawRef, focus }: { outfit: Outfit; yawRef: MutableRefObject<number>; focus: 'body' | 'head' }) {
  const g = useRef<THREE.Group>(null);
  const bones = useRef<HumanBones | null>(null);
  useFrame(({ camera, clock }, dt) => {
    if (g.current) g.current.rotation.y = yawRef.current;
    if (bones.current) {
      resetPose(bones.current);
      poseLocomotion(bones.current, 0, 0, clock.elapsedTime);
    }
    const h = outfit.height ?? 1;
    const want = focus === 'head' ? new THREE.Vector3(0, 1.66 * h, 1.15) : new THREE.Vector3(0, 1.15 * h, 3.6);
    camera.position.lerp(want, Math.min(1, dt * 6));
    camera.lookAt(0, focus === 'head' ? 1.64 * h : 0.95 * h, 0);
  });
  return (
    <group ref={g}>
      <Humanoid outfit={outfit} bonesRef={bones} />
    </group>
  );
}

/** Rotating 3D preview of a character. Drag to turn. */
export function AvatarPreview({ outfit, focus = 'body' }: { outfit: Outfit; focus?: 'body' | 'head' }) {
  const yaw = useRef(0.35);
  const drag = useRef<number | null>(null);
  return (
    <div
      className="avatar-preview"
      onPointerDown={(e) => (drag.current = e.clientX)}
      onPointerMove={(e) => {
        if (drag.current === null) return;
        yaw.current += (e.clientX - drag.current) * 0.012;
        drag.current = e.clientX;
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
    >
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 30, position: [0, 1.15, 3.6] }}>
        <color attach="background" args={['#1c222c']} />
        <hemisphereLight args={['#eef4ff', '#3a3226', 1.0]} />
        <directionalLight position={[2, 4, 3]} intensity={2.2} castShadow />
        <directionalLight position={[-3, 2, -2]} intensity={0.6} color="#9cc3ff" />
        <Model outfit={outfit} yawRef={yaw} focus={focus} />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[1.1, 32]} />
          <meshStandardMaterial color="#3a3f47" />
        </mesh>
      </Canvas>
      <span className="avatar-preview__hint">↔ raahaa kääntääksesi</span>
    </div>
  );
}
