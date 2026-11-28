import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MARKET } from '../../../shared/economy';
import { onlineApi } from '../../services/online';
import { itemLabel } from './GameWorld/systems/useOnline';
import { defaultAppearance, type Appearance } from '../../game/player/appearance';
import { Humanoid, type HumanBones } from './humanoid/Humanoid';
import { poseLocomotion, resetPose } from './humanoid/animate';
import { playerOutfit } from './PlayerCharacter';
import { Box, TextPanel } from './interiors/kit';

/** Pavilion layout in local metres around MARKET.at (+z is the open, south side). */
export const PORSSI_LAYOUT = {
  canopy: { w: 18, d: 12, h: 4.4 },
  counter: { x: 0, z: -2.2, w: 10, d: 0.9 },
  stall: { x: 11.5, z: 0.5, w: 4.2, d: 1.4 },
};
/** Where you stand to use the counter and the NPC stall (world XZ). */
export const PORSSI_COUNTER: [number, number] = [MARKET.at.x, MARKET.at.z - 0.9];
export const PORSSI_STALL: [number, number] = [MARKET.at.x + PORSSI_LAYOUT.stall.x, MARKET.at.z + PORSSI_LAYOUT.stall.z + 1.5];

const STEEL = '#3b4048';
const GLASS = '#9fc6dc';

function Broker({ at, rotY, look, phase }: { at: [number, number, number]; rotY: number; look: Partial<Appearance>; phase: number }) {
  const bones = useRef<HumanBones | null>(null);
  const outfit = useMemo(() => playerOutfit('#23262d', { ...defaultAppearance(), ...look }), [look]);
  useFrame((s) => {
    const b = bones.current;
    if (!b) return;
    resetPose(b);
    poseLocomotion(b, 0, 0, s.clock.elapsedTime + phase);
    b.head.rotation.y = Math.sin(s.clock.elapsedTime * 0.4 + phase) * 0.5;
  });
  return (
    <group position={at} rotation-y={rotY}>
      <Humanoid outfit={outfit} bonesRef={bones} />
    </group>
  );
}

const BROKERS: { at: [number, number, number]; look: Partial<Appearance> }[] = [
  { at: [-2.5, 0, -3.1], look: { skin: '#c98d63', hair: '#141010', hairStyle: 'buzz', glasses: true } },
  { at: [2.6, 0, -3.1], look: { skin: '#f6d3b8', hair: '#d8b070', hairStyle: 'ponytail', top: '#2e3b55', legs: '#2e3b55', accent: '#3a7bd5' } },
];

/** The price board as a sharp, left-aligned text screen. */
function PriceBoard({ text, p, w, h }: { text: string; p: [number, number, number]; w: number; h: number }) {
  const tex = useMemo(() => {
    const W = 1024, H = Math.round((W * h) / w);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0d1a12';
    g.fillRect(0, 0, W, H);
    const lines = text.split('\n');
    const lh = H / (lines.length + 0.6);
    g.textBaseline = 'middle';
    lines.forEach((l, i) => {
      g.font = `${i === 0 ? 800 : 700} ${Math.round(lh * 0.62)}px 'Courier New', monospace`;
      g.fillStyle = i === 0 ? '#ffd23f' : '#5ee07a';
      g.fillText(l, 28, lh * (i + 0.8));
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [text, w, h]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={p}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

/** The board rows: busiest items first, refreshed every 30 s. */
function useBoard() {
  const [text, setText] = useState('KERAVA-PÖRSSI\nHinnat päivittyvät…');
  useEffect(() => {
    let live = true;
    const load = () =>
      onlineApi
        .market()
        .then((r) => {
          if (!live) return;
          const top = [...r.items].sort((a, b) => b.volume24h - a.volume24h || Number(b.ask !== null) - Number(a.ask !== null)).slice(0, 6);
          const f = (c: number | null) => (c === null ? '–' : (c / 100).toFixed(2).replace('.', ','));
          const row = (a: string, b: string, c: string) => `${a.slice(0, 16).padEnd(17)}${b.padStart(7)}${c.padStart(8)}`;
          setText([row('KERAVA-PÖRSSI', 'OSTO', 'MYYNTI'), ...top.map((i) => row(itemLabel(i.itemId), f(i.bid), f(i.ask)))].join('\n'));
        })
        .catch(() => live && setText('KERAVA-PÖRSSI\nKirjaudu verkkopeliin'));
    void load();
    const id = window.setInterval(load, 30_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);
  return text;
}

/**
 * Kerava-Pörssi on the tori: a steel and glass canopy over the brokers'
 * counter, a big price board, and the Torikauppias stall beside it.
 */
export function PorssiPavilion({ groundAt, playerRef, onUse }: {
  groundAt: (x: number, z: number) => number;
  playerRef: MutableRefObject<THREE.Vector3>;
  onUse: (tab: 'board' | 'npc') => void;
}) {
  const { canopy, counter, stall } = PORSSI_LAYOUT;
  const y = groundAt(MARKET.at.x, MARKET.at.z);
  const board = useBoard();
  const posts: [number, number][] = [];
  for (const x of [-canopy.w / 2, 0, canopy.w / 2]) for (const z of [-canopy.d / 2, canopy.d / 2]) posts.push([x, z]);
  void playerRef;
  return (
    <group position={[MARKET.at.x, y, MARKET.at.z]}>
      {/* granite paving under the pavilion */}
      <Box p={[0, 0.06, 0]} s={[canopy.w + 2, 0.12, canopy.d + 2]} color="#8d8f94" cast={false} />
      {posts.map(([x, z]) => (
        <Box key={`${x}:${z}`} p={[x, canopy.h / 2, z]} s={[0.28, canopy.h, 0.28]} color={STEEL} metal={0.6} rough={0.4} />
      ))}
      {/* canopy: steel frame with a glass roof, tilted a little to the south */}
      <group position={[0, canopy.h + 0.15, 0]} rotation-x={-0.06}>
        <Box p={[0, 0, 0]} s={[canopy.w + 1.2, 0.22, canopy.d + 1.2]} color={STEEL} metal={0.6} rough={0.4} />
        <Box p={[0, 0.14, 0]} s={[canopy.w + 0.6, 0.06, canopy.d + 0.6]} color={GLASS} metal={0.3} rough={0.1} opacity={0.55} cast={false} />
        {[-6, -3, 0, 3, 6].map((x) => <Box key={x} p={[x, 0.2, 0]} s={[0.12, 0.12, canopy.d + 1]} color={STEEL} metal={0.6} cast={false} />)}
      </group>
      <TextPanel p={[0, canopy.h + 0.75, canopy.d / 2 + 0.62]} w={7} h={0.75} text="📈 KERAVA-PÖRSSI" bg="#14171f" fg="#ffd23f" glow />
      <TextPanel p={[0, canopy.h + 0.75, -canopy.d / 2 - 0.62]} rotY={Math.PI} w={7} h={0.75} text="KERAVA-PÖRSSI" bg="#14171f" fg="#ffd23f" glow />

      {/* brokers' counter (click to trade) */}
      <group onClick={(e) => { e.stopPropagation(); onUse('board'); }}>
        <Box p={[counter.x, 0.55, counter.z]} s={[counter.w, 1.1, counter.d]} color="#2b2f36" />
        <Box p={[counter.x, 1.13, counter.z + 0.05]} s={[counter.w + 0.2, 0.07, counter.d + 0.25]} color="#d8d2c4" rough={0.3} />
        {[-3.5, 0, 3.5].map((x) => (
          <group key={x}>
            <Box p={[x, 1.38, counter.z - 0.2]} s={[0.7, 0.45, 0.04]} color="#14171f" />
            <Box p={[x, 1.38, counter.z - 0.17]} s={[0.62, 0.37, 0.02]} color="#2e7d4f" emissive="#1c5a35" cast={false} />
          </group>
        ))}
        <TextPanel p={[0, 0.7, counter.z + counter.d / 2 + 0.01]} w={4} h={0.45} text="TARJOUKSET · NOUTO" bg="#2b2f36" fg="#f2efe6" />
      </group>
      {BROKERS.map((b, i) => <Broker key={i} at={b.at} rotY={0} look={b.look} phase={i * 2.1} />)}

      {/* the big price board behind the brokers */}
      <Box p={[0, 2.5, -canopy.d / 2 + 0.3]} s={[9, 3.4, 0.25]} color="#14171f" />
      <PriceBoard text={board} p={[0, 2.5, -canopy.d / 2 + 0.44]} w={8.6} h={3.0} />

      {/* Torikauppias: a market stall with a striped awning */}
      <group position={[stall.x, 0, stall.z]} onClick={(e) => { e.stopPropagation(); onUse('npc'); }}>
        <Box p={[0, 0.5, 0]} s={[stall.w, 1.0, stall.d]} color="#8a5a32" />
        <Box p={[0, 1.03, 0.05]} s={[stall.w + 0.1, 0.06, stall.d + 0.2]} color="#c9a36a" />
        {[-1, 1].map((sx) => <Box key={sx} p={[sx * (stall.w / 2 - 0.1), 1.4, -0.6]} s={[0.1, 2.8, 0.1]} color="#6b4a2b" />)}
        {Array.from({ length: 7 }, (_, i) => (
          <Box key={i} p={[-stall.w / 2 + (i + 0.5) * (stall.w / 7), 2.75, 0.1]} s={[stall.w / 7, 0.06, 2.2]} color={i % 2 ? '#f2efe6' : '#c8312b'} cast={i === 0} />
        ))}
        {/* goods on the counter */}
        {[['#ffd23f', -1.4], ['#9b2d20', -0.6], ['#5ee07a', 0.2], ['#c9a36a', 1.0], ['#3a7bd5', 1.6]].map(([c, x]) => (
          <Box key={String(x)} p={[Number(x), 1.2, 0.1]} s={[0.45, 0.28, 0.4]} color={String(c)} />
        ))}
        <TextPanel p={[0, 2.35, 0.75]} w={2.6} h={0.5} text="TORIKAUPPIAS" bg="#f2efe6" fg="#9b2d20" />
        <Broker at={[0, 0, -1.2]} rotY={0} look={{ top: '#6b4a2e', topStyle: 'jacket', legs: '#2e3b55', hat: 'cap', hatColor: '#9b2d20', skin: '#e0a982', hair: '#9a9a9a', facialHair: 'beard' }} phase={4} />
      </group>
    </group>
  );
}
