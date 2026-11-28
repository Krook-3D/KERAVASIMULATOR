/**
 * Commuter train cycle at Kerava station, as a pure function of time.
 * Local x = 0 is the stopping point.
 */
export const CYCLE = {
  arriveFrom: -340,
  arriveEnd: 10, // s, train stops
  doorsOpen: [10.6, 11.6] as const,
  doorsClose: [23, 24] as const,
  departStart: 25,
  departEnd: 37,
  departTo: 420,
  length: 80, // s, then the next train
};

export interface TrainState {
  x: number;
  /** 0 = closed, 1 = open. */
  doors: number;
  visible: boolean;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function trainStateAt(t: number): TrainState {
  const c = CYCLE;
  const tt = ((t % c.length) + c.length) % c.length;
  let x: number;
  if (tt < c.arriveEnd) {
    const k = tt / c.arriveEnd;
    x = c.arriveFrom * (1 - k) ** 3; // ease-out: brakes into the station
  } else if (tt < c.departStart) {
    x = 0;
  } else if (tt < c.departEnd) {
    const k = (tt - c.departStart) / (c.departEnd - c.departStart);
    x = c.departTo * k * k; // ease-in: accelerates away
  } else {
    x = c.departTo;
  }
  const open = clamp01((tt - c.doorsOpen[0]) / (c.doorsOpen[1] - c.doorsOpen[0]));
  const close = clamp01((tt - c.doorsClose[0]) / (c.doorsClose[1] - c.doorsClose[0]));
  return { x, doors: open * (1 - close), visible: tt < c.departEnd };
}

/** Offset into the cycle for players who already saw the intro: train somewhere far away. */
export const NO_INTRO_START = CYCLE.departEnd + 5;
