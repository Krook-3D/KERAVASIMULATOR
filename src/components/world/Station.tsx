import { useEffect, useMemo } from 'react';
import { createXrayStandardMaterial, type XrayUniforms } from './materials';
import * as THREE from 'three';
import { PLATFORM, STATION_BUILDING, type StationLayout } from '../../game/world/station';
import { createTextTexture } from './textTexture';

/**
 * Kerava station, an original low-poly take on a Finnish town station:
 * long 55 cm platform with canopy, an ochre wooden station house with a red
 * roof, signs, benches and lamps. Built in the station's local frame.
 */

const STEEL = '#2f4f45';
const CONCRETE = '#b9b6ae';
const OCHRE = '#d9a441';
const TRIM = '#f3efe4';
const ROOF = '#8a2f24';

function Box({ p, s, color, rough = 0.85, metal = 0, cast = true }: { p: [number, number, number]; s: [number, number, number]; color: string; rough?: number; metal?: number; cast?: boolean }) {
  return (
    <mesh position={p} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} />
    </mesh>
  );
}

function Sign({ p, rotY = 0, text, w = 4.2, h = 0.9 }: { p: [number, number, number]; rotY?: number; text: string; w?: number; h?: number }) {
  const tex = useMemo(() => createTextTexture(text), [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={p} rotation-y={rotY}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.15, h + 0.15, 0.12]} />
        <meshStandardMaterial color="#e8e8e8" metalness={0.5} roughness={0.4} />
      </mesh>
      {[0.07, -0.07].map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation-y={z < 0 ? Math.PI : 0}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={tex} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Departures({ p }: { p: [number, number, number] }) {
  const tex = useMemo(
    () =>
      createTextTexture('R  Helsinki   2 min\nK  Kerava →  laituri 1\nZ  Lahti     11 min', {
        width: 512,
        height: 192,
        bg: '#0d1118',
        fg: '#ffb43c',
        font: '600 34px "Courier New", monospace',
      }),
    [],
  );
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={p}>
      <Box p={[0, -1.4, 0]} s={[0.12, 2.2, 0.12]} color={STEEL} metal={0.6} rough={0.4} />
      <Box p={[0, 0.2, 0]} s={[2.1, 0.9, 0.18]} color="#1a1f28" />
      <mesh position={[0, 0.2, 0.1]}>
        <planeGeometry args={[1.95, 0.75]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Bench({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 0.45, 0]} s={[1.8, 0.07, 0.45]} color="#7b4b2a" />
      <Box p={[0, 0.75, -0.2]} s={[1.8, 0.4, 0.06]} color="#7b4b2a" />
      <Box p={[-0.75, 0.22, 0]} s={[0.07, 0.45, 0.45]} color={STEEL} metal={0.6} />
      <Box p={[0.75, 0.22, 0]} s={[0.07, 0.45, 0.45]} color={STEEL} metal={0.6} />
    </group>
  );
}

function Lamp({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 2, 0]} s={[0.12, 4, 0.12]} color={STEEL} metal={0.6} rough={0.4} />
      <Box p={[0, 4.05, -0.3]} s={[0.25, 0.12, 0.7]} color={STEEL} metal={0.6} rough={0.4} />
      <mesh position={[0, 3.97, -0.5]}>
        <boxGeometry args={[0.18, 0.04, 0.3]} />
        <meshStandardMaterial color="#fff3c4" emissive="#ffe7a0" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

function Bin({ p }: { p: [number, number, number] }) {
  return (
    <mesh position={[p[0], p[1] + 0.45, p[2]]} castShadow>
      <cylinderGeometry args={[0.25, 0.22, 0.9, 10]} />
      <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.4} />
    </mesh>
  );
}

function Platform() {
  const { minX, maxX, minZ, maxZ, height } = PLATFORM;
  const len = maxX - minX, wid = maxZ - minZ, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  return (
    <group>
      <Box p={[cx, height / 2, cz]} s={[len, height, wid]} color={CONCRETE} rough={0.95} />
      {/* yellow safety line + tactile strip near the edge */}
      <Box p={[cx, height + 0.005, minZ + 0.5]} s={[len, 0.01, 0.12]} color="#f2c21b" cast={false} />
      <Box p={[cx, height + 0.005, minZ + 0.85]} s={[len, 0.012, 0.35]} color="#d9d4c4" cast={false} />
      {/* darker edge stones */}
      <Box p={[cx, height - 0.02, minZ + 0.15]} s={[len, 0.06, 0.3]} color="#8d8a83" cast={false} />
      {/* ramps at both ends */}
      {[minX - 4, maxX + 4].map((x, i) => (
        <mesh key={x} position={[x, height / 2 - 0.1, cz]} rotation-z={i === 0 ? -0.13 : 0.13} receiveShadow>
          <boxGeometry args={[8.2, 0.2, wid]} />
          <meshStandardMaterial color={CONCRETE} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Canopy({ xray }: { xray: XrayUniforms }) {
  const mats = useMemo(
    () => ({
      top: createXrayStandardMaterial(xray, { color: '#5b6b70', metalness: 0.3, roughness: 0.5 }),
      wood: createXrayStandardMaterial(xray, { color: '#b7834f', roughness: 0.85 }),
      edge: createXrayStandardMaterial(xray, { color: STEEL, metalness: 0.5, roughness: 0.5 }),
    }),
    [xray],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const pillars = [];
  for (let x = -40; x <= 40; x += 8) pillars.push(x);
  const h = PLATFORM.height;
  return (
    <group>
      {pillars.map((x) => (
        <group key={x}>
          <Box p={[x, h + 2.1, 6.8]} s={[0.22, 4.2, 0.22]} color={STEEL} metal={0.5} rough={0.45} />
          <Box p={[x, h + 4.05, 5.6]} s={[0.16, 0.16, 3.2]} color={STEEL} metal={0.5} rough={0.45} />
        </group>
      ))}
      {/* slightly tilted roof plate with a wooden underside */}
      <group position={[0, h + 4.35, 5.7]} rotation-x={-0.06}>
        <mesh position={[0, 0.12, 0]} material={mats.top} castShadow receiveShadow>
          <boxGeometry args={[84, 0.12, 6.4]} />
        </mesh>
        <mesh material={mats.wood} receiveShadow>
          <boxGeometry args={[84, 0.1, 6.2]} />
        </mesh>
        <mesh position={[0, 0.05, -3.2]} material={mats.edge} castShadow>
          <boxGeometry args={[84, 0.35, 0.1]} />
        </mesh>
      </group>
      {/* hanging station name signs */}
      {[-28, 0, 28].map((x) => (
        <group key={x}>
          <Box p={[x - 1.6, h + 3.85, 4.2]} s={[0.04, 0.6, 0.04]} color={STEEL} />
          <Box p={[x + 1.6, h + 3.85, 4.2]} s={[0.04, 0.6, 0.04]} color={STEEL} />
          <Sign p={[x, h + 3.2, 4.2]} text="KERAVA" w={3.8} h={0.8} />
        </group>
      ))}
      {[-32, -12, 12, 32].map((x) => (
        <Bench key={x} p={[x, h, 7.8]} />
      ))}
      {[-20, 20].map((x) => (
        <Departures key={x} p={[x, h + 2.4, 6.4]} />
      ))}
      {[-60, -48, 48, 60].map((x) => (
        <Lamp key={x} p={[x, h, 8.2]} />
      ))}
      {[-24, 4, 36].map((x) => (
        <Bin key={x} p={[x, h, 8.4]} />
      ))}
    </group>
  );
}

function StationHouse() {
  const { minX, maxX, minZ, maxZ } = STATION_BUILDING;
  const depth = maxZ - minZ, cz = (minZ + maxZ) / 2;
  const main = { w: 16, h: 6.6 };
  const wing = { w: (maxX - minX - main.w) / 2, h: 4.2 };

  const gable = (w: number, d: number, rise: number, y: number, x: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2 - 0.5, 0);
    shape.lineTo(d / 2 + 0.5, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w + 0.8, bevelEnabled: false });
    geo.translate(0, 0, -(w + 0.8) / 2);
    geo.rotateY(Math.PI / 2);
    return (
      <mesh geometry={geo} position={[x, y, cz]} castShadow receiveShadow>
        <meshStandardMaterial color={ROOF} roughness={0.6} metalness={0.2} />
      </mesh>
    );
  };

  // Platform-facing windows and doors.
  const windows: [number, number][] = [];
  for (let x = -6; x <= 6; x += 3) if (x !== 0) windows.push([x, 1.9], [x, 4.6]);
  for (const x of [-12.2, -9.8, 9.8, 12.2]) windows.push([x, 1.9]);

  return (
    <group>
      {/* stone plinth */}
      <Box p={[0, 0.3, cz]} s={[maxX - minX + 0.3, 0.6, depth + 0.3]} color="#7f7a72" />
      {/* main block + wings */}
      <Box p={[0, main.h / 2 + 0.3, cz]} s={[main.w, main.h, depth]} color={OCHRE} rough={0.9} />
      <Box p={[minX + wing.w / 2, wing.h / 2 + 0.3, cz]} s={[wing.w, wing.h, depth - 1]} color={OCHRE} rough={0.9} />
      <Box p={[maxX - wing.w / 2, wing.h / 2 + 0.3, cz]} s={[wing.w, wing.h, depth - 1]} color={OCHRE} rough={0.9} />
      {/* white corner boards and eaves trim */}
      {[-main.w / 2, main.w / 2, minX, maxX].map((x) => (
        <Box key={x} p={[x, (x === minX || x === maxX ? wing.h : main.h) / 2 + 0.3, minZ - 0.02]} s={[0.3, x === minX || x === maxX ? wing.h : main.h, 0.1]} color={TRIM} />
      ))}
      <Box p={[0, main.h + 0.3, minZ - 0.05]} s={[main.w + 0.4, 0.25, 0.15]} color={TRIM} />
      <Box p={[0, 3.35, minZ - 0.05]} s={[main.w, 0.18, 0.12]} color={TRIM} />
      {gable(main.w, depth, 3.2, main.h + 0.3, 0)}
      {gable(wing.w, depth - 1, 2.2, wing.h + 0.3, minX + wing.w / 2)}
      {gable(wing.w, depth - 1, 2.2, wing.h + 0.3, maxX - wing.w / 2)}
      {/* chimney */}
      <Box p={[4, main.h + 3.2, cz + 2]} s={[0.8, 2.4, 0.8]} color="#8a4a36" />
      {/* windows */}
      {windows.map(([x, y]) => (
        <group key={`${x}-${y}`} position={[x, y + 0.3, minZ - 0.06]}>
          <Box p={[0, 0, 0]} s={[1.25, 1.6, 0.1]} color={TRIM} cast={false} />
          <mesh position={[0, 0, -0.06]}>
            <planeGeometry args={[1.0, 1.35]} />
            <meshStandardMaterial color="#2d4256" roughness={0.22} metalness={0.5} side={THREE.DoubleSide} />
          </mesh>
          <Box p={[0, 0, -0.07]} s={[0.06, 1.35, 0.02]} color={TRIM} cast={false} />
          <Box p={[0, 0.2, -0.07]} s={[1.0, 0.06, 0.02]} color={TRIM} cast={false} />
        </group>
      ))}
      {/* double entrance door with transom */}
      <group position={[0, 1.55, minZ - 0.07]}>
        <Box p={[0, 0, 0]} s={[2.1, 2.7, 0.12]} color={TRIM} cast={false} />
        <Box p={[-0.48, -0.1, -0.05]} s={[0.88, 2.3, 0.06]} color="#5a2f1f" cast={false} />
        <Box p={[0.48, -0.1, -0.05]} s={[0.88, 2.3, 0.06]} color="#5a2f1f" cast={false} />
      </group>
      {/* sign and clock above the door */}
      <Sign p={[0, 5.2, minZ - 0.2]} text="KERAVA" w={4.5} h={0.95} />
      <group position={[0, 3.75, minZ - 0.15]}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.42, 0.42, 0.1, 24]} />
          <meshStandardMaterial color="#1a1f28" />
        </mesh>
        <mesh position={[0, 0, -0.06]}>
          <circleGeometry args={[0.36, 24]} />
          <meshStandardMaterial color="#fbfaf5" side={THREE.DoubleSide} />
        </mesh>
        <Box p={[0, 0.12, -0.08]} s={[0.04, 0.26, 0.01]} color="#14171f" cast={false} />
        <Box p={[0.1, 0, -0.08]} s={[0.2, 0.035, 0.01]} color="#14171f" cast={false} />
      </group>
      {/* paved square between platform and house */}
      <Box p={[0, 0.03, (PLATFORM.maxZ + minZ) / 2]} s={[maxX - minX + 20, 0.06, minZ - PLATFORM.maxZ + 0.2]} color="#9a968e" cast={false} />
      {/* bike racks */}
      {[-24, -22, -20, -18].map((x) => (
        <mesh key={x} position={[x, 0.45, 15]} rotation-y={Math.PI / 2} castShadow>
          <torusGeometry args={[0.38, 0.03, 6, 16, Math.PI]} />
          <meshStandardMaterial color="#c8ccd2" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export function Station({ layout, xray }: { layout: StationLayout; xray: XrayUniforms }) {
  return (
    <group position={[layout.origin[0], 0, layout.origin[1]]} rotation-y={layout.rotationY}>
      <Platform />
      <Canopy xray={xray} />
      <StationHouse />
    </group>
  );
}
