import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type * as THREE from 'three';
import { worldBounds, type Area, type WorldData } from '../../../../game/world/worldData';
import type { ControlState } from '../../controls';

export interface MinimapMarker {
  x: number;
  z: number;
  kind: 'drop' | 'porssi' | 'player';
}

/** Views to cycle through by clicking the map: metres from the centre to the edge. */
const RANGES = [90, 180, 360];
const SIZE = 184;
const MAX_TEX = 4096;

const COLORS = {
  ground: '#6f8a52',
  forest: '#3f6234',
  park: '#86a964',
  water: '#4a86b8',
  building: '#c9bfae',
  buildingEdge: '#9a9080',
  major: '#f2e6c2',
  street: '#e8e2d4',
  path: '#c7b48a',
  rail: '#4a4a52',
};

/** Draws the whole town once, north up, into a canvas the minimap crops from. */
function renderBase(world: WorldData) {
  const b = worldBounds(world);
  const w = b.maxX - b.minX, h = b.maxZ - b.minZ;
  const s = Math.min(1.6, MAX_TEX / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * s);
  c.height = Math.ceil(h * s);
  const g = c.getContext('2d')!;
  const X = (x: number) => (x - b.minX) * s, Z = (z: number) => (z - b.minZ) * s;
  g.fillStyle = COLORS.ground;
  g.fillRect(0, 0, c.width, c.height);
  const fill = (areas: Area[] | undefined, color: string) => {
    g.fillStyle = color;
    for (const a of areas ?? []) {
      g.beginPath();
      a.outline.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
      g.closePath();
      g.fill();
    }
  };
  fill(world.forests, COLORS.forest);
  fill(world.parks, COLORS.park);
  fill(world.water, COLORS.water);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const order = ['river', 'path', 'street', 'major', 'rail'] as const;
  for (const kind of order) {
    for (const r of world.roads) {
      if (r.kind !== kind) continue;
      g.strokeStyle = kind === 'river' ? COLORS.water : COLORS[kind];
      g.lineWidth = Math.max(1, (kind === 'major' ? 9 : kind === 'street' ? 6 : kind === 'river' ? 12 : kind === 'rail' ? 3 : 2.5) * s);
      g.setLineDash(kind === 'rail' ? [6 * s, 4 * s] : []);
      g.beginPath();
      r.points.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
      g.stroke();
    }
  }
  g.setLineDash([]);
  g.fillStyle = COLORS.building;
  g.strokeStyle = COLORS.buildingEdge;
  g.lineWidth = Math.max(0.5, 0.6 * s);
  for (const bd of world.buildings) {
    g.beginPath();
    bd.footprint.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.closePath();
    g.fill();
    g.stroke();
  }
  return { canvas: c, scale: s, minX: b.minX, minZ: b.minZ };
}

/**
 * Round minimap in the corner: the town around you, turned so that up is the
 * way the camera looks, with your arrow in the middle, a north mark on the
 * rim and markers for the package drop, the Pörssi and other players.
 * Click it to zoom out (three steps).
 */
export function Minimap({ world, positionRef, controlRef, markersRef }: {
  world: WorldData;
  positionRef: MutableRefObject<THREE.Vector3>;
  controlRef: MutableRefObject<ControlState>;
  markersRef: MutableRefObject<() => MinimapMarker[]>;
}) {
  const base = useMemo(() => renderBase(world), [world]);
  const ref = useRef<HTMLCanvasElement>(null);
  const [range, setRange] = useState(0);
  const rangeRef = useRef(RANGES[0]!);
  rangeRef.current = RANGES[range]!;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = SIZE * dpr;
    cv.height = SIZE * dpr;
    const g = cv.getContext('2d')!;
    let raf = 0;
    const R = SIZE / 2;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const p = positionRef.current;
      const yaw = controlRef.current.yaw;
      const k = R / rangeRef.current; // screen px per metre
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, SIZE, SIZE);
      g.save();
      g.beginPath();
      g.arc(R, R, R - 2, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = COLORS.ground;
      g.fillRect(0, 0, SIZE, SIZE);
      g.translate(R, R);
      g.rotate(yaw);
      // the town, positioned so the player is at the centre
      const f = k / base.scale;
      g.drawImage(base.canvas, -(p.x - base.minX) * k, -(p.z - base.minZ) * k, base.canvas.width * f, base.canvas.height * f);
      g.restore();

      // markers (clamped to the rim when off the map)
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      const toScreen = (x: number, z: number, clamp: boolean) => {
        const dx = (x - p.x) * k, dz = (z - p.z) * k;
        let sx = dx * cos - dz * sin, sy = dx * sin + dz * cos;
        const d = Math.hypot(sx, sy);
        const edge = R - 12;
        if (d > edge) {
          if (!clamp) return null;
          sx *= edge / d;
          sy *= edge / d;
        }
        return [R + sx, R + sy] as const;
      };
      const t = performance.now() / 1000;
      for (const m of markersRef.current()) {
        const at = toScreen(m.x, m.z, m.kind !== 'player');
        if (!at) continue;
        if (m.kind === 'player') {
          g.fillStyle = '#ffffff';
          g.strokeStyle = '#14171f';
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(at[0], at[1], 3.2, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        } else if (m.kind === 'drop') {
          const pulse = 7 + Math.sin(t * 5) * 2;
          g.fillStyle = '#ff8a1f55';
          g.beginPath();
          g.arc(at[0], at[1], pulse + 4, 0, Math.PI * 2);
          g.fill();
          g.font = '15px system-ui, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('📦', at[0], at[1]);
        } else {
          g.font = '13px system-ui, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('📈', at[0], at[1]);
        }
      }

      // you: an arrow pointing up (the camera's direction)
      g.save();
      g.translate(R, R);
      g.fillStyle = '#ffd23f';
      g.strokeStyle = '#14171f';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -8);
      g.lineTo(6, 6);
      g.lineTo(0, 3);
      g.lineTo(-6, 6);
      g.closePath();
      g.stroke();
      g.fill();
      g.restore();

      // rim and the north mark
      g.strokeStyle = '#14171f';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(R, R, R - 2, 0, Math.PI * 2);
      g.stroke();
      const nx = R + (R - 11) * sin, ny = R - (R - 11) * cos;
      g.fillStyle = '#14171f';
      g.beginPath();
      g.arc(nx, ny, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ff5a4a';
      g.font = '800 11px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('P', nx, ny + 0.5);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [base, positionRef, controlRef, markersRef]);

  return (
    <div className="minimap" title="Kartta: klikkaa loitontaaksesi">
      <canvas ref={ref} style={{ width: SIZE, height: SIZE }} onClick={() => setRange((r) => (r + 1) % RANGES.length)} />
      <span className="minimap__range">{RANGES[range]! * 2} m</span>
    </div>
  );
}
