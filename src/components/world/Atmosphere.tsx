import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { DAY_SECONDS, START_HOUR, hourAt, lightingAt, sunDirection } from '../../game/world/dayNight';
import { NIGHT } from './nightState';

/** Late-afternoon Finnish sun: fairly low, from the south-west. */
export const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
const SUN_POS: [number, number, number] = [SUN_DIR.x * 1000, SUN_DIR.y * 1000, SUN_DIR.z * 1000];
export const FOG_COLOR = '#c8dbe6';

function SkyDome({ skyRef }: { skyRef?: MutableRefObject<THREE.Mesh | null> }) {
  return <Sky ref={skyRef as never} distance={8000} sunPosition={SUN_POS} turbidity={7} rayleigh={0.7} mieCoefficient={0.005} mieDirectionalG={0.85} />;
}

/** Shadow-casting sun that follows the player so shadows stay crisp nearby. */
function Sun({ followRef, shadowMapSize, dirRef }: { followRef: MutableRefObject<THREE.Vector3>; shadowMapSize: number; dirRef: MutableRefObject<THREE.Vector3> }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const p = followRef.current;
    const d = dirRef.current;
    // Snap to a coarse grid to avoid shadow shimmering while walking.
    const sx = Math.round(p.x / 2) * 2, sz = Math.round(p.z / 2) * 2;
    l.position.set(sx + d.x * 120, d.y * 120, sz + d.z * 120);
    l.target.position.set(sx, 0, sz);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      color="#ffe6bf"
      intensity={2.9}
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


/**
 * Sky, fog and lights. Outdoors with a clock the look follows the time of
 * day (dayNight.ts): the sun moves, evenings turn golden, nights are blue
 * with stars, and NIGHT drives lit windows and street lamps.
 */
export function Atmosphere({ followRef, high, indoor = false, aerial = false, clockRef }: { followRef: MutableRefObject<THREE.Vector3>; high: boolean; indoor?: boolean; aerial?: boolean; clockRef?: MutableRefObject<number> }) {
  const dirRef = useRef(SUN_DIR.clone());
  const sky = useRef<THREE.Mesh | null>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sunGroup = useRef<THREE.Group>(null);
  const stars = useRef<THREE.Group>(null);
  const lastHour = useRef(-1);
  const glow = useRef<THREE.PointLight>(null);
  // ?debug=1: window.__keravaHour(21) jumps the clock to that time of day
  useEffect(() => {
    if (!clockRef || !new URLSearchParams(window.location.search).has('debug')) return;
    const win = window as unknown as { __keravaHour?: (h: number) => void };
    win.__keravaHour = (h) => {
      const now = clockRef.current;
      const day = Math.floor(now / DAY_SECONDS) * DAY_SECONDS;
      let t = day + (((h - START_HOUR + 24) % 24) / 24) * DAY_SECONDS;
      if (t < now) t += DAY_SECONDS;
      clockRef.current = t;
    };
    return () => {
      delete win.__keravaHour;
    };
  }, [clockRef]);
  useFrame(({ scene }) => {
    // a soft light around the player at night so the character stays readable
    const gl = glow.current;
    if (gl) {
      const p = followRef.current;
      gl.position.set(p.x, p.y + 3.2, p.z);
      gl.intensity = indoor ? 0 : NIGHT.value * 9;
    }
    if (indoor || !clockRef) {
      NIGHT.value = 0;
      return;
    }
    const hour = hourAt(clockRef.current);
    if (Math.abs(hour - lastHour.current) < 0.004) return; // ~15 s of game time
    lastHour.current = hour;
    const L = lightingAt(hour);
    NIGHT.value = L.night;
    dirRef.current.set(...L.key.dir);
    const sun = sunGroup.current?.children[0] as THREE.DirectionalLight | undefined;
    if (sun) {
      sun.color.set(L.key.color);
      sun.intensity = L.key.intensity;
    }
    if (hemi.current) {
      hemi.current.color.set(L.hemi.sky);
      hemi.current.groundColor.set(L.hemi.ground);
      hemi.current.intensity = L.hemi.intensity;
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.set(L.fog);
      scene.fog.far = aerial ? 2600 : L.fogFar;
    }
    scene.environmentIntensity = L.env;
    const mat = sky.current?.material as THREE.ShaderMaterial | undefined;
    // the sky shader gets the true sun, even below the horizon, so dusk and night darken it
    if (mat?.uniforms?.sunPosition) mat.uniforms.sunPosition.value.set(...sunDirection(hour)).multiplyScalar(1000);
    if (stars.current) stars.current.visible = L.night > 0.35;
  });
  return (
    <>
      {indoor ? <color attach="background" args={['#101215']} /> : <SkyDome skyRef={sky} />}
      {!indoor && clockRef && (
        <group ref={stars} visible={false}>
          <Stars radius={1500} depth={300} count={3000} factor={40} saturation={0} fade speed={0.3} />
        </group>
      )}
      {/* Image-based lighting rendered from the same sky: soft fill and reflections. */}
      <Environment resolution={64} frames={1} environmentIntensity={0.55}>
        <SkyDome />
      </Environment>
      {indoor ? <fog attach="fog" args={['#101215', 60, 160]} /> : <fog attach="fog" args={[FOG_COLOR, aerial ? 500 : 160, aerial ? 2600 : 620]} />}
      <hemisphereLight ref={hemi} args={indoor ? ['#fff6e8', '#5a5650', 1.1] : ['#d6ecff', '#5d7a3a', 0.75]} />
      {!indoor && clockRef && <pointLight ref={glow} color="#d8e2ff" intensity={0} distance={16} decay={1.6} />}
      <group ref={sunGroup}>
        <Sun followRef={followRef} shadowMapSize={high ? 4096 : 1024} dirRef={dirRef} />
      </group>
    </>
  );
}
