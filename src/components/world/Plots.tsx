import * as THREE from 'three';
import type { WorldXZ } from '../../game/world/projection';
import { houseHalf, type Plot, type PlotState } from '../../game/world/plots';
import { Box, TextPanel } from './interiors/kit';

const WOOD = '#c9a36a';
const FALU = '#9b2d20';
const TRIM = '#f2efe6';
const fmt = (n: number) => n.toLocaleString('fi-FI');

/** Building plots: stakes and a sign on the ones for sale, your house on your own. */
export function Plots({ plots, owned, groundAt, onClick }: {
  plots: Plot[];
  owned: Record<string, PlotState>;
  groundAt: (x: number, z: number) => number;
  onClick: (p: WorldXZ) => void;
}) {
  return (
    <>
      {plots.map((p) => (
        <PlotModel key={p.id} plot={p} state={owned[p.id]} y={groundAt(p.at[0], p.at[1])} onClick={() => onClick(p.sign)} />
      ))}
    </>
  );
}

function PlotModel({ plot, state, y, onClick }: { plot: Plot; state?: PlotState; y: number; onClick: () => void }) {
  const h = plot.size / 2;
  const yaw = Math.atan2(plot.front[0], plot.front[1]); // local +z = street side
  const mine = !!state;
  const stage = state?.stage ?? 0;
  const rope = mine ? '#ffd23f' : '#e8e2d0';
  return (
    <group position={[plot.at[0], y, plot.at[1]]} rotation-y={yaw}>
      {/* corner stakes and the rope between them */}
      {[[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, z]) => (
        <Box key={`${x}${z}`} p={[x!, 0.4, z!]} s={[0.1, 0.8, 0.1]} color="#d24a2a" />
      ))}
      <Box p={[0, 0.6, -h]} s={[plot.size, 0.03, 0.03]} color={rope} cast={false} />
      <Box p={[0, 0.6, h]} s={[plot.size, 0.03, 0.03]} color={rope} cast={false} />
      <Box p={[-h, 0.6, 0]} s={[0.03, 0.03, plot.size]} color={rope} cast={false} />
      <Box p={[h, 0.6, 0]} s={[0.03, 0.03, plot.size]} color={rope} cast={false} />
      {/* sign at the street side */}
      <group position={[0, 0, h - 0.8]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <Box p={[-0.7, 0.8, 0]} s={[0.08, 1.6, 0.08]} color="#6b4a2b" />
        <Box p={[0.7, 0.8, 0]} s={[0.08, 1.6, 0.08]} color="#6b4a2b" />
        <TextPanel
          p={[0, 1.55, 0.05]}
          w={1.8}
          h={0.9}
          text={mine ? 'OMA\nTONTTI' : `MYYTÄVÄNÄ\n${fmt(plot.price)} €\n${plot.size}×${plot.size} m`}
          bg={mine ? '#2e7d4f' : '#c8312b'}
        />
        <TextPanel p={[0, 1.55, -0.05]} rotY={Math.PI} w={1.8} h={0.9} text={mine ? 'OMA\nTONTTI' : 'MYYTÄVÄNÄ'} bg={mine ? '#2e7d4f' : '#c8312b'} />
      </group>
      {mine && stage > 0 && <House size={plot.size} stage={stage} />}
    </group>
  );
}

/** The house, as far as it has been built (1 slab, 2 walls, 3 roof, 4 windows + paint). */
function House({ size, stage }: { size: number; stage: number }) {
  const [hw, hd] = houseHalf(size);
  const wallH = 2.8;
  const done = stage >= 4;
  const wall = done ? FALU : WOOD;
  const t = 0.18;
  const roofRise = 1.6;
  const slope = Math.atan2(roofRise, hw + 0.4);
  const roofLen = Math.hypot(hw + 0.4, roofRise);
  return (
    <group>
      <Box p={[0, 0.15, 0]} s={[hw * 2 + 0.6, 0.3, hd * 2 + 0.6]} color="#a7a49c" />
      {stage >= 2 && (
        <group position-y={0.3}>
          <Box p={[0, wallH / 2, hd - t / 2]} s={[hw * 2, wallH, t]} color={wall} />
          <Box p={[0, wallH / 2, -hd + t / 2]} s={[hw * 2, wallH, t]} color={wall} />
          <Box p={[hw - t / 2, wallH / 2, 0]} s={[t, wallH, hd * 2]} color={wall} />
          <Box p={[-hw + t / 2, wallH / 2, 0]} s={[t, wallH, hd * 2]} color={wall} />
          {!done &&
            // visible studs on the unfinished frame
            Array.from({ length: Math.floor(hw * 2 / 1.2) + 1 }, (_, i) => -hw + i * 1.2).map((x) => (
              <Box key={x} p={[x, wallH / 2, hd + 0.02]} s={[0.07, wallH, 0.06]} color="#a8814d" />
            ))}
        </group>
      )}
      {stage >= 3 && (
        <group position-y={0.3 + wallH}>
          {/* gable roof, ridge along local z */}
          <group position={[-(hw + 0.4) / 2, roofRise / 2, 0]} rotation-z={slope}>
            <Box p={[0, 0, 0]} s={[roofLen, 0.12, hd * 2 + 0.8]} color="#3b3f46" metal={0.5} />
          </group>
          <group position={[(hw + 0.4) / 2, roofRise / 2, 0]} rotation-z={-slope}>
            <Box p={[0, 0, 0]} s={[roofLen, 0.12, hd * 2 + 0.8]} color="#3b3f46" metal={0.5} />
          </group>
          {/* gable ends */}
          {[hd - 0.09, -hd + 0.09].map((z) => (
            <mesh key={z} position={[0, 0, z]}>
              <extrudeGeometry args={[gable(hw, roofRise), { depth: 0.12, bevelEnabled: false }]} />
              <meshStandardMaterial color={wall} roughness={0.8} />
            </mesh>
          ))}
        </group>
      )}
      {done && (
        <group position-y={0.3}>
          {/* door and windows on the street side, windows round the back too */}
          <Box p={[0, 1.05, hd + 0.03]} s={[1.0, 2.1, 0.06]} color="#3a2a1c" />
          <Box p={[0, 1.05, hd + 0.02]} s={[1.2, 2.25, 0.04]} color={TRIM} />
          {[-hw * 0.55, hw * 0.55].map((x) => (
            <group key={x}>
              <Box p={[x, 1.55, hd + 0.03]} s={[1.3, 1.1, 0.05]} color={TRIM} />
              <Box p={[x, 1.55, hd + 0.05]} s={[1.1, 0.9, 0.04]} color="#9fc6dc" rough={0.1} metal={0.5} />
              <Box p={[x, 1.55, -hd - 0.03]} s={[1.3, 1.1, 0.05]} color={TRIM} />
              <Box p={[x, 1.55, -hd - 0.05]} s={[1.1, 0.9, 0.04]} color="#9fc6dc" rough={0.1} metal={0.5} />
            </group>
          ))}
          {/* corner boards */}
          {[[-hw, hd], [hw, hd], [-hw, -hd], [hw, -hd]].map(([x, z]) => (
            <Box key={`${x}${z}`} p={[x!, 1.4, z!]} s={[0.16, 2.8, 0.16]} color={TRIM} />
          ))}
          {/* steps */}
          <Box p={[0, -0.1, hd + 0.6]} s={[1.6, 0.25, 0.9]} color="#a7a49c" />
        </group>
      )}
    </group>
  );
}

const gableCache = new Map<string, THREE.Shape>();
function gable(hw: number, rise: number): THREE.Shape {
  const k = `${hw}:${rise}`;
  let s = gableCache.get(k);
  if (!s) {
    s = new THREE.Shape();
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(0, rise);
    s.closePath();
    gableCache.set(k, s);
  }
  return s;
}
