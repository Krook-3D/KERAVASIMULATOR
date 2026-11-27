import type { ThreeEvent } from '@react-three/fiber';
import { speakerName } from '../../../game/npc/talk';
import { describeNpc } from '../../../game/npc/describe';
import { levelFromXp } from '../../../game/xp/xp';
import { bodyShape } from '../../../game/player/body';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LngLat } from '../../../types/game';
import { lngLatToWorld, worldToLngLat, type WorldXZ } from '../../../game/world/projection';
import { stationGroundHeight, toWorld, INTRO_DOOR_X } from '../../../game/world/station';
import { NO_INTRO_START } from '../../../game/world/trainSchedule';
import { INSPECTOR_NAME, INTRO_TIMES, type IntroLine } from '../../../game/world/intro';
import { INTERIORS, PLAYER_BARS, POLICE_BARS, RectCollider, type Link, type SceneId } from '../../../game/interiors/interiors';
import { JAILBREAK_ID, JAILBREAK_STEP } from '../../../game/quests/jailbreak';
import { placeClouds } from '../../../game/world/streetProps';
import { useGame } from '../../../game/store/GameProvider';
import { playerOutfit, type ScriptedPose } from '../PlayerCharacter';
import { Atmosphere } from '../Atmosphere';
import { Effects } from '../Effects';
import { createXrayUniforms } from '../materials';
import type { NpcLive } from '../npc/Crowd';
import type { DialogueView } from '../quest/DialogueBox';
import { newJailLive } from '../quest/Jailbreak';
import { CELL_SPAWN, dist, USE_REACH } from './constants';
import type { GameCtx } from './gameWorld.types';
import { useWorldSetup } from './useWorldSetup';
import { useDebugHook } from './useDebugHook';
import { useJailbreak } from './systems/useJailbreak';
import { useCooking } from './systems/useCooking';
import { useTraining } from './systems/useTraining';
import { useTransit } from './systems/useTransit';
import { useShop } from './systems/useShop';
import { useGraffiti } from './systems/useGraffiti';
import { useStashes } from './systems/useStashes';
import { useRoina } from './systems/useRoina';
import { usePolicePatrol } from './systems/usePolicePatrol';
import { useNpcTalk } from './systems/useNpcTalk';
import { useBarber } from './systems/useBarber';
import { useInteraction } from './systems/useInteraction';
import { createControls } from '../controls';
import { GameMap } from './GameMap';
import { WorldObjects } from './WorldObjects';
import { NPCLayer } from './NPCLayer';
import { QuestLayer } from './QuestLayer';
import { InteriorScene } from './InteriorScene';
import { Player, PlaceCamera } from './Player';
import { GameHUD } from './GameHUD';

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

/** Advances the game clock (seconds, capped per frame). */
function Clock({ clockRef }: { clockRef: MutableRefObject<number> }) {
  useFrame((_, dt) => {
    clockRef.current += Math.min(dt, 0.5);
  });
  return null;
}

/**
 * The playable game. This component orchestrates: it owns the shared session
 * state (scene, route, dialogue, toast, intro), builds the map once, wires the
 * game systems (hooks in ./systems) to each other, and composes the 3D layers
 * and the HUD. Game rules live in src/game and in the system hooks.
 */
export function GameWorld({ start, color, playerName, introDone, highQuality, onMove, onIntroDone }: GameWorldProps) {
  const { state, dispatch } = useGame();
  const player = state.player;
  const jail = player?.quests[JAILBREAK_ID];
  const jailStep = !jail ? 0 : jail.status === 'completed' ? JAILBREAK_STEP.done : jail.objectiveIndex;
  const inJail = jailStep >= JAILBREAK_STEP.visit && jailStep <= JAILBREAK_STEP.escape;

  // ------------------------------------------------------------ shared session state
  const [route, setRoute] = useState<WorldXZ[]>([]);
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
  const npcLive = useRef<NpcLive>(new Map());

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // ------------------------------------------------------------ map
  const w = useWorldSetup(scene);
  const { layout, terrain, doors } = w;

  const cameraOffset = useMemo(() => {
    if (!layout) return null;
    const [zx, zz] = layout.dirZ, [xx, xz] = layout.dirX;
    // Cutscene: low under the canopy, looking along the platform at the door.
    return cutscene
      ? new THREE.Vector3(zx * 7.5 - xx * 9, 3.6, zz * 7.5 - xz * 9)
      : new THREE.Vector3(zx * 9 - xx * 5, 7, zz * 9 - xz * 5);
    // Only on first placement.
  }, [layout]);

  // ------------------------------------------------------------ intro
  // New players start in the train door.
  useEffect(() => {
    if (layout && cutscene) {
      const door = toWorld(layout, [INTRO_DOOR_X, 1.75]);
      positionRef.current.set(door[0], 0.55, door[1]);
    }
  }, [layout]);
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

  // ------------------------------------------------------------ game systems
  const ctx: GameCtx = {
    player,
    dispatch,
    scene,
    dialogue,
    cutscene,
    fading,
    positionRef,
    clockRef,
    setRoute,
    setToast,
    setDialogue,
    setFading,
    setPlayerVisible,
    say: (speaker, text, options, note) => setDialogue({ speaker, text, options, note }),
    close: () => setDialogue(null),
    teleport,
    goTo,
  };
  const jailbreak = useJailbreak(ctx, jailStep, jailLive, holdingRef);
  const cooking = useCooking(ctx);
  const training = useTraining(ctx, !!cooking.cooking);
  const transit = useTransit(ctx, w.busStops, w.trainStops);
  const shop = useShop(ctx);
  const graffiti = useGraffiti(ctx, w, npcLive, shop.toPutka);
  const stash = useStashes(ctx, shop.toPutka);
  const roina = useRoina(ctx);
  const barber = useBarber(ctx, color);
  usePolicePatrol(ctx, { doors, alert: shop.alert, occupied: training.busy || transit.riding || !!stash.chase || !!graffiti.painting, toPutka: shop.toPutka });
  // NPC talk walks you up to the NPC with the click handler defined below.
  const groundClickRef = useRef<(p: WorldXZ) => void>(() => {});
  const talk = useNpcTalk(ctx, { npcs: w.npcs, npcLive, blocked: training.busy || transit.riding, walkTo: (p) => groundClickRef.current(p), stash });

  // Leaving a scene: an unpaid basket stays in the shop, panels close.
  const prevScene = useRef(scene);
  useEffect(() => {
    if (prevScene.current === scene) return;
    const left = prevScene.current;
    prevScene.current = scene;
    shop.leaveScene(left);
    cooking.setAtCook(null);
    talk.pendingTalk.current = null;
  }, [scene, shop.basket]);

  // ------------------------------------------------------------ clicks and arrival
  /** Clicks, keys and steering are ignored while true (cutscene, dialogue, training, riding, painting, chase). */
  const inputLocked = cutscene || !!dialogue || fading || training.busy || transit.riding || !!graffiti.painting || !!stash.chase || !!talk.gang;
  /** Close all open panels when the player walks off. */
  const closePanels = () => {
    transit.setAtBusStop(null);
    transit.setAtTrain(null);
    barber.setBarberDraft(null);
    training.setAtStation(null);
    training.setAtPool(false);
    training.setAtDrill(null);
    training.setCarrying(null);
    shop.setAtShelf(null);
    shop.setPicked(null);
    shop.setAtTill(false);
  };
  const interaction = useInteraction(
    ctx,
    w,
    {
      jailStep,
      carrying: training.carrying,
      currentLook: barber.currentLook,
      putkaUntil: shop.putkaUntil,
      stashTaken: stash.stashTaken,
      chase: stash.chase,
      talkToJonne: jailbreak.talkToJonne,
      escaped: jailbreak.escaped,
      setAtBusStop: transit.setAtBusStop,
      setAtTrain: transit.setAtTrain,
      takeStash: stash.takeStash,
      setAtCook: cooking.setAtCook,
      talkToPete: roina.talkToPete,
      arriveAtStation: training.arriveAtStation,
      setAtPool: training.setAtPool,
      setAtDrill: training.setAtDrill,
      setBarberDraft: barber.setBarberDraft,
      setAtShelf: shop.setAtShelf,
      setAtTill: shop.setAtTill,
      talkAtPoliceDesk: () => shop.talkAtPoliceDesk(stash.policeDeskOptions),
    },
    {
      locked: inputLocked,
      closePanels,
      route,
      onMove,
      onArrived: talk.arrived,
    },
  );
  const { onGroundClick } = interaction;
  groundClickRef.current = onGroundClick;

  // ------------------------------------------------------------ keyboard + mouse-look controls
  const controlRef = useRef(createControls());
  const [pointerLocked, setPointerLocked] = useState(false);
  const [nearSpot, setNearSpot] = useState(false);
  const useNearestRef = useRef(interaction.useNearest);
  useNearestRef.current = interaction.useNearest;
  const nearestRef = useRef(interaction.nearest);
  nearestRef.current = interaction.nearest;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'e') useNearestRef.current();
    };
    window.addEventListener('keydown', key);
    const id = window.setInterval(() => setNearSpot(!!nearestRef.current()), 300);
    return () => {
      window.removeEventListener('keydown', key);
      window.clearInterval(id);
    };
  }, []);
  // Give the mouse back whenever a menu, panel or dialogue needs it.
  useEffect(() => {
    const UI = '.dialogue, .gym-hud, .shop-hud, .shelf-pop, .cook-list, .bus-hud, .panel, .graffiti, .ctx-menu';
    const check = () => {
      if (document.pointerLockElement && document.querySelector(UI)) document.exitPointerLock();
    };
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  // ------------------------------------------------------------ right-click menu
  // Right-click anything to see what you can do with it. Using needs you to
  // stand close (movement is keys only); "Tarkastele" works from anywhere.
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; title: string; options: { text: string; onPick: () => void; disabled?: boolean }[] } | null>(null);
  const onContext = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    const locked = !!document.pointerLockElement;
    openContextAt([e.point.x, e.point.z], locked ? window.innerWidth / 2 + 12 : e.nativeEvent.clientX, locked ? window.innerHeight / 2 + 12 : e.nativeEvent.clientY);
  };
  const openContextAt = (p: WorldXZ, x: number, y: number) => {
    if (inputLocked) return;
    const here: WorldXZ = [positionRef.current.x, positionRef.current.z];
    const far = (d: number) => `Liian kaukana (${Math.round(d)} m), kävele lähemmäs`;
    // people first
    let npc: (typeof w.npcs)[number] | null = null, nd = 1.6;
    if (inWorld)
      for (const n of w.npcs) {
        const at = npcLive.current.get(n.id)?.p ?? n.at;
        if (!at) continue;
        const d = dist(at, p);
        if (d < nd) { npc = n; nd = d; }
      }
    if (npc) {
      const n = npc;
      const at = npcLive.current.get(n.id)?.p ?? n.at!;
      const d = dist(at, here);
      setCtxMenu({
        x, y, title: speakerName(n),
        options: [
          { text: d < USE_REACH ? '💬 Puhu' : `💬 ${far(d)}`, disabled: d >= USE_REACH, onPick: () => talk.onNpcClick(n) },
          { text: '🔍 Tarkastele', onPick: () => setToast(describeNpc(n, levelFromXp(player?.skills.strength?.xp ?? 0), levelFromXp(player?.skills.martial?.xp ?? 0))) },
        ],
      });
      return;
    }
    const sp = interaction.spotAt(p);
    if (!sp) return setCtxMenu(null);
    const d = dist(sp.at, here);
    setCtxMenu({
      x, y, title: sp.label ?? 'Kohde',
      options: [
        { text: d < USE_REACH ? '✋ Käytä' : `✋ ${far(d)}`, disabled: d >= USE_REACH, onPick: () => onGroundClick(sp.at) },
        { text: '🔍 Tarkastele', onPick: () => setToast(sp.info ?? sp.label ?? 'Ei mitään erikoista.') },
      ],
    });
  };
  useEffect(() => {
    // the browser's own menu never opens over the game
    const block = (e: MouseEvent) => { if ((e.target as HTMLElement | null)?.closest?.('.game-world')) e.preventDefault(); };
    window.addEventListener('contextmenu', block);
    return () => window.removeEventListener('contextmenu', block);
  }, []);

  const onSteerStart = useCallback(() => {
    setRoute([]);
    closePanels();
    setCtxMenu(null);
  }, [closePanels]);
  const onSteerEnd = (p: WorldXZ) => {
    if (scene === 'world') onMove(worldToLngLat(p));
  };

  // ------------------------------------------------------------ player
  const interiorCollider = useMemo(() => {
    if (scene === 'world') return null;
    const def = INTERIORS[scene];
    let solids = scene === 'prison' && jailStep < JAILBREAK_STEP.escape ? [...def.solids, PLAYER_BARS] : def.solids;
    if (scene === 'police' && shop.putkaUntil !== null) solids = [...solids, POLICE_BARS];
    return new RectCollider(solids);
  }, [scene, jailStep, shop.putkaUntil]);
  const appearance = player?.appearance;
  const strengthLv = levelFromXp(player?.skills.strength?.xp ?? 0);
  const { fat: bodyFat, muscle: bodyMuscle } = bodyShape(player?.body, strengthLv);
  const shape = useMemo(() => ({ fat: bodyFat, muscle: bodyMuscle }), [bodyFat, bodyMuscle]);
  const outfit = useMemo(() => playerOutfit(color, appearance, shape), [color, appearance, shape]);

  useDebugHook({
    w, scene, cutscene, dispatch, positionRef, jailLive, holdingRef, npcLive, goTo, teleport, setRoute,
    talkToJonne: jailbreak.talkToJonne, onGroundClick, onNpcClick: talk.onNpcClick, spots: interaction.spots, lootTaken: interaction.lootTaken,
    shop, graffiti, transit, stash, openContextAt,
  });

  const speaker = line?.speaker === 'inspector' ? INSPECTOR_NAME : line?.speaker === 'player' ? playerName : null;
  const inWorld = scene === 'world';

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
        <group onContextMenu={onContext}>

        {w.ready && (
          <group visible={inWorld}>
            <GameMap w={w} clouds={clouds} xray={xray} highQuality={highQuality} cutscene={cutscene} playerRef={positionRef} clockRef={clockRef} busRun={transit.busRun} onGroundClick={onGroundClick} />
            <NPCLayer npcs={w.npcs} live={npcLive} terrain={terrain!} cutscene={cutscene} clockRef={clockRef} playerRef={positionRef} talkingId={talk.talkingId} onTalk={talk.onNpcClick} />
            <WorldObjects w={w} pieces={graffiti.pieces} stashTaken={stash.stashTaken} lootTaken={interaction.lootTaken} cutscene={cutscene} playerRef={positionRef} onGroundClick={onGroundClick} />
            <QuestLayer
              w={w}
              jailStep={jailStep}
              chase={stash.chase}
              gang={talk.gang}
              cutscene={cutscene}
              playerRef={positionRef}
              clockRef={clockRef}
              scriptRef={scriptRef}
              onGroundClick={onGroundClick}
              onLine={setLine}
              onVisible={setPlayerVisible}
              onIntroDone={finishIntro}
            />
            {cameraOffset && <PlaceCamera offset={cameraOffset} follow={positionRef} />}
          </group>
        )}

        {scene !== 'world' && (
          <InteriorScene
            scene={scene}
            shop={shop.shop}
            jailStep={jailStep}
            putkaUntil={shop.putkaUntil}
            gymPairs={training.gymPairs}
            gymActive={training.gymActive}
            swimT0={training.swimT0}
            fightActive={training.fightActive}
            outfit={outfit}
            clockRef={clockRef}
            playerRef={positionRef}
            holdingRef={holdingRef}
            jailLive={jailLive}
            guardsFrozen={!!dialogue || fading}
            onCaught={jailbreak.onCaught}
            onFiled={jailbreak.onFiled}
            onGroundClick={onGroundClick}
            shelf={{
              shelves: shop.shop?.shelves ?? [],
              picked: shop.picked,
              atShelfId: shop.atShelf?.id ?? null,
              inBasket: shop.basket,
              onPick: (s, itemId) => {
                onGroundClick(s.at);
                shop.setPicked({ shelfId: s.id, itemId });
              },
              onBasket: shop.toBasket,
              onSteal: shop.stealItem,
            }}
          />
        )}

        </group>
        <Player
          color={color}
          appearance={appearance}
          shape={shape}
          positionRef={positionRef}
          scriptRef={scriptRef}
          route={route}
          collider={inWorld ? w.collider : interiorCollider}
          groundHeight={w.groundHeight}
          extraBlocked={w.extraBlocked}
          visible={playerVisible}
          auraVisible={playerVisible && !cutscene}
          karma={player?.karma ?? 0}
          markerY={inWorld ? positionRef.current.y : 0}
          held={{ handL: player?.equipment.handL, handR: player?.equipment.handR }}
          onArrive={interaction.onArrive}
          controlRef={controlRef}
          canSteer={!inputLocked}
          onSteerStart={onSteerStart}
          onSteerEnd={onSteerEnd}
          onLockChange={setPointerLocked}
        />
      </Canvas>
      {pointerLocked && !cutscene && <div className="crosshair" aria-hidden />}
      {ctxMenu && (
        <div className="ctx-backdrop" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}>
          <div className="ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={(e) => e.stopPropagation()}>
            <div className="ctx-menu__title">{ctxMenu.title}</div>
            {ctxMenu.options.map((o) => (
              <button key={o.text} type="button" disabled={o.disabled} onClick={() => { setCtxMenu(null); o.onPick(); }}>
                {o.text}
              </button>
            ))}
          </div>
        </div>
      )}
      {!cutscene && nearSpot && !inputLocked && <div className="use-prompt"><kbd>E</kbd> Käytä</div>}

      <GameHUD
        world={w.world}
        player={player}
        scene={scene}
        cutscene={cutscene}
        line={line}
        speaker={speaker}
        onSkip={skip}
        dialogue={dialogue}
        toast={toast}
        fading={fading}
        jailStep={jailStep}
        jailLive={jailLive}
        holdingRef={holdingRef}
        onVisit={jailbreak.visit}
        clockRef={clockRef}
        busStops={w.busStops}
        trainStops={w.trainStops}
        transit={transit}
        training={training}
        barber={barber}
        shop={shop}
        graffiti={graffiti}
        cooking={cooking}
      />
    </div>
  );
}
