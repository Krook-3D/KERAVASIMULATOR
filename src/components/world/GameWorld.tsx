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
import { BARBER_CHAIR_SPOT, GYM_PLATE_SPOT, GYM_STATIONS, INTERIORS, PLAYER_BARS, PLAYER_CELL_X, POOL_SWIM_SPOT, RectCollider, type InteriorId, type Link, type SceneId, type WorldDoorId } from '../../game/interiors/interiors';
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
import { TunnelInterior } from './interiors/TunnelInterior';
import { StationInterior } from './interiors/StationInterior';
import { PrismaInterior } from './interiors/PrismaInterior';
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
    const savio = findSavioStation(rawWorld);
    const alepaAt: WorldXZ = [savio.centre[0] + savio.side[0] * 32 + savio.dir[0] * 6, savio.centre[1] + savio.side[1] * 32 + savio.dir[1] * 6];
    const alepa = placeBlockAt(buildings.filter((b) => b.kind !== 'alepa'), rawWorld.roads, alepaAt, 24, 18, 5, 'alepa');
    buildings = alepa.buildings;
    return { world: { ...rawWorld, buildings }, gym: gym.site, pool: pool.site, alepa: alepa.site, barber: barber.site, savio };
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

  const interiorCollider = useMemo(() => {
    if (scene === 'world') return null;
    const def = INTERIORS[scene];
    const solids = scene === 'prison' && jailStep < JAILBREAK_STEP.escape ? [...def.solids, PLAYER_BARS] : def.solids;
    return new RectCollider(solids);
  }, [scene, jailStep]);

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
      list.push({ id: 'pool', at: placed.pool.door, outward: placed.pool.outward, label: 'Uimahalli', to: { scene: 'pool', exit: 'main' } });
    }
    return Object.fromEntries(list.map((d) => [d.id, d])) as Record<WorldDoorId, WorldDoor>;
  }, [layout, prisma, placed]);

  const busStops = useMemo((): BusStop[] => {
    if (!world || !doors || !layout) return [];
    const ahead = (d: WorldDoor, k: number): WorldXZ => [d.at[0] + d.outward[0] * k, d.at[1] + d.outward[1] * k];
    return placeBusStops(
      [
        { id: 'asema', name: 'Asema', near: ahead(doors['station-town'], 30) },
        { id: 'keskusta', name: 'Keskusta / Prisma', near: ahead(doors.prisma, 20) },
        { id: 'sali', name: 'Kuntosali', near: ahead(doors.gym, 15) },
        { id: 'uimahalli', name: 'Uimahalli', near: ahead(doors.pool, 15) },
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
  const busy = !!gymActive || swimT0 !== null;
  const appearance = player?.appearance;
  const outfit = useMemo(() => playerOutfit(color, appearance), [color, appearance]);

  // Energy comes back slowly while you are not training.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!busy) dispatch({ type: 'adjustStats', energy: 1 });
    }, 6000);
    return () => window.clearInterval(id);
  }, [busy, dispatch]);

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
    const chance = liftChance(lift, strength, kg);
    const success = Math.random() < chance;
    setGymActive({ lift, success, t0: clockRef.current });
    setPlayerVisible(false);
    window.setTimeout(() => {
      setGymActive(null);
      setPlayerVisible(true);
      const xp = chance > 0 ? liftXp(lift, strength, kg, success) : 0;
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
      const xp = 35 + Math.round(Math.random() * 10);
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
      return list;
    }
    const list: Spot[] = INTERIORS[scene].exits.map((e) => ({
      at: e.at,
      use: () => (scene === 'prison' && e.id === 'yard' ? escaped() : goTo(e.to)),
    }));
    if (scene === 'gym') for (const g of GYM_STATIONS) list.push({ at: g.use, use: () => arriveAtStation(g.lift) });
    if (scene === 'pool') list.push({ at: POOL_SWIM_SPOT, use: () => setAtPool(true) });
    if (scene === 'barber') list.push({ at: BARBER_CHAIR_SPOT, use: () => setBarberDraft({ ...currentLook }) });
    return list;
    // talkToJonne/escaped read the latest state through closures re-created each render
  }, [scene, doors, jonneAt, goTo, jailStep, player, carrying, busStops, trainStops, currentLook]);

  const onGroundClick = (raw: WorldXZ) => {
    if (cutscene || dialogue || fading || busy || riding) return;
    setAtBusStop(null);
    setAtTrain(null);
    setBarberDraft(null);
    setAtStation(null);
    setAtPool(false);
    setCarrying(null);
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
            {placed && <BlockExterior site={placed.pool} ground={terrain!.surfaceAt(placed.pool.door[0], placed.pool.door[1])} sign="UIMAHALLI" color="#1f8fc0" sub="KERAVAN UIMAHALLI" />}
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
        />
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
