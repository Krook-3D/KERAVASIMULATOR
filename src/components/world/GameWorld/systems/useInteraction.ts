import { PORSSI_COUNTER, PORSSI_STALL } from '../../PorssiPavilion';
import type { DrillId } from '../../../../game/gym/drills';
import { FIGHT_SPOTS } from '../../../../game/interiors/interiors';
import { useMemo } from 'react';
import type { WorldXZ } from '../../../../game/world/projection';
import { worldToLngLat } from '../../../../game/world/projection';

import { BARBER_CHAIR_SPOT, GYM_STATIONS, INTERIORS, POLICE_DESK_SPOT, POOL_SWIM_SPOT } from '../../../../game/interiors/interiors';
import type { BusStop } from '../../../../game/world/transit';
import type { CookSpot } from '../../../../game/world/grills';
import type { PlacedStash } from '../../../../game/quests/stashes';
import { SHOPS, type Shelf } from '../../../../game/shop/shop';
import type { LootSpot } from '../../../../game/world/loot';
import { canAdd } from '../../../../game/store/gameReducer';
import { ITEMS, RARITY_NAMES, itemName } from '../../../../data/items';
import type { LngLat } from '../../../../types/game';
import type { Appearance } from '../../../../game/player/appearance';
import { HOTSPOT_SNAP, HOTSPOT_USE, ROINA_TALK_SPOT, USE_REACH, dist } from '../constants';
import { DRILLS } from '../../../../game/gym/drills';
import type { LiftId } from '../../../../game/gym/lifting';
import { LIFTS } from '../../../../game/gym/lifting';
import type { GameCtx, Spot, TrainStop } from '../gameWorld.types';
import type { WorldSetup } from '../useWorldSetup';
import type { Plot } from '../../../../game/world/plots';

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
  setAtDrill: (d: DrillId) => void;
  setBarberDraft: (a: Appearance) => void;
  setAtShelf: (s: Shelf) => void;
  setAtTill: (v: boolean) => void;
  talkAtPoliceDesk: () => void;
  usePlot: (p: Plot) => void;
  openPorssi: (tab: 'board' | 'npc') => void;
  plotsOwned: Record<string, unknown>;
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
  const { doors, jonneAt, busStops, trainStops, stashes, cookSpots, loot } = w;
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
        list.push({ at: d.at, label: `🚪 ${d.label}`, info: to ? `Ovi: ${d.label}. Käytä mennäksesi sisään.` : 'Vankilan portti. Lukossa.', use: () => (to ? goTo({ scene: to.scene, exit: to.exit }) : setToast('Vankilan portti on lukossa. Hyvä niin.')) });
      }
      if (jonneAt) list.push({ at: jonneAt, label: '🧍 Jonne', info: 'Jonne pyörii aseman nurkilla. Hänellä on aina jokin juoni.', use: a.talkToJonne });
      for (const b of busStops) list.push({ at: b.at, label: `🚌 ${b.name}`, info: `Bussipysäkki ${b.name}. Täältä pääsee bussilla muualle Keravalle.`, use: () => a.setAtBusStop(b) });
      for (const t of trainStops) list.push({ at: t.at, label: `🚆 ${t.name}`, info: `Lähijunan laituri: ${t.name}.`, use: () => a.setAtTrain(t) });
      for (const st of stashes) if (!a.stashTaken.has(st.id)) list.push({ at: st.at, label: '❓ Jotain maassa', info: 'Sammaleen alla näkyy jotain. Joku on piilottanut tänne jotain.', use: () => a.takeStash(st) });
      for (const c of cookSpots) list.push({ at: c.at, label: `🔥 ${c.name}`, info: `${c.name}: täällä voi kokata raaka-aineista ruokaa.`, use: () => a.setAtCook(c) });
      list.push({ at: PORSSI_COUNTER, label: '📈 Kerava-Pörssi', info: 'Kerava-Pörssi: pelaajien kauppapaikka. Jätä osto- ja myyntitarjouksia, nouda kaupat. Vaatii verkkopelin.', use: () => a.openPorssi('board') });
      list.push({ at: PORSSI_STALL, label: '🧺 Torikauppias', info: 'Torikauppias myy tavallisia tarvikkeita ja ostaa tavaraa halvalla.', use: () => a.openPorssi('npc') });
      for (const pl of w.plots) {
        const mine = !!a.plotsOwned[pl.id];
        list.push({ at: pl.sign, label: mine ? '🏗️ Oma tontti' : `🪧 Tontti ${pl.price.toLocaleString('fi-FI')} €`, info: mine ? `Oma tonttisi (${pl.size} × ${pl.size} m). Rakenna talo Motonetin tarvikkeilla.` : `Myytävä rakennustontti: ${pl.zone}, ${pl.size} × ${pl.size} m, ${pl.price.toLocaleString('fi-FI')} €.`, use: () => a.usePlot(pl) });
      }
      for (const l of loot) if (!lootTaken.includes(l.id)) list.push({ at: [l.x, l.z], label: `✨ ${itemName(l.itemId)}`, info: `${itemName(l.itemId)} (${RARITY_NAMES[ITEMS[l.itemId]?.rarity ?? 'common']}). ${ITEMS[l.itemId]?.description ?? ''}`, use: () => pickLoot(l) });
      return list;
    }
    const list: Spot[] = INTERIORS[scene].exits.map((e) => ({
      at: e.at,
      label: `🚪 ${e.label}`,
      use: () => (scene === 'prison' && e.id === 'yard' ? a.escaped() : goTo(e.to)),
    }));
    if (scene === 'gym') list.push({ at: ROINA_TALK_SPOT, label: '🧴 Pumppi-Pete', info: 'Pumppi-Pete myy salin nurkassa "lisäravinteita". Fiktiivisiä, ja karma kärsii.', use: a.talkToPete });
    if (scene === 'gym') for (const g of GYM_STATIONS) list.push({ at: g.use, label: `🏋️ ${LIFTS[g.lift].name}`, info: `${LIFTS[g.lift].name}: lataa tankoon levyjä ja nosta. Kehittää Voimaa.`, use: () => a.arriveAtStation(g.lift) });
    if (scene === 'fightgym') for (const [id, at] of Object.entries(FIGHT_SPOTS)) list.push({ at, label: `🥊 ${DRILLS[id as DrillId].name}`, info: `${DRILLS[id as DrillId].blurb} Vaatii Kamppailu ${DRILLS[id as DrillId].level}.`, use: () => a.setAtDrill(id as DrillId) });
    if (scene === 'pool') list.push({ at: POOL_SWIM_SPOT, label: '🏊 Uintirata', info: 'Ui allasmittoja. Kehittää Kestävyyttä.', use: () => a.setAtPool(true) });
    if (scene === 'barber') list.push({ at: BARBER_CHAIR_SPOT, label: '💈 Parturin tuoli', info: 'Uusi kampaus tai parta.', use: () => a.setBarberDraft({ ...a.currentLook }) });
    const sh = SHOPS[scene];
    if (sh) {
      for (const shelf of sh.shelves) list.push({ at: shelf.at, label: `🛒 ${shelf.name}`, info: `${shelf.name}: ${shelf.items.map((i) => itemName(i)).join(', ')}.`, use: () => a.setAtShelf(shelf) });
      list.push({ at: sh.till, label: '💳 Kassa', info: 'Maksa korin tuotteet täällä.', use: () => a.setAtTill(true) });
    }
    if (scene === 'police') list.push({ at: POLICE_DESK_SPOT, label: '👮 Asiakaspalvelu', info: 'Poliisiaseman tiski.', use: a.talkAtPoliceDesk });
    return list;
    // The actions read the latest state through closures re-created each render;
    // the list is rebuilt when any of these change (same dependencies as before the split).
  }, [scene, doors, jonneAt, goTo, a.jailStep, player, a.carrying, busStops, trainStops, a.currentLook, loot, lootTaken, a.putkaUntil, cookSpots, stashes, a.stashTaken, a.chase, w.plots, a.plotsOwned]);

  /**
   * A click in the world. There is no click-to-walk: you move with the arrow
   * keys / WASD. Clicking something usable that you stand next to uses it
   * right away; anything else is ignored.
   */
  const onGroundClick = (raw: WorldXZ) => {
    if (opts.locked) return;
    const p = scene === 'world' ? w.clampToWorld(raw) : raw;
    const snap = spotAt(p);
    if (!snap) return;
    const here: WorldXZ = [positionRef.current.x, positionRef.current.z];
    if (dist(here, snap.at) > USE_REACH) {
      setToast(`${snap.label ?? 'Kohde'} on liian kaukana. Kävele lähemmäs nuolilla tai WASD:lla.`);
      return;
    }
    opts.closePanels();
    setRoute([]);
    snap.use();
  };
  /** The usable spot closest to a point (within snapping distance), or null. */
  const spotAt = (p: WorldXZ): Spot | null => {
    let best: Spot | null = null, bd = HOTSPOT_SNAP;
    for (const s of spots) {
      const d = dist(s.at, p);
      if (d < bd) { best = s; bd = d; }
    }
    return best;
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
  /** E key: use the nearest hotspot. */
  const useNearest = () => {
    if (opts.locked) return false;
    const sp = nearest();
    if (!sp) return false;
    opts.closePanels();
    setRoute([]);
    sp.use();
    return true;
  };

  return { spots, onGroundClick, onArrive, lootTaken, nearest, useNearest, spotAt };
}
