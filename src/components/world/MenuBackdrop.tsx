import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { loadWorldData, type WorldData } from '../../game/world/worldData';
import { createTerrain } from '../../game/world/terrain';
import { placePrisma } from '../../game/world/prisma';
import { BuildingCollider } from '../../game/world/collision';
import { clearStationArea, computeStationLayout, stationFootprints } from '../../game/world/station';
import { placeClouds } from '../../game/world/streetProps';
import { NO_INTRO_START } from '../../game/world/trainSchedule';
import { KeravaWorld } from './KeravaWorld';
import { Atmosphere } from './Atmosphere';
import { Station } from './Station';
import { Train } from './Train';
import { Clouds } from './StreetProps';
import { PrismaExterior } from './Landmarks';
import { createXrayUniforms } from './materials';

/** Slow aerial orbit over the station and the centre. */
function OrbitCam({ centre, follow }: { centre: THREE.Vector3; follow: MutableRefObject<THREE.Vector3> }) {
  useFrame(({ camera, clock }) => {
    const a = clock.elapsedTime * 0.035 + 0.8;
    const r = 330;
    camera.position.set(centre.x + Math.cos(a) * r, 190 + Math.sin(clock.elapsedTime * 0.05) * 15, centre.z + Math.sin(a) * r);
    camera.lookAt(centre.x, 0, centre.z);
    follow.current.copy(centre);
  });
  return null;
}

/** The menu background: our own Kerava rendered from the air. */
export function MenuBackdrop() {
  const [raw, setRaw] = useState<WorldData | null>(null);
  useEffect(() => {
    let alive = true;
    loadWorldData().then((w) => alive && setRaw(w));
    return () => {
      alive = false;
    };
  }, []);
  const xray = useMemo(createXrayUniforms, []);
  const clouds = useMemo(placeClouds, []);
  const follow = useRef(new THREE.Vector3());
  const nowhere = useRef(new THREE.Vector3(1e5, 0, 1e5)); // no x-ray hole in the menu
  const clock = useRef(NO_INTRO_START);
  const scene = useMemo(() => {
    if (!raw) return null;
    const layout = computeStationLayout(raw);
    const prisma = placePrisma(raw);
    const world = { ...raw, buildings: clearStationArea(layout, prisma.buildings) };
    const terrain = createTerrain(world, layout);
    const collider = new BuildingCollider([...world.buildings, ...stationFootprints(layout).map((footprint) => ({ footprint, height: 8 }))]);
    return { layout, prisma, world, terrain, collider };
  }, [raw]);
  const centre = useMemo(() => new THREE.Vector3(-40, 0, 20), []);
  return (
    <div className="menu-backdrop" aria-hidden>
      <Canvas shadows="percentage" dpr={[1, 1.25]} camera={{ fov: 40, near: 1, far: 9000, position: [300, 200, 300] }}>
        <Atmosphere followRef={follow} high={false} aerial />
        <OrbitCam centre={centre} follow={follow} />
        <ClockTick clock={clock} />
        {scene && (
          <group>
            <Clouds clouds={clouds} />
            <KeravaWorld data={scene.world} terrain={scene.terrain} collider={scene.collider} playerRef={nowhere} xray={xray} onGroundClick={() => {}} />
            <Station layout={scene.layout} xray={xray} />
            <Train layout={scene.layout} clockRef={clock} />
            <PrismaExterior site={scene.prisma.site} ground={scene.terrain.surfaceAt(scene.prisma.site.door[0], scene.prisma.site.door[1])} />
          </group>
        )}
      </Canvas>
    </div>
  );
}

function ClockTick({ clock }: { clock: MutableRefObject<number> }) {
  useFrame((_, dt) => {
    clock.current += Math.min(dt, 0.5);
  });
  return null;
}
