import * as THREE from 'three';

/** Renders text into a canvas texture (no font files needed). */
export function createTextTexture(
  text: string,
  { width = 512, height = 128, bg = '#1f3f8f', fg = '#ffffff', font = '800 72px Rubik, Arial, sans-serif' } = {},
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((line, i) => ctx.fillText(line, width / 2, (height / (lines.length + 1)) * (i + 1)));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
