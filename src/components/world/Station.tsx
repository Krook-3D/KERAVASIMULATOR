import { useEffect, useMemo } from 'react';
import { createXrayStandardMaterial, type XrayUniforms } from './materials';
import * as THREE from 'three';
import { BRIDGE, PLATFORM, STATION_BUILDING, TUNNEL_ENTRANCES, type StationLayout } from '../../game/world/station';
import { createTextTexture } from './textTexture';
import { Passengers } from './Passengers';

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
      {/* town-side doors (Asema-aukio) */}
      <group position={[0, 1.55, maxZ + 0.07]}>
        <Box p={[0, 0, 0]} s={[2.1, 2.7, 0.12]} color={TRIM} cast={false} />
        <Box p={[-0.48, -0.1, 0.05]} s={[0.88, 2.3, 0.06]} color="#5a2f1f" cast={false} />
        <Box p={[0.48, -0.1, 0.05]} s={[0.88, 2.3, 0.06]} color="#5a2f1f" cast={false} />
      </group>
      <Sign p={[0, 4.4, maxZ + 0.2]} text="KERAVA" w={4.5} h={0.95} />
      <Box p={[0, 0.03, maxZ + 5]} s={[30, 0.06, 10]} color="#9a968e" cast={false} />
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

/** Covered footbridge with glass sides: stairs, deck over the rails, stairs. */
function Footbridge({ xray }: { xray: XrayUniforms }) {
  const glass = useMemo(() => {
    const m = createXrayStandardMaterial(xray, { color: '#bcd8ea', roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.35 });
    return m;
  }, [xray]);
  const steel = useMemo(() => createXrayStandardMaterial(xray, { color: STEEL, roughness: 0.5, metalness: 0.6 }), [xray]);
  const roofMat = useMemo(() => createXrayStandardMaterial(xray, { color: '#d9dcd6', roughness: 0.7 }), [xray]);
  useEffect(() => () => [glass, steel, roofMat].forEach((m) => m.dispose()), [glass, steel, roofMat]);
  const { x, halfWidth: hw, deck, footNear, topNear, topFar, footFar } = BRIDGE;
  const flight = (from: number, to: number, key: string) => {
    const n = 16;
    const run = (to - from) / n;
    return (
      <group key={key}>
        {Array.from({ length: n }, (_, i) => {
          const h = (deck * (i + 1)) / n;
          return <Box key={i} p={[x, h - 0.12, from + run * (i + 0.5)]} s={[hw * 2, 0.24, Math.abs(run) + 0.02]} color={i % 2 ? '#a8a49c' : '#b3afa7'} />;
        })}
        {/* stringer under the flight */}
        {[-hw, hw].map((dx) => {
          const len = Math.hypot(to - from, deck);
          const ang = Math.atan2(deck, to - from);
          return (
            <mesh key={dx} position={[x + dx, deck / 2 - 0.3, (from + to) / 2]} rotation-x={-ang} material={steel} castShadow>
              <boxGeometry args={[0.15, 0.35, len]} />
            </mesh>
          );
        })}
      </group>
    );
  };
  const span = topNear - topFar;
  return (
    <group>
      {flight(footNear, topNear, 'near')}
      {flight(footFar, topFar, 'far')}
      {/* deck */}
      <Box p={[x, deck - 0.2, (topNear + topFar) / 2]} s={[hw * 2 + 0.3, 0.4, span]} color="#9a968e" />
      {/* glass walls and roof over the deck */}
      {[-hw - 0.1, hw + 0.1].map((dx) => (
        <mesh key={dx} position={[x + dx, deck + 1.3, (topNear + topFar) / 2]} material={glass}>
          <boxGeometry args={[0.05, 2.6, span]} />
        </mesh>
      ))}
      <mesh position={[x, deck + 2.7, (topNear + topFar) / 2]} material={roofMat} castShadow>
        <boxGeometry args={[hw * 2 + 0.8, 0.18, span + 0.6]} />
      </mesh>
      {/* pillars */}
      {[topNear, topFar].flatMap((z) =>
        [-hw, hw].map((dx) => (
          <mesh key={`${z}${dx}`} position={[x + dx, deck / 2 - 0.2, z]} material={steel} castShadow>
            <boxGeometry args={[0.3, deck - 0.4, 0.3]} />
          </mesh>
        )),
      )}
      {/* handrails along the stairs */}
      {[
        [footNear, topNear],
        [footFar, topFar],
      ].flatMap(([a, b]) =>
        [-hw, hw].map((dx) => {
          const len = Math.hypot(b! - a!, deck);
          const ang = Math.atan2(deck, b! - a!);
          return (
            <mesh key={`${a}${dx}`} position={[x + dx, deck / 2 + 0.95, (a! + b!) / 2]} rotation-x={-ang} material={steel}>
              <boxGeometry args={[0.06, 0.06, len]} />
            </mesh>
          );
        }),
      )}
      <Sign p={[x, deck + 3.4, topNear + 0.2]} text="SILTA · LAITURIT" w={3.6} h={0.6} />
    </group>
  );
}

/** Stair opening down to the pedestrian tunnel. */
function TunnelEntrance({ x, z, rotY }: { x: number; z: number; rotY: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={rotY}>
      <Box p={[0, 0.015, 0]} s={[3.4, 0.03, 4.4]} color="#1a1a1c" cast={false} />
      {Array.from({ length: 7 }, (_, i) => (
        <Box key={i} p={[0, 0.035, -1.9 + i * 0.55]} s={[3, 0.012, 0.42]} color={`hsl(30, 4%, ${14 + i * 4}%)`} cast={false} />
      ))}
      {[-1.75, 1.75].map((dx) => (
        <Box key={dx} p={[dx, 0.5, 0]} s={[0.1, 1, 4.4]} color="#c8ccd2" metal={0.8} rough={0.3} />
      ))}
      <Box p={[0, 0.5, -2.2]} s={[3.6, 1, 0.1]} color="#c8ccd2" metal={0.8} rough={0.3} />
      {/* little glass roof */}
      {[-1.7, 1.7].map((dx) => (
        <Box key={dx} p={[dx, 1.5, -1.9]} s={[0.12, 3, 0.12]} color={STEEL} />
      ))}
      <Box p={[0, 3.05, -0.4]} s={[3.8, 0.12, 3.6]} color="#bcd8ea" rough={0.2} metal={0.3} />
      <Sign p={[0, 3.55, 1.3]} text="TUNNELI ⬇" w={2.6} h={0.55} />
    </group>
  );
}

export function Station({ layout, xray }: { layout: StationLayout; xray: XrayUniforms }) {
  return (
    <group position={[layout.origin[0], 0, layout.origin[1]]} rotation-y={layout.rotationY}>
      <Platform />
      <Canopy xray={xray} />
      <StationHouse />
      <Footbridge xray={xray} />
      {TUNNEL_ENTRANCES.map((t) => (
        <TunnelEntrance key={t.id} x={t.x} z={t.z} rotY={t.rotY} />
      ))}
      <Passengers />
    </group>
  );
}
