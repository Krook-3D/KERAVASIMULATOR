import type { PlayerLook } from '../../../shared/protocol';
import { defaultAppearance, FACIAL_HAIR, HAIR_STYLES, type Appearance } from '../player/appearance';

const COLOR = /^#[0-9a-fA-F]{3,8}$/;
const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** Another client's look, checked field by field: unknown or bad values fall back to the default. */
export function lookToAppearance(look: PlayerLook | undefined, color: string): { a: Appearance; shape: { fat: number; muscle: number } } {
  const base = defaultAppearance(color);
  const a = look?.a ?? {};
  const out: Appearance = { ...base };
  for (const k of ['skin', 'hair', 'eyes', 'top', 'legs', 'shoes', 'hatColor', 'accent'] as const) {
    const v = a[k];
    if (typeof v === 'string' && COLOR.test(v)) out[k] = v;
  }
  if (typeof a.hairStyle === 'string' && (HAIR_STYLES as readonly string[]).includes(a.hairStyle)) out.hairStyle = a.hairStyle as Appearance['hairStyle'];
  if (typeof a.facialHair === 'string' && (FACIAL_HAIR as readonly string[]).includes(a.facialHair)) out.facialHair = a.facialHair as Appearance['facialHair'];
  if (a.hat === 'beanie' || a.hat === 'cap' || a.hat === 'none') out.hat = a.hat;
  if (a.topStyle === 'hoodie' || a.topStyle === 'jacket') out.topStyle = a.topStyle;
  if (typeof a.glasses === 'boolean') out.glasses = a.glasses;
  if (typeof a.backpack === 'boolean') out.backpack = a.backpack;
  out.build = clamp(a.build, 0.9, 1.15, base.build);
  out.height = clamp(a.height, 0.92, 1.08, base.height);
  return { a: out, shape: { fat: clamp(look?.fat, 0, 1, 0), muscle: clamp(look?.muscle, 0, 1, 0) } };
}

/** Our own look as it goes to the server. */
export function appearanceToLook(a: Appearance | undefined, color: string, shape: { fat: number; muscle: number }): PlayerLook {
  const ap = a ?? defaultAppearance(color);
  return { a: { ...ap }, fat: Math.round(shape.fat * 100) / 100, muscle: Math.round(shape.muscle * 100) / 100 };
}

