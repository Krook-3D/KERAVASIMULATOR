import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { WorldData } from '../../game/world/worldData';
import type { WorldXZ } from '../../game/world/projection';
import type { BuildingCollider } from '../../game/world/collision';
import { placeTrees } from '../../game/world/vegetation';
import { buildAreaGeometry, buildBuildingsGeometry, buildRoadLayers } from '../../game/world/geometry';
import { createBuildingMaterial, createGrainMaterial, createGroundMaterial, type XrayUniforms } from './materials';
import { Trees } from './Trees';
import { StreetProps } from './StreetProps';
import { placeStreetProps } from '../../game/world/streetProps';

interface KeravaWorldProps {
  data: WorldData;
  collider: BuildingCollider;
  excludeTrees?: (p: WorldXZ) => boolean;
  onGroundClick: (point: WorldXZ) => void;
  playerRef: MutableRefObject<THREE.Vector3>;
  xray: XrayUniforms;
}

/** Max pointer travel (px) for a press to count as a click rather than a camera drag. */
const CLICK_TOLERANCE_PX = 6;

export function KeravaWorld({ data, collider, excludeTrees, onGroundClick, playerRef, xray }: KeravaWorldProps) {

  const materials = useMemo(
    () => ({
      building: createBuildingMaterial(xray),
      ground: createGroundMaterial(),
      asphalt: createGrainMaterial('#4d5157', 0.12, 0.9),
      sidewalk: createGrainMaterial('#a7a59f', 0.1),
      path: createGrainMaterial('#c9b48a', 0.2),
      ballast: createGrainMaterial('#7d7368', 0.3),
      park: new THREE.MeshStandardMaterial({ color: '#5f8f3e', roughness: 1 }),
      water: new THREE.MeshStandardMaterial({ color: '#3f7fae', roughness: 0.2, metalness: 0.1 }),
      marking: new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.6 }),
      sleeper: new THREE.MeshStandardMaterial({ color: '#4a3527', roughness: 0.9 }),
      rail: new THREE.MeshStandardMaterial({ color: '#b9bcc2', roughness: 0.3, metalness: 0.9 }),
    }),
    [xray],
  );

  const geos = useMemo(
    () => ({
      buildings: buildBuildingsGeometry(data.buildings),
      roads: buildRoadLayers(data.roads),
      water: buildAreaGeometry(data.water, 0.025),
      parks: buildAreaGeometry(data.parks, 0.015),
    }),
    [data],
  );

  const trees = useMemo(() => placeTrees(data, collider, excludeTrees), [data, collider, excludeTrees]);
  const props = useMemo(() => placeStreetProps(data, collider, excludeTrees ?? (() => false)), [data, collider, excludeTrees]);

  useEffect(
    () => () => {
      geos.buildings?.dispose();
      geos.water?.dispose();
      geos.parks?.dispose();
      Object.values(geos.roads).forEach((g) => g?.dispose());
    },
    [geos],
  );
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  useFrame(({ camera }) => {
    const p = playerRef.current;
    xray.uPlayer.value.set(p.x, p.y + 1, p.z);
    xray.uCamera.value.copy(camera.position);
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_TOLERANCE_PX) return;
    onGroundClick([e.point.x, e.point.z]);
  };

  const size = 12000; // far beyond the fog so the horizon never shows the sky's dark underside
  const r = geos.roads;
  const flat = (geo: THREE.BufferGeometry | null, material: THREE.Material, shadow = true) =>
    geo && <mesh geometry={geo} material={material} receiveShadow={shadow} />;

  return (
    <group onClick={handleClick}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={materials.ground}>
        <planeGeometry args={[size, size]} />
      </mesh>
      {flat(geos.parks, materials.park)}
      {flat(geos.water, materials.water)}
      {flat(r.river, materials.water)}
      {flat(r.sidewalk, materials.sidewalk)}
      {flat(r.asphalt, materials.asphalt)}
      {flat(r.markings, materials.marking)}
      {flat(r.path, materials.path)}
      {flat(r.ballast, materials.ballast)}
      {flat(r.sleepers, materials.sleeper)}
      {flat(r.rails, materials.rail)}
      {geos.buildings && <mesh geometry={geos.buildings} material={materials.building} castShadow receiveShadow />}
      <Trees trees={trees} />
      <StreetProps lamps={props.lamps} cars={props.cars} />
    </group>
  );
}
