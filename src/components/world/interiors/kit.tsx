import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Rect } from '../../../game/interiors/interiors';
import type { WorldXZ } from '../../../game/world/projection';
import { createTextTexture } from '../textTexture';

type V3 = [number, number, number];

export function Box({ p, s, color, rough = 0.8, metal = 0, emissive, cast = true, rotY = 0, opacity }: { p: V3; s: V3; color: string; rough?: number; metal?: number; emissive?: string; cast?: boolean; rotY?: number; opacity?: number }) {
  return (
    <mesh position={p} rotation-y={rotY} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={color}
        roughness={rough}
        metalness={metal}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissive ? 0.9 : 0}
        transparent={opacity !== undefined}
        opacity={opacity ?? 1}
      />
    </mesh>
  );
}

/**
 * A wall from a collision rect, `h` tall. With `room` (the room centre) it is
 * a cutaway wall: when the camera is outside the wall it drops to a low
 * stub so you can always see into the room, RuneScape/Sims style.
 */
export function WallFromRect({ r, h, color, map, cast = false, room, hideLow = false }: { r: Rect; h: number; color: string; map?: THREE.Texture; cast?: boolean; room?: WorldXZ; hideLow?: boolean }) {
  const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
  const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
  const ref = useRef<THREE.Mesh>(null);
  const low = Math.min(h, 0.5);
  useFrame(({ camera }, dt) => {
    const m = ref.current;
    if (!m || !room) return;
    // outward normal along the wall's thin axis
    const alongX = w < d; // thin in x → wall runs along z, normal is ±x
    const nx = alongX ? Math.sign(cx - room[0]) || 1 : 0;
    const nz = alongX ? 0 : Math.sign(cz - room[1]) || 1;
    const outside = (camera.position.x - cx) * nx + (camera.position.z - cz) * nz > 0.2;
    const want = outside ? (hideLow ? 0.001 : low / h) : 1;
    m.scale.y = THREE.MathUtils.lerp(m.scale.y, want, Math.min(1, dt * 10));
    m.position.y = (h * m.scale.y) / 2;
  });
  return (
    <mesh ref={ref} position={[cx, h / 2, cz]} castShadow={cast} receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} map={map ?? null} roughness={0.85} />
    </mesh>
  );
}

/** Canvas texture of square tiles (floors, tunnel walls). */
export function useTileTexture(a: string, b: string, tiles: number, repeat: [number, number], grout = '#00000033', checker = false) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const s = 256 / tiles;
    for (let i = 0; i < tiles; i++)
      for (let j = 0; j < tiles; j++) {
        const alt = checker ? (i + j) % 2 === 1 : Math.random() < 0.12;
        ctx.fillStyle = alt ? b : a;
        ctx.fillRect(i * s, j * s, s, s);
        // slight per-tile variation
        ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.06).toFixed(3)})`;
        ctx.fillRect(i * s, j * s, s, s);
      }
    ctx.strokeStyle = grout;
    ctx.lineWidth = 2;
    for (let i = 0; i <= tiles; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, 256);
      ctx.moveTo(0, i * s);
      ctx.lineTo(256, i * s);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [a, b, tiles, repeat[0], repeat[1], grout, checker]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** Flat text panel (sign, poster, screen). */
export function TextPanel({ p, rotY = 0, w, h, text, bg = '#1f3f8f', fg = '#ffffff', font, glow = false, rotX = 0 }: { p: V3; rotY?: number; rotX?: number; w: number; h: number; text: string; bg?: string; fg?: string; font?: string; glow?: boolean }) {
  const tex = useMemo(
    () => createTextTexture(text, { width: 512, height: Math.max(64, Math.round((512 * h) / w)), bg, fg, font: font ?? `800 ${Math.round(Math.min(72, (512 * h) / w / (text.split('\n').length + 1)))}px Rubik, Arial, sans-serif` }),
    [text, w, h, bg, fg, font],
  );
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={p} rotation={[rotX, rotY, 0]}>
      <planeGeometry args={[w, h]} />
      {glow ? <meshBasicMaterial map={tex} toneMapped={false} /> : <meshStandardMaterial map={tex} roughness={0.6} />}
    </mesh>
  );
}

/** Floor that receives clicks, plus a dark void around the room. */
export function ClickFloor({ r, map, color = '#ffffff', onClick, invisible = false }: { r: Rect; map?: THREE.Texture; color?: string; onClick: (p: WorldXZ) => void; invisible?: boolean }) {
  const handle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    onClick([e.point.x, e.point.z]);
  };
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[(r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2]} receiveShadow onClick={handle}>
        <planeGeometry args={[r.maxX - r.minX + 1.2, r.maxZ - r.minZ + 1.2]} />
        {invisible ? <meshBasicMaterial colorWrite={false} depthWrite={false} /> : <meshStandardMaterial color={color} map={map ?? null} roughness={0.7} />}
      </mesh>
      {!invisible && (
        <mesh rotation-x={-Math.PI / 2} position-y={-0.05}>
          <planeGeometry args={[600, 600]} />
          <meshBasicMaterial color="#101215" />
        </mesh>
      )}
    </group>
  );
}

/** Many small boxes in one draw call (shop products, tiles…). */
export function InstancedBoxes({ items }: { items: { p: V3; s: V3; c: string }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      mat.compose(new THREE.Vector3(...it.p), new THREE.Quaternion(), new THREE.Vector3(...it.s));
      m.setMatrixAt(i, mat);
      m.setColorAt(i, col.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);
  useEffect(() => () => geo.dispose(), [geo]);
  if (!items.length) return null;
  return (
    <instancedMesh ref={ref} args={[geo, undefined, items.length]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.6} />
    </instancedMesh>
  );
}

/** Glowing ring + floating label on a door / exit hotspot. */
export function Hotspot({ at, y = 0, label, onClick }: { at: WorldXZ; y?: number; label: string; onClick?: () => void }) {
  const ring = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => createTextTexture(label, { width: 512, height: 96, bg: '#14171fdd', fg: '#ffd23f', font: '700 46px Rubik, Arial, sans-serif' }), [label]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[at[0], y, at[1]]}>
      <mesh
        ref={ring}
        rotation-x={-Math.PI / 2}
        position-y={0.06}
        onClick={(e) => {
          if (!onClick) return;
          e.stopPropagation();
          onClick();
        }}
      >
        <ringGeometry args={[0.55, 0.85, 32]} />
        <meshBasicMaterial color="#ffd23f" transparent opacity={0.75} toneMapped={false} />
      </mesh>
      <sprite position-y={2.9} scale={[3.2, 0.6, 1]}>
        <spriteMaterial map={tex} depthTest={false} transparent />
      </sprite>
    </group>
  );
}

export type { V3 };

/** Hides its children while the camera is beyond a wall plane (decorations on cutaway walls). */
export function Cutaway({ axis, at, outward, children }: { axis: 'x' | 'z'; at: number; outward: 1 | -1; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (!ref.current) return;
    const c = axis === 'x' ? camera.position.x : camera.position.z;
    ref.current.visible = (c - at) * outward <= 0.2;
  });
  return <group ref={ref}>{children}</group>;
}
