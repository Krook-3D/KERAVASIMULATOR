import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { WorldData } from '../../game/world/worldData';
import type { WorldXZ } from '../../game/world/projection';
import type { BuildingCollider } from '../../game/world/collision';
import { placeTrees } from '../../game/world/vegetation';
import { buildAreaGeometry, buildBuildingsGeometry, buildRoadLayers, buildTerrainGeometry } from '../../game/world/geometry';
import type { Terrain } from '../../game/world/terrain';
import { paintGroundMap } from './groundMap';
import { createBuildingMaterial, createGrainMaterial, createGroundMaterial, type XrayUniforms } from './materials';
import { Trees } from './Trees';
import { StreetProps } from './StreetProps';
import { placeStreetProps } from '../../game/world/streetProps';

interface KeravaWorldProps {
  data: WorldData;
  terrain: Terrain;
  collider: BuildingCollider;
  excludeTrees?: (p: WorldXZ) => boolean;
  onGroundClick: (point: WorldXZ) => void;
  playerRef: MutableRefObject<THREE.Vector3>;
  xray: XrayUniforms;
}

/** Pull a ground layer towards the camera in the depth test so it never flickers with the terrain. */
function offset<M extends THREE.Material>(m: M, units: number): M {
  m.polygonOffset = true;
  m.polygonOffsetFactor = units;
  m.polygonOffsetUnits = units;
  return m;
}

/** Max pointer travel (px) for a press to count as a click rather than a camera drag. */
const CLICK_TOLERANCE_PX = 6;

export function KeravaWorld({ data, terrain, collider, excludeTrees, onGroundClick, playerRef, xray }: KeravaWorldProps) {
  const groundMap = useMemo(() => paintGroundMap(data, terrain), [data, terrain]);
  useEffect(() => () => groundMap.texture.dispose(), [groundMap]);

  const materials = useMemo(
    () => ({
      building: createBuildingMaterial(xray),
      ground: createGroundMaterial(),
      terrain: createGroundMaterial(groundMap),
      asphalt: offset(createGrainMaterial('#4d5157', 0.12, 0.9), -2),
      sidewalk: offset(createGrainMaterial('#a7a59f', 0.1), -1),
      path: offset(createGrainMaterial('#c9b48a', 0.2), -1),
      ballast: offset(createGrainMaterial('#7d7368', 0.3), -1),
      water: new THREE.MeshStandardMaterial({ color: '#3f7fae', roughness: 0.2, metalness: 0.1 }),
      marking: offset(new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.6 }), -3),
      sleeper: new THREE.MeshStandardMaterial({ color: '#4a3527', roughness: 0.9 }),
      rail: new THREE.MeshStandardMaterial({ color: '#b9bcc2', roughness: 0.3, metalness: 0.9 }),
    }),
    [xray, groundMap],
  );

  const geos = useMemo(
    () => ({
      terrain: buildTerrainGeometry(terrain),
      buildings: buildBuildingsGeometry(data.buildings, terrain),
      roads: buildRoadLayers(data.roads, terrain),
      water: buildAreaGeometry(data.water, terrain.waterLevels),
    }),
    [data, terrain],
  );

  const trees = useMemo(() => placeTrees(data, collider, excludeTrees, terrain), [data, collider, excludeTrees, terrain]);
  const props = useMemo(() => placeStreetProps(data, collider, excludeTrees ?? (() => false), terrain), [data, collider, excludeTrees, terrain]);

  useEffect(
    () => () => {
      geos.terrain.dispose();
      geos.buildings?.dispose();
      geos.water?.dispose();
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
      {/* far plane beyond the terrain, slightly lower so the terrain edge meets it */}
      {/* four slabs around the terrain (a single plane would cover low ground like the river valley) */}
      {(() => {
        const x0 = terrain.minX + 3, x1 = terrain.maxX - 3, z0 = terrain.minZ + 3, z1 = terrain.maxZ - 3, H = size / 2;
        return [
          [-H, H, -H, z0],
          [-H, H, z1, H],
          [-H, x0, z0, z1],
          [x1, H, z0, z1],
        ].map(([a, b, c, d], i) => (
          <mesh key={i} rotation-x={-Math.PI / 2} position={[(a! + b!) / 2, -0.4, (c! + d!) / 2]} receiveShadow material={materials.ground}>
            <planeGeometry args={[b! - a!, d! - c!]} />
          </mesh>
        ));
      })()}
      <mesh geometry={geos.terrain} material={materials.terrain} receiveShadow />
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
