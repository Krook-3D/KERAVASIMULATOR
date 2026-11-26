import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LngLat } from '../../types/game';
import { lngLatToWorld, worldToLngLat, type WorldXZ } from '../../game/world/projection';
import { loadWorldData, type WorldData } from '../../game/world/worldData';
import { BuildingCollider } from '../../game/world/collision';
import { KeravaWorld } from './KeravaWorld';
import { PlayerCharacter } from './PlayerCharacter';
import { CameraRig } from './CameraRig';
import { ClickMarker } from './ClickMarker';

interface GameWorldProps {
  start: LngLat;
  color: string;
  onMove: (position: LngLat) => void;
}

const SKY = '#a9d3ee';

/** Sun that follows the player so shadows stay sharp around them. */
function Sun({ followRef }: { followRef: React.MutableRefObject<THREE.Vector3> }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const p = followRef.current;
    l.position.set(p.x + 40, 80, p.z + 25);
    l.target.position.copy(p);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      intensity={2.2}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-70}
      shadow-camera-right={70}
      shadow-camera-top={70}
      shadow-camera-bottom={-70}
      shadow-camera-far={250}
      shadow-bias={-0.0005}
    />
  );
}

export function GameWorld({ start, color, onMove }: GameWorldProps) {
  const [world, setWorld] = useState<WorldData | null>(null);
  const [target, setTarget] = useState<WorldXZ | null>(null);
  const startXZ = useMemo(() => lngLatToWorld(start), [start]);
  const collider = useMemo(() => (world ? new BuildingCollider(world.buildings) : null), [world]);
  const positionRef = useRef(new THREE.Vector3(startXZ[0], 0, startXZ[1]));

  useEffect(() => {
    let alive = true;
    loadWorldData().then((w) => alive && setWorld(w));
    return () => {
      alive = false;
    };
  }, []);

  const clampToWorld = ([x, z]: WorldXZ): WorldXZ => {
    const r = world?.radius ?? 500;
    return [THREE.MathUtils.clamp(x, -r, r), THREE.MathUtils.clamp(z, -r, r)];
  };

  return (
    <div className="game-world">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ fov: 50, near: 0.5, far: 1500, position: [startXZ[0] - 20, 24, startXZ[1] + 26] }}
      >
        <color attach="background" args={[SKY]} />
        <fog attach="fog" args={[SKY, 120, 420]} />
        <hemisphereLight args={['#fff4d6', '#55704a', 1.1]} />
        <Sun followRef={positionRef} />

        {world && <KeravaWorld data={world} playerRef={positionRef} onGroundClick={(p) => setTarget(clampToWorld(p))} />}
        <PlayerCharacter
          color={color}
          positionRef={positionRef}
          target={target}
          collider={collider}
          onArrive={(p) => {
            setTarget(null);
            onMove(worldToLngLat(p));
          }}
        />
        {target && <ClickMarker point={target} />}
        <CameraRig followRef={positionRef} />
      </Canvas>

      {!world && <div className="world-loading">Ladataan Keravaa…</div>}
      {world?.source === 'placeholder' && (
        <div className="world-badge">Väliaikainen kartta · aja <code>npm run fetch:osm</code> saadaksesi oikean Keravan</div>
      )}
      {world?.source === 'osm' && <div className="world-badge">© OpenStreetMap contributors</div>}
    </div>
  );
}
