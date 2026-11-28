/** Token bucket. `rate` tokens per second, up to `burst` saved. */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private rate: number,
    private burst: number,
    now = Date.now(),
  ) {
    this.tokens = burst;
    this.last = now;
  }

  take(now = Date.now(), cost = 1): boolean {
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}

/** Per-message-type limits, docs/MULTIPLAYER.md section 15. */
export const MESSAGE_LIMITS: Record<string, { rate: number; burst: number }> = {
  ping: { rate: 1, burst: 3 },
  move: { rate: 12, burst: 20 },
  chat: { rate: 1, burst: 5 },
  look: { rate: 0.2, burst: 4 },
  warp: { rate: 0.5, burst: 3 },
  'trade.request': { rate: 1 / 3, burst: 2 },
  'trade.respond': { rate: 10, burst: 10 },
  'trade.offer': { rate: 10, burst: 10 },
  'trade.accept': { rate: 10, burst: 10 },
  'trade.cancel': { rate: 10, burst: 10 },
};

export class ConnectionLimiter {
  private buckets = new Map<string, TokenBucket>();
  /** Total rejections; too many closes the connection. */
  violations = 0;

  allow(type: string, now = Date.now()): boolean {
    const limit = MESSAGE_LIMITS[type];
    if (!limit) return false;
    let bucket = this.buckets.get(type);
    if (!bucket) this.buckets.set(type, (bucket = new TokenBucket(limit.rate, limit.burst, now)));
    const ok = bucket.take(now);
    if (!ok) this.violations++;
    return ok;
  }
}
