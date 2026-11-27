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
  };
}
