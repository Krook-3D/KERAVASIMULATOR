import type { RoinaId } from '../../../game/gym/roina';
import { useEffect, type MutableRefObject } from 'react';
import type * as THREE from 'three';
import type { Dispatch } from 'react';
import type { GameAction } from '../../../game/store/gameReducer';
import type { WorldXZ } from '../../../game/world/projection';
import { toWorld } from '../../../game/world/station';
import type { Link, SceneId } from '../../../game/interiors/interiors';
import type { NpcLive } from '../npc/Crowd';
import type { Npc } from '../../../game/npc/population';
import type { JailLive } from '../quest/Jailbreak';
import type { Spot } from './gameWorld.types';
import type { WorldSetup } from './useWorldSetup';
import type { useShop } from './systems/useShop';
import type { useGraffiti } from './systems/useGraffiti';
import type { useTransit } from './systems/useTransit';
import type { useStashes } from './systems/useStashes';

/**
 * Developer hook, only with ?debug=1: `window.__kerava` lets tests and the
 * console jump between scenes, give items, talk, steal, paint and inspect.
 */
export function useDebugHook(d: {
  w: WorldSetup;
  scene: SceneId;
  cutscene: boolean;
  dispatch: Dispatch<GameAction>;
  positionRef: MutableRefObject<THREE.Vector3>;
  jailLive: MutableRefObject<JailLive>;
  holdingRef: MutableRefObject<boolean>;
  npcLive: MutableRefObject<NpcLive>;
  goTo: (link: Link) => void;
  teleport: (scene: SceneId, p: WorldXZ) => void;
  setRoute: (r: WorldXZ[]) => void;
  talkToJonne: () => void;
  onGroundClick: (p: WorldXZ) => void;
  onNpcClick: (npc: Npc) => void;
  spots: Spot[];
  lootTaken: string[];
  shop: ReturnType<typeof useShop>;
  graffiti: ReturnType<typeof useGraffiti>;
  transit: ReturnType<typeof useTransit>;
  stash: ReturnType<typeof useStashes>;
  openContextAt: (p: WorldXZ, x: number, y: number) => void;
  controlRef: MutableRefObject<{ yaw: number; pitch: number; dist: number }>;
}) {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('debug')) return;
    const { w, shop, graffiti, transit, stash, positionRef, npcLive } = d;
    const win = window as unknown as Record<string, unknown>;
    win.__kerava = {
      goTo: d.goTo,
      teleport: d.teleport,
      talkToJonne: d.talkToJonne,
      setRoute: d.setRoute,
      /** Camera looking along (dx, dz) from behind the player. */
      cam: (dx: number, dz: number, pitch = 0.36, dist = 5.6) => Object.assign(d.controlRef.current, { yaw: Math.atan2(-dx, -dz), pitch, dist }),
      pos: () => [positionRef.current.x, positionRef.current.z],
      ctx: (x: number, z: number) => d.openContextAt([x, z], 400, 300),
      lamps: () => w.streetProps.lamps.slice(0, 400).map((l) => [l.x, l.z]),
      cars: () => w.streetProps.cars.slice(0, 50).map((c) => [c.x, c.z, c.rotation]),
      doors: w.doors,
      live: d.jailLive.current,
      hold: (v: boolean) => (d.holdingRef.current = v),
      click: (x: number, z: number) => d.onGroundClick([x, z]),
      stops: w.busStops,
      stashes: () => w.stashes.map((x) => ({ id: x.id, at: x.at, owner: x.owner, taken: stash.stashTaken.has(x.id) })),
      wall: () => graffiti.nearWall,
      paint: () => graffiti.startPaint(),
      pieces: () => graffiti.pieces.length,
      cookSpots: () => w.cookSpots,
      give: (id: string, n = 1) => d.dispatch({ type: 'addItem', itemId: id, quantity: n }),
      eat: (id: string) => d.dispatch({ type: 'eatItem', itemId: id }),
      crossings: () => (w.terrain?.crossings ?? []).map((c) => ({ kind: c.kind, at: c.at.map(Math.round), dir: c.dir, road: c.road, span: Math.round(c.span) })),
      plots: () => w.plots.map((p) => ({ id: p.id, at: p.at, sign: p.sign, size: p.size, price: p.price, zone: p.zone, d: Math.round(Math.hypot(p.at[0], p.at[1])) })),
      stats: (money = 0, energy = 0) => d.dispatch({ type: 'adjustStats', money, energy }),
      xp: (skill: string, n: number) => d.dispatch({ type: 'grantReward', reward: { skillXp: { [skill]: n } } }),
      lift: (kg: number) => d.dispatch({ type: 'recordLift', lift: 'deadlift', kg }),
      roina: (id: RoinaId) => d.dispatch({ type: 'useRoina', id }),
      npcs: () => [...npcLive.current.entries()].map(([id, v]) => ({ id, p: v.p, kind: w.npcs.find((n) => n.id === id)?.kind })),
      talk: (id: string) => { const n = w.npcs.find((x) => x.id === id); if (n) d.onNpcClick(n); },
      npcCount: () => w.npcs.length,
      shop: () => ({ basket: shop.basket, atShelf: shop.atShelf?.id, atTill: shop.atTill, alert: shop.alert, putkaLeft: shop.putkaLeft, putka: shop.putkaUntil !== null }),
      basketAdd: shop.toBasket,
      steal: shop.stealItem,
      shelfAt: (id: string) => shop.shop?.shelves.find((x) => x.id === id)?.at,
      tillAt: () => shop.shop?.till,
      pick: (shelfId: string, itemId: string) => {
        const s = shop.shop?.shelves.find((x) => x.id === shelfId);
        if (s) { d.onGroundClick(s.at); shop.setPicked({ shelfId, itemId }); }
      },
      loot: () => w.loot.filter((l) => !d.lootTaken.includes(l.id)).map((l) => ({ id: l.id, item: l.itemId, x: l.x, z: l.z })),
      trains: w.trainStops,
      blocked: (x: number, z: number) => !!w.collider?.isBlocked([x, z]) || w.extraBlocked([x, z]),
      ui: () => ({ atTrain: transit.atTrain?.id, spots: d.spots.length, atBusStop: transit.atBusStop?.id, busRun: transit.busRun?.mode, scene: d.scene, cutscene: d.cutscene }),
      local: (x: number, z: number) => (w.layout ? toWorld(w.layout, [x, z]) : null),
      ground: (x: number, z: number) => [w.terrain?.heightAt(x, z), w.terrain?.surfaceAt(x, z), positionRef.current.y],
    };
  });
}
