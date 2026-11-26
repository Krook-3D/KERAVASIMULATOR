import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { WorldData } from '../../game/world/worldData';
import type { WorldXZ } from '../../game/world/projection';
import { applyXray, createXrayUniforms } from './xrayMaterial';
import { buildAreaGeometry, buildBuildingsGeometry, buildRoadGeometry } from '../../game/world/geometry';

interface KeravaWorldProps {
  data: WorldData;
  onGroundClick: (point: WorldXZ) => void;
  playerRef: MutableRefObject<THREE.Vector3>;
}

/** Max pointer travel (px) for a press to count as a click rather than a camera drag. */
const CLICK_TOLERANCE_PX = 6;

export function KeravaWorld({ data, onGroundClick, playerRef }: KeravaWorldProps) {
  const xray = useMemo(createXrayUniforms, []);
  const buildingMaterial = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
    applyXray(m, xray);
    return m;
  }, [xray]);
  useEffect(() => () => buildingMaterial.dispose(), [buildingMaterial]);

  useFrame(({ camera }) => {
    const p = playerRef.current;
    xray.uPlayer.value.set(p.x, p.y + 1, p.z);
    xray.uCamera.value.copy(camera.position);
  });

  const geos = useMemo(
    () => ({
      buildings: buildBuildingsGeometry(data.buildings),
      major: buildRoadGeometry(data.roads, 'major'),
      street: buildRoadGeometry(data.roads, 'street'),
      path: buildRoadGeometry(data.roads, 'path'),
      rail: buildRoadGeometry(data.roads, 'rail'),
      river: buildRoadGeometry(data.roads, 'river'),
      water: buildAreaGeometry(data.water, 0.02),
      parks: buildAreaGeometry(data.parks, 0.015),
    }),
    [data],
  );

  useEffect(() => () => Object.values(geos).forEach((g) => g?.dispose()), [geos]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_TOLERANCE_PX) return;
    onGroundClick([e.point.x, e.point.z]);
  };

  const size = data.radius * 2 + 400;

  return (
    <group onClick={handleClick}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#8fb26b" />
      </mesh>
      {geos.parks && (
        <mesh geometry={geos.parks} receiveShadow>
          <meshStandardMaterial color="#6f9e4f" />
        </mesh>
      )}
      {geos.water && (
        <mesh geometry={geos.water}>
          <meshStandardMaterial color="#4f8fc9" roughness={0.2} metalness={0.1} />
        </mesh>
      )}
      {geos.river && (
        <mesh geometry={geos.river}>
          <meshStandardMaterial color="#4f8fc9" roughness={0.2} metalness={0.1} />
        </mesh>
      )}
      {geos.major && (
        <mesh geometry={geos.major} receiveShadow>
          <meshStandardMaterial color="#5b5f66" />
        </mesh>
      )}
      {geos.street && (
        <mesh geometry={geos.street} receiveShadow>
          <meshStandardMaterial color="#73777e" />
        </mesh>
      )}
      {geos.path && (
        <mesh geometry={geos.path} receiveShadow>
          <meshStandardMaterial color="#d8c9a3" />
        </mesh>
      )}
      {geos.rail && (
        <mesh geometry={geos.rail} receiveShadow>
          <meshStandardMaterial color="#6b5546" />
        </mesh>
      )}
      {geos.buildings && (
        <mesh geometry={geos.buildings} material={buildingMaterial} castShadow receiveShadow />
      )}
    </group>
  );
}
