import * as THREE from 'three';
import type { WorldXZ } from '../../game/world/projection';
import type { Terrain } from '../../game/world/terrain';
import { ROAD_WIDTH, type WorldData } from '../../game/world/worldData';

export interface GroundMap {
  texture: THREE.Texture;
  /** World xz of the texture's (0,0) corner and its size in metres. */
  min: THREE.Vector2;
  size: THREE.Vector2;
}

/**
 * Paints land cover into a texture the ground shader reads:
 * red = park lawn, green = forest floor, blue = river banks / mud.
 * Soft edges come from a blur pass.
 */
export function paintGroundMap(world: WorldData, terrain: Terrain): GroundMap {
  const wM = terrain.maxX - terrain.minX;
  const hM = terrain.maxZ - terrain.minZ;
  const scale = 2048 / Math.max(wM, hM); // px per metre
  const W = Math.ceil(wM * scale), H = Math.ceil(hM * scale);
  const raw = document.createElement('canvas');
  raw.width = W;
  raw.height = H;
  const ctx = raw.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const px = ([x, z]: WorldXZ): [number, number] => [(x - terrain.minX) * scale, (z - terrain.minZ) * scale];
  const poly = (pts: WorldXZ[], color: string) => {
    if (pts.length < 3) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
    ctx.closePath();
    ctx.fill();
  };
  world.parks.forEach((a) => poly(a.outline, 'rgb(255,0,0)'));
  (world.forests ?? []).forEach((a) => poly(a.outline, 'rgb(0,255,0)'));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // gravel and bare earth along the railway embankment
  for (const r of world.roads) {
    if (r.kind !== 'rail') continue;
    ctx.strokeStyle = 'rgb(0,0,150)';
    ctx.lineWidth = (ROAD_WIDTH.rail + 7) * scale;
    ctx.beginPath();
    r.points.forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
    ctx.stroke();
  }
  for (const r of world.roads) {
    if (r.kind !== 'river') continue;
    ctx.strokeStyle = 'rgb(0,0,255)';
    ctx.lineWidth = (ROAD_WIDTH.river + 9) * scale;
    ctx.beginPath();
    r.points.forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
    ctx.stroke();
  }
  world.water.forEach((a) => {
    ctx.strokeStyle = 'rgb(0,0,255)';
    ctx.lineWidth = 6 * scale;
    ctx.beginPath();
    a.outline.forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
    ctx.closePath();
    ctx.stroke();
  });

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d')!;
  octx.filter = `blur(${Math.max(1, 2.5 * scale).toFixed(1)}px)`;
  octx.drawImage(raw, 0, 0);

  const texture = new THREE.CanvasTexture(out);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return { texture, min: new THREE.Vector2(terrain.minX, terrain.minZ), size: new THREE.Vector2(W / scale, H / scale) };
}
