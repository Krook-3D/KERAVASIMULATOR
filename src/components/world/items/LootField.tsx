import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LootSpot } from '../../../game/world/loot';
import { ITEMS, RARITY_COLORS, itemName } from '../../../data/items';
import { createTextTexture } from '../textTexture';
import { buildItemModel, disposeItemModel } from './itemModels';

const SHOW_RADIUS = 110;
const LABEL_RADIUS = 16;

/** One item lying on the ground: the model flat on the grass, a rarity ring and (rare+) a light beam. */
function LootPickup({ spot, label, onClick }: { spot: LootSpot; label: boolean; onClick: () => void }) {
  const model = useMemo(() => buildItemModel(spot.itemId), [spot.itemId]);
  useEffect(() => () => disposeItemModel(model), [model]);
  const spin = useRef<THREE.Group>(null);
  const rarity = ITEMS[spot.itemId]?.rarity ?? 'common';
  const color = RARITY_COLORS[rarity];
  const beam = rarity === 'rare' || rarity === 'epic' || rarity === 'legendary';
  const tex = useMemo(
    () => (label ? createTextTexture(itemName(spot.itemId), { width: 512, height: 96, bg: '#14171fcc', fg: color, font: '700 44px Rubik, Arial, sans-serif' }) : null),
    [label, spot.itemId, color],
  );
  useEffect(() => () => tex?.dispose(), [tex]);
  const phase = (spot.x * 13.1 + spot.z * 7.7) % 6.28;
  useFrame(({ clock }) => {
    const g = spin.current;
    if (!g) return;
    const t = clock.elapsedTime + phase;
    g.position.y = 0.32 + Math.sin(t * 2) * 0.06;
    g.rotation.y = t * 0.9;
  });
  const hit = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onClick();
  };
  return (
    <group position={[spot.x, spot.y, spot.z]}>
      <group ref={spin} scale={2.2}>
        <primitive object={model} rotation-x={Math.PI / 2.4} />
      </group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.05} onClick={hit}>
        <ringGeometry args={[0.35, 0.6, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* bigger invisible click target */}
      <mesh position-y={0.4} onClick={hit} visible={false}>
        <cylinderGeometry args={[0.7, 0.7, 0.9, 8]} />
      </mesh>
      {beam && (
        <mesh position-y={2.2} raycast={() => null}>
          <cylinderGeometry args={[0.05, 0.22, 4.4, 10, 1, true]} />
          <meshBasicMaterial color={color} transparent opacity={rarity === 'legendary' ? 0.5 : 0.3} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {tex && (
        <sprite position-y={1.3} scale={[2.0, 0.38, 1]}>
          <spriteMaterial map={tex} depthTest={false} transparent />
        </sprite>
      )}
    </group>
  );
}

/** World loot near the player (far spots are not mounted at all). */
export function LootField({ spots, taken, playerRef, onPick }: { spots: LootSpot[]; taken: string[]; playerRef: MutableRefObject<THREE.Vector3>; onPick: (s: LootSpot) => void }) {
  const [near, setNear] = useState<{ ids: string[]; labels: string[] }>({ ids: [], labels: [] });
  const last = useRef(-1);
  const takenSet = useMemo(() => new Set(taken), [taken]);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.6) return;
    last.current = clock.elapsedTime;
    const p = playerRef.current;
    const ids: string[] = [], labels: string[] = [];
    for (const s of spots) {
      if (takenSet.has(s.id)) continue;
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < SHOW_RADIUS) ids.push(s.id);
      if (d < LABEL_RADIUS) labels.push(s.id);
    }
    const key = (a: string[]) => a.join(',');
    setNear((prev) => (key(prev.ids) === key(ids) && key(prev.labels) === key(labels) ? prev : { ids, labels }));
  });
  const byId = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots]);
  return (
    <group>
      {near.ids.map((id) => {
        const s = byId.get(id);
        if (!s || takenSet.has(id)) return null;
        return <LootPickup key={id} spot={s} label={near.labels.includes(id)} onClick={() => onPick(s)} />;
      })}
    </group>
  );
}
