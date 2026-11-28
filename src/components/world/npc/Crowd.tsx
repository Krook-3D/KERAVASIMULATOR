import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorldXZ } from '../../../game/world/projection';
import { onRoute, routeLength, type Npc } from '../../../game/npc/population';
import { BARKS } from '../../../game/npc/talk';
import { Humanoid, type HumanBones, type Outfit } from '../humanoid/Humanoid';
import { poseLocomotion, posePoint, resetPose } from '../humanoid/animate';
import { createTextTexture } from '../textTexture';

const SHOW_RADIUS = 115;
const MAX_SHOWN = 30;
const BARK_RADIUS = 16;

/** Live NPC positions, shared with the game (talking, graffiti witnesses). */
export type NpcLive = Map<string, { p: WorldXZ; s: number }>;

const outfitOf = (n: Npc): Outfit => ({ ...n.look, hat: n.look.hat, style: n.look.style });

function bubbleTexture(text: string, crew: boolean) {
  const w = Math.min(1024, 120 + text.length * 26);
  return createTextTexture(text, { width: w, height: 96, bg: crew ? '#14171fe6' : '#f2f2eee6', fg: crew ? '#ffd23f' : '#14171f', font: '700 42px Rubik, Arial, sans-serif' });
}

function NpcView({ npc, live, clockRef, groundAt, playerRef, talking, onClick }: {
  npc: Npc;
  live: MutableRefObject<NpcLive>;
  clockRef: MutableRefObject<number>;
  groundAt: (x: number, z: number) => number;
  playerRef: MutableRefObject<THREE.Vector3>;
  talking: boolean;
  onClick: (n: Npc) => void;
}) {
  const g = useRef<THREE.Group>(null);
  const bones = useRef<HumanBones | null>(null);
  const outfit = useMemo(() => outfitOf(npc), [npc]);
  const total = useMemo(() => (npc.route ? routeLength(npc.route) : 0), [npc.route]);
  const s = useRef<number | null>(null);
  const walk = useRef(0);
  const prevS = useRef<number | null>(null);
  const [bark, setBark] = useState<string | null>(null);
  const nextBark = useRef(0);
  const seed = useMemo(() => [...npc.id].reduce((a, c) => a + c.charCodeAt(0), 0), [npc.id]);
  const tex = useMemo(() => (bark ? bubbleTexture(bark, npc.kind === 'crew') : null), [bark, npc.kind]);
  useEffect(() => () => tex?.dispose(), [tex]);

  useFrame((_, dt) => {
    const m = g.current;
    if (!m) return;
    const t = clockRef.current;
    const pl = playerRef.current;
    let p: WorldXZ, yaw: number, moving = false;
    if (npc.route && npc.speed) {
      const leader = npc.follow ? live.current.get(npc.follow) : undefined;
      if (s.current === null) s.current = (npc.phase ?? 0) + t * npc.speed;
      if (leader) s.current = leader.s; // keep pace beside the leader
      else if (!talking) s.current += npc.speed * dt;
      const at = onRoute(npc.route, total, s.current - (npc.follow ? 0.5 : 0));
      const side = npc.offset ?? 0;
      p = [at.p[0] + Math.cos(at.yaw) * side, at.p[1] - Math.sin(at.yaw) * side];
      yaw = at.yaw;
      moving = !talking && (!leader || Math.abs(leader.s - (prevS.current ?? leader.s)) > 1e-4);
      prevS.current = s.current;
    } else {
      p = npc.at!;
      yaw = npc.yaw ?? 0;
    }
    if (talking) yaw = Math.atan2(pl.x - p[0], pl.z - p[1]);
    live.current.set(npc.id, { p, s: s.current ?? 0 });
    m.position.set(p[0], groundAt(p[0], p[1]), p[1]);
    m.rotation.y = yaw;
    const b = bones.current;
    if (b) {
      resetPose(b);
      const speed = npc.speed ?? 0;
      walk.current += dt * (speed > 2.5 ? 13 : 9) * (moving ? 1 : 0);
      poseLocomotion(b, walk.current, moving ? Math.min(1, speed / 3.5) : 0, t + seed);
      if (npc.kind === 'crew' && !talking) {
        // hanging out: gestures and looking around
        const k = Math.sin(t * 0.9 + seed);
        if (k > 0.55) posePoint(b, (k - 0.55) * 2);
        b.head.rotation.y = Math.sin(t * 0.5 + seed * 1.7) * 0.6;
      }
    }
    // barks when the player is near
    const d = Math.hypot(pl.x - p[0], pl.z - p[1]);
    if (t > nextBark.current) {
      if (bark) {
        setBark(null);
        nextBark.current = t + 6 + ((seed * 7) % 9);
      } else if (d < BARK_RADIUS && !talking) {
        const list = BARKS[npc.kind];
        setBark(list[Math.floor((t * 13 + seed) % list.length)]!);
        nextBark.current = t + 3.2;
      } else nextBark.current = t + 1 + (seed % 3);
    }
  });

  return (
    <group
      ref={g}
      onClick={(e) => {
        e.stopPropagation();
        onClick(npc);
      }}
    >
      <Humanoid outfit={outfit} bonesRef={bones} />
      {/* generous invisible click target */}
      <mesh position-y={0.9} visible={false}>
        <cylinderGeometry args={[0.45, 0.45, 1.8, 6]} />
      </mesh>
      {tex && (
        <sprite position-y={2.35 * (npc.look.height ?? 1)} scale={[(tex.image as HTMLCanvasElement).width / 260, 0.38, 1]} raycast={() => null}>
          <spriteMaterial map={tex} depthTest={false} transparent />
        </sprite>
      )}
    </group>
  );
}

/** Mounts the NPCs near the player and keeps their live positions in `live`. */
export function Crowd({ npcs, live, clockRef, groundAt, playerRef, talkingId, onTalk }: {
  npcs: Npc[];
  live: MutableRefObject<NpcLive>;
  clockRef: MutableRefObject<number>;
  groundAt: (x: number, z: number) => number;
  playerRef: MutableRefObject<THREE.Vector3>;
  talkingId: string | null;
  onTalk: (n: Npc) => void;
}) {
  const [shown, setShown] = useState<string[]>([]);
  const last = useRef(-10);
  const byId = useMemo(() => new Map(npcs.map((n) => [n.id, n])), [npcs]);
  const totals = useMemo(() => new Map(npcs.map((n) => [n.id, n.route ? routeLength(n.route) : 0])), [npcs]);
  useFrame(() => {
    const t = clockRef.current;
    if (Math.abs(t - last.current) < 0.7) return;
    last.current = t;
    const pl = playerRef.current;
    const scored: [string, number][] = [];
    for (const n of npcs) {
      const lv = live.current.get(n.follow ?? n.id);
      let p = lv?.p ?? n.at;
      if (!p && n.route) p = onRoute(n.route, totals.get(n.id)!, (n.phase ?? 0) + t * (n.speed ?? 0)).p;
      if (!p) continue;
      const d = Math.hypot(pl.x - p[0], pl.z - p[1]);
      if (d < SHOW_RADIUS) scored.push([n.id, d]);
    }
    scored.sort((a, b) => a[1] - b[1]);
    const ids = scored.slice(0, MAX_SHOWN).map((x) => x[0]);
    // a follower needs its leader mounted
    for (const id of [...ids]) {
      const f = byId.get(id)?.follow;
      if (f && !ids.includes(f)) ids.push(f);
    }
    ids.sort();
    setShown((prev) => (prev.join() === ids.join() ? prev : ids));
  });
  return (
    <group>
      {shown.map((id) => {
        const n = byId.get(id);
        return n ? <NpcView key={id} npc={n} live={live} clockRef={clockRef} groundAt={groundAt} playerRef={playerRef} talking={talkingId === id || (!!n.follow && talkingId === n.follow)} onClick={onTalk} /> : null;
      })}
    </group>
  );
}
