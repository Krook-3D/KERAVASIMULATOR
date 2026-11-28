import * as THREE from 'three';
import type { WorldXZ } from '../../game/world/projection';
import { houseColor, houseHalf, type Plot, type PlotState } from '../../game/world/plots';
import { Box, InstancedBoxes, TextPanel } from './interiors/kit';

const WOOD = '#c9a36a';
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
          text={mine ? (state?.rentFrom ? 'VUOKRALLA' : stage >= 4 ? 'KOTI' : 'OMA\nTONTTI') : `MYYTÄVÄNÄ\n${fmt(plot.price)} €\n${plot.size}×${plot.size} m`}
          bg={mine ? '#2e7d4f' : '#c8312b'}
        />
        <TextPanel p={[0, 1.55, -0.05]} rotY={Math.PI} w={1.8} h={0.9} text={mine ? 'OMA\nTONTTI' : 'MYYTÄVÄNÄ'} bg={mine ? '#2e7d4f' : '#c8312b'} />
      </group>
      {mine && stage > 0 && <House size={plot.size} stage={stage} color={state?.color} solar={!!state?.upgrades?.includes('aurinko')} />}
      {mine && stage >= 4 && <Yard size={plot.size} upgrades={state?.upgrades ?? []} />}
    </group>
  );
}

/** The house, as far as it has been built (1 slab, 2 walls, 3 roof, 4 windows + paint). */
function House({ size, stage, color, solar }: { size: number; stage: number; color?: string; solar: boolean }) {
  const [hw, hd] = houseHalf(size);
  const wallH = 2.8;
  const done = stage >= 4;
  const paint = houseColor(color);
  const wall = done ? paint.wall : WOOD;
  const TRIM = paint.trim;
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
          {solar &&
            // solar panels on the south-ish (local +x) slope
            [-1, 1].map((k) => (
              <group key={k} position={[(hw + 0.4) / 2, roofRise / 2 + 0.12, k * hd * 0.45]} rotation-z={-slope}>
                <Box p={[0, 0, 0]} s={[roofLen * 0.7, 0.05, hd * 0.8]} color="#1c2a4a" metal={0.6} rough={0.2} />
                <Box p={[0, 0.03, 0]} s={[roofLen * 0.72, 0.02, 0.04]} color="#c8ccd2" metal={0.8} cast={false} />
              </group>
            ))}
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

/** The yard around a finished house: flower beds, terrace, fence, sauna, garage. */
function Yard({ size, upgrades }: { size: number; upgrades: string[] }) {
  const [hw, hd] = houseHalf(size);
  const h = size / 2;
  const has = (id: string) => upgrades.includes(id);
  const fence: [number, number, number, number][] = []; // x, z, length, rotY
  if (has('aita')) {
    const gate = 2.4;
    fence.push([0, -h + 0.2, size - 0.4, 0], [-h + 0.2, 0, size - 0.4, Math.PI / 2], [h - 0.2, 0, size - 0.4, Math.PI / 2]);
    const side = (size - gate) / 2 - 0.2;
    fence.push([-(gate / 2 + side / 2), h - 0.2, side, 0], [gate / 2 + side / 2, h - 0.2, side, 0]);
  }
  const pickets: { p: [number, number, number]; s: [number, number, number]; c: string }[] = [];
  for (const [x, z, len, r] of fence) {
    const n = Math.max(2, Math.floor(len / 0.34));
    const along = r === 0;
    for (let j = 0; j < n; j++) {
      const o = -len / 2 + (j + 0.5) * (len / n);
      pickets.push({ p: along ? [x + o, 0.55, z + 0.04] : [x + 0.04, 0.55, z + o], s: along ? [0.1, 1.1, 0.03] : [0.03, 1.1, 0.1], c: '#f2efe6' });
    }
  }
  return (
    <group>
      {has('piha') &&
        [-1, 1].map((k) => (
          <group key={k} position={[k * (hw * 0.55), 0, hd + 1.4]}>
            <Box p={[0, 0.12, 0]} s={[2.2, 0.24, 0.9]} color="#6b4a2b" />
            <Box p={[0, 0.25, 0]} s={[2.0, 0.04, 0.75]} color="#3d2a1c" cast={false} />
            {Array.from({ length: 7 }, (_, i) => (
              <group key={i} position={[-0.85 + i * 0.28, 0.25, (i % 2) * 0.22 - 0.11]}>
                <Box p={[0, 0.14, 0]} s={[0.03, 0.28, 0.03]} color="#3f7a35" cast={false} />
                <Box p={[0, 0.3, 0]} s={[0.11, 0.1, 0.11]} color={['#e23b3b', '#ffd23f', '#f2efe6', '#e87ac0'][i % 4]!} cast={false} />
              </group>
            ))}
          </group>
        ))}
      {has('terassi') && (
        <group position={[hw + 1.6, 0, 0.6]}>
          <Box p={[0, 0.22, 0]} s={[3, 0.12, hd * 2 - 0.4]} color="#a87b4e" />
          {Array.from({ length: Math.floor((hd * 2 - 0.4) / 0.3) }, (_, i) => (
            <Box key={i} p={[0, 0.29, -hd + 0.35 + i * 0.3]} s={[2.96, 0.02, 0.02]} color="#7d5a36" cast={false} />
          ))}
          {/* table and two chairs */}
          <Box p={[0.2, 0.75, 0]} s={[0.9, 0.05, 0.9]} color="#f2efe6" />
          <Box p={[0.2, 0.52, 0]} s={[0.06, 0.45, 0.06]} color="#c8ccd2" />
          {[-0.75, 0.75].map((z) => <Box key={z} p={[0.2, 0.5, z]} s={[0.45, 0.06, 0.45]} color="#2e3b55" />)}
        </group>
      )}
      {fence.map(([x, z, len, r], i) => (
        <group key={i} position={[x, 0, z]} rotation-y={r}>
          <Box p={[0, 0.85, 0]} s={[len, 0.08, 0.05]} color="#e8e2d4" cast={false} />
          <Box p={[0, 0.4, 0]} s={[len, 0.08, 0.05]} color="#e8e2d4" cast={false} />
        </group>
      ))}
      {pickets.length > 0 && <InstancedBoxes items={pickets} />}
      {has('sauna') && (
        <group position={[-h + 3.2, 0, -h + 3]}>
          <Box p={[0, 0.15, 0]} s={[3.4, 0.3, 2.8]} color="#a7a49c" />
          <Box p={[0, 1.4, 0]} s={[3, 2.2, 2.4]} color="#7a5232" />
          <Box p={[0, 2.62, 0]} s={[3.5, 0.22, 2.9]} color="#3b3f46" metal={0.4} />
          <Box p={[0.9, 3.1, -0.5]} s={[0.3, 0.9, 0.3]} color="#4a4a52" metal={0.5} />
          <Box p={[0, 1.15, 1.22]} s={[0.75, 1.7, 0.05]} color="#3a2a1c" />
          <Box p={[-0.95, 1.7, 1.22]} s={[0.5, 0.35, 0.05]} color="#9fc6dc" rough={0.1} />
          <TextPanel p={[0, 2.25, 1.24]} w={1.1} h={0.28} text="SAUNA" bg="#5a3a22" fg="#ffd23f" />
        </group>
      )}
      {has('autotalli') && (
        <group position={[-hw - 2.6, 0, 0.4]}>
          <Box p={[0, 0.1, 0]} s={[4, 0.2, 6.2]} color="#a7a49c" />
          <Box p={[0, 1.35, 0]} s={[3.8, 2.5, 6]} color="#a8442f" />
          <Box p={[0, 2.68, 0]} s={[4.2, 0.18, 6.4]} color="#3b3f46" metal={0.5} />
          <Box p={[0, 1.1, 3.02]} s={[2.8, 2, 0.05]} color="#d8dde6" metal={0.3} />
          {[0.35, 0.75, 1.15, 1.55, 1.95].map((y) => <Box key={y} p={[0, y, 3.05]} s={[2.8, 0.03, 0.02]} color="#9aa0a8" cast={false} />)}
          {/* driveway to the street */}
          <Box p={[0, 0.02, 3 + (h - hd - 0.4) / 2]} s={[3, 0.04, Math.max(0.5, h - 3.4)]} color="#6d7076" cast={false} />
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
