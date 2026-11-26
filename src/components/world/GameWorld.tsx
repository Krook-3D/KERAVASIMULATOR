import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { LngLat } from '../../types/game';
import { lngLatToWorld, worldToLngLat, type WorldXZ } from '../../game/world/projection';
import { loadWorldData, type WorldData } from '../../game/world/worldData';
import { BuildingCollider } from '../../game/world/collision';
import {
  clearStationArea,
  computeStationLayout,
  isInStationClearZone,
  stationFootprints,
  stationGroundHeight,
  toWorld,
  INTRO_DOOR_X,
} from '../../game/world/station';
import { NO_INTRO_START } from '../../game/world/trainSchedule';
import { INSPECTOR_NAME, INTRO_TIMES, type IntroLine } from '../../game/world/intro';
import { KeravaWorld } from './KeravaWorld';
import { PlayerCharacter, type ScriptedPose } from './PlayerCharacter';
import { CameraRig } from './CameraRig';
import { ClickMarker } from './ClickMarker';
import { Atmosphere } from './Atmosphere';
import { Effects } from './Effects';
import { createXrayUniforms } from './materials';
import { Station } from './Station';
import { Train } from './Train';
import { Inspector } from './Inspector';
import { IntroDirector } from './IntroDirector';
import { Clouds } from './StreetProps';
import { placeClouds } from '../../game/world/streetProps';

interface GameWorldProps {
  start: LngLat;
  color: string;
  playerName: string;
  introDone: boolean;
  /** High = post-processing and sharper shadows. */
  highQuality: boolean;
  onMove: (position: LngLat) => void;
  onIntroDone: (position: LngLat) => void;
}

function Clock({ clockRef }: { clockRef: MutableRefObject<number> }) {
  useFrame((_, dt) => {
    clockRef.current += Math.min(dt, 0.5);
  });
  return null;
}

/** Places the camera once the station is known: a view from the platform towards the train. */
function PlaceCamera({ offset, follow }: { offset: THREE.Vector3; follow: MutableRefObject<THREE.Vector3> }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.copy(follow.current).add(offset);
    camera.lookAt(follow.current);
  }, [camera, offset, follow]);
  return null;
}

export function GameWorld({ start, color, playerName, introDone, highQuality, onMove, onIntroDone }: GameWorldProps) {
  const [rawWorld, setRawWorld] = useState<WorldData | null>(null);
  const [target, setTarget] = useState<WorldXZ | null>(null);
  const [cutscene, setCutscene] = useState(!introDone);
  const [line, setLine] = useState<IntroLine | null>(null);
  const [playerVisible, setPlayerVisible] = useState(introDone);

  const startXZ = useMemo(() => lngLatToWorld(start), [start]);
  const positionRef = useRef(new THREE.Vector3(startXZ[0], 0, startXZ[1]));
  const clockRef = useRef(introDone ? NO_INTRO_START : 0);
  const xray = useMemo(createXrayUniforms, []);
  const clouds = useMemo(placeClouds, []);
  const scriptRef = useRef<ScriptedPose>({ active: !introDone, tilt: 0, yaw: 0, flail: 0 });

  useEffect(() => {
    let alive = true;
    loadWorldData().then((w) => alive && setRawWorld(w));
    return () => {
      alive = false;
    };
  }, []);

  const layout = useMemo(() => (rawWorld ? computeStationLayout(rawWorld) : null), [rawWorld]);
  const world = useMemo(
    () => (rawWorld && layout ? { ...rawWorld, buildings: clearStationArea(layout, rawWorld.buildings) } : null),
    [rawWorld, layout],
  );
  const collider = useMemo(() => {
    if (!world || !layout) return null;
    const extra = stationFootprints(layout).map((footprint) => ({ footprint, height: 8 }));
    return new BuildingCollider([...world.buildings, ...extra]);
  }, [world, layout]);
  const groundHeight = useCallback((p: WorldXZ) => (layout ? stationGroundHeight(layout, p) : 0), [layout]);
  const excludeTrees = useCallback((p: WorldXZ) => (layout ? isInStationClearZone(layout, p) : false), [layout]);

  const cameraOffset = useMemo(() => {
    if (!layout) return null;
    // Stand on the platform side, slightly along the track, looking at the door.
    const [zx, zz] = layout.dirZ, [xx, xz] = layout.dirX;
    // Cutscene: low under the canopy, looking along the platform at the door.
    return cutscene
      ? new THREE.Vector3(zx * 7.5 - xx * 9, 3.6, zz * 7.5 - xz * 9)
      : new THREE.Vector3(zx * 9 - xx * 5, 7, zz * 9 - xz * 5);
    // Only on first placement.
  }, [layout]);

  // New players start in the train door.
  useEffect(() => {
    if (layout && cutscene) {
      const door = toWorld(layout, [INTRO_DOOR_X, 1.75]);
      positionRef.current.set(door[0], 0.55, door[1]);
    }
  }, [layout]);

  const clampToWorld = ([x, z]: WorldXZ): WorldXZ => {
    const r = world?.radius ?? 500;
    return [THREE.MathUtils.clamp(x, -r, r), THREE.MathUtils.clamp(z, -r, r)];
  };

  const finishIntro = useCallback(
    (p: WorldXZ) => {
      setCutscene(false);
      setLine(null);
      setPlayerVisible(true);
      onIntroDone(worldToLngLat(p));
    },
    [onIntroDone],
  );

  const skip = () => {
    if (clockRef.current < INTRO_TIMES.end) clockRef.current = INTRO_TIMES.end;
  };

  const speaker = line?.speaker === 'inspector' ? INSPECTOR_NAME : line?.speaker === 'player' ? playerName : null;

  return (
    <div className={`game-world${cutscene ? ' is-cutscene' : ''}`}>
      <Canvas
        shadows="percentage"
        dpr={highQuality ? [1, 2] : [1, 1.25]}
        gl={{ antialias: !highQuality, powerPreference: 'high-performance' }}
        camera={{ fov: 45, near: 0.3, far: 9000, position: [startXZ[0] - 12, 9, startXZ[1] + 14] }}
      >
        <Clock clockRef={clockRef} />
        <Atmosphere followRef={positionRef} high={highQuality} />
        {highQuality && <Effects />}
        <Clouds clouds={clouds} />

        {world && collider && layout && (
          <>
            <KeravaWorld
              data={world}
              collider={collider}
              excludeTrees={excludeTrees}
              playerRef={positionRef}
              xray={xray}
              onGroundClick={(p) => !cutscene && setTarget(clampToWorld(p))}
            />
            <Station layout={layout} xray={xray} />
            <Train layout={layout} clockRef={clockRef} />
            {cutscene && <Inspector layout={layout} clockRef={clockRef} />}
            {cutscene && (
              <IntroDirector
                layout={layout}
                clockRef={clockRef}
                positionRef={positionRef}
                scriptRef={scriptRef}
                onLine={setLine}
                onVisible={setPlayerVisible}
                onDone={finishIntro}
              />
            )}
            {cameraOffset && <PlaceCamera offset={cameraOffset} follow={positionRef} />}
          </>
        )}
        <PlayerCharacter
          color={color}
          positionRef={positionRef}
          target={target}
          collider={collider}
          groundHeight={groundHeight}
          visible={playerVisible}
          scriptRef={scriptRef}
          onArrive={(p) => {
            setTarget(null);
            onMove(worldToLngLat(p));
          }}
        />
        {target && <ClickMarker point={target} y={positionRef.current.y} />}
        <CameraRig followRef={positionRef} />
      </Canvas>

      {!world && <div className="world-loading">Ladataan Keravaa…</div>}
      {cutscene && world && (
        <>
          <div className="letterbox letterbox--top" />
          <div className="letterbox letterbox--bottom">
            {line && (
              <div className={`subtitle subtitle--${line.speaker}`}>
                {speaker && <span className="subtitle__speaker">{speaker}</span>}
                <span>{line.text}</span>
              </div>
            )}
          </div>
          <button type="button" className="skip-btn" onClick={skip}>
            Ohita ▶
          </button>
        </>
      )}
      {!cutscene && world?.source === 'placeholder' && (
        <div className="world-badge">Väliaikainen kartta · aja <code>npm run fetch:osm</code> saadaksesi oikean Keravan</div>
      )}
      {!cutscene && world?.source === 'osm' && <div className="world-badge">© OpenStreetMap contributors</div>}
    </div>
  );
}
