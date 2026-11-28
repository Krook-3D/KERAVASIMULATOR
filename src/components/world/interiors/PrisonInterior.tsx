import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GUARD_DESK, INTERIORS, PLAYER_CELL_X, PRISON_CELL_XS } from '../../../game/interiors/interiors';
import { Box, Cutaway, TextPanel, WallFromRect, useTileTexture } from './kit';

const WALL_H = 3.4;

/** Vertical bars along the front of every cell; the player's cell can be cut open. */
function Bars({ barsCut, progress }: { barsCut: boolean; progress: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.CylinderGeometry(0.025, 0.025, 1, 8), []);
  const bars = useMemo(() => {
    const out: { x: number; h: number; y: number; tilt: number }[] = [];
    for (const cx of PRISON_CELL_XS)
      for (let i = 0; i < 21; i++) {
        const x = cx - 2.4 + i * 0.24;
        const mine = cx === PLAYER_CELL_X && i >= 8 && i <= 12;
        if (mine && barsCut) {
          // cut and bent aside
          out.push({ x, h: 0.25, y: 0.13, tilt: 0 }, { x, h: 0.6, y: WALL_H - 0.4, tilt: (i - 10) * 0.25 });
        } else out.push({ x, h: WALL_H, y: WALL_H / 2, tilt: 0 });
      }
    return out;
  }, [barsCut]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    bars.forEach((b, i) => {
      mat.compose(new THREE.Vector3(b.x, b.y, -1.6), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, b.tilt)), new THREE.Vector3(1, b.h, 1));
      m.setMatrixAt(i, mat);
    });
    m.count = bars.length;
    m.instanceMatrix.needsUpdate = true;
  }, [bars]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <instancedMesh key={bars.length} ref={ref} args={[geo, undefined, bars.length]} castShadow>
        <meshStandardMaterial color="#5a5f68" metalness={0.8} roughness={0.35} />
      </instancedMesh>
      {/* crossbars */}
      {PRISON_CELL_XS.map((cx) => (
        <group key={cx}>
          <Box p={[cx, 1.2, -1.6]} s={[5, 0.06, 0.06]} color="#5a5f68" metal={0.8} rough={0.35} />
          <Box p={[cx, WALL_H - 0.1, -1.6]} s={[5, 0.12, 0.12]} color="#4a4f58" metal={0.8} rough={0.35} />
        </group>
      ))}
      {/* filing marks: bright metal dust under the bars */}
      {!barsCut && progress > 0.05 && (
        <Box p={[PLAYER_CELL_X, 0.012, -1.75]} s={[0.4 + progress * 0.8, 0.01, 0.25]} color="#c8ccd2" metal={0.9} rough={0.2} cast={false} />
      )}
    </group>
  );
}

function Cell({ x, mine }: { x: number; mine: boolean }) {
  const blanket = mine ? '#5a6b8a' : ['#7a5a3a', '#6b8a5a', '#8a5a5a'][Math.abs(x) % 3]!;
  return (
    <group position={[x, 0, 0]}>
      {/* bunk */}
      <Box p={[0.75, 0.25, -5.8]} s={[2.4, 0.5, 1.1]} color="#6b6f76" metal={0.4} />
      <Box p={[0.75, 0.55, -5.8]} s={[2.3, 0.12, 1.0]} color={blanket} rough={1} />
      <Box p={[-0.2, 0.68, -5.8]} s={[0.4, 0.12, 0.7]} color="#e8e4da" rough={1} />
      {/* toilet & sink */}
      <Box p={[-1.9, 0.25, -5.9]} s={[0.5, 0.5, 0.6]} color="#d9dde2" metal={0.6} rough={0.25} />
      <Box p={[-1.9, 0.9, -6.3]} s={[0.5, 0.25, 0.3]} color="#d9dde2" metal={0.6} rough={0.25} />
      {/* small high window with light */}
      <Box p={[0, 2.7, -6.5]} s={[1.0, 0.45, 0.06]} color="#cfe6f2" emissive="#bfe0ff" cast={false} />
      {[-0.3, 0, 0.3].map((dx) => (
        <Box key={dx} p={[dx, 2.7, -6.45]} s={[0.04, 0.45, 0.04]} color="#3a3f47" cast={false} />
      ))}
      {mine && (
        <>
          {/* tally marks on the wall */}
          <TextPanel p={[2.2, 1.6, -4]} rotY={-Math.PI / 2} w={0.8} h={0.4} text="IIII I" bg="#cfd6c4" fg="#3a3a3a" font="700 120px Arial" />
          <Box p={[1.6, 0.03, -3.6]} s={[0.8, 0.02, 0.5]} color="#3a3f6b" cast={false} />
        </>
      )}
    </group>
  );
}

export function PrisonInterior({ barsCut, progress }: { barsCut: boolean; progress: number }) {
  const def = INTERIORS.prison;
  const wallTex = useTileTexture('#cfd6c4', '#c4ccb8', 4, [10, 1], '#00000014');
  return (
    <group>
      {def.solids.slice(0, 5).map((r, i) => (
        <WallFromRect key={i} r={r} h={WALL_H} color="#ffffff" map={wallTex} room={[0, -2.5]} />
      ))}
      {/* cell dividers */}
      {def.solids.slice(5, 10).map((r, i) => (
        <WallFromRect key={`d${i}`} r={r} h={WALL_H} color="#b9c2ad" />
      ))}
      {/* guard room block */}
      <WallFromRect r={def.solids[13]!} h={WALL_H} color="#b9c2ad" />
      <Box p={[12.6, 1.5, -1.62]} s={[3.6, 1.2, 0.05]} color="#cfe6f2" opacity={0.35} cast={false} />
      {PRISON_CELL_XS.map((x) => (
        <Cell key={x} x={x} mine={x === PLAYER_CELL_X} />
      ))}
      <Bars barsCut={barsCut} progress={progress} />
      {/* cell numbers */}
      {PRISON_CELL_XS.map((x, i) => (
        <TextPanel key={x} p={[x, 3.05, -1.4]} w={0.7} h={0.35} text={`B${i + 1}`} bg="#3a3f47" />
      ))}
      {/* guard desk, monitors, chair */}
      <Box p={[13.2, 0.45, -1.3]} s={[2.6, 0.9, 0.6]} color="#5a4a3a" />
      <Box p={[13.6, 1.1, -1.35]} s={[0.6, 0.4, 0.05]} color="#14171f" />
      <Box p={[13.6, 1.1, -1.32]} s={[0.55, 0.35, 0.01]} color="#6fd08a" emissive="#4fbf6a" cast={false} />
      <Box p={[12.7, 1.1, -1.35]} s={[0.6, 0.4, 0.05]} color="#14171f" />
      <Box p={[12.7, 1.1, -1.32]} s={[0.55, 0.35, 0.01]} color="#8fd0ff" emissive="#6fbfff" cast={false} />
      <Box p={[GUARD_DESK[0], 0.45, GUARD_DESK[1] - 0.2]} s={[0.55, 0.08, 0.55]} color="#222" />
      {/* exit door */}
      <Box p={[17.5, 1.25, 0]} s={[0.15, 2.5, 1.8]} color="#6b7480" metal={0.6} rough={0.4} />
      <TextPanel p={[17.38, 2.75, 0]} rotY={-Math.PI / 2} w={1.2} h={0.35} text="ULOS ➜" bg="#2e9e5b" glow />
      {/* ceiling lights along the corridor */}
      {[-14, -8, -2, 4, 10, 15].map((x) => (
        <Box key={x} p={[x, WALL_H - 0.1, 1.45]} s={[1.6, 0.08, 0.12]} color="#eef6ff" emissive="#dfefff" cast={false} />
      ))}
      <Cutaway axis="z" at={1.6} outward={1}>
        <TextPanel p={[0, 2.6, 1.57]} rotY={Math.PI} w={4.2} h={0.5} text="KERAVAN VANKILA · OSASTO B" bg="#3a3f47" />
        <TextPanel p={[-12, 1.8, 1.57]} rotY={Math.PI} w={1.6} h={1.1} text={'SAUNAVUOROT\nTI & PE\n17–19'} bg="#f3efe4" fg="#14171f" />
      </Cutaway>
    </group>
  );
}
