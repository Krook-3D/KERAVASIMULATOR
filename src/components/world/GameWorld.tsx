import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { LngLat } from '../../types/game';
import { lngLatToWorld, worldToLngLat, type WorldXZ } from '../../game/world/projection';
import { loadWorldData, worldBounds, type Building, type WorldData } from '../../game/world/worldData';
import { createTerrain } from '../../game/world/terrain';
import { placeBlock, placeBlockAt, placePrisma } from '../../game/world/prisma';
import { TRAIN_DODGE_CATCH, TRAIN_FARE, TRAIN_FINE, findSavioStation } from '../../game/world/savio';
import { SITES } from '../../game/world/sites';
import { BUS_FARE, FARE_DODGE_CATCH, inspectorDropStop, placeBusStops, type BusStop } from '../../game/world/transit';
import { BUS_ARRIVE, BusStopModel, BusVehicle, type BusRun } from './Bus';
import { LIFTS, SET_ENERGY, liftChance, liftXp, barWeight, type LiftId } from '../../game/gym/lifting';
import { BuildingCollider } from '../../game/world/collision';
import {
  bridgeBlocked,
  clearStationArea,
  computeStationLayout,
  isInStationClearZone,
  isTrackBlocked,
  planRoute,
  stationFootprints,
  stationGroundHeight,
  toWorld,
  INTRO_DOOR_X,
  TUNNEL_ENTRANCES,
} from '../../game/world/station';
import { NO_INTRO_START } from '../../game/world/trainSchedule';
import { INSPECTOR_NAME, INTRO_TIMES, type IntroLine } from '../../game/world/intro';
import { POLICE_BARS, POLICE_CELL_SPAWN, POLICE_DESK_SPOT, BARBER_CHAIR_SPOT, GYM_PLATE_SPOT, GYM_STATIONS, INTERIORS, PLAYER_BARS, PLAYER_CELL_X, POOL_SWIM_SPOT, RectCollider, type InteriorId, type Link, type SceneId, type WorldDoorId } from '../../game/interiors/interiors';
import { JAILBREAK, JAILBREAK_ID, JAILBREAK_STEP } from '../../game/quests/jailbreak';
import { levelFromXp } from '../../game/xp/xp';
import { useGame } from '../../game/store/GameProvider';
import { KeravaWorld } from './KeravaWorld';
import { PlayerCharacter, playerOutfit, type ScriptedPose } from './PlayerCharacter';
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
import { ClickFloor, Hotspot } from './interiors/kit';
import { LootField } from './items/LootField';
import { KarmaAura } from './KarmaAura';
import { GroundDetail } from './GroundDetail';
import { Birds } from './Birds';
import { ROINA, ROINA_SPOT, buffMultipliers, strainEffect, type RoinaId } from '../../game/gym/roina';
import { drugUnits } from '../../game/shop/shop';
import { Pursuers, Stashes } from './Stashes';
import { STASH_DEFS, STASH_STEP, placeStashes, stashQuestId, type PlacedStash } from '../../game/quests/stashes';
import { ITEMS as ITEM_DEFS } from '../../data/items';
import { GraffitiCanvas } from './art/GraffitiCanvas';
import { GraffitiWall } from './art/GraffitiWall';
import { POLICE_RESPONSE, QUALITY_KARMA, QUALITY_NAMES, WITNESS_LINES, artXp, loadPieces, nearestWall, savePieces, spotQuality, witnessReaction, type SavedPiece, type SpotQuality, type WallHit } from '../../game/art/graffiti';
import { SPRAY_COLORS, isSpray } from '../../data/items';
import { CookSpots } from './CookSpots';
import { CookHud } from './CookHud';
import { placeCookSpots, type CookSpot } from '../../game/world/grills';
import { burnChance, type Recipe } from '../../game/cooking/recipes';
import { Crowd, type NpcLive } from './npc/Crowd';
import { populate, type Npc } from '../../game/npc/population';
import { speakerName, talkTreeFor, type TalkOption, type TalkTree } from '../../game/npc/talk';
import { ShelfHud, TillHud, AlertMeter } from './shop/ShopHud';
import { PoliceInterior } from './interiors/PoliceInterior';
import { MotonetInterior } from './interiors/MotonetInterior';
import { SHOPS, CAUGHT_KARMA_MULT, STEAL_KARMA, alertLevel, basketTotal, catchChance, type Shelf } from '../../game/shop/shop';
import { placeLoot, type LootSpot } from '../../game/world/loot';
import { canAdd, INVENTORY_SIZE } from '../../game/store/gameReducer';
import { ITEMS, RARITY_NAMES, itemIcon, itemName } from '../../data/items';
import { TunnelInterior } from './interiors/TunnelInterior';
import { StationInterior } from './interiors/StationInterior';
import { PrismaInterior, Shopper } from './interiors/PrismaInterior';
import { PrisonInterior } from './interiors/PrisonInterior';
import { GymInterior, setDuration, type GymActive } from './interiors/GymInterior';
import { PoolInterior, SWIM_TIME } from './interiors/PoolInterior';
import { GymHud } from './gym/GymHud';
import { BlockExterior, PrismaExterior, PrisonExterior, SavioStationModel } from './Landmarks';
import { AlepaInterior } from './interiors/AlepaInterior';
import { BarberInterior } from './interiors/BarberInterior';
import { AppearanceEditor } from '../editor/AppearanceEditor';
import { AvatarPreview } from '../editor/AvatarPreview';
import { BARBER_PRICE, defaultAppearance, type Appearance } from '../../game/player/appearance';
import { Jonne } from './quest/Jonne';
import { DialogueBox, type DialogueView } from './quest/DialogueBox';
import { JailHud, PrisonGuards, newJailLive } from './quest/Jailbreak';

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

interface WorldDoor {
  id: WorldDoorId;
  at: WorldXZ;
  /** Points away from the building / stairwell. */
  outward: WorldXZ;
  label: string;
  to?: { scene: InteriorId; exit: string };
}

/** Keravan vankila sits at the edge of the forest north-east of the centre. */
const PRISON_AT: WorldXZ = [560, -610];
const PRISON_FOOTPRINT: WorldXZ[] = [
  [PRISON_AT[0] - 18, PRISON_AT[1] - 13],
  [PRISON_AT[0] + 18, PRISON_AT[1] - 13],
  [PRISON_AT[0] + 18, PRISON_AT[1] + 5],
  [PRISON_AT[0] - 18, PRISON_AT[1] + 5],
];
const JONNE_LOCAL: WorldXZ = [-27.5, 22.5];
const CELL_SPAWN: WorldXZ = [PLAYER_CELL_X + 0.6, -4.2];
const HOTSPOT_SNAP = 2.6;
const HOTSPOT_USE = 1.8;

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

const dist = (a: WorldXZ, b: WorldXZ) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function GameWorld({ start, color, playerName, introDone, highQuality, onMove, onIntroDone }: GameWorldProps) {
  const { state, dispatch } = useGame();
  const player = state.player;
  const jail = player?.quests[JAILBREAK_ID];
  const jailStep = !jail ? 0 : jail.status === 'completed' ? JAILBREAK_STEP.done : jail.objectiveIndex;
  const inJail = jailStep >= JAILBREAK_STEP.visit && jailStep <= JAILBREAK_STEP.escape;

  const [rawWorld, setRawWorld] = useState<WorldData | null>(null);
  const [route, setRoute] = useState<WorldXZ[]>([]);
  const target = route[0] ?? null;
  const [cutscene, setCutscene] = useState(!introDone);
  const [line, setLine] = useState<IntroLine | null>(null);
  const [playerVisible, setPlayerVisible] = useState(introDone);
  const [scene, setScene] = useState<SceneId>(inJail ? 'prison' : 'world');
  const [dialogue, setDialogue] = useState<DialogueView | null>(null);
  const [fading, setFading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // shops: basket, the shelf / till you stand at, thefts this visit; police holding cell
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [atShelf, setAtShelf] = useState<Shelf | null>(null);
  const [atTill, setAtTill] = useState(false);
  const [visitThefts, setVisitThefts] = useState(0);
  const [putkaUntil, setPutkaUntil] = useState<number | null>(null);
  const [putkaLeft, setPutkaLeft] = useState(0);

  const startXZ = useMemo(() => lngLatToWorld(start), [start]);
  const positionRef = useRef(new THREE.Vector3(...(inJail ? [CELL_SPAWN[0], 0, CELL_SPAWN[1]] : [startXZ[0], 0, startXZ[1]]) as [number, number, number]));
  const clockRef = useRef(introDone ? NO_INTRO_START : 0);
  const xray = useMemo(createXrayUniforms, []);
  const clouds = useMemo(placeClouds, []);
  const scriptRef = useRef<ScriptedPose>({ active: !introDone, tilt: 0, yaw: 0, flail: 0 });
  const jailLive = useRef(newJailLive());
  const holdingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    loadWorldData().then((w) => alive && setRawWorld(w));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // ------------------------------------------------------------ world setup
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
    const police = placeBlock(buildings, rawWorld.roads, SITES.police.lngLat, SITES.police.w, SITES.police.d, SITES.police.h, SITES.police.kind);
    buildings = police.buildings;
    const savio = findSavioStation(rawWorld);
    const alepaAt: WorldXZ = [savio.centre[0] + savio.side[0] * 32 + savio.dir[0] * 6, savio.centre[1] + savio.side[1] * 32 + savio.dir[1] * 6];
    const alepa = placeBlockAt(buildings.filter((b) => b.kind !== 'alepa'), rawWorld.roads, alepaAt, 24, 18, 5, 'alepa');
    buildings = alepa.buildings;
    return { world: { ...rawWorld, buildings }, gym: gym.site, pool: pool.site, alepa: alepa.site, barber: barber.site, police: police.site, motonet: motonet.site, savio };
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
  const extraBlocked = useCallback(
    (p: WorldXZ, from?: WorldXZ) => {
      if (scene !== 'world' || !layout) return false;
      return isTrackBlocked(layout, p) || (!!from && bridgeBlocked(layout, p, from));
    },
    [layout, scene],
  );
  const excludeTrees = useCallback(
    (p: WorldXZ) => (layout ? isInStationClearZone(layout, p) : false) || dist(p, PRISON_AT) < 45,
    [layout],
  );

  const loot = useMemo(() => (world && collider && terrain ? placeLoot(world, collider, excludeTrees, terrain) : []), [world, collider, terrain, excludeTrees]);
  const lootTaken = player?.lootTaken ?? [];
  const pickLoot = (s: LootSpot) => {
    if (!player || lootTaken.includes(s.id)) return;
    if (!canAdd(player, s.itemId)) {
      setToast('🎒 Reppu on täynnä (30/30). Pudota tai myy jotain ensin.');
      return;
    }
    dispatch({ type: 'pickupLoot', lootId: s.id, itemId: s.itemId });
    const r = ITEMS[s.itemId]?.rarity ?? 'common';
    setToast(`${r === 'legendary' ? '🌟 ' : ''}Löysit: ${itemName(s.itemId)} (${RARITY_NAMES[r]})`);
  };

  const interiorCollider = useMemo(() => {
    if (scene === 'world') return null;
    const def = INTERIORS[scene];
    let solids = scene === 'prison' && jailStep < JAILBREAK_STEP.escape ? [...def.solids, PLAYER_BARS] : def.solids;
    if (scene === 'police' && putkaUntil !== null) solids = [...solids, POLICE_BARS];
    return new RectCollider(solids);
  }, [scene, jailStep, putkaUntil]);

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
      list.push({ id: 'police', at: placed.police.door, outward: placed.police.outward, label: 'Poliisiasema', to: { scene: 'police', exit: 'main' } });
      list.push({ id: 'pool', at: placed.pool.door, outward: placed.pool.outward, label: 'Uimahalli', to: { scene: 'pool', exit: 'main' } });
    }
    return Object.fromEntries(list.map((d) => [d.id, d])) as Record<WorldDoorId, WorldDoor>;
  }, [layout, prisma, placed]);

  // ------------------------------------------------------------ town life (NPCs)
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
  const npcLive = useRef<NpcLive>(new Map());
  const grassBlocked = useCallback((p: WorldXZ) => !!collider?.isBlocked(p, 0.6) || (layout ? isTrackBlocked(layout, p) || isInStationClearZone(layout, p) : false), [collider, layout]);
  const [talkingId, setTalkingId] = useState<string | null>(null);
  const pendingTalk = useRef<string | null>(null);

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

  const jonneAt = useMemo(() => (layout ? toWorld(layout, JONNE_LOCAL) : null), [layout]);
  const jonneYaw = useMemo(() => (layout ? Math.atan2(-layout.dirZ[0], -layout.dirZ[1]) + 0.6 : 0), [layout]);

  const cameraOffset = useMemo(() => {
    if (!layout) return null;
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
    if (!world) return [x, z];
    const b = worldBounds(world);
    return [THREE.MathUtils.clamp(x, b.minX, b.maxX), THREE.MathUtils.clamp(z, b.minZ, b.maxZ)];
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

  // ------------------------------------------------------------ scene changes
  const teleport = useCallback(
    (sceneId: SceneId, p: WorldXZ) => {
      setFading(true);
      setRoute([]);
      window.setTimeout(() => {
        setScene(sceneId);
        const y = sceneId === 'world' && layout ? stationGroundHeight(layout, p, terrain ? terrain.surfaceAt(p[0], p[1]) : 0) : 0;
        positionRef.current.set(p[0], y, p[1]);
        if (sceneId === 'world') onMove(worldToLngLat(p));
        window.setTimeout(() => setFading(false), 150);
      }, 300);
    },
    [layout, terrain, onMove],
  );

  const goTo = useCallback(
    (link: Link) => {
      if (link.scene === 'world') {
        const d = doors?.[link.door];
        if (!d) return;
        teleport('world', [d.at[0] + d.outward[0] * 2, d.at[1] + d.outward[1] * 2]);
      } else {
        const ex = INTERIORS[link.scene].exits.find((e) => e.id === link.exit);
        if (ex) teleport(link.scene, ex.spawn);
      }
    },
    [doors, teleport],
  );

  // ------------------------------------------------------------ quest: jailbreak
  const say = (speaker: string, text: string, options: DialogueView['options'], note?: string) => setDialogue({ speaker, text, options, note });
  const close = () => setDialogue(null);

  const sendToJail = () => {
    dispatch({ type: 'setQuestStep', questId: JAILBREAK_ID, step: JAILBREAK_STEP.visit });
    jailLive.current = newJailLive();
    close();
    teleport('prison', CELL_SPAWN);
    window.setTimeout(() => setToast('Sinut vietiin Keravan vankilaan. Questit-paneelissa: Viilattu vapaus.'), 500);
  };

  const arrest = () => {
    const hustle = levelFromXp(player?.skills.hustling?.xp ?? 0);
    say('Poliisi', 'Poliisi, seis! Mitäs tuossa pussissa on?', [
      { text: 'Ei se oo mun! Joku Jonne antoi sen…', onPick: () => say('Poliisi', 'Jonne. Aivan. Niitä on Keravalla aika monta. Lähdetään asemalle.', [{ text: 'Voihan vittu.', onPick: sendToJail }]) },
      { text: 'Pullaa. Ihan vaan pullaa.', onPick: () => say('Poliisi', 'Pullaa ei yleensä pakata noin. Mukaan vaan.', [{ text: '…', onPick: sendToJail }]) },
      {
        text: '[Hustlaus 10] Selitä tilanne rauhallisesti.',
        onPick: () =>
          hustle >= 10
            ? say('Poliisi', 'No… mene sitten. Mutta pidä nenäsi puhtaana.', [{ text: 'Kiitos, konstaapeli.', onPick: close }])
            : say('Poliisi', 'Joo joo. Selität sitten kuulustelussa.', [{ text: 'Voihan vittu.', onPick: sendToJail }], `Hustlauksesi ei riittänyt (taso ${hustle}/10).`),
      },
    ]);
  };

  const talkToJonne = () => {
    if (jailStep !== JAILBREAK_STEP.notStarted) {
      say('Jonne', jailStep === JAILBREAK_STEP.done ? 'Ai sä pääsit pois? Respect. Mä en tiedä mitään mistään.' : 'Mitä?', [{ text: 'Painu hiiteen, Jonne.', onPick: close }]);
      return;
    }
    say('Jonne', 'Hei kaveri! Voisitko pitää tätä pussia hetken? Mä käyn vaan tossa kioskilla. Kaks minuuttia, max.', [
      {
        text: 'Okei, anna tänne.',
        onPick: () =>
          say('Jonne', 'Kiitti, oot kingi! Älä sit avaa sitä.', [
            { text: '(Odota…)', onPick: () => say('Kertoja', 'Jonne katoaa tunneliin. Hetken päästä sireenit ulvovat aukiolla.', [{ text: 'Mitä hel…', onPick: arrest }]) },
          ]),
      },
      { text: 'En koske tuntemattomien pusseihin.', onPick: () => say('Jonne', 'Tylsimys. Mä kysyn joltain muulta.', [{ text: 'Hyvä niin.', onPick: close }]) },
    ]);
  };

  const visit = () =>
    say('Vartija', 'Sulle on vieras. Tapaamishuone, viisi minuuttia.', [
      {
        text: 'Mennään.',
        onPick: () =>
          say('Serkku Pasi', 'No moi! Äiti leipoi sulle pullaa. Syö se ihan RAUHASSA. Ja yksin. Ymmärsitkö? Yksin.', [
            {
              text: 'Ymmärsin… luulisin.',
              onPick: () =>
                say('Kertoja', 'Pullan sisältä löytyy pieni metalliviila. Kiitos, Pasi.', [
                  {
                    text: 'Takaisin selliin.',
                    onPick: () => {
                      dispatch({ type: 'addItem', itemId: 'viila' });
                      dispatch({ type: 'addItem', itemId: 'pulla' });
                      dispatch({ type: 'setQuestStep', questId: JAILBREAK_ID, step: JAILBREAK_STEP.file });
                      jailLive.current.progress = 0;
                      close();
                      teleport('prison', CELL_SPAWN);
                    },
                  },
                ]),
            },
          ]),
      },
    ]);

  const onCaught = useCallback(() => {
    holdingRef.current = false;
    setRoute([]);
    setDialogue({
      speaker: 'Vartija',
      text: jailStep === JAILBREAK_STEP.escape ? 'HEI! Minne luulet meneväsi?! Takaisin selliin!' : 'Mitäs täällä raaputetaan?! Anna tänne se!',
      note: 'Jäit kiinni. Viila takavarikoitiin ja kalterit korjattiin.',
      options: [
        {
          text: 'Voi ei…',
          onPick: () => {
            dispatch({ type: 'removeItem', itemId: 'viila' });
            dispatch({ type: 'setQuestStep', questId: JAILBREAK_ID, step: JAILBREAK_STEP.visit });
            jailLive.current.progress = 0;
            setDialogue(null);
            teleport('prison', CELL_SPAWN);
          },
        },
      ],
    });
  }, [dispatch, jailStep, teleport]);

  const onFiled = useCallback(() => {
    holdingRef.current = false;
    dispatch({ type: 'setQuestStep', questId: JAILBREAK_ID, step: JAILBREAK_STEP.escape });
    setToast('Kalterit poikki! Nyt hiljaa ulos.');
  }, [dispatch]);

  const escaped = () => {
    dispatch({ type: 'setQuestStep', questId: JAILBREAK_ID, step: JAILBREAK_STEP.done, completed: true });
    dispatch({ type: 'grantReward', reward: JAILBREAK.rewards });
    dispatch({ type: 'removeItem', itemId: 'viila' });
    goTo({ scene: 'world', door: 'prison-yard' });
    window.setTimeout(() => setToast('✓ Quest suoritettu: Viilattu vapaus · +250 Kyttien pakoilu XP · +40 Hustlaus XP'), 500);
  };

  // ------------------------------------------------------------ gym and swimming hall
  const strength = levelFromXp(player?.skills.strength?.xp ?? 0);
  const energy = player?.energy ?? 0;
  const [atStation, setAtStation] = useState<LiftId | null>(null);
  const [gymPairs, setGymPairs] = useState<Record<LiftId, number[]>>({ bench: [], squat: [], deadlift: [] });
  const [carrying, setCarrying] = useState<{ lift: LiftId; plate: number } | null>(null);
  const [gymActive, setGymActive] = useState<GymActive | null>(null);
  const [atPool, setAtPool] = useState(false);
  const [swimT0, setSwimT0] = useState<number | null>(null);
  const [atCook, setAtCook] = useState<CookSpot | null>(null);
  const [cooking, setCooking] = useState<{ recipe: Recipe; t0: number } | null>(null);
  const [cookProgress, setCookProgress] = useState(0);
  const busy = !!gymActive || swimT0 !== null || !!cooking;
  const buffMult = useMemo(() => buffMultipliers(player?.buffs ?? []), [player?.buffs]);
  const appearance = player?.appearance;
  const outfit = useMemo(() => playerOutfit(color, appearance), [color, appearance]);

  // Energy comes back slowly while you are not training.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!busy) dispatch({ type: 'adjustStats', energy: Math.round(buffMult.energyRegen) });
      dispatch({ type: 'tickBuffs', dt: 6 });
    }, 6000);
    return () => window.clearInterval(id);
  }, [busy, dispatch, buffMult.energyRegen]);

  const fetchPlate = (plate: number) => {
    if (!atStation) return;
    const st = GYM_STATIONS.find((g) => g.lift === atStation)!;
    setCarrying({ lift: atStation, plate });
    setRoute([GYM_PLATE_SPOT, st.use]);
  };
  const arriveAtStation = (lift: LiftId) => {
    setAtStation(lift);
    if (carrying && carrying.lift === lift) {
      setGymPairs((g) => ({ ...g, [lift]: [...g[lift], carrying.plate] }));
      setCarrying(null);
    }
  };
  const removePair = () => atStation && setGymPairs((g) => ({ ...g, [atStation]: g[atStation].slice(0, -1) }));
  const startLift = () => {
    if (!atStation || busy || energy < SET_ENERGY) return;
    const lift = atStation;
    const kg = barWeight(gymPairs[lift]);
    const chance = liftChance(lift, strength, kg / buffMult.maxLift);
    const success = Math.random() < chance;
    setGymActive({ lift, success, t0: clockRef.current });
    setPlayerVisible(false);
    window.setTimeout(() => {
      setGymActive(null);
      setPlayerVisible(true);
      const xp = chance > 0 ? Math.round(liftXp(lift, strength, kg, success) * buffMult.strengthXp) : 0;
      dispatch({ type: 'adjustStats', energy: -SET_ENERGY });
      if (xp) dispatch({ type: 'grantReward', reward: { skillXp: { strength: xp } } });
      setToast(
        success
          ? `💪 ${LIFTS[lift].name} ${kg} kg × 5 – onnistui! +${xp} Voima XP`
          : chance > 0
            ? `Tanko pysähtyi kesken… ${kg} kg ei noussut tällä kertaa. +${xp} Voima XP`
            : `${kg} kg ei hievahdakaan. Kevennä tankoa.`,
      );
    }, setDuration(success) * 1000);
  };
  const SWIM_ENERGY = 8;
  const startSwim = () => {
    if (busy || energy < SWIM_ENERGY) return;
    setSwimT0(clockRef.current);
    setPlayerVisible(false);
    window.setTimeout(() => {
      setSwimT0(null);
      setPlayerVisible(true);
      dispatch({ type: 'adjustStats', energy: -SWIM_ENERGY });
      const xp = Math.round((35 + Math.random() * 10) * buffMult.enduranceXp);
      dispatch({ type: 'grantReward', reward: { skillXp: { endurance: xp } } });
      setToast(`🏊 Uit 10 × 25 m. +${xp} Kestävyys XP`);
    }, SWIM_TIME * 1000);
  };

  // ------------------------------------------------------------ buses
  const [atBusStop, setAtBusStop] = useState<BusStop | null>(null);
  const [busRun, setBusRun] = useState<BusRun | null>(null);
  const [dodge, setDodge] = useState(false);
  const riding = !!busRun;
  const money = player?.money ?? 0;

  const takeBus = (from: BusStop, to: BusStop) => {
    const pay = !dodge;
    if (pay && money < BUS_FARE) {
      setToast(`Lippu maksaa ${BUS_FARE} €. Rahat ei riitä.`);
      return;
    }
    setAtBusStop(null);
    setRoute([]);
    setBusRun({ stop: from, mode: 'in', t0: clockRef.current, dest: to.name.toUpperCase() });
    window.setTimeout(() => {
      // board
      setPlayerVisible(false);
      if (pay) dispatch({ type: 'adjustStats', money: -BUS_FARE });
      setBusRun({ stop: from, mode: 'out', t0: clockRef.current, dest: to.name.toUpperCase() });
      const caught = !pay && Math.random() < FARE_DODGE_CATCH;
      const end = caught ? (inspectorDropStop(busStops, from.id, to.id, Math.random()) ?? to) : to;
      window.setTimeout(() => {
        teleport('world', end.at);
        window.setTimeout(() => {
          setBusRun({ stop: end, mode: 'wait', t0: clockRef.current, dest: to.name.toUpperCase() });
          setPlayerVisible(true);
          setToast(caught ? `Lipuntarkastus! Sinut heitettiin ulos pysäkillä ${end.name}. Voihan vittu.` : `🚌 Perillä: ${end.name}${pay ? ` (−${BUS_FARE} €)` : ' · pummilla, onnistui!'}`);
          window.setTimeout(() => setBusRun({ stop: end, mode: 'out', t0: clockRef.current, dest: to.name.toUpperCase() }), 1500);
          window.setTimeout(() => setBusRun(null), 7000);
        }, 450);
      }, 2200);
    }, (BUS_ARRIVE + 0.6) * 1000);
  };

  // ------------------------------------------------------------ local train Kerava <-> Savio
  type TrainStop = { id: 'kerava' | 'savio'; name: string; at: WorldXZ };
  const trainStops = useMemo((): TrainStop[] => {
    if (!layout || !placed) return [];
    return [
      { id: 'kerava', name: 'Kerava', at: toWorld(layout, [-24, 6]) },
      { id: 'savio', name: 'Savio', at: placed.savio.wait },
    ];
  }, [layout, placed]);
  const [atTrain, setAtTrain] = useState<TrainStop | null>(null);
  const [trainRide, setTrainRide] = useState<string | null>(null);
  const rideTrain = (from: TrainStop) => {
    const to = trainStops.find((t) => t.id !== from.id);
    if (!to) return;
    if (!dodge && money < TRAIN_FARE) {
      setToast(`Lippu maksaa ${TRAIN_FARE} €. Rahat ei riitä.`);
      return;
    }
    setAtTrain(null);
    setRoute([]);
    setFading(true);
    window.setTimeout(() => {
      setTrainRide(`🚆 Lähijuna ${from.name} → ${to.name}`);
      setPlayerVisible(false);
    }, 300);
    const caught = dodge && Math.random() < TRAIN_DODGE_CATCH;
    window.setTimeout(() => {
      setTrainRide(null);
      setPlayerVisible(true);
      teleport('world', to.at);
      if (!dodge) dispatch({ type: 'adjustStats', money: -TRAIN_FARE });
      if (caught) dispatch({ type: 'adjustStats', money: -TRAIN_FINE });
      window.setTimeout(
        () =>
          setToast(
            caught
              ? `Lipuntarkastus! Tarkastusmaksu ${TRAIN_FINE} €. Tuttu tunne… voihan vittu.`
              : `🚆 Perillä: ${to.name}${dodge ? ' · pummilla, kukaan ei kysellyt' : ` (−${TRAIN_FARE} €)`}`,
          ),
        600,
      );
    }, 3600);
  };

  // ------------------------------------------------------------ shops, guards, police
  const shop = scene !== 'world' ? SHOPS[scene as InteriorId] : undefined;
  const alert = player ? alertLevel(player, { inShop: !!shop, visitThefts }) : 0;
  const prevScene = useRef(scene);
  useEffect(() => {
    if (prevScene.current === scene) return;
    const left = prevScene.current;
    prevScene.current = scene;
    if (SHOPS[left as InteriorId] && Object.keys(basket).length) setToast('Jätit täyden korin kauppaan.');
    setBasket({});
    setVisitThefts(0);
    setAtShelf(null);
    setAtTill(false);
    setAtCook(null);
    pendingTalk.current = null;
  }, [scene, basket]);

  const toBasket = (id: string) => setBasket((b) => ({ ...b, [id]: (b[id] ?? 0) + 1 }));
  const fromBasket = (id: string) =>
    setBasket((b) => {
      const n = { ...b };
      if ((n[id] ?? 0) > 1) n[id]!--;
      else delete n[id];
      return n;
    });
  const payBasket = () => {
    if (!player) return;
    const total = basketTotal(basket);
    if (player.money < total) return setToast('Rahat ei riitä.');
    const newSlots = Object.keys(basket).filter((id) => !player.inventory.some((s) => s.itemId === id)).length;
    if (player.inventory.length + newSlots > INVENTORY_SIZE) return setToast('🎒 Reppuun ei mahdu kaikki ostokset.');
    dispatch({ type: 'buyBasket', basket, total });
    setBasket({});
    setAtTill(false);
    setToast(`🧾 Maksoit ${total.toFixed(2).replace('.', ',')} €. Kiitos käynnistä!`);
  };

  const caughtStealing = (itemId: string) => {
    const karma = CAUGHT_KARMA_MULT * STEAL_KARMA * (visitThefts + 1);
    setAtShelf(null);
    setBasket({});
    say('Vartija', `Hetkinen! Mitä sulla on taskussa? ${itemName(itemId)}. Kamerat näki kaiken. Poliisi on jo tulossa.`, [
      {
        text: 'Ei se oo mitä luulet…',
        onPick: () => say('Vartija', 'Se on just sitä. Istu alas, partio vie sut asemalle.', [{ text: '…', onPick: () => toPutka(karma) }]),
      },
      { text: '[Juokse] Yritä livahtaa ovesta.', onPick: () => say('Vartija', 'Ovet on lukossa, kaveri. Hyvä yritys.', [{ text: 'Voi ei.', onPick: () => toPutka(karma - 2) }]) },
    ]);
  };
  const toPutka = (karma: number, reason: 'theft' | 'graffiti' | 'stash' = 'theft') => {
    close();
    if (reason === 'theft') dispatch({ type: 'caughtStealing', karma });
    else dispatch({ type: 'adjustKarma', amount: karma });
    const sentence = reason === 'theft' ? 25 + Math.min(35, visitThefts * 6) : 30;
    setPutkaUntil(clockRef.current + sentence + 0.5);
    setPutkaLeft(sentence);
    teleport('police', POLICE_CELL_SPAWN);
    const what = reason === 'theft' ? 'Varastetut tavarat takavarikoitiin' : reason === 'stash' ? 'Kätkö takavarikoitiin' : 'Töhrimisestä tuli merkintä';
    window.setTimeout(() => setToast(`🚓 Putkaan ${sentence} s. ${what} · karma ${karma}`), 500);
  };
  // holding cell countdown
  useEffect(() => {
    if (putkaUntil === null) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil(putkaUntil - clockRef.current));
      setPutkaLeft(left);
      if (left <= 0) {
        setPutkaUntil(null);
        say('Konstaapeli', 'Noniin. Kuulustelu on pidetty ja paperit täytetty. Olet vapaa lähtemään, mutta seuraavalla kerralla tulee sakot.', [
          { text: 'Kiitos. Ei toistu.', onPick: () => { dispatch({ type: 'adjustKarma', amount: 1 }); close(); } },
          { text: 'Katsotaan.', onPick: close },
        ]);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [putkaUntil]);

  const stealItem = (itemId: string) => {
    if (!player) return;
    if (!canAdd(player, itemId)) return setToast('🎒 Reppu on täynnä.');
    if (Math.random() < catchChance(player.sinceCaught ?? 0, alert)) return caughtStealing(itemId);
    dispatch({ type: 'stealItem', itemId });
    setVisitThefts((n) => n + 1);
    setToast(`🫳 ${itemName(itemId)} taskuun. Karma ${STEAL_KARMA}. Vartija vilkaisee suuntaasi…`);
  };
  const talkAtPoliceDesk = () =>
    say('Päivystäjä', putkaUntil !== null ? 'Odota vuoroasi.' : 'Keravan poliisi, päivää. Miten voin auttaa?', [
      { text: 'Tulin vain kysymään tietä.', onPick: () => say('Päivystäjä', 'Asema on suoraan pohjoiseen. Prisma itään. Ja muista: kamerat näkee kaiken.', [{ text: 'Selvä.', onPick: close }]) },
      { text: 'Haluan ilmoittaa rikoksesta.', onPick: () => say('Päivystäjä', 'Ilmoituksen voi tehdä netissä. Mutta kiitos aktiivisuudesta.', [{ text: '(+1 karma) Selvä.', onPick: () => { dispatch({ type: 'adjustKarma', amount: 1 }); close(); } }]) },
      ...deliverable.slice(0, 1).map((d) => ({ text: `Palauta löytämäni kätkö (${d.title})`, onPick: () => handInStash(d) })),
      { text: 'Ei mitään. Heippa.', onPick: close },
    ]);

  // ------------------------------------------------------------ cooking
  const cookLevel = levelFromXp(player?.skills.cooking?.xp ?? 0);
  const startCook = (r: Recipe) => {
    if (cooking) return;
    setCooking({ recipe: r, t0: clockRef.current });
    setCookProgress(0);
  };
  useEffect(() => {
    if (!cooking) return;
    const id = window.setInterval(() => {
      const k = (clockRef.current - cooking.t0) / cooking.recipe.time;
      setCookProgress(Math.min(1, k));
      if (k < 1) return;
      window.clearInterval(id);
      const burnt = Math.random() < burnChance(cookLevel, cooking.recipe);
      const xp = burnt ? Math.round(cooking.recipe.xp * 0.25) : cooking.recipe.xp;
      dispatch({ type: 'cook', ingredients: cooking.recipe.ingredients, out: burnt ? 'palanut' : cooking.recipe.out, xp });
      setToast(burnt ? `🔥 Hups, ${cooking.recipe.name.toLowerCase()} paloi. +${xp} Ruoanlaitto XP` : `🍳 ${cooking.recipe.name} valmis! +${xp} Ruoanlaitto XP`);
      setCooking(null);
    }, 200);
    return () => window.clearInterval(id);
  }, [cooking, cookLevel, dispatch]);

  // ------------------------------------------------------------ graffiti (Art)
  const [pieces, setPieces] = useState<SavedPiece[]>(loadPieces);
  const [nearWall, setNearWall] = useState<WallHit | null>(null);
  const [painting, setPainting] = useState<{ wall: WallHit; quality: SpotQuality; t0: number } | null>(null);
  const [policeAt, setPoliceAt] = useState<number | null>(null);
  const [witnessLog, setWitnessLog] = useState<string[]>([]);
  const reacted = useRef(new Set<string>());
  const [, setPaintTick] = useState(0);
  const heldSpray = isSpray(player?.equipment.handL) || isSpray(player?.equipment.handR);
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
  const qualityAt = (p: WorldXZ, n: WorldXZ): SpotQuality => {
    if (layout) for (const k of [6, 14, 24]) if (isTrackBlocked(layout, [p[0] + n[0] * k, p[1] + n[1] * k])) return 'ugly';
    return spotQuality(p, uglySpots, niceSpots);
  };
  // look for a wall to paint while holding a can
  useEffect(() => {
    if (!heldSpray || scene !== 'world' || !world) {
      setNearWall(null);
      return;
    }
    const id = window.setInterval(() => {
      const pos = positionRef.current;
      setNearWall((prev) => {
        const hit = nearestWall(world.buildings, [pos.x, pos.z]);
        if (!hit && !prev) return prev;
        if (hit && prev && Math.hypot(hit.q[0] - prev.q[0], hit.q[1] - prev.q[1]) < 0.3) return prev;
        return hit;
      });
    }, 600);
    return () => window.clearInterval(id);
  }, [heldSpray, scene, world]);
  const startPaint = () => {
    if (!nearWall) return;
    reacted.current.clear();
    setWitnessLog([]);
    setPoliceAt(null);
    setRoute([]);
    setPainting({ wall: nearWall, quality: qualityAt(nearWall.q, nearWall.n), t0: clockRef.current });
  };
  // witnesses while painting
  useEffect(() => {
    if (!painting) return;
    const id = window.setInterval(() => {
      const pos = positionRef.current;
      const t = clockRef.current;
      setPaintTick(t);
      for (const [nid, v] of npcLive.current) {
        if (reacted.current.has(nid) || Math.hypot(v.p[0] - pos.x, v.p[1] - pos.z) > 22) continue;
        reacted.current.add(nid);
        const npc = npcs.find((n) => n.id === nid);
        if (!npc) continue;
        const r = witnessReaction(nid, npc.kind === 'crew');
        const line = WITNESS_LINES[r][nid.length % WITNESS_LINES[r].length]!;
        setWitnessLog((l) => [...l.slice(-3), `${npc.name}: "${line}"`]);
        if (r === 'angry') dispatch({ type: 'adjustKarma', amount: -1 });
        if (r === 'police') setPoliceAt((p) => p ?? t + POLICE_RESPONSE);
      }
      // shopping-centre security watches the nice blocks
      if (painting.quality === 'nice' && doors?.prisma && Math.hypot(doors.prisma.at[0] - pos.x, doors.prisma.at[1] - pos.z) < 90 && t - painting.t0 > 6 && !reacted.current.has('guard')) {
        reacted.current.add('guard');
        setWitnessLog((l) => [...l.slice(-3), 'Kauppakeskuksen vartija: "Hälytin poliisit, jää siihen!"']);
        setPoliceAt((p) => p ?? t + POLICE_RESPONSE * 0.8);
      }
      setPoliceAt((p) => {
        if (p !== null && t >= p) {
          setPainting(null);
          say('Poliisi', 'Poliisi! Laita se tölkki maahan. Töhriminen on vahingontekoa, lähdetään asemalle.', [
            { text: 'Se on taidetta!', onPick: () => toPutka(-6, 'graffiti') },
            { text: '…', onPick: () => toPutka(-6, 'graffiti') },
          ]);
          return null;
        }
        return p;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [painting, npcs, doors]);
  const finishPaint = (img: string, coverage: number, cans: string[]) => {
    if (!painting || !player) return;
    if (coverage < 0.02) {
      setToast('Seinä jäi lähes tyhjäksi. Maalaa enemmän!');
      return;
    }
    const lvl = levelFromXp(player.skills.art?.xp ?? 0);
    const xp = artXp(coverage, cans.length, lvl);
    const karma = QUALITY_KARMA[painting.quality];
    const w = painting.wall;
    const pieceW = Math.min(w.len, 3.6);
    const piece: SavedPiece = { id: `g${Date.now()}`, q: w.q, n: w.n, t: w.t, w: pieceW, h: pieceW / 2, y: terrain ? terrain.surfaceAt(w.q[0] + w.n[0], w.q[1] + w.n[1]) : 0, img };
    setPieces((list) => savePieces([...list, piece]));
    dispatch({ type: 'grantReward', reward: { skillXp: { art: xp, ...(policeAt !== null ? { evasion: 15 } : {}) } } });
    if (karma) dispatch({ type: 'adjustKarma', amount: karma });
    for (const c of cans) dispatch({ type: 'useUp', itemId: c });
    setToast(`🎨 Graffiti valmis! +${xp} Art XP${karma ? ` · karma ${karma > 0 ? '+' : ''}${karma}` : ''}${policeAt !== null ? ' · ehdit häipyä ennen poliisia (+15 Kyttien pakoilu XP)' : ''}${cans.length ? ` · ${cans.length} tölkki${cans.length > 1 ? 'ä' : ''} tyhjeni` : ''}`);
    setPainting(null);
    setPoliceAt(null);
  };
  const sprayPalette = useMemo(() => {
    if (!player) return [];
    const ids = new Set<string>();
    for (const h of [player.equipment.handL, player.equipment.handR]) if (isSpray(h)) ids.add(h!);
    for (const s of player.inventory) if (isSpray(s.itemId)) ids.add(s.itemId);
    return [...ids].map((id) => ({ id, color: SPRAY_COLORS[id]!, name: itemName(id) }));
  }, [player]);

  // ------------------------------------------------------------ forest stashes
  const stashes = useMemo(() => {
    if (!world || !collider || !terrain) return [];
    const roadsNear = (p: WorldXZ) => world.roads.some((r) => r.points.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 18));
    return placeStashes(world, (p) => !collider.isBlocked(p, 2) && !roadsNear(p) && terrain.heightAt(p[0], p[1]) >= terrain.surfaceAt(p[0], p[1]) - 0.2);
  }, [world, collider, terrain]);
  const stashTaken = useMemo(() => new Set(STASH_DEFS.filter((d) => player?.quests[stashQuestId(d.id)]).map((d) => d.id)), [player?.quests]);
  const [chase, setChase] = useState<{ stash: PlacedStash; from: WorldXZ; t0: number } | null>(null);
  const skillLv = (id: 'hustling' | 'evasion' | 'running' | 'strength') => levelFromXp(player?.skills[id]?.xp ?? 0);
  const stashStep = (s: PlacedStash, step: number) => dispatch({ type: 'setQuestStep', questId: stashQuestId(s.id), step, completed: step >= STASH_STEP.done });
  const loseStash = (s: PlacedStash) => {
    for (const it of s.items) dispatch({ type: 'removeItem', itemId: it, quantity: 1 });
    if (s.money) dispatch({ type: 'adjustStats', money: -s.money });
  };
  const takeStash = (s: PlacedStash) => {
    if (stashTaken.has(s.id) || chase) return;
    if (s.items.some((it) => player && !canAdd(player, it))) return setToast('🎒 Reppu on täynnä.');
    for (const it of s.items) dispatch({ type: 'addItem', itemId: it });
    if (s.money) dispatch({ type: 'adjustStats', money: s.money });
    stashStep(s, STASH_STEP.pursued);
    const got = [...s.items.map((i) => itemName(i)), ...(s.money ? [`${s.money} €`] : [])].join(', ');
    setToast(`${s.find} Otit: ${got}. Joku tulee…`);
    const pos = positionRef.current;
    const a = Math.random() * Math.PI * 2;
    window.setTimeout(() => setChase({ stash: s, from: [pos.x + Math.sin(a) * 18, pos.z + Math.cos(a) * 18], t0: clockRef.current }), 3500);
  };
  // the pursuers arrive and talk
  useEffect(() => {
    if (!chase) return;
    const id = window.setTimeout(() => stashTalk(chase.stash), 4300);
    return () => window.clearTimeout(id);
  }, [chase]);
  const endChase = (s: PlacedStash, kept: boolean, toast?: string) => {
    close();
    setChase(null);
    stashStep(s, kept ? STASH_STEP.deliver : STASH_STEP.done);
    if (!kept) dispatch({ type: 'grantReward', reward: { xp: 40 } });
    if (toast) setToast(toast);
  };
  const stashTalk = (s: PlacedStash) => {
    const hustle = skillLv('hustling'), evade = Math.max(skillLv('evasion'), skillLv('running'));
    if (s.owner === 'geocacher') {
      say('Retkeilijä', 'Hei! Toi on geokätkö! Se kuuluu kaikille. Kirjoita nimesi vihkoon ja laita takaisin, niin seuraavakin löytää sen.', [
        { text: 'Totta kai. Laitan takaisin.', onPick: () => { loseStash(s); dispatch({ type: 'adjustKarma', amount: 5 }); endChase(s, false, '📓 Kirjoitit nimesi vihkoon. Karma +5'); } },
        { text: 'Löytäjä saa pitää.', onPick: () => { dispatch({ type: 'adjustKarma', amount: -3 }); endChase(s, true, 'Retkeilijä tuhahtaa. Karma −3'); } },
      ]);
      return;
    }
    if (s.owner === 'police') {
      say('Siviilipoliisi', 'Poliisi! Tuo kätkö on todistusaineistoa. Olemme tarkkailleet sitä kolme päivää. Mitä sinä teet täällä?', [
        {
          text: `[Hustlaus 4] Löysin sen sattumalta ja aioin tuoda sen teille.`,
          onPick: () =>
            hustle >= 4
              ? say('Siviilipoliisi', 'Hmm. Uskotaan. Kiitos kansalaisaktiivisuudesta, tässä löytöpalkkio.', [{ text: 'Mielelläni.', onPick: () => { loseStash(s); dispatch({ type: 'adjustKarma', amount: 3 }); dispatch({ type: 'adjustStats', money: 20 }); dispatch({ type: 'grantReward', reward: { skillXp: { hustling: 40 } } }); endChase(s, false, 'Selvisit puhumalla. +20 € löytöpalkkio · karma +3'); } }], `Hustlaus ${hustle}/4: onnistui`)
              : say('Siviilipoliisi', 'Sattumalta. Kaikki sanoo niin. Lähdetään asemalle.', [{ text: 'Voi ei.', onPick: () => { loseStash(s); stashStep(s, STASH_STEP.done); setChase(null); toPutka(-4, 'stash'); } }], `Hustlaus ${hustle}/4: ei riittänyt`),
        },
        {
          text: `[Kyttien pakoilu 6] Juokse metsään.`,
          onPick: () =>
            evade >= 6
              ? (dispatch({ type: 'grantReward', reward: { skillXp: { evasion: 60 } } }), endChase(s, true, '🏃 Karistit poliisit metsään! +60 Kyttien pakoilu XP'))
              : say('Siviilipoliisi', 'Seis! *kampittaa sinut sammaleeseen*', [{ text: 'Auts.', onPick: () => { loseStash(s); stashStep(s, STASH_STEP.done); setChase(null); toPutka(-6, 'stash'); } }], `Pakoilu ${evade}/6: ei riittänyt`),
        },
        { text: 'Antaudun. Ottakaa se.', onPick: () => { loseStash(s); dispatch({ type: 'adjustKarma', amount: 1 }); endChase(s, false, 'Poliisit ottivat kätkön ja päästivät sinut varoituksella.'); } },
      ]);
      return;
    }
    say('Tuntematon jäbä', 'Ey. Toi on meidän. Mehtäläinen ei tykkää kun sen tavaroihin kosketaan. Anna se takas, niin kukaan ei satu.', [
      { text: 'Okei okei, ota.', onPick: () => { loseStash(s); dispatch({ type: 'adjustKarma', amount: 2 }); endChase(s, false, 'Annoit kätkön takaisin. Viisas valinta.'); } },
      {
        text: '[Hustlaus 6] Mehtäläinen itse käski mun hakea tän.',
        onPick: () =>
          hustle >= 6
            ? (dispatch({ type: 'grantReward', reward: { skillXp: { hustling: 50 } } }), endChase(s, true, '🤝 He uskoivat! Kätkö jäi sinulle. +50 Hustlaus XP'))
            : say('Tuntematon jäbä', 'Valehtelet. *lyö sinua*', [{ text: 'Ugh…', onPick: () => { loseStash(s); dispatch({ type: 'adjustStats', health: -25 }); endChase(s, false, '🤕 Sait turpaan ja kätkö vietiin. −25 HP'); } }], `Hustlaus ${hustle}/6: ei riittänyt`),
      },
      {
        text: '[Juoksu / pakoilu 5] Juokse karkuun.',
        onPick: () =>
          evade >= 5
            ? (dispatch({ type: 'grantReward', reward: { skillXp: { evasion: 50, running: 30 } } }), endChase(s, true, '🏃 Juoksit karkuun kätkön kanssa!'))
            : say('Tuntematon jäbä', '*saa sinut kiinni* Minne luulit meneväsi?', [{ text: 'Ugh…', onPick: () => { loseStash(s); dispatch({ type: 'adjustStats', health: -30 }); endChase(s, false, '🤕 Jäit kiinni ja kätkö vietiin. −30 HP'); } }], `Pakoilu ${evade}/5: ei riittänyt`),
      },
    ]);
  };
  const deliverable = STASH_DEFS.filter((d) => player?.quests[stashQuestId(d.id)]?.status === 'active' && player.quests[stashQuestId(d.id)]!.objectiveIndex === STASH_STEP.deliver);
  const stashValue = (d: (typeof STASH_DEFS)[number]) => d.items.reduce((a, it) => a + (player?.inventory.some((x) => x.itemId === it) ? ITEM_DEFS[it]?.value ?? 0 : 0), 0);
  const handInStash = (d: (typeof STASH_DEFS)[number]) => {
    for (const it of d.items) dispatch({ type: 'removeItem', itemId: it, quantity: 1 });
    dispatch({ type: 'adjustKarma', amount: 6 });
    dispatch({ type: 'grantReward', reward: { xp: 80, money: 25 } });
    dispatch({ type: 'setQuestStep', questId: stashQuestId(d.id), step: STASH_STEP.done, completed: true });
    close();
    setToast(`✓ Quest suoritettu: palautit kätkön poliisille. +25 € · karma +6`);
  };
  const fenceStash = (d: (typeof STASH_DEFS)[number]) => {
    const pay = Math.round(stashValue(d) * 0.55);
    for (const it of d.items) dispatch({ type: 'removeItem', itemId: it, quantity: 1 });
    dispatch({ type: 'adjustKarma', amount: -3 });
    dispatch({ type: 'grantReward', reward: { xp: 80, money: pay, skillXp: { hustling: 45 } } });
    dispatch({ type: 'setQuestStep', questId: stashQuestId(d.id), step: STASH_STEP.done, completed: true });
    close();
    setToast(`✓ Quest suoritettu: myit kätkön tavarat. +${pay} € · +45 Hustlaus XP · karma −3`);
  };

  // ------------------------------------------------------------ gym roina dealer (fictional products)
  const ROINA_TALK_SPOT: WorldXZ = [7.0, 5.0];
  const buyRoina = (id: RoinaId) => {
    const d = ROINA[id];
    if (!player) return;
    if (player.money < d.price) return say('Pumppi-Pete', 'Ei rahaa, ei kamaa. Tuu takas kun on.', [{ text: 'Okei.', onPick: close }]);
    if (!canAdd(player, id)) return say('Pumppi-Pete', 'Sun reppu on täynnä, bro.', [{ text: 'Okei.', onPick: close }]);
    dispatch({ type: 'adjustStats', money: -d.price });
    dispatch({ type: 'addItem', itemId: id });
    if (d.karma) dispatch({ type: 'adjustKarma', amount: d.karma });
    dispatch({ type: 'grantReward', reward: { skillXp: { hustling: 6 } } });
    say('Pumppi-Pete', `Siinä. ${itemName(id)}. Ja muista: sä et saanu tätä multa.`, [{ text: 'Mitä muuta sulla on?', onPick: talkToPete }, { text: 'Kiitti.', onPick: close }]);
  };
  const talkToPete = () =>
    say(
      'Pumppi-Pete',
      'Psst. Haluuks sä kasvaa nopeemmin? Mulla on "lisäravinteita". Ei mitään laillista, ei mitään takuita. Rasitus kasvaa, ja liika rasitus tuntuu kropassa.',
      [
        ...(['tankkioljy', 'massamix', 'kuivatin', 'palautin', 'tuplaus', 'leikkuri'] as RoinaId[]).map((id) => ({
          text: `${itemName(id)} · ${ROINA[id].price} € — ${ROINA[id].blurb}`,
          onPick: () => buyRoina(id),
        })),
        { text: 'Ei kiitos, mä treenaan puhtaasti.', onPick: () => { dispatch({ type: 'adjustKarma', amount: 1 }); close(); } },
      ],
      `Rahaa ${money} € · rasitus ${Math.round(player?.strain ?? 0)}/100 · ${strainEffect(player?.strain ?? 0).label}`,
    );

  // public alert from carrying drugs: patrols may stop you near the centre
  useEffect(() => {
    if (scene !== 'world' || !doors) return;
    const id = window.setInterval(() => {
      if (!player || dialogue || cutscene || busy || riding || chase || painting) return;
      const units = drugUnits(player);
      if (units < 4) return;
      const pos = positionRef.current;
      const centre = doors['station-town'].at;
      if (Math.hypot(centre[0] - pos.x, centre[1] - pos.z) > 350) return;
      if (Math.random() > 0.1 + Math.min(0.25, alert * 0.003)) return;
      const hustle = skillLv('hustling'), evade = Math.max(skillLv('evasion'), skillLv('running'));
      say('Poliisipartio', 'Iltaa. Rutiinitarkastus. Sulla näyttää olevan reppu aika täynnä. Mitä siellä on?', [
        {
          text: '[Hustlaus 7] Salilisäravinteita. Proteiinia ja vitamiineja.',
          onPick: () => (hustle >= 7 ? (dispatch({ type: 'grantReward', reward: { skillXp: { hustling: 40 } } }), say('Poliisipartio', 'Hmm. Jatka matkaa.', [{ text: 'Kiitos.', onPick: close }], `Hustlaus ${hustle}/7: onnistui`)) : say('Poliisipartio', 'Katsotaanpa… Nämä lähtee meidän mukaan. Ja sinä myös.', [{ text: 'Voi ei.', onPick: () => { dispatch({ type: 'confiscateDrugs' }); toPutka(-5, 'stash'); } }], `Hustlaus ${hustle}/7: ei riittänyt`)),
        },
        {
          text: '[Pakoilu 6] Juokse.',
          onPick: () => (evade >= 6 ? (dispatch({ type: 'grantReward', reward: { skillXp: { evasion: 50 } } }), close(), setToast('🏃 Karistit partion! +50 Kyttien pakoilu XP')) : say('Poliisipartio', 'Seis! *saa sinut kiinni*', [{ text: 'Auts.', onPick: () => { dispatch({ type: 'confiscateDrugs' }); toPutka(-6, 'stash'); } }], `Pakoilu ${evade}/6: ei riittänyt`)),
        },
        { text: 'Ottakaa ne. En halua ongelmia.', onPick: () => { dispatch({ type: 'confiscateDrugs' }); dispatch({ type: 'adjustKarma', amount: 1 }); close(); setToast('Partio takavarikoi tavarat ja päästi sinut varoituksella.'); } },
      ]);
    }, 30000);
    return () => window.clearInterval(id);
  });

  // ------------------------------------------------------------ talking to NPCs
  useEffect(() => {
    if (!dialogue) setTalkingId(null);
  }, [dialogue]);
  const runTalk = (npc: Npc, tree: TalkTree, nodeId = 'start') => {
    const node = tree[nodeId] ?? tree.start;
    say(speakerName(npc), node.text, node.options.map((o) => ({ text: o.text, onPick: () => pickTalk(npc, tree, o) })));
  };
  const pickTalk = (npc: Npc, tree: TalkTree, o: TalkOption) => {
    if (o.next) return runTalk(npc, tree, o.next);
    const hustle = levelFromXp(player?.skills.hustling?.xp ?? 0);
    const ok = o.hustle === undefined || hustle >= o.hustle;
    let eff = ok ? o.effect : o.failEffect;
    let reply = ok ? o.reply : o.failReply ?? o.reply;
    if (eff?.money && eff.money < 0 && (player?.money ?? 0) < -eff.money) {
      reply = 'Ai sulla ei ookaan rahaa? No ei sitten.';
      eff = undefined;
    }
    if (eff?.karma) dispatch({ type: 'adjustKarma', amount: eff.karma });
    if (eff?.money || eff?.health) dispatch({ type: 'adjustStats', money: eff.money, health: eff.health });
    if (eff?.hustlingXp) dispatch({ type: 'grantReward', reward: { skillXp: { hustling: eff.hustlingXp } } });
    const bits = [eff?.karma ? `karma ${eff.karma > 0 ? '+' : ''}${eff.karma}` : '', eff?.hustlingXp ? `+${eff.hustlingXp} Hustlaus XP` : '', eff?.money ? `${eff.money > 0 ? '+' : ''}${eff.money} €` : ''].filter(Boolean);
    say(speakerName(npc), reply ?? '…', [{ text: 'Heippa.', onPick: close }], o.hustle !== undefined ? (ok ? `Hustlaus ${hustle}/${o.hustle}: onnistui` : `Hustlaus ${hustle}/${o.hustle}: ei riittänyt`) : undefined);
    if (eff?.toast) setToast(eff.toast);
    else if (bits.length) setToast(bits.join(' · '));
  };
  const startTalk = (npc: Npc) => {
    pendingTalk.current = null;
    setRoute([]);
    setTalkingId(npc.follow ?? npc.id);
    const d = deliverable[0];
    if (d && npc.crew === 'laituri') {
      const pay = Math.round(stashValue(d) * 0.55);
      say(speakerName(npc), 'Kuulin et sä löysit jotain metsästä. Lasse ostaa. Mitä sulla on?', [
        { text: `Myy kätkön tavarat (${pay} €)`, onPick: () => fenceStash(d) },
        { text: 'Ei mulla mitään. Mitä kuuluu?', onPick: () => runTalk(npc, talkTreeFor(npc)) },
      ]);
      return;
    }
    runTalk(npc, talkTreeFor(npc));
  };
  const onNpcClick = (npc: Npc) => {
    if (cutscene || dialogue || fading || busy || riding) return;
    const at = npcLive.current.get(npc.id)?.p ?? npc.at;
    if (!at) return;
    const here: WorldXZ = [positionRef.current.x, positionRef.current.z];
    if (dist(here, at) < 3.5) return startTalk(npc);
    const k = 1.4 / Math.max(1e-3, dist(here, at));
    const goal: WorldXZ = [at[0] + (here[0] - at[0]) * k, at[1] + (here[1] - at[1]) * k];
    onGroundClick(goal);
    pendingTalk.current = npc.id;
  };

  // ------------------------------------------------------------ barber
  const [barberDraft, setBarberDraft] = useState<Appearance | null>(null);
  const currentLook = appearance ?? defaultAppearance(color);
  const barberChanged = !!barberDraft && (barberDraft.hairStyle !== currentLook.hairStyle || barberDraft.hair !== currentLook.hair || barberDraft.facialHair !== currentLook.facialHair);
  const draftOutfit = useMemo(() => (barberDraft ? playerOutfit(color, barberDraft) : null), [barberDraft, color]);
  const payBarber = () => {
    if (!barberDraft) return;
    if (money < BARBER_PRICE) {
      setToast(`Leikkuu maksaa ${BARBER_PRICE} €. Rahat ei riitä.`);
      return;
    }
    dispatch({ type: 'setAppearance', appearance: { hairStyle: barberDraft.hairStyle, hair: barberDraft.hair, facialHair: barberDraft.facialHair }, cost: BARBER_PRICE });
    setBarberDraft(null);
    setToast(`✂ Uusi look! (−${BARBER_PRICE} €)`);
  };

  // ------------------------------------------------------------ clicks and arrival
  interface Spot {
    at: WorldXZ;
    use: () => void;
  }
  const spots = useMemo((): Spot[] => {
    if (scene === 'world') {
      const list: Spot[] = [];
      for (const d of Object.values(doors ?? {})) {
        const to = d.to;
        list.push({ at: d.at, use: () => (to ? goTo({ scene: to.scene, exit: to.exit }) : setToast('Vankilan portti on lukossa. Hyvä niin.')) });
      }
      if (jonneAt) list.push({ at: jonneAt, use: talkToJonne });
      for (const b of busStops) list.push({ at: b.at, use: () => setAtBusStop(b) });
      for (const t of trainStops) list.push({ at: t.at, use: () => setAtTrain(t) });
      for (const st of stashes) if (!stashTaken.has(st.id)) list.push({ at: st.at, use: () => takeStash(st) });
      for (const c of cookSpots) list.push({ at: c.at, use: () => setAtCook(c) });
      for (const l of loot) if (!lootTaken.includes(l.id)) list.push({ at: [l.x, l.z], use: () => pickLoot(l) });
      return list;
    }
    const list: Spot[] = INTERIORS[scene].exits.map((e) => ({
      at: e.at,
      use: () => (scene === 'prison' && e.id === 'yard' ? escaped() : goTo(e.to)),
    }));
    if (scene === 'gym') list.push({ at: ROINA_TALK_SPOT, use: talkToPete });
    if (scene === 'gym') for (const g of GYM_STATIONS) list.push({ at: g.use, use: () => arriveAtStation(g.lift) });
    if (scene === 'pool') list.push({ at: POOL_SWIM_SPOT, use: () => setAtPool(true) });
    if (scene === 'barber') list.push({ at: BARBER_CHAIR_SPOT, use: () => setBarberDraft({ ...currentLook }) });
    const sh = SHOPS[scene];
    if (sh) {
      for (const shelf of sh.shelves) list.push({ at: shelf.at, use: () => setAtShelf(shelf) });
      list.push({ at: sh.till, use: () => setAtTill(true) });
    }
    if (scene === 'police') list.push({ at: POLICE_DESK_SPOT, use: talkAtPoliceDesk });
    return list;
    // talkToJonne/escaped read the latest state through closures re-created each render
  }, [scene, doors, jonneAt, goTo, jailStep, player, carrying, busStops, trainStops, currentLook, loot, lootTaken, putkaUntil, cookSpots, stashes, stashTaken, chase]);

  const onGroundClick = (raw: WorldXZ) => {
    if (cutscene || dialogue || fading || busy || riding || painting || chase) return;
    setAtBusStop(null);
    setAtTrain(null);
    setBarberDraft(null);
    setAtStation(null);
    setAtPool(false);
    setCarrying(null);
    setAtShelf(null);
    setAtTill(false);
    let p = scene === 'world' ? clampToWorld(raw) : raw;
    const snap = spots.find((s) => dist(s.at, p) < HOTSPOT_SNAP);
    if (snap) p = snap.at;
    const here: WorldXZ = [positionRef.current.x, positionRef.current.z];
    setRoute(scene === 'world' && layout ? planRoute(layout, here, p) : [p]);
  };

  const onArrive = (p: WorldXZ) => {
    const goal = route[0];
    const reached = !!goal && dist(goal, p) < 0.8;
    if (reached && route.length > 1) {
      setRoute((r) => r.slice(1));
      return;
    }
    setRoute([]);
    if (scene === 'world') onMove(worldToLngLat(p));
    const spot = spots.find((s) => dist(s.at, p) < HOTSPOT_USE);
    if (spot) spot.use();
    const pend = pendingTalk.current ? npcs.find((n) => n.id === pendingTalk.current) : undefined;
    if (pend) {
      const at = npcLive.current.get(pend.id)?.p;
      if (at && dist(at, p) < 6) startTalk(pend);
      else setToast(`${pend.name} käveli jo ohi.`);
      pendingTalk.current = null;
    }
  };

  // Developer hook (only with ?debug=1): jump between scenes from the console.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('debug')) return;
    const w = window as unknown as Record<string, unknown>;
    w.__kerava = {
      goTo,
      teleport,
      talkToJonne,
      setRoute,
      pos: () => [positionRef.current.x, positionRef.current.z],
      doors,
      live: jailLive.current,
      hold: (v: boolean) => (holdingRef.current = v),
      click: (x: number, z: number) => onGroundClick([x, z]),
      stops: busStops,
      stashes: () => stashes.map((x) => ({ id: x.id, at: x.at, owner: x.owner, taken: stashTaken.has(x.id) })),
      wall: () => nearWall,
      paint: () => startPaint(),
      pieces: () => pieces.length,
      cookSpots: () => cookSpots,
      give: (id: string, n = 1) => dispatch({ type: 'addItem', itemId: id, quantity: n }),
      npcs: () => [...npcLive.current.entries()].map(([id, v]) => ({ id, p: v.p, kind: npcs.find((n) => n.id === id)?.kind })),
      talk: (id: string) => { const n = npcs.find((x) => x.id === id); if (n) onNpcClick(n); },
      npcCount: () => npcs.length,
      shop: () => ({ basket, atShelf: atShelf?.id, atTill, alert, putkaLeft, putka: putkaUntil !== null }),
      basketAdd: toBasket,
      steal: stealItem,
      shelfAt: (id: string) => shop?.shelves.find((x) => x.id === id)?.at,
      tillAt: () => shop?.till,
      loot: () => loot.filter((l) => !lootTaken.includes(l.id)).map((l) => ({ id: l.id, item: l.itemId, x: l.x, z: l.z })),
      trains: trainStops,
      blocked: (x: number, z: number) => !!collider?.isBlocked([x, z]) || extraBlocked([x, z]),
      ui: () => ({ atTrain: atTrain?.id, spots: spots.length, atBusStop: atBusStop?.id, busRun: busRun?.mode, scene, cutscene }),
      local: (x: number, z: number) => (layout ? toWorld(layout, [x, z]) : null),
      ground: (x: number, z: number) => [terrain?.heightAt(x, z), terrain?.surfaceAt(x, z), positionRef.current.y],
    };
  });

  const speaker = line?.speaker === 'inspector' ? INSPECTOR_NAME : line?.speaker === 'player' ? playerName : null;
  const ready = !!(world && collider && layout && terrain && doors);
  const inWorld = scene === 'world';
  const def = scene !== 'world' ? INTERIORS[scene] : null;

  return (
    <div className={`game-world${cutscene ? ' is-cutscene' : ''}`}>
      <Canvas
        shadows="percentage"
        dpr={highQuality ? [1, 2] : [1, 1.25]}
        gl={{ antialias: !highQuality, powerPreference: 'high-performance' }}
        camera={{ fov: 45, near: 0.3, far: 9000, position: [startXZ[0] - 12, 9, startXZ[1] + 14] }}
      >
        <Clock clockRef={clockRef} />
        <Atmosphere followRef={positionRef} high={highQuality} indoor={!inWorld} />
        {highQuality && <Effects />}

        {ready && (
          <group visible={inWorld}>
            <Clouds clouds={clouds} />
            <Birds followRef={positionRef} />
            <KeravaWorld
              data={world!}
              terrain={terrain!}
              collider={collider!}
              excludeTrees={excludeTrees}
              playerRef={positionRef}
              xray={xray}
              onGroundClick={onGroundClick}
            />
            <Station layout={layout!} xray={xray} />
            <Train layout={layout!} clockRef={clockRef} />
            <PrismaExterior site={prisma!.site} ground={terrain!.surfaceAt(prisma!.site.door[0], prisma!.site.door[1])} />
            {busStops.map((b) => (
              <BusStopModel key={b.id} stop={b} ground={terrain!.surfaceAt(b.at[0], b.at[1])} />
            ))}
            {!cutscene &&
              busStops.map((b) => <Hotspot key={b.id} at={b.at} y={terrain!.surfaceAt(b.at[0], b.at[1])} label={`🚌 ${b.name}`} onClick={() => onGroundClick(b.at)} />)}
            {placed && <SavioStationModel centre={placed.savio.centre} dir={placed.savio.dir} side={placed.savio.side} ground={terrain!.surfaceAt(placed.savio.wait[0], placed.savio.wait[1])} />}
            {placed && <BlockExterior site={placed.barber} ground={terrain!.surfaceAt(placed.barber.door[0], placed.barber.door[1])} sign="PARTURI" color="#7a1f2a" sub="SAKSET · AJANVARAUS EI TARPEEN" />}
            {placed && <BlockExterior site={placed.alepa} ground={terrain!.surfaceAt(placed.alepa.door[0], placed.alepa.door[1])} sign="Alepa" color="#f28c28" />}
            {!cutscene &&
              trainStops.map((t) => (
                <Hotspot key={t.id} at={t.at} y={layout ? stationGroundHeight(layout, t.at, terrain!.surfaceAt(t.at[0], t.at[1])) : 0} label="🚆 Lähijuna" onClick={() => onGroundClick(t.at)} />
              ))}
            {busRun && <BusVehicle run={busRun} clockRef={clockRef} groundAt={(x, z) => terrain!.surfaceAt(x, z)} />}
            {placed && <BlockExterior site={placed.gym} ground={terrain!.surfaceAt(placed.gym.door[0], placed.gym.door[1])} sign="KUNTOSALI RAUTA" color="#c8312b" sub="AVOINNA 24/7" />}
            {placed && <BlockExterior site={placed.motonet} ground={terrain!.surfaceAt(placed.motonet.door[0], placed.motonet.door[1])} sign="MOTONET" color="#d4202a" sub="AUTO · KOTI · VAPAA-AIKA" />}
            {placed && <BlockExterior site={placed.police} ground={terrain!.surfaceAt(placed.police.door[0], placed.police.door[1])} sign="POLIISI" color="#1f3f8f" sub="POLISEN · KERAVAN POLIISIASEMA" />}
            {placed && <BlockExterior site={placed.pool} ground={terrain!.surfaceAt(placed.pool.door[0], placed.pool.door[1])} sign="UIMAHALLI" color="#1f8fc0" sub="KERAVAN UIMAHALLI" />}
            {!cutscene && npcs.length > 0 && (
              <Crowd npcs={npcs} live={npcLive} clockRef={clockRef} groundAt={(x, z) => terrain!.surfaceAt(x, z)} playerRef={positionRef} talkingId={talkingId} onTalk={onNpcClick} />
            )}
            <GraffitiWall pieces={pieces} />
            {highQuality && <GroundDetail data={world!} terrain={terrain!} blocked={grassBlocked} playerRef={positionRef} />}
            {!cutscene && <Stashes stashes={stashes} taken={stashTaken} playerRef={positionRef} groundAt={(x, z) => terrain!.surfaceAt(x, z)} onClick={(st) => onGroundClick(st.at)} />}
            {chase && <Pursuers owner={chase.stash.owner} from={chase.from} t0={chase.t0} playerRef={positionRef} clockRef={clockRef} groundAt={(x, z) => terrain!.surfaceAt(x, z)} />}
            <CookSpots spots={cookSpots} groundAt={(x, z) => terrain!.surfaceAt(x, z)} />
            {!cutscene &&
              cookSpots.map((c) => <Hotspot key={c.id} at={c.at} y={terrain!.surfaceAt(c.at[0], c.at[1])} label={`🍳 ${c.name}`} onClick={() => onGroundClick(c.at)} />)}
            {!cutscene && <LootField spots={loot} taken={lootTaken} playerRef={positionRef} onPick={(l) => onGroundClick([l.x, l.z])} />}
            <PrisonExterior at={PRISON_AT} yaw={0} ground={terrain!.surfaceAt(PRISON_AT[0], PRISON_AT[1] + 8)} />
            {jonneAt && <Jonne at={jonneAt} y={0} yaw={jonneYaw} onClick={() => onGroundClick(jonneAt)} showMarker={!cutscene && jailStep === JAILBREAK_STEP.notStarted} />}
            {!cutscene &&
              Object.values(doors!).map((d) => (
                <Hotspot key={d.id} at={d.at} y={stationGroundHeight(layout!, d.at, terrain!.surfaceAt(d.at[0], d.at[1]))} label={d.label} onClick={() => onGroundClick(d.at)} />
              ))}
            {cutscene && <Inspector layout={layout!} clockRef={clockRef} />}
            {cutscene && (
              <IntroDirector
                layout={layout!}
                clockRef={clockRef}
                positionRef={positionRef}
                scriptRef={scriptRef}
                onLine={setLine}
                onVisible={setPlayerVisible}
                onDone={finishIntro}
              />
            )}
            {cameraOffset && <PlaceCamera offset={cameraOffset} follow={positionRef} />}
          </group>
        )}

        {def && (
          <group>
            <ClickFloor r={def.floor} invisible={scene === 'pool'} color={scene === 'prison' ? '#8f918c' : scene === 'tunnel' ? '#5d5f63' : scene === 'station' ? '#c9b48a' : '#d4d4cf'} onClick={onGroundClick} />
            {scene === 'tunnel' && <TunnelInterior />}
            {scene === 'station' && <StationInterior />}
            {scene === 'prisma' && <PrismaInterior />}
            {scene === 'gym' && <GymInterior pairs={gymPairs} active={gymActive} outfit={outfit} clockRef={clockRef} />}
            {scene === 'alepa' && <AlepaInterior />}
            {scene === 'barber' && <BarberInterior />}
            {scene === 'motonet' && <MotonetInterior />}
            {scene === 'police' && <PoliceInterior cellOpen={putkaUntil === null} />}
            {scene === 'pool' && <PoolInterior swimT0={swimT0} clockRef={clockRef} outfit={outfit} />}
            {scene === 'prison' && (
              <>
                <PrisonInterior barsCut={jailStep >= JAILBREAK_STEP.escape} progress={jailLive.current.progress} />
                <PrisonGuards
                  step={jailStep}
                  playerRef={positionRef}
                  holdingRef={holdingRef}
                  live={jailLive}
                  frozen={!!dialogue || fading}
                  onCaught={onCaught}
                  onFiled={onFiled}
                />
              </>
            )}
            {def.exits.map((e) => (
              <Hotspot key={e.id} at={e.at} label={e.label} onClick={() => onGroundClick(e.at)} />
            ))}
            {shop?.shelves.map((sh) => <Hotspot key={sh.id} at={sh.at} label={`🛒 ${sh.name}`} onClick={() => onGroundClick(sh.at)} />)}
            {shop && (
              <Shopper p={shop.guard} yaw={Math.PI * 0.85} sway={1.3} outfit={{ top: '#1b1d22', legs: '#1b1d22', shoes: '#111', hair: '#2a2018', hairStyle: 'buzz', hat: 'none', hatColor: '#000', accent: '#ffd23f', style: 'jacket', build: 1.12 }} />
            )}
            {shop && <Hotspot at={shop.till} label="🧾 Kassa" onClick={() => onGroundClick(shop.till)} />}
            {scene === 'gym' && (
              <>
                <Shopper p={ROINA_SPOT} yaw={-2.2} sway={0.7} outfit={{ top: '#14171f', legs: '#3c4a63', shoes: '#f2f2f2', skin: '#e0ac7e', hair: '#1a1410', hairStyle: 'buzz', facialHair: 'goatee', hat: 'cap', hatColor: '#c8312b', accent: '#ffd23f', style: 'hoodie', build: 1.25 }} />
                <Hotspot at={ROINA_TALK_SPOT} label="🧴 Pumppi-Pete" onClick={() => onGroundClick(ROINA_TALK_SPOT)} />
              </>
            )}
            {scene === 'police' && <Hotspot at={POLICE_DESK_SPOT} label="👮 Palvelutiski" onClick={() => onGroundClick(POLICE_DESK_SPOT)} />}
          </group>
        )}

        <PlayerCharacter
          color={color}
          appearance={appearance}
          positionRef={positionRef}
          target={target}
          collider={inWorld ? collider : interiorCollider}
          groundHeight={groundHeight}
          extraBlocked={extraBlocked}
          visible={playerVisible}
          scriptRef={scriptRef}
          onArrive={onArrive}
          held={{ handL: player?.equipment.handL, handR: player?.equipment.handR }}
        />
        <KarmaAura karma={player?.karma ?? 0} followRef={positionRef} visible={playerVisible && !cutscene} />
        {target && <ClickMarker point={route[route.length - 1] ?? target} y={inWorld ? positionRef.current.y : 0} />}
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
      {!cutscene && def && <div className="location-tag">📍 {def.name}</div>}
      {!cutscene && scene === 'prison' && !dialogue && <JailHud step={jailStep} live={jailLive} holdingRef={holdingRef} onVisit={visit} />}
      {!cutscene && scene === 'gym' && atStation && !gymActive && (
        <GymHud
          lift={atStation}
          level={strength}
          pairs={gymPairs[atStation]}
          energy={energy}
          carrying={carrying?.plate ?? null}
          busy={busy}
          onFetch={fetchPlate}
          onRemove={removePair}
          onLift={startLift}
        />
      )}
      {!cutscene && scene === 'gym' && carrying && !atStation && <div className="gym-hud gym-hud--mini">Kannat 2 × {carrying.plate} kg levyjä tankoon…</div>}
      {!cutscene && scene === 'pool' && atPool && swimT0 === null && (
        <div className="gym-hud">
          <div className="gym-hud__title">Uintirata 1 <span className="muted">· 25 m</span></div>
          <p className="muted">Ui kymmenen allasmittaa. Kehittää kestävyyttä.</p>
          <div className="gym-hud__actions">
            <button type="button" className="btn" disabled={energy < SWIM_ENERGY} onClick={startSwim}>
              {energy < SWIM_ENERGY ? 'Liian väsynyt' : `Ui 10 × 25 m (−${SWIM_ENERGY} ⚡)`}
            </button>
          </div>
        </div>
      )}
      {!cutscene && inWorld && atBusStop && !busRun && (
        <div className="gym-hud bus-hud">
          <div className="gym-hud__title">🚌 Pysäkki: {atBusStop.name}</div>
          <div className="gym-hud__label">Minne mennään? Lippu {BUS_FARE} € · rahaa {money} €</div>
          <div className="bus-hud__list">
            {busStops
              .filter((b) => b.id !== atBusStop.id)
              .map((b) => (
                <button key={b.id} type="button" className="bus-hud__dest" onClick={() => takeBus(atBusStop, b)}>
                  {b.name}
                </button>
              ))}
          </div>
          <label className="bus-hud__dodge">
            <input type="checkbox" checked={dodge} onChange={(e) => setDodge(e.target.checked)} /> Matkusta pummilla (ilmainen, mutta tarkastaja voi heittää ulos)
          </label>
        </div>
      )}
      {!cutscene && inWorld && atTrain && !trainRide && (
        <div className="gym-hud bus-hud">
          <div className="gym-hud__title">🚆 {atTrain.name}: lähijunat</div>
          <div className="gym-hud__label">Lippu {TRAIN_FARE} € · rahaa {money} €</div>
          <div className="bus-hud__list">
            {trainStops
              .filter((t) => t.id !== atTrain.id)
              .map((t) => (
                <button key={t.id} type="button" className="bus-hud__dest" onClick={() => rideTrain(atTrain)}>
                  {t.name} (n. 3 min)
                </button>
              ))}
          </div>
          <label className="bus-hud__dodge">
            <input type="checkbox" checked={dodge} onChange={(e) => setDodge(e.target.checked)} /> Matkusta pummilla (tarkastusmaksu {TRAIN_FINE} €, jos jäät kiinni)
          </label>
        </div>
      )}
      {trainRide && (
        <div className="train-ride">
          <div className="train-ride__title">{trainRide}</div>
          <div className="train-ride__bar"><span /></div>
          <div className="muted">Seuraava asema…</div>
        </div>
      )}
      {!cutscene && scene === 'barber' && barberDraft && draftOutfit && (
        <div className="barber-hud">
          <div className="gym-hud__title">✂ Parturi Sakset <span className="muted">· {BARBER_PRICE} € · rahaa {money} €</span></div>
          <div className="barber-hud__body">
            <AvatarPreview outfit={draftOutfit} focus="head" />
            <AppearanceEditor value={barberDraft} onChange={setBarberDraft} only="hair" />
          </div>
          <div className="gym-hud__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setBarberDraft(null)}>Ei sittenkään</button>
            <button type="button" className="btn" disabled={!barberChanged || money < BARBER_PRICE} onClick={payBarber}>
              {money < BARBER_PRICE ? 'Rahat ei riitä' : `Leikkaa (−${BARBER_PRICE} €)`}
            </button>
          </div>
        </div>
      )}
      {!cutscene && shop && atShelf && !dialogue && (
        <ShelfHud shelf={atShelf} basket={basket} alert={alert} onBasket={toBasket} onSteal={stealItem} onClose={() => setAtShelf(null)} />
      )}
      {!cutscene && shop && atTill && !dialogue && (
        <TillHud basket={basket} money={money} onPay={payBasket} onRemove={fromBasket} onClose={() => setAtTill(false)} />
      )}
      {!cutscene && shop && !atShelf && !atTill && (Object.keys(basket).length > 0 || alert > 10) && (
        <div className="gym-hud gym-hud--mini shop-mini">
          {Object.keys(basket).length > 0 && <span>🧺 Kori: {Object.values(basket).reduce((a, b) => a + b, 0)} kpl · {basketTotal(basket).toFixed(2).replace('.', ',')} € · maksa kassalla</span>}
          <AlertMeter alert={alert} />
        </div>
      )}
      {!cutscene && scene === 'police' && putkaUntil !== null && (
        <div className="gym-hud gym-hud--mini putka-hud">🔒 Putkassa · vapautus {putkaLeft} s kuluttua</div>
      )}
      {!cutscene && inWorld && alert >= 20 && (
        <div className="gym-hud gym-hud--mini shop-mini"><AlertMeter alert={alert} /></div>
      )}
      {!cutscene && inWorld && atCook && player && (
        <CookHud name={atCook.name} level={cookLevel} inventory={player.inventory} cooking={cooking ? { recipe: cooking.recipe, progress: cookProgress } : null} onCook={startCook} onClose={() => setAtCook(null)} />
      )}
      {!cutscene && inWorld && nearWall && !painting && !dialogue && (
        <button type="button" className="btn paint-btn" onClick={startPaint}>
          🎨 Maalaa seinään · {QUALITY_NAMES[qualityAt(nearWall.q, nearWall.n)]}
        </button>
      )}
      {!cutscene && painting && (
        <GraffitiCanvas
          palette={sprayPalette}
          onCancel={() => {
            setPainting(null);
            setPoliceAt(null);
          }}
          onDone={finishPaint}
          info={
            <>
              <span className={painting.quality === 'nice' ? 'is-bad' : painting.quality === 'ugly' ? 'is-good' : ''}>{QUALITY_NAMES[painting.quality]}</span>
              {policeAt !== null && <span className="is-bad">📞 Joku soitti poliisit! Partio paikalla {Math.max(0, Math.ceil(policeAt - clockRef.current))} s kuluttua. Viimeistele tai lopeta!</span>}
              {witnessLog.map((w, i) => (
                <span key={i} className="muted">{w}</span>
              ))}
            </>
          }
        />
      )}
      {!cutscene && ((player?.buffs?.length ?? 0) > 0 || (player?.strain ?? 0) >= 5) && (
        <div className="buff-bar">
          {player?.buffs?.map((b) => (
            <span key={b.id} className="buff" title={ROINA[b.id].blurb}>
              {itemIcon(b.id)} {Math.ceil(b.left / 60)} min
            </span>
          ))}
          {(player?.strain ?? 0) >= 5 && (
            <span className={`buff buff--strain${(player?.strain ?? 0) >= 55 ? ' is-high' : ''}`} title={strainEffect(player?.strain ?? 0).label}>
              🫀 Rasitus {Math.round(player?.strain ?? 0)}
            </span>
          )}
        </div>
      )}
      {dialogue && <DialogueBox view={dialogue} />}
      {toast && <div className="toast">{toast}</div>}
      <div className={`fade${fading ? ' is-on' : ''}`} />
      {!cutscene && inWorld && world?.source === 'placeholder' && (
        <div className="world-badge">Väliaikainen kartta · aja <code>npm run fetch:osm</code> saadaksesi oikean Keravan</div>
      )}
      {!cutscene && inWorld && world?.source === 'osm' && <div className="world-badge">© OpenStreetMap contributors</div>}
    </div>
  );
}
