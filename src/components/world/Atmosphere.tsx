import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Sky } from '@react-three/drei';
import * as THREE from 'three';

/** Late-afternoon Finnish sun: fairly low, from the south-west. */
export const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
const SUN_POS: [number, number, number] = [SUN_DIR.x * 1000, SUN_DIR.y * 1000, SUN_DIR.z * 1000];
export const FOG_COLOR = '#c8dbe6';

function SkyDome() {
  return <Sky distance={8000} sunPosition={SUN_POS} turbidity={7} rayleigh={0.7} mieCoefficient={0.005} mieDirectionalG={0.85} />;
}

/** Shadow-casting sun that follows the player so shadows stay crisp nearby. */
function Sun({ followRef, shadowMapSize }: { followRef: MutableRefObject<THREE.Vector3>; shadowMapSize: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const p = followRef.current;
    // Snap to a coarse grid to avoid shadow shimmering while walking.
    const sx = Math.round(p.x / 2) * 2, sz = Math.round(p.z / 2) * 2;
    l.position.set(sx + SUN_DIR.x * 120, SUN_DIR.y * 120, sz + SUN_DIR.z * 120);
    l.target.position.set(sx, 0, sz);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      color="#fff1d9"
      intensity={2.6}
      castShadow
      shadow-mapSize={[shadowMapSize, shadowMapSize]}
      shadow-camera-left={-80}
      shadow-camera-right={80}
      shadow-camera-top={80}
      shadow-camera-bottom={-80}
      shadow-camera-near={1}
      shadow-camera-far={300}
      shadow-bias={-0.0004}
      shadow-normalBias={0.04}
    />
  );
}

export function Atmosphere({ followRef, high, indoor = false, aerial = false }: { followRef: MutableRefObject<THREE.Vector3>; high: boolean; indoor?: boolean; aerial?: boolean }) {
  return (
    <>
      {indoor ? <color attach="background" args={['#101215']} /> : <SkyDome />}
      {/* Image-based lighting rendered from the same sky: soft fill and reflections. */}
      <Environment resolution={64} frames={1} environmentIntensity={0.4}>
        <SkyDome />
      </Environment>
      {indoor ? <fog attach="fog" args={['#101215', 60, 160]} /> : <fog attach="fog" args={[FOG_COLOR, aerial ? 500 : 160, aerial ? 2600 : 620]} />}
      <hemisphereLight args={indoor ? ['#fff6e8', '#5a5650', 1.1] : ['#dfeeff', '#4d5f3a', 0.45]} />
      <Sun followRef={followRef} shadowMapSize={high ? 4096 : 1024} />
    </>
  );
}
