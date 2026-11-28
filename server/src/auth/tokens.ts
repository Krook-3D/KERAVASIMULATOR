import { createHash, randomBytes } from 'node:crypto';

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only this hash is stored, so a database leak does not leak sessions. */
export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export const SESSION_COOKIE = 'ks_session';
