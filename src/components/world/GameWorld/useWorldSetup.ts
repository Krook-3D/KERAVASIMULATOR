import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { WorldXZ } from '../../../game/world/projection';
import { loadWorldData, worldBounds, type Building, type WorldData } from '../../../game/world/worldData';
import { createTerrain } from '../../../game/world/terrain';
import { placeTrees, RoadIndex } from '../../../game/world/vegetation';
import { placePlots, type Plot } from '../../../game/world/plots';
import { lngLatToWorld } from '../../../game/world/projection';
import { placeStreetProps } from '../../../game/world/streetProps';
import { PropCollider } from '../../../game/world/propCollider';
import { placeBlock, placeBlockAt, placePrisma } from '../../../game/world/prisma';
import { findSavioStation } from '../../../game/world/savio';
import { SITES } from '../../../game/world/sites';
import { placeBusStops, type BusStop } from '../../../game/world/transit';
import { BuildingCollider } from '../../../game/world/collision';
import {
  bridgeBlocked,
  clearStationArea,
  computeStationLayout,
  isInStationClearZone,
  isTrackBlocked,
  stationFootprints,
  stationGroundHeight,
  toWorld,
  TUNNEL_ENTRANCES,
} from '../../../game/world/station';
import type { SceneId, WorldDoorId } from '../../../game/interiors/interiors';
import { placeLoot } from '../../../game/world/loot';
import { placeCookSpots } from '../../../game/world/grills';
import { populate } from '../../../game/npc/population';
import { placeStashes } from '../../../game/quests/stashes';
import { JONNE_LOCAL, PRISON_AT, TORI_LNGLAT, PRISON_FOOTPRINT, dist } from './constants';
import type { TrainStop, WorldDoor } from './gameWorld.types';

/**
 * Map logic: loads the town, places the gameplay sites (gym, pool, shops,
 * police, Savio), and derives everything positioned from it: terrain,
 * colliders, doors, NPCs, loot, grills, stashes, bus and train stops.
 * Everything here is deterministic for a given world.
 */
export function useWorldSetup(scene: SceneId) {
  const [rawWorld, setRawWorld] = useState<WorldData | null>(null);
  useEffect(() => {
    let alive = true;
    loadWorldData().then((w) => alive && setRawWorld(w));
    return () => {
      alive = false;
    };
  }, []);

  const layout = useMemo(() => (rawWorld ? computeStationLayout(rawWorld) : null), [rawWorld]);
  const prisma = useMemo(() => (rawWorld ? placePrisma(rawWorld) : null), [rawWorld]);
  const placed = useMemo(() => {
    if (!rawWorld || !layout || !prisma) return null;
    const near = (b: Building) => b.footprint.some((q) => dist(q, PRISON_AT) < 55);
    let buildings = clearStationArea(layout, prisma.buildings).filter((b) => !near(b));
    const gym = placeBlock(buildings, rawWorld.roads, SITES.gym.lngLat, SITES.gym.w, SITES.gym.d, SITES.gym.h, SITES.gym.kind);
    buildings = gym.buildings;
    const pool = placeBlock(buildings, rawWorld.roads, SITES.pool.lngLat, SITES.pool.w, SITES.pool.d, SITES.pool.h, SITES.pool.kind);
    buildings = pool.buildings;
    const barber = placeBlock(buildings, rawWorld.roads, SITES.barber.lngLat, SITES.barber.w, SITES.barber.d, SITES.barber.h, SITES.barber.kind);
    buildings = barber.buildings;
    const motonet = placeBlock(buildings, rawWorld.roads, SITES.motonet.lngLat, SITES.motonet.w, SITES.motonet.d, SITES.motonet.h, SITES.motonet.kind);
    buildings = motonet.buildings;
    const fightgym = placeBlock(buildings, rawWorld.roads, SITES.fightgym.lngLat, SITES.fightgym.w, SITES.fightgym.d, SITES.fightgym.h, SITES.fightgym.kind);
    buildings = fightgym.buildings;
    const police = placeBlock(buildings, rawWorld.roads, SITES.police.lngLat, SITES.police.w, SITES.police.d, SITES.police.h, SITES.police.kind);
    buildings = police.buildings;
    const savio = findSavioStation(rawWorld);
    const alepaAt: WorldXZ = [savio.centre[0] + savio.side[0] * 32 + savio.dir[0] * 6, savio.centre[1] + savio.side[1] * 32 + savio.dir[1] * 6];
    const alepa = placeBlockAt(buildings.filter((b) => b.kind !== 'alepa'), rawWorld.roads, alepaAt, 24, 18, 5, 'alepa');
    buildings = alepa.buildings;
    return { world: { ...rawWorld, buildings }, gym: gym.site, pool: pool.site, alepa: alepa.site, barber: barber.site, police: police.site, motonet: motonet.site, fightgym: fightgym.site, savio };
  }, [rawWorld, layout, prisma]);
  const world = placed?.world ?? null;
  const terrain = useMemo(() => (world && layout ? createTerrain(world, layout) : null), [world, layout]);
  const collider = useMemo(() => {
    if (!world || !layout) return null;
    const extra = [...stationFootprints(layout), PRISON_FOOTPRINT].map((footprint) => ({ footprint, height: 8 }));
    return new BuildingCollider([...world.buildings, ...extra]);
  }, [world, layout]);

  const groundHeight = useCallback(
    (p: WorldXZ) => {
      if (scene !== 'world') return 0;
      return layout ? stationGroundHeight(layout, p, terrain ? terrain.surfaceAt(p[0], p[1]) : 0) : 0;
    },
    [layout, terrain, scene],
  );
  /** Lamp posts, parked cars, bus shelters and tree trunks (filled in once they are placed below). */
  const propColRef = useRef<PropCollider | null>(null);
  /** Houses the player has built on their plots (set by GameWorld from the save). */
  const houseColRef = useRef<PropCollider | null>(null);
  const extraBlocked = useCallback(
    (p: WorldXZ, from?: WorldXZ) => {
      if (scene !== 'world' || !layout) return false;
      return isTrackBlocked(layout, p) || (!!from && bridgeBlocked(layout, p, from)) || !!propColRef.current?.isBlocked(p) || !!houseColRef.current?.isBlocked(p);
    },
    [layout, scene],
  );
  /** Buyable plots on free land (the tori, the station and the prison area stay free). */
  const plots = useMemo((): Plot[] => {
    if (!world || !collider || !terrain || !layout) return [];
    const roads = new RoadIndex(world.roads);
    const tori = lngLatToWorld(TORI_LNGLAT);
    const free = (p: WorldXZ) =>
      !collider.isBlocked(p, 3) &&
      !isTrackBlocked(layout, p) &&
      !isInStationClearZone(layout, p) &&
      dist(p, PRISON_AT) > 70 &&
      dist(p, tori) > 90 &&
      terrain.heightAt(p[0], p[1]) >= terrain.surfaceAt(p[0], p[1]) - 0.2;
    return placePlots({ free, road: (p, m) => roads.near(p, m), height: (p) => terrain.heightAt(p[0], p[1]), bounds: worldBounds(world) });
  }, [world, collider, terrain, layout]);
  const inPlot = useCallback((p: WorldXZ) => plots.some((pl) => Math.abs(p[0] - pl.at[0]) < pl.size / 2 + 1 && Math.abs(p[1] - pl.at[1]) < pl.size / 2 + 1), [plots]);
  const excludeTrees = useCallback(
    (p: WorldXZ) => (layout ? isInStationClearZone(layout, p) : false) || dist(p, PRISON_AT) < 45 || inPlot(p),
    [layout, inPlot],
  );
  const grassBlocked = useCallback((p: WorldXZ) => !!collider?.isBlocked(p, 0.6) || (layout ? isTrackBlocked(layout, p) || isInStationClearZone(layout, p) : false), [collider, layout]);
  const clampToWorld = ([x, z]: WorldXZ): WorldXZ => {
    if (!world) return [x, z];
    const b = worldBounds(world);
    return [THREE.MathUtils.clamp(x, b.minX, b.maxX), THREE.MathUtils.clamp(z, b.minZ, b.maxZ)];
  };

  const trees = useMemo(() => (world && collider && terrain ? placeTrees(world, collider, excludeTrees, terrain) : []), [world, collider, excludeTrees, terrain]);
  const streetProps = useMemo(() => (world && collider && terrain ? placeStreetProps(world, collider, excludeTrees, terrain) : { lamps: [], cars: [] }), [world, collider, excludeTrees, terrain]);
  const loot = useMemo(() => (world && collider && terrain ? placeLoot(world, collider, excludeTrees, terrain) : []), [world, collider, terrain, excludeTrees]);

  const doors = useMemo(() => {
    if (!layout || !prisma) return null;
    const out = (dz: number): WorldXZ => [layout.dirZ[0] * dz, layout.dirZ[1] * dz];
    const tt = TUNNEL_ENTRANCES[0]!, te = TUNNEL_ENTRANCES[1]!;
    const list: WorldDoor[] = [
      { id: 'tunnel-town', at: toWorld(layout, [tt.x, tt.z + 2.6]), outward: out(1), label: 'Asematunneli ⬇', to: { scene: 'tunnel', exit: 'town' } },
      { id: 'tunnel-east', at: toWorld(layout, [te.x, te.z - 2.6]), outward: out(-1), label: 'Asematunneli ⬇', to: { scene: 'tunnel', exit: 'east' } },
      { id: 'station-platform', at: toWorld(layout, [0, 12.3]), outward: out(-1), label: 'Asemarakennus', to: { scene: 'station', exit: 'platform' } },
      { id: 'station-town', at: toWorld(layout, [0, 23.8]), outward: out(1), label: 'Asemarakennus', to: { scene: 'station', exit: 'town' } },
      { id: 'prisma', at: prisma.site.door, outward: prisma.site.outward, label: 'Prisma', to: { scene: 'prisma', exit: 'main' } },
      { id: 'prison-yard', at: [PRISON_AT[0], PRISON_AT[1] + 23.5], outward: [0, 1], label: 'Keravan vankila' },
    ];
    if (placed) {
      list.push({ id: 'gym', at: placed.gym.door, outward: placed.gym.outward, label: 'Kuntosali Rauta', to: { scene: 'gym', exit: 'main' } });
      list.push({ id: 'barber', at: placed.barber.door, outward: placed.barber.outward, label: 'Parturi', to: { scene: 'barber', exit: 'main' } });
      list.push({ id: 'alepa', at: placed.alepa.door, outward: placed.alepa.outward, label: 'Alepa', to: { scene: 'alepa', exit: 'main' } });
      list.push({ id: 'motonet', at: placed.motonet.door, outward: placed.motonet.outward, label: 'Motonet', to: { scene: 'motonet', exit: 'main' } });
      list.push({ id: 'fightgym', at: placed.fightgym.door, outward: placed.fightgym.outward, label: 'Ahjo Training Center', to: { scene: 'fightgym', exit: 'main' } });
      list.push({ id: 'police', at: placed.police.door, outward: placed.police.outward, label: 'Poliisiasema', to: { scene: 'police', exit: 'main' } });
      list.push({ id: 'pool', at: placed.pool.door, outward: placed.pool.outward, label: 'Uimahalli', to: { scene: 'pool', exit: 'main' } });
    }
    return Object.fromEntries(list.map((d) => [d.id, d])) as Record<WorldDoorId, WorldDoor>;
  }, [layout, prisma, placed]);

  const npcs = useMemo(() => {
    if (!world || !collider || !terrain || !layout || !doors) return [];
    const ok = (p: WorldXZ) => !collider.isBlocked(p, 1.2) && !isTrackBlocked(layout, p) && terrain.heightAt(p[0], p[1]) >= terrain.surfaceAt(p[0], p[1]) - 0.2 && dist(p, PRISON_AT) > 50;
    const ahead = (d: WorldDoor, k: number): WorldXZ => [d.at[0] + d.outward[0] * k, d.at[1] + d.outward[1] * k];
    return populate(world, ok, [ahead(doors['station-town'], 22), ahead(doors.prisma, 26), ...(placed ? [placed.savio.wait] : [])]);
  }, [world, collider, terrain, layout, doors, placed]);
  const cookSpots = useMemo(() => {
    if (!world || !collider || !terrain || !layout) return [];
    return placeCookSpots(world, (p) => !collider.isBlocked(p, 3) && !isTrackBlocked(layout, p) && terrain.heightAt(p[0], p[1]) >= terrain.surfaceAt(p[0], p[1]) - 0.2);
  }, [world, collider, terrain, layout]);

  const busStops = useMemo((): BusStop[] => {
    if (!world || !doors || !layout) return [];
    const ahead = (d: WorldDoor, k: number): WorldXZ => [d.at[0] + d.outward[0] * k, d.at[1] + d.outward[1] * k];
    return placeBusStops(
      [
        { id: 'asema', name: 'Asema', near: ahead(doors['station-town'], 30) },
        { id: 'keskusta', name: 'Keskusta / Prisma', near: ahead(doors.prisma, 20) },
        { id: 'sali', name: 'Kuntosali', near: ahead(doors.gym, 15) },
        { id: 'uimahalli', name: 'Uimahalli', near: ahead(doors.pool, 15) },
        ...(doors.motonet ? [{ id: 'motonet', name: 'Motonet', near: ahead(doors.motonet, 16) }] : []),
        ...(doors.police ? [{ id: 'poliisi', name: 'Poliisiasema', near: ahead(doors.police, 14) }] : []),
        { id: 'kaleva', name: 'Kaleva', near: [-300, 420] },
        { id: 'ahjo', name: 'Ahjo', near: [420, 60] },
        { id: 'talma', name: 'Talma', near: [1450, -860] },
        { id: 'vankila', name: 'Vankilan risteys', near: [PRISON_AT[0], PRISON_AT[1] + 45] },
        ...(placed ? [{ id: 'savio', name: 'Savio', near: [placed.savio.wait[0] + placed.savio.side[0] * 40, placed.savio.wait[1] + placed.savio.side[1] * 40] as WorldXZ }] : []),
      ],
      world.roads,
    );
  }, [world, doors, layout, placed]);

  const trainStops = useMemo((): TrainStop[] => {
    if (!layout || !placed) return [];
    return [
      { id: 'kerava', name: 'Kerava', at: toWorld(layout, [-24, 6]) },
      { id: 'savio', name: 'Savio', at: placed.savio.wait },
    ];
  }, [layout, placed]);

  const stashes = useMemo(() => {
    if (!world || !collider || !terrain) return [];
    const roadsNear = (p: WorldXZ) => world.roads.some((r) => r.points.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 18));
    return placeStashes(world, (p) => !collider.isBlocked(p, 2) && !roadsNear(p) && terrain.heightAt(p[0], p[1]) >= terrain.surfaceAt(p[0], p[1]) - 0.2);
  }, [world, collider, terrain]);

  const jonneAt = useMemo(() => (layout ? toWorld(layout, JONNE_LOCAL) : null), [layout]);
  const jonneYaw = useMemo(() => (layout ? Math.atan2(-layout.dirZ[0], -layout.dirZ[1]) + 0.6 : 0), [layout]);

  // Graffiti: run-down places (tunnel mouths, prison, Savio) and tidy ones (shop fronts, park grills).
  const uglySpots = useMemo((): WorldXZ[] => {
    if (!layout) return [];
    const list: WorldXZ[] = TUNNEL_ENTRANCES.map((t) => toWorld(layout, [t.x, t.z]));
    list.push(PRISON_AT);
    if (placed) list.push(placed.savio.centre);
    return list;
  }, [layout, placed]);
  const niceSpots = useMemo((): WorldXZ[] => {
    const list: WorldXZ[] = [];
    if (doors) for (const id of ['prisma', 'pool', 'gym', 'barber', 'police'] as const) if (doors[id]) list.push(doors[id].at);
    for (const c of cookSpots) if (c.kind === 'grill') list.push(c.at);
    return list;
  }, [doors, cookSpots]);

  const ready = !!(world && collider && layout && terrain && doors);

  const propCollider = useMemo(() => {
    const c = new PropCollider();
    for (const l of streetProps.lamps) c.circle(l.x, l.z, 0.18);
    // parked cars: 1.75 m × 4.1 m, long side along the car's heading
    for (const car of streetProps.cars) c.box(car.x, car.z, 0.9, 2.08, car.rotation);
    for (const t of trees) c.circle(t.x, t.z, 0.22 * t.scale);
    // bus shelters (see BusStopModel): back wall, side panes, bench, sign pole; open towards the road
    for (const b of busStops) {
      const yaw = Math.atan2(b.side[0], b.side[1]);
      const ox = b.at[0] + b.side[0] * 1.2, oz = b.at[1] + b.side[1] * 1.2;
      c.boxIn(ox, oz, yaw, 0, 0.7, 1.85, 0.06);
      c.boxIn(ox, oz, yaw, -1.85, 0.2, 0.05, 0.5);
      c.boxIn(ox, oz, yaw, 1.85, 0.2, 0.05, 0.5);
      c.boxIn(ox, oz, yaw, 0, 0.45, 1.2, 0.2);
      c.boxIn(ox, oz, yaw, -2.3, -0.6, 0.06, 0.06);
    }
    return c;
  }, [streetProps, trees, busStops]);
  propColRef.current = propCollider;

  return {
    ready,
    world,
    layout,
    prisma,
    placed,
    terrain,
    collider,
    doors,
    groundHeight,
    extraBlocked,
    excludeTrees,
    grassBlocked,
    trees,
    streetProps,
    propCollider,
    plots,
    houseColRef,
    clampToWorld,
    loot,
    npcs,
    cookSpots,
    busStops,
    trainStops,
    stashes,
    jonneAt,
    jonneYaw,
    uglySpots,
    niceSpots,
  };
}

export type WorldSetup = ReturnType<typeof useWorldSetup>;
