import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { WorldXZ } from '../../../../game/world/projection';
import { isTrackBlocked } from '../../../../game/world/station';
import { levelFromXp } from '../../../../game/xp/xp';
import { POLICE_RESPONSE, QUALITY_KARMA, WITNESS_LINES, artXp, loadPieces, nearestWall, savePieces, spotQuality, witnessReaction, type SavedPiece, type SpotQuality, type WallHit } from '../../../../game/art/graffiti';
import { SPRAY_COLORS, isSpray, itemName } from '../../../../data/items';
import type { NpcLive } from '../../npc/Crowd';
import type { GameCtx } from '../gameWorld.types';
import type { WorldSetup } from '../useWorldSetup';
import type { PutkaReason } from './useShop';

/**
 * Art skill: with a spray can in hand, find a wall, paint freehand, and live
 * with the witnesses (ignore / angry / call the police) and the area's karma.
 */
export function useGraffiti(ctx: GameCtx, w: WorldSetup, npcLive: MutableRefObject<NpcLive>, toPutka: (karma: number, reason: PutkaReason) => void) {
  const { player, dispatch, scene, positionRef, clockRef, setRoute, setToast, say } = ctx;
  const { world, layout, terrain, doors, npcs, uglySpots, niceSpots } = w;
  const [pieces, setPieces] = useState<SavedPiece[]>(loadPieces);
  const [nearWall, setNearWall] = useState<WallHit | null>(null);
  const [painting, setPainting] = useState<{ wall: WallHit; quality: SpotQuality; t0: number } | null>(null);
  const [policeAt, setPoliceAt] = useState<number | null>(null);
  const [witnessLog, setWitnessLog] = useState<string[]>([]);
  const reacted = useRef(new Set<string>());
  const [, setPaintTick] = useState(0);
  const heldSpray = isSpray(player?.equipment.handL) || isSpray(player?.equipment.handR);

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
    const wall = painting.wall;
    const pieceW = Math.min(wall.len, 3.6);
    const piece: SavedPiece = { id: `g${Date.now()}`, q: wall.q, n: wall.n, t: wall.t, w: pieceW, h: pieceW / 2, y: terrain ? terrain.surfaceAt(wall.q[0] + wall.n[0], wall.q[1] + wall.n[1]) : 0, img };
    setPieces((list) => savePieces([...list, piece]));
    dispatch({ type: 'grantReward', reward: { skillXp: { art: xp, ...(policeAt !== null ? { evasion: 15 } : {}) } } });
    if (karma) dispatch({ type: 'adjustKarma', amount: karma });
    for (const c of cans) dispatch({ type: 'useUp', itemId: c });
    setToast(`🎨 Graffiti valmis! +${xp} Art XP${karma ? ` · karma ${karma > 0 ? '+' : ''}${karma}` : ''}${policeAt !== null ? ' · ehdit häipyä ennen poliisia (+15 Kyttien pakoilu XP)' : ''}${cans.length ? ` · ${cans.length} tölkki${cans.length > 1 ? 'ä' : ''} tyhjeni` : ''}`);
    setPainting(null);
    setPoliceAt(null);
  };
  const cancelPaint = () => {
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

  return { pieces, nearWall, painting, policeAt, witnessLog, qualityAt, startPaint, finishPaint, cancelPaint, sprayPalette };
}
