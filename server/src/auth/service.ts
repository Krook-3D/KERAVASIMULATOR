import type { Db } from '../db/pool';
import { DUMMY_HASH, hashPassword, needsRehash, passwordProblem, verifyPassword } from './password';
import { hashToken, newToken } from './tokens';

export type AccountStatus = 'active' | 'muted' | 'trade_banned' | 'banned';

export interface Account {
  id: string;
  email: string;
  status: AccountStatus;
  createdAt: Date;
}

export class AuthError extends Error {
  constructor(
    public code: 'invalid' | 'taken' | 'rate_limited' | 'banned' | 'weak_password' | 'not_adult',
    message: string,
  ) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

/** Login limits, docs/MULTIPLAYER.md section 2. */
const LOGIN_WINDOW = '15 minutes';
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 30;

export interface AuthOptions {
  sessionTtlMs: number;
  termsVersion: number;
}

export class AuthService {
  constructor(
    private db: Db,
    private opts: AuthOptions,
  ) {}

  async register(input: { email: string; password: string; adult: boolean }): Promise<Account> {
    const email = input.email.trim();
    if (!EMAIL_RE.test(email)) throw new AuthError('invalid', 'Tarkista sähköpostiosoite.');
    if (!input.adult) throw new AuthError('not_adult', 'Peli on K18. Vahvista että olet täysi-ikäinen.');
    const problem = passwordProblem(input.password);
    if (problem) throw new AuthError('weak_password', problem);
    const hash = await hashPassword(input.password);
    try {
      const { rows } = await this.db.query(
        `INSERT INTO accounts (email, password_hash, adult_confirmed_at, terms_version)
         VALUES ($1, $2, now(), $3) RETURNING id, email, status, created_at`,
        [email, hash, this.opts.termsVersion],
      );
      return toAccount(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw new AuthError('taken', 'Sähköposti on jo käytössä.');
      throw err;
    }
  }

  /** Returns a new session token. */
  async login(input: { email: string; password: string; ip?: string; userAgent?: string }): Promise<{ token: string; account: Account }> {
    const email = input.email.trim();
    const ip = input.ip ?? null;
    const { rows: fails } = await this.db.query<{ by_email: number; by_ip: number }>(
      `SELECT count(*) FILTER (WHERE lower(email) = lower($1))::int AS by_email,
              count(*) FILTER (WHERE ip = $2)::int AS by_ip
         FROM login_attempts
        WHERE NOT success AND created_at > now() - $3::interval
          AND (lower(email) = lower($1) OR ip = $2)`,
      [email, ip, LOGIN_WINDOW],
    );
    const f = fails[0]!;
    if (f.by_email >= MAX_FAILS_PER_EMAIL || f.by_ip >= MAX_FAILS_PER_IP) {
      throw new AuthError('rate_limited', 'Liian monta yritystä. Odota hetki ja yritä uudelleen.');
    }

    const { rows } = await this.db.query(
      `SELECT id, email, status, status_until, created_at, password_hash FROM accounts WHERE lower(email) = lower($1)`,
      [email],
    );
    const row = rows[0];
    // Always run scrypt so response time does not reveal whether the account exists.
    const ok = await verifyPassword(input.password, row?.password_hash ?? DUMMY_HASH);
    await this.db.query('INSERT INTO login_attempts (email, ip, success) VALUES ($1, $2, $3)', [email, ip, ok && !!row]);
    if (!row || !ok) throw new AuthError('invalid', 'Väärä sähköposti tai salasana.');
    if (isBanned(row)) throw new AuthError('banned', 'Tili on suljettu.');

    if (needsRehash(row.password_hash)) {
      await this.db.query('UPDATE accounts SET password_hash = $1 WHERE id = $2', [await hashPassword(input.password), row.id]);
    }
    const token = newToken();
    await this.db.query(
      `INSERT INTO sessions (token_hash, account_id, expires_at, ip, user_agent)
       VALUES ($1, $2, now() + $3 * interval '1 millisecond', $4, $5)`,
      [hashToken(token), row.id, this.opts.sessionTtlMs, ip, input.userAgent?.slice(0, 300) ?? null],
    );
    await this.db.query('UPDATE accounts SET last_login_at = now() WHERE id = $1', [row.id]);
    return { token, account: toAccount(row) };
  }

  /** Resolves a session token to its account, sliding the expiry. Null if invalid. */
  async authenticate(token: string | undefined): Promise<Account | null> {
    if (!token || token.length > 100) return null;
    const { rows } = await this.db.query(
      `UPDATE sessions s SET expires_at = now() + $2 * interval '1 millisecond'
         FROM accounts a
        WHERE s.token_hash = $1 AND s.expires_at > now() AND a.id = s.account_id
        RETURNING a.id, a.email, a.status, a.status_until, a.created_at`,
      [hashToken(token), this.opts.sessionTtlMs],
    );
    const row = rows[0];
    if (!row || isBanned(row)) return null;
    return toAccount(row);
  }

  async logout(token: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  }

  async logoutEverywhere(accountId: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE account_id = $1', [accountId]);
  }
}

function isBanned(row: { status: string; status_until: Date | null }): boolean {
  return row.status === 'banned' && (!row.status_until || row.status_until > new Date());
}

function toAccount(row: { id: string; email: string; status: AccountStatus; status_until?: Date | null; created_at: Date }): Account {
  // Temporary statuses fall back to active once they expire.
  const expired = row.status_until && row.status_until <= new Date();
  return { id: row.id, email: row.email, status: expired ? 'active' : row.status, createdAt: row.created_at };
}
