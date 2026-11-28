import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { INTERIORS, POLICE_CELL, POLICE_CELL_XS, POLICE_DESK, POLICE_HALL, POLICE_PLAYER_CELL_X } from '../../../game/interiors/interiors';
import { Humanoid, type HumanBones, type Outfit } from '../humanoid/Humanoid';
import { poseLocomotion, resetPose } from '../humanoid/animate';
import { Box, Cutaway, TextPanel, WallFromRect, useTileTexture } from './kit';

const WALL_H = 3.4;
const COP: Outfit = { top: '#1f2a44', legs: '#1b2233', shoes: '#111', hair: '#3a2a1e', hairStyle: 'buzz', hat: 'cap', hatColor: '#1f2a44', accent: '#c8d0e0', style: 'jacket' };

function Officer({ p, yaw, outfit = COP, look = 0 }: { p: [number, number]; yaw: number; outfit?: Outfit; look?: number }) {
  const bones = useRef<HumanBones | null>(null);
  useFrame(({ clock }) => {
    const b = bones.current;
    if (!b) return;
    resetPose(b);
    poseLocomotion(b, 0, 0, clock.elapsedTime + p[0]);
    if (look) b.head.rotation.y = Math.sin(clock.elapsedTime * 0.4 + look) * 0.5;
  });
  return (
    <group position={[p[0], 0, p[1]]} rotation-y={yaw}>
      <Humanoid bonesRef={bones} outfit={outfit} />
    </group>
  );
}

/** Bars across one holding cell's front. */
function CellBars({ x, open }: { x: number; open: boolean }) {
  const w = 4.2;
  return (
    <group position={[x, 0, POLICE_CELL.maxZ]}>
      <Box p={[0, WALL_H - 0.08, 0]} s={[w, 0.12, 0.14]} color="#5a5f66" metal={0.8} rough={0.35} />
      <Box p={[0, 0.06, 0]} s={[w, 0.12, 0.14]} color="#5a5f66" metal={0.8} rough={0.35} />
      {Array.from({ length: 15 }, (_, i) => -w / 2 + 0.14 + i * ((w - 0.28) / 14)).map((bx, i) =>
        open && i > 4 && i < 10 ? null : <Box key={i} p={[bx, WALL_H / 2, 0]} s={[0.05, WALL_H - 0.1, 0.05]} color="#7a7f86" metal={0.9} rough={0.3} />,
      )}
    </group>
  );
}

/** Keravan poliisiasema: lobby with the front desk and the holding cells (putka). */
export function PoliceInterior({ cellOpen }: { cellOpen: boolean }) {
  const floor = useTileTexture('#c9ccd2', '#b8bcc4', 12, [6, 4], '#00000022');
  const def = INTERIORS.police;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
        <planeGeometry args={[POLICE_HALL.maxX - POLICE_HALL.minX, POLICE_HALL.maxZ - POLICE_HALL.minZ]} />
        <meshStandardMaterial map={floor} roughness={0.6} />
      </mesh>
      {/* outer walls, cell dividers, archive, corridor wall */}
      {def.solids.slice(0, 5).map((r, i) => (
        <WallFromRect key={i} r={r} h={WALL_H} color="#e4e6ea" room={[0, 0]} />
      ))}
      {def.solids.slice(5, 11).map((r, i) => (
        <WallFromRect key={`c${i}`} r={r} h={WALL_H} color="#a9aeb6" room={[0, 0]} />
      ))}
      {def.solids.slice(14, 16).map((r, i) => (
        <WallFromRect key={`w${i}`} r={r} h={1.05} color="#2a3550" room={[0, 2]} />
      ))}
      {/* corridor window strip above the wall */}
      <Box p={[-2.1, 1.75, -1]} s={[19.8, 1.4, 0.05]} color="#cfe6f2" opacity={0.22} cast={false} />
      {/* cells: bunks, toilets, bars */}
      {POLICE_CELL_XS.map((x) => (
        <group key={x}>
          <Box p={[x - 1.4, 0.45, -6.6]} s={[1.1, 0.12, 2.4]} color="#6f7680" />
          <Box p={[x - 1.4, 0.55, -7.5]} s={[0.9, 0.12, 0.5]} color="#2a5a8a" />
          <Box p={[x + 1.5, 0.3, -7.5]} s={[0.5, 0.6, 0.6]} color="#c9ccd2" metal={0.9} rough={0.2} />
          <CellBars x={x} open={x === POLICE_PLAYER_CELL_X && cellOpen} />
          <TextPanel p={[x, 2.95, POLICE_CELL.maxZ + 0.09]} w={0.9} h={0.3} text={`PUTKA ${POLICE_CELL_XS.indexOf(x) + 1}`} bg="#14171f" fg="#ffd23f" />
        </group>
      ))}
      {/* archive shelves */}
      {[7.6, 9.4, 11.2].map((x) => (
        <Box key={x} p={[x, 1.1, -6]} s={[0.5, 2.2, 3.4]} color="#5a5f66" metal={0.4} />
      ))}
      {/* front desk with screens */}
      <Box p={[POLICE_DESK[0], 0.55, POLICE_DESK[1]]} s={[5.6, 1.1, 1.2]} color="#2a3550" />
      <Box p={[POLICE_DESK[0], 1.12, POLICE_DESK[1]]} s={[5.8, 0.06, 1.3]} color="#c9ccd2" />
      <Box p={[POLICE_DESK[0], 1.6, POLICE_DESK[1] + 0.62]} s={[5.6, 0.9, 0.04]} color="#d8ecf6" opacity={0.3} cast={false} />
      {[-1.6, 1.6].map((dx) => (
        <Box key={dx} p={[POLICE_DESK[0] + dx, 1.4, POLICE_DESK[1] - 0.2]} s={[0.6, 0.4, 0.04]} color="#0d1118" emissive="#26407a" />
      ))}
      <Officer p={[POLICE_DESK[0], POLICE_DESK[1] - 1.1]} yaw={0} look={1} />
      <Officer p={[-6, -2.2]} yaw={Math.PI / 2} look={2} />
      {/* waiting benches */}
      <Box p={[-10, 0.45, 5.5]} s={[1.0, 0.1, 3.8]} color="#2a3550" />
      <Box p={[-10.9, 0.9, 5.5]} s={[0.1, 0.9, 3.8]} color="#2a3550" />
      {/* signs */}
      <Cutaway axis="z" at={POLICE_HALL.maxZ} outward={1}>
        <TextPanel p={[8, 3.0, POLICE_HALL.maxZ - 0.25]} rotY={Math.PI} w={2.8} h={0.4} text="ULOS · EXIT" bg="#1f7a3a" />
      </Cutaway>
      <TextPanel p={[POLICE_DESK[0], 2.85, POLICE_DESK[1] - 0.2]} w={3.6} h={0.5} text="POLIISI · PALVELU" bg="#1f3f8f" />
      <TextPanel p={[-11.75, 2.1, 3]} rotY={Math.PI / 2} w={3.2} h={1.6} text={'ILMOITA RIKOKSESTA\nNETISSÄ TAI\nPÄIVYSTYKSESSÄ 24/7'} bg="#e4e6ea" fg="#1f3f8f" />
      <pointLight position={[0, 3, -5.5]} intensity={8} distance={14} color="#e8f0ff" />
      <pointLight position={[2, 3, 4]} intensity={10} distance={16} color="#fff4e0" />
    </group>
  );
}
