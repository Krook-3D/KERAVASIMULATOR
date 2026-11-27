/**
 * The player's body changes with how they live: eating more than they burn
 * puts on fat, training burns it; muscle comes from Voima, heavy deadlifts
 * and (for the really "roinattu" look) gym roina. Natural training alone
 * tops out around a fit, broad build; the cartoonishly huge frame needs roina.
 */
export interface BodyState {
  /** 0–1. */
  fat: number;
  /** Heaviest successful deadlift (kg). */
  deadlift: number;
  /** Roina taken so far, in strain points / 100. */
  roina: number;
}

export const START_BODY: BodyState = { fat: 0.12, deadlift: 0, roina: 0 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Fat gained from eating `gain` energy when you had `before` (overeating counts most). */
export function fatFromEating(before: number, gain: number): number {
  const over = Math.max(0, before + gain - 80);
  return gain * 0.0005 + over * 0.0035;
}

/** Fat burned by spending `energy` on training or walking. */
export const fatBurn = (energy: number) => Math.max(0, energy) * 0.0016;

/** Muscle 0–1 from Voima level, best deadlift and roina use. */
export function muscleOf(b: BodyState, strengthLevel: number): number {
  const natural = Math.min(1, strengthLevel / 45) * 0.38 + Math.min(1, b.deadlift / 200) * 0.27;
  const juice = Math.min(1, b.roina / 3) * 0.45;
  return clamp01(natural + juice);
}

/** Shape for the character model, rounded so the mesh isn't rebuilt for tiny changes. */
export function bodyShape(b: BodyState | undefined, strengthLevel: number): { fat: number; muscle: number } {
  const s = b ?? START_BODY;
  const q = (v: number) => Math.round(clamp01(v) * 20) / 20;
  return { fat: q(s.fat), muscle: q(muscleOf(s, strengthLevel)) };
}

/** A short description for the character screen. */
export function bodyLabel(shape: { fat: number; muscle: number }): string {
  if (shape.muscle >= 0.75) return shape.fat >= 0.5 ? 'Iso ja pyöreä voimamies' : 'Roinattu tankki';
  if (shape.muscle >= 0.45) return shape.fat >= 0.5 ? 'Vahva mutta pehmeä' : 'Lihaksikas';
  if (shape.fat >= 0.65) return 'Reilusti ylipainoinen';
  if (shape.fat >= 0.4) return 'Pyöreähkö';
  return shape.muscle >= 0.2 ? 'Treenattu' : 'Hoikka';
}
