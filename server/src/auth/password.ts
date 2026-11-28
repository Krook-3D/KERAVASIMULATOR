import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** scrypt parameters; stored with each hash so they can be raised later. */
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

const opts = (n: number, r: number, p: number): ScryptOptions => ({ N: n, r, p, maxmem: 256 * n * r });

/** Format: scrypt$N$r$p$saltB64$hashB64 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, opts(N, R, P));
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, opts(+n, +r, +p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** True if the stored hash uses weaker parameters than the current ones. */
export function needsRehash(stored: string): boolean {
  const [, n, r, p] = stored.split('$');
  return Number(n) < N || Number(r) < R || Number(p) < P;
}

/** Hash used when the account does not exist, so login timing does not reveal it. */
export const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

const COMMON = new Set([
  'salasana123', 'salasana1234', 'password123', 'qwertyuiop', '1234567890', '0123456789',
  'qwerty1234', 'kerava1234', 'keravasimulator', 'iloveyou12', 'password1!', 'aaaaaaaaaa',
]);

export function passwordProblem(password: string): string | null {
  if (password.length < 10) return 'Salasanan pitää olla vähintään 10 merkkiä.';
  if (password.length > 200) return 'Salasana on liian pitkä.';
  if (COMMON.has(password.toLowerCase())) return 'Salasana on liian yleinen.';
  return null;
}
