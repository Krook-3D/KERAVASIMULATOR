import { useCallback, useEffect, useRef, useState } from 'react';
import { canAdd } from '../../../../game/store/gameReducer';
import { itemName } from '../../../../data/items';
import { DROP, compassFi, nextGap, pickDropSpot, rollLegendary, type PackageDrop } from '../../../../game/world/packageDrop';
import type { GameCtx } from '../gameWorld.types';
import type { WorldSetup } from '../useWorldSetup';

/**
 * Random package drops: a crate parachutes somewhere in town every 6–12
 * minutes of play, is announced with direction and distance, and holds one
 * legendary item for whoever gets there within five minutes.
 */
export function usePackageDrops(ctx: GameCtx, w: WorldSetup, active: boolean) {
  const { player, dispatch, positionRef, clockRef, setToast, scene } = ctx;
  const [drop, setDrop] = useState<PackageDrop | null>(null);
  const nextAt = useRef<number | null>(null);
  const warned = useRef(false);
  const seq = useRef(0);
  const dropRef = useRef(drop);
  dropRef.current = drop;
  const activeRef = useRef(active && scene === 'world');
  activeRef.current = active && scene === 'world';

  const spawn = useCallback(() => {
    const p = positionRef.current;
    const at = pickDropSpot(w.loot, p, Math.random);
    if (!at) return null;
    const t = clockRef.current;
    const d: PackageDrop = { id: `${Date.now().toString(36)}${seq.current++}`, itemId: rollLegendary(Math.random), x: at.x + 2.5, y: w.groundHeight([at.x + 2.5, at.z]), z: at.z, at: t, landsAt: t + DROP.fallS, goneAt: t + DROP.fallS + DROP.stayS };
    warned.current = false;
    setDrop(d);
    setToast(`📦 Pakettipudotus! Laskuvarjo laskeutuu noin ${Math.round(Math.hypot(d.x - p.x, d.z - p.z) / 10) * 10} m päähän, ${compassFi(p, d)}. Katso karttaa. Sisällä on aina legendaarinen esine.`);
    return d;
  }, [w.loot, w.groundHeight, positionRef, clockRef, setToast]);

  useEffect(() => {
    if (!w.loot.length) return;
    const id = window.setInterval(() => {
      const t = clockRef.current;
      const d = dropRef.current;
      if (d) {
        if (!warned.current && t > d.goneAt - 60) {
          warned.current = true;
          if (activeRef.current) setToast('📦 Paketti katoaa minuutin päästä!');
        }
        if (t > d.goneAt) {
          setDrop(null);
          nextAt.current = t + nextGap(Math.random);
          if (activeRef.current) setToast('📦 Joku muu ehti paketille ensin.');
        }
        return;
      }
      if (nextAt.current === null) nextAt.current = t + nextGap(Math.random, true);
      // wait for the player to be outdoors and free
      if (t >= nextAt.current && activeRef.current) spawn();
    }, 1000);
    return () => window.clearInterval(id);
  }, [w.loot, clockRef, setToast, spawn]);

  const openDrop = () => {
    const d = dropRef.current;
    if (!d || !player) return;
    if (clockRef.current < d.landsAt) return setToast('🪂 Paketti on vielä ilmassa.');
    if (!canAdd(player, d.itemId)) return setToast('🎒 Reppu on täynnä (30/30). Tee tilaa, paketti odottaa vielä hetken.');
    dispatch({ type: 'pickupLoot', lootId: `drop:${d.id}`, itemId: d.itemId });
    dispatch({ type: 'grantReward', reward: { xp: 60 } });
    setDrop(null);
    nextAt.current = clockRef.current + nextGap(Math.random);
    setToast(`🌟 Paketista löytyi: ${itemName(d.itemId)} (Legendaarinen)!`);
  };

  // ?debug=1: window.__keravaDrop() drops one right away, optionally at a given distance
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('debug')) return;
    const win = window as unknown as { __keravaDrop?: (land?: boolean) => PackageDrop | null };
    win.__keravaDrop = (land) => {
      const d = spawn();
      if (d && land) setDrop({ ...d, at: clockRef.current - DROP.fallS, landsAt: clockRef.current });
      return d;
    };
    return () => {
      delete win.__keravaDrop;
    };
  }, [spawn, clockRef]);

  return { drop, openDrop };
}
