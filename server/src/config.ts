/** Runtime configuration from environment variables. */
export interface Config {
  databaseUrl: string;
  port: number;
  host: string;
  allowedOrigins: string[];
  cookieSecure: boolean;
  /** Session lifetime, ms. */
  sessionTtlMs: number;
  termsVersion: number;
  /** Characters per account. */
  maxCharacters: number;
  /** New accounts per IP per hour. */
  registerPerHour: number;
  /** World name shown to players, e.g. "Kerava 1". */
  worldName: string;
  /** Max concurrent players in this world; the rest wait in a queue. */
  maxPlayers: number;
  /** Max players waiting in the queue; beyond this new connections are refused. */
  maxQueue: number;
  /** Who may use the Pörssi: character level and account age (0 in development). */
  marketMinLevel: number;
  marketMinAccountAgeMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    databaseUrl: env.DATABASE_URL ?? 'postgres://kerava:kerava@localhost:5432/kerava',
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '0.0.0.0',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    cookieSecure: env.COOKIE_SECURE === 'true',
    sessionTtlMs: 30 * 24 * 3600_000,
    termsVersion: 1,
    maxCharacters: 1,
    registerPerHour: Number(env.REGISTER_PER_HOUR ?? 3),
    worldName: env.WORLD_NAME ?? 'Kerava 1',
    maxPlayers: Number(env.MAX_PLAYERS ?? 20),
    maxQueue: Number(env.MAX_QUEUE ?? 50),
    marketMinLevel: Number(env.MARKET_MIN_LEVEL ?? (env.NODE_ENV === 'production' ? 5 : 0)),
    marketMinAccountAgeMs: Number(env.MARKET_MIN_ACCOUNT_AGE_H ?? (env.NODE_ENV === 'production' ? 24 : 0)) * 3600_000,
  };
}
