import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lookToAppearance } from '../../game/online/look';
import type { Remote } from './GameWorld/systems/useOnline';
import { Humanoid, type HumanBones } from './humanoid/Humanoid';
import { poseLocomotion, resetPose } from './humanoid/animate';
import { playerOutfit } from './PlayerCharacter';
import { createTextTexture } from './textTexture';

export { appearanceToLook } from '../../game/online/look';

function labelTexture(text: string, bg: string, fg: string, font = '700 40px Rubik, Arial, sans-serif') {
  const w = Math.min(1024, 100 + text.length * 24);
  return createTextTexture(text, { width: w, height: 84, bg, fg, font });
}

function RemoteView({ id, live, groundAt, onClick }: {
  id: string;
  live: MutableRefObject<Map<string, Remote>>;
  groundAt: (x: number, z: number) => number;
  onClick: (id: string, x: number, y: number) => void;
}) {
  const r = live.current.get(id)!;
  const g = useRef<THREE.Group>(null);
  const bones = useRef<HumanBones | null>(null);
  const bubble = useRef<THREE.Sprite>(null);
  const walk = useRef(0);
  const shownBubble = useRef<string | null>(null);
  const lookKey = JSON.stringify(r.look);
  const outfit = useMemo(() => {
    const { a, shape } = lookToAppearance(r.look, r.color);
    return playerOutfit(r.color, a, shape);
  }, [lookKey, r.color]);
  const h = outfit.height ?? 1;
  const name = useMemo(() => labelTexture(`${r.name} (taso ${r.level})`, '#14171fd0', '#9fe0ff'), [r.name, r.level]);
  useEffect(() => () => name.dispose(), [name]);
  const bubbleTex = useRef<THREE.CanvasTexture | null>(null);
  useEffect(() => () => bubbleTex.current?.dispose(), []);

  useFrame((state, dt) => {
    const m = g.current;
    const p = live.current.get(id);
    if (!m || !p) return;
    const dx = p.x - p.rx, dz = p.z - p.rz;
    const d = Math.hypot(dx, dz);
    if (d > 40) {
      p.rx = p.x;
      p.rz = p.z;
    } else {
      // ease towards the latest position (moves come 10×/s)
      const k = 1 - Math.exp(-dt * 9);
      p.rx += dx * k;
      p.rz += dz * k;
    }
    const speed = d * 9;
    const moving = speed > 0.4 || p.anim === 'walk' || p.anim === 'run';
    if (d > 0.05) p.yaw = Math.atan2(dx, dz);
    m.position.set(p.rx, groundAt(p.rx, p.rz), p.rz);
    m.rotation.y = p.yaw;
    const b = bones.current;
    if (b) {
      resetPose(b);
      walk.current += dt * 9 * (moving ? 1 : 0);
      poseLocomotion(b, walk.current, moving ? Math.min(1, Math.max(0.5, speed / 7)) : 0, state.clock.elapsedTime + id.length);
    }
    // chat bubble
    const s = bubble.current;
    if (s) {
      const now = performance.now();
      const text = p.bubble && p.bubble.until > now ? p.bubble.text : null;
      if (text !== shownBubble.current) {
        shownBubble.current = text;
        bubbleTex.current?.dispose();
        bubbleTex.current = text ? labelTexture(text.length > 60 ? `${text.slice(0, 58)}…` : text, '#f2f2eeee', '#14171f') : null;
        const mat = s.material as THREE.SpriteMaterial;
        mat.map = bubbleTex.current;
        mat.needsUpdate = true;
        if (bubbleTex.current) s.scale.set((bubbleTex.current.image as HTMLCanvasElement).width / 240, 0.35, 1);
      }
      s.visible = !!text;
    }
  });

  return (
    <group ref={g} onClick={(e) => { e.stopPropagation(); onClick(id, e.nativeEvent.clientX, e.nativeEvent.clientY); }}>
      <Humanoid outfit={outfit} bonesRef={bones} />
      <sprite position-y={2.15 * h} scale={[(name.image as HTMLCanvasElement).width / 350, 0.24, 1]} raycast={() => null}>
        <spriteMaterial map={name} depthTest={false} transparent />
      </sprite>
      <sprite ref={bubble} position-y={2.65 * h} visible={false} raycast={() => null}>
        <spriteMaterial depthTest={false} transparent />
      </sprite>
    </group>
  );
}

/** Other players in your scene, with name tags and chat bubbles. */
export function RemotePlayers({ roster, live, scene, groundAt, onClick }: {
  roster: string[];
  live: MutableRefObject<Map<string, Remote>>;
  scene: string;
  groundAt: (x: number, z: number) => number;
  onClick: (id: string, x: number, y: number) => void;
}) {
  const here = roster.filter((id) => live.current.get(id)?.scene === scene);
  return (
    <>
      {here.map((id) => (
        <RemoteView key={id} id={id} live={live} groundAt={groundAt} onClick={onClick} />
      ))}
    </>
  );
}

/** Your own chat bubble, over your head. */
export function SelfBubble({ bubbleRef, positionRef }: { bubbleRef: MutableRefObject<{ text: string; until: number } | null>; positionRef: MutableRefObject<THREE.Vector3> }) {
  const s = useRef<THREE.Sprite>(null);
  const shown = useRef<string | null>(null);
  const tex = useRef<THREE.CanvasTexture | null>(null);
  useEffect(() => () => tex.current?.dispose(), []);
  useFrame(() => {
    const sp = s.current;
    if (!sp) return;
    const b = bubbleRef.current;
    const text = b && b.until > performance.now() ? b.text : null;
    if (text !== shown.current) {
      shown.current = text;
      tex.current?.dispose();
      tex.current = text ? labelTexture(text.length > 60 ? `${text.slice(0, 58)}…` : text, '#f2f2eeee', '#14171f') : null;
      const mat = sp.material as THREE.SpriteMaterial;
      mat.map = tex.current;
      mat.needsUpdate = true;
      if (tex.current) sp.scale.set((tex.current.image as HTMLCanvasElement).width / 240, 0.35, 1);
    }
    sp.visible = !!text;
    const p = positionRef.current;
    sp.position.set(p.x, p.y + 2.5, p.z);
  });
  return (
    <sprite ref={s} visible={false} raycast={() => null}>
      <spriteMaterial depthTest={false} transparent />
    </sprite>
  );
}
