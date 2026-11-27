import { useMemo } from 'react';
import type { WorldXZ } from '../../../../game/world/projection';
import { worldToLngLat } from '../../../../game/world/projection';
import { planRoute } from '../../../../game/world/station';
import { BARBER_CHAIR_SPOT, GYM_STATIONS, INTERIORS, POLICE_DESK_SPOT, POOL_SWIM_SPOT } from '../../../../game/interiors/interiors';
import type { LiftId } from '../../../../game/gym/lifting';
import type { BusStop } from '../../../../game/world/transit';
import type { CookSpot } from '../../../../game/world/grills';
import type { PlacedStash } from '../../../../game/quests/stashes';
import { SHOPS, type Shelf } from '../../../../game/shop/shop';
import type { LootSpot } from '../../../../game/world/loot';
import { canAdd } from '../../../../game/store/gameReducer';
import { ITEMS, RARITY_NAMES, itemName } from '../../../../data/items';
import type { LngLat } from '../../../../types/game';
import type { Appearance } from '../../../../game/player/appearance';
import { HOTSPOT_SNAP, HOTSPOT_USE, ROINA_TALK_SPOT, dist } from '../constants';
import type { GameCtx, Spot, TrainStop } from '../gameWorld.types';
import type { WorldSetup } from '../useWorldSetup';

/** What the hotspots open, from the systems that own them. */
export interface SpotActions {
  jailStep: number;
  carrying: unknown;
  currentLook: Appearance;
  putkaUntil: number | null;
  stashTaken: Set<string>;
  chase: unknown;
  talkToJonne: () => void;
  escaped: () => void;
  setAtBusStop: (b: BusStop) => void;
  setAtTrain: (t: TrainStop) => void;
  takeStash: (s: PlacedStash) => void;
  setAtCook: (c: CookSpot) => void;
  talkToPete: () => void;
  arriveAtStation: (lift: LiftId) => void;
  setAtPool: (v: boolean) => void;
  setBarberDraft: (a: Appearance) => void;
  setAtShelf: (s: Shelf) => void;
  setAtTill: (v: boolean) => void;
  talkAtPoliceDesk: () => void;
}

/**
 * Clicks and arrival: the list of hotspots in the current scene, snapping a
 * click onto a hotspot, route planning, and using a hotspot when you get there.
 */
export function useInteraction(
  ctx: GameCtx,
  w: WorldSetup,
  a: SpotActions,
  opts: {
    /** Clicks are ignored while true (cutscene, dialogue, training, riding, painting, chase). */
    locked: boolean;
    /** Close all open panels when the player walks off. */
    closePanels: () => void;
    route: WorldXZ[];
    onMove: (position: LngLat) => void;
    /** Extra arrival handling (a pending NPC talk). */
    onArrived: (p: WorldXZ) => void;
  },
) {
  const { player, dispatch, scene, positionRef, setRoute, setToast, goTo } = ctx;
  const { doors, jonneAt, busStops, trainStops, stashes, cookSpots, loot, layout } = w;
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

  const spots = useMemo((): Spot[] => {
    if (scene === 'world') {
      const list: Spot[] = [];
      for (const d of Object.values(doors ?? {})) {
        const to = d.to;
        list.push({ at: d.at, use: () => (to ? goTo({ scene: to.scene, exit: to.exit }) : setToast('Vankilan portti on lukossa. Hyvä niin.')) });
      }
      if (jonneAt) list.push({ at: jonneAt, use: a.talkToJonne });
      for (const b of busStops) list.push({ at: b.at, use: () => a.setAtBusStop(b) });
      for (const t of trainStops) list.push({ at: t.at, use: () => a.setAtTrain(t) });
      for (const st of stashes) if (!a.stashTaken.has(st.id)) list.push({ at: st.at, use: () => a.takeStash(st) });
      for (const c of cookSpots) list.push({ at: c.at, use: () => a.setAtCook(c) });
      for (const l of loot) if (!lootTaken.includes(l.id)) list.push({ at: [l.x, l.z], use: () => pickLoot(l) });
      return list;
    }
    const list: Spot[] = INTERIORS[scene].exits.map((e) => ({
      at: e.at,
      use: () => (scene === 'prison' && e.id === 'yard' ? a.escaped() : goTo(e.to)),
    }));
    if (scene === 'gym') list.push({ at: ROINA_TALK_SPOT, use: a.talkToPete });
    if (scene === 'gym') for (const g of GYM_STATIONS) list.push({ at: g.use, use: () => a.arriveAtStation(g.lift) });
    if (scene === 'pool') list.push({ at: POOL_SWIM_SPOT, use: () => a.setAtPool(true) });
    if (scene === 'barber') list.push({ at: BARBER_CHAIR_SPOT, use: () => a.setBarberDraft({ ...a.currentLook }) });
    const sh = SHOPS[scene];
    if (sh) {
      for (const shelf of sh.shelves) list.push({ at: shelf.at, use: () => a.setAtShelf(shelf) });
      list.push({ at: sh.till, use: () => a.setAtTill(true) });
    }
    if (scene === 'police') list.push({ at: POLICE_DESK_SPOT, use: a.talkAtPoliceDesk });
    return list;
    // The actions read the latest state through closures re-created each render;
    // the list is rebuilt when any of these change (same dependencies as before the split).
  }, [scene, doors, jonneAt, goTo, a.jailStep, player, a.carrying, busStops, trainStops, a.currentLook, loot, lootTaken, a.putkaUntil, cookSpots, stashes, a.stashTaken, a.chase]);

  const onGroundClick = (raw: WorldXZ) => {
    if (opts.locked) return;
    opts.closePanels();
    let p = scene === 'world' ? w.clampToWorld(raw) : raw;
    const snap = spots.find((s) => dist(s.at, p) < HOTSPOT_SNAP);
    if (snap) p = snap.at;
    const here: WorldXZ = [positionRef.current.x, positionRef.current.z];
    setRoute(scene === 'world' && layout ? planRoute(layout, here, p) : [p]);
  };

  const onArrive = (p: WorldXZ) => {
    const goal = opts.route[0];
    const reached = !!goal && dist(goal, p) < 0.8;
    if (reached && opts.route.length > 1) {
      setRoute((r) => r.slice(1));
      return;
    }
    setRoute([]);
    if (scene === 'world') opts.onMove(worldToLngLat(p));
    const spot = spots.find((s) => dist(s.at, p) < HOTSPOT_USE);
    if (spot) spot.use();
    opts.onArrived(p);
  };

  /** Closest hotspot within reach of the player (for the E key), or null. */
  const nearest = (): Spot | null => {
    const here: WorldXZ = [positionRef.current.x, positionRef.current.z];
    let best: Spot | null = null, bd = HOTSPOT_SNAP;
    for (const sp of spots) {
      const d = dist(sp.at, here);
      if (d < bd) { best = sp; bd = d; }
    }
    return best;
  };
  /** E key: walk the last step to the nearest hotspot and use it. */
  const useNearest = () => {
    if (opts.locked) return false;
    const sp = nearest();
    if (!sp) return false;
    opts.closePanels();
    setRoute([sp.at]);
    return true;
  };

  return { spots, onGroundClick, onArrive, lootTaken, nearest, useNearest };
}
