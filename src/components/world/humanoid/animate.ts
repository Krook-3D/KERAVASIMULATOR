import type { HumanBones } from './buildHumanoid';

/**
 * Procedural poses for the skinned humanoid. Conventions (character faces +z):
 * - negative rotation.x on a limb swings it forward (legs, arms),
 * - positive rotation.x on a shin bends the knee, negative on a forearm bends the elbow,
 * - positive rotation.x on spine/chest/head leans forward / looks down,
 * - positive rotation.z on the left (+x) arm lifts it outward, negative on the right arm.
 */

const HIPS_Y = 0.95;

export function resetPose(b: HumanBones) {
  for (const bone of Object.values(b)) bone.rotation.set(0, 0, 0);
  b.hips.position.y = HIPS_Y;
}

/** Idle breathing + running, blended by `run` (0 = standing, 1 = full run). */
export function poseLocomotion(b: HumanBones, phase: number, run: number, t: number) {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const idle = 1 - run;
  const breathe = Math.sin(t * 1.7);
  const sway = Math.sin(t * 0.6);

  // legs: thigh swing, knee bend highest while the leg swings through
  const legs = (side: 'L' | 'R', ph: number) => {
    const ls = Math.sin(ph);
    const lc = Math.cos(ph);
    const thigh = -ls * 0.78;
    const knee = 0.15 + 1.15 * Math.max(0, -lc) + 0.25 * Math.max(0, ls);
    b[`thigh${side}`].rotation.x = thigh * run + idle * (side === 'L' ? 0.02 * sway : -0.02 * sway);
    b[`thigh${side}`].rotation.z = (side === 'L' ? 0.03 : -0.03) * idle;
    b[`shin${side}`].rotation.x = knee * run + idle * 0.04;
    b[`foot${side}`].rotation.x = (-0.25 * Math.max(0, -lc) + 0.35 * Math.max(0, ls) - 0.1) * run;
  };
  legs('L', phase);
  legs('R', phase + Math.PI);

  // arms: counter-swing with bent elbows when running, relaxed when idle
  b.upperArmL.rotation.x = s * 0.7 * run + idle * (0.04 + breathe * 0.015);
  b.upperArmR.rotation.x = -s * 0.7 * run + idle * (0.04 - breathe * 0.015);
  b.upperArmL.rotation.z = 0.12 * run + 0.07 * idle;
  b.upperArmR.rotation.z = -0.12 * run - 0.07 * idle;
  b.forearmL.rotation.x = -(1.25 + Math.max(0, -s) * 0.35) * run - 0.18 * idle;
  b.forearmR.rotation.x = -(1.25 + Math.max(0, s) * 0.35) * run - 0.18 * idle;
  b.handL.rotation.x = 0;
  b.handR.rotation.x = 0;

  // torso: lean into the run, twist against the legs, bob twice per cycle
  b.hips.position.y = HIPS_Y + run * (Math.abs(c) * 0.05 - 0.035) + idle * breathe * 0.003;
  b.hips.rotation.y = s * 0.14 * run;
  b.hips.rotation.z = idle * sway * 0.02;
  b.spine.rotation.x = 0.16 * run + idle * breathe * 0.012;
  b.spine.rotation.y = -s * 0.1 * run;
  b.chest.rotation.y = -s * 0.12 * run;
  b.chest.rotation.x = 0.04 * run + idle * breathe * 0.015;
  b.chest.rotation.z = -idle * sway * 0.015;
  b.neck.rotation.x = -0.1 * run;
  b.head.rotation.x = -0.06 * run;
  b.head.rotation.y = idle * Math.sin(t * 0.35) * 0.25;
  b.head.rotation.z = c * 0.03 * run;
}

/** Looking at a phone held in the right hand. */
export function posePhone(b: HumanBones, t: number) {
  b.upperArmR.rotation.set(-0.3, 0.15, -0.05);
  b.forearmR.rotation.set(-1.55, 0, 0);
  b.handR.rotation.set(-0.35, 0, 0.2);
  b.upperArmL.rotation.set(-0.25, -0.3, 0.1);
  b.forearmL.rotation.set(-1.4, 0, 0);
  b.handL.rotation.set(0, 0, -0.4);
  b.neck.rotation.x = 0.25;
  b.head.rotation.set(0.35 + Math.sin(t * 0.5) * 0.04, 0, 0);
}

/** Thrown out of the train: arms windmilling, legs kicking. `f` 0–1. */
export function poseFlail(b: HumanBones, f: number, t: number) {
  const w = t * 11;
  b.upperArmL.rotation.set(-2.5 * f + Math.sin(w) * 0.5 * f, 0, 0.5 * f);
  b.upperArmR.rotation.set(-2.5 * f + Math.cos(w) * 0.5 * f, 0, -0.5 * f);
  b.forearmL.rotation.x = -0.6 * f;
  b.forearmR.rotation.x = -0.6 * f;
  b.thighL.rotation.x = (-0.4 + Math.sin(w) * 0.6) * f;
  b.thighR.rotation.x = (-0.4 - Math.sin(w) * 0.6) * f;
  b.shinL.rotation.x = (0.5 + Math.max(0, Math.cos(w)) * 0.6) * f;
  b.shinR.rotation.x = (0.5 + Math.max(0, -Math.cos(w)) * 0.6) * f;
  b.spine.rotation.x = -0.15 * f;
  b.head.rotation.x = -0.2 * f;
}

/** Right arm pointing straight out (0–1), elbow nearly straight. */
export function posePoint(b: HumanBones, k: number) {
  b.upperArmR.rotation.set(-1.45 * k, 0, -0.1 * k);
  b.forearmR.rotation.x = -0.12 * k;
  b.handR.rotation.x = 0.1 * k;
  b.chest.rotation.y = -0.15 * k;
}

/** Holding the card reader out in front. */
export function poseHoldOut(b: HumanBones, k: number) {
  b.upperArmR.rotation.set(-0.55 * k, 0.15 * k, -0.05 * k);
  b.forearmR.rotation.x = -1.0 * k;
}
