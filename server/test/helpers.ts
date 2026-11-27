import { createPool, withTx, type Db } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';
import { CharacterService } from '../src/characters/service';
import { addItem } from '../src/economy/ledger';
import { hashPassword } from '../src/auth/password';

export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? 'postgres://kerava:kerava@localhost:5432/kerava_test';

let available: boolean | undefined;

/** DB tests are skipped (not failed) when no PostgreSQL is reachable. */
export async function dbAvailable(): Promise<boolean> {
  if (available !== undefined) return available;
  const db = createPool(TEST_DB_URL);
  try {
    await db.query('SELECT 1');
    available = true;
  } catch {
    available = false;
  } finally {
    await db.end();
  }
  return available;
}

export async function freshDb(): Promise<Db> {
  const db = createPool(TEST_DB_URL);
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations(db);
  return db;
}

let counter = 0;
let cachedHash: string | undefined;

/** Creates an account + character directly (fast path for tests). */
export async function makeCharacter(db: Db, opts: { name?: string; items?: Record<string, number>; veteran?: boolean } = {}) {
  counter++;
  cachedHash ??= await hashPassword('testisalasana-123');
  const { rows } = await db.query(
    `INSERT INTO accounts (email, password_hash, adult_confirmed_at, terms_version) VALUES ($1, $2, now(), 1) RETURNING id`,
    [`p${counter}-${Date.now()}@example.com`, cachedHash],
  );
  const chars = new CharacterService(db, 1);
  const c = await chars.create(rows[0].id, { name: opts.name ?? `Pelaaja${counter}`, color: '#ffd23f' });
  if (opts.veteran !== false) {
    // Past the new-account trade limits.
    await db.query('UPDATE characters SET xp = 1000, play_seconds = 100000 WHERE id = $1', [c.id]);
  }
  if (opts.items) {
    await withTx(db, async (tx) => {
      for (const [itemId, qty] of Object.entries(opts.items!)) await addItem(tx, c.id, itemId, qty, 'admin_restore');
    });
  }
  return { ...c, accountId: rows[0].id as string };
}

export async function money(db: Db, id: string): Promise<number> {
  return (await db.query('SELECT money FROM characters WHERE id = $1', [id])).rows[0].money;
}

export async function qty(db: Db, id: string, itemId: string): Promise<number> {
  const { rows } = await db.query(`SELECT quantity FROM inventory_items WHERE character_id = $1 AND item_id = $2 AND location = 'pack'`, [id, itemId]);
  return rows[0]?.quantity ?? 0;
}
