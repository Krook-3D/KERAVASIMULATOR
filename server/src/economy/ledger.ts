/**
 * The only module allowed to change money or items.
 * Every function takes an open transaction and writes a ledger row, so
 * sum(ledger.delta) always equals the current balance. Checks and writes are
 * done in a single conditional statement so concurrent requests cannot both
 * spend the same money or item. See docs/MULTIPLAYER.md section 8.
 */
import type { Db, Tx } from '../db/pool';
import { MAX_MONEY_CENTS } from '../../../shared/economy';
import { getItem } from '../../../shared/items';

export type Location = 'pack' | 'home';

/** Names every money/item source and sink, so the economy can be measured. */
export type LedgerReason =
  | 'starting_money'
  | 'trade'
  | 'npc_buy'
  | 'npc_sell'
  | 'quest_reward'
  | 'activity_loot'
  | 'item_used'
  | 'market_escrow'
  | 'market_collect'
  | 'market_tax'
  | 'arena_stake'
  | 'arena_fee'
  | 'fine'
  | 'confiscation'
  | 'storage_move'
  | 'admin_restore';

export interface LedgerRef {
  type: string;
  id: string;
}

export class InsufficientError extends Error {
  constructor(
    public what: 'money' | 'item',
    public itemId?: string,
  ) {
    super(what === 'money' ? 'insufficient money' : `insufficient item ${itemId}`);
  }
}

function assertAmount(n: number): void {
  if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError(`amount must be a positive integer, got ${n}`);
}

async function writeLedger(
  tx: Tx,
  row: { characterId: string; kind: 'money' | 'item'; itemId?: string; location?: Location; delta: number; balanceAfter: number; reason: LedgerReason; ref?: LedgerRef },
): Promise<void> {
  await tx.query(
    `INSERT INTO ledger (character_id, kind, item_id, location, delta, balance_after, reason, ref_type, ref_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [row.characterId, row.kind, row.itemId ?? null, row.location ?? null, row.delta, row.balanceAfter, row.reason, row.ref?.type ?? null, row.ref?.id ?? null],
  );
}

export async function addMoney(tx: Tx, characterId: string, amount: number, reason: LedgerReason, ref?: LedgerRef): Promise<number> {
  assertAmount(amount);
  const { rows } = await tx.query<{ money: number }>(
    'UPDATE characters SET money = money + $1 WHERE id = $2 AND money + $1 <= $3 RETURNING money',
    [amount, characterId, MAX_MONEY_CENTS],
  );
  if (!rows[0]) throw new RangeError('wallet full or character missing');
  await writeLedger(tx, { characterId, kind: 'money', delta: amount, balanceAfter: rows[0].money, reason, ref });
  return rows[0].money;
}

export async function takeMoney(tx: Tx, characterId: string, amount: number, reason: LedgerReason, ref?: LedgerRef): Promise<number> {
  assertAmount(amount);
  const { rows } = await tx.query<{ money: number }>(
    'UPDATE characters SET money = money - $1 WHERE id = $2 AND money >= $1 RETURNING money',
    [amount, characterId],
  );
  if (!rows[0]) throw new InsufficientError('money');
  await writeLedger(tx, { characterId, kind: 'money', delta: -amount, balanceAfter: rows[0].money, reason, ref });
  return rows[0].money;
}

export async function addItem(
  tx: Tx,
  characterId: string,
  itemId: string,
  quantity: number,
  reason: LedgerReason,
  ref?: LedgerRef,
  location: Location = 'pack',
): Promise<number> {
  assertAmount(quantity);
  if (!getItem(itemId)) throw new RangeError(`unknown item ${itemId}`);
  const { rows } = await tx.query<{ quantity: number }>(
    `INSERT INTO inventory_items (character_id, location, item_id, quantity) VALUES ($1, $2, $3, $4)
     ON CONFLICT (character_id, location, item_id) DO UPDATE SET quantity = inventory_items.quantity + EXCLUDED.quantity
     RETURNING quantity`,
    [characterId, location, itemId, quantity],
  );
  const after = rows[0]!.quantity;
  await writeLedger(tx, { characterId, kind: 'item', itemId, location, delta: quantity, balanceAfter: after, reason, ref });
  return after;
}

export async function takeItem(
  tx: Tx,
  characterId: string,
  itemId: string,
  quantity: number,
  reason: LedgerReason,
  ref?: LedgerRef,
  location: Location = 'pack',
): Promise<number> {
  assertAmount(quantity);
  // Stacks never reach 0 (CHECK quantity > 0): taking all of it deletes the row.
  // Both statements are conditional, so a concurrent take cannot overdraw.
  const params = [characterId, location, itemId, quantity];
  const updated = await tx.query<{ quantity: number }>(
    `UPDATE inventory_items SET quantity = quantity - $4
      WHERE character_id = $1 AND location = $2 AND item_id = $3 AND quantity > $4
      RETURNING quantity`,
    params,
  );
  let after = updated.rows[0]?.quantity;
  if (after === undefined) {
    const deleted = await tx.query(
      'DELETE FROM inventory_items WHERE character_id = $1 AND location = $2 AND item_id = $3 AND quantity = $4',
      params,
    );
    if (deleted.rowCount !== 1) throw new InsufficientError('item', itemId);
    after = 0;
  }
  await writeLedger(tx, { characterId, kind: 'item', itemId, location, delta: -quantity, balanceAfter: after, reason, ref });
  return after;
}

/** Locks character rows in a fixed order (by id) to avoid deadlocks between concurrent trades. */
export async function lockCharacters(tx: Tx, ids: string[]): Promise<Map<string, { money: number; accountStatus: string }>> {
  const sorted = [...new Set(ids)].sort();
  const result = new Map<string, { money: number; accountStatus: string }>();
  for (const id of sorted) {
    const { rows } = await tx.query<{ money: number; status: string; status_until: Date | null }>(
      `SELECT c.money, a.status, a.status_until FROM characters c JOIN accounts a ON a.id = c.account_id
        WHERE c.id = $1 FOR UPDATE OF c`,
      [id],
    );
    const row = rows[0];
    if (!row) throw new RangeError(`character ${id} missing`);
    const expired = row.status_until && row.status_until <= new Date();
    result.set(id, { money: row.money, accountStatus: expired ? 'active' : row.status });
  }
  return result;
}

export interface AuditProblem {
  kind: 'money' | 'item';
  itemId?: string;
  location?: string;
  balance: number;
  ledgerSum: number;
}

/** Checks that the ledger explains every balance of one character (nightly audit). */
export async function auditCharacter(db: Db | Tx, characterId: string): Promise<AuditProblem[]> {
  const problems: AuditProblem[] = [];
  const money = await db.query<{ money: number; sum: number }>(
    `SELECT c.money, coalesce((SELECT sum(delta) FROM ledger l WHERE l.character_id = c.id AND kind = 'money'), 0)::bigint AS sum
       FROM characters c WHERE c.id = $1`,
    [characterId],
  );
  const m = money.rows[0];
  if (m && m.money !== m.sum) problems.push({ kind: 'money', balance: m.money, ledgerSum: m.sum });

  const items = await db.query<{ item_id: string; location: string; quantity: number; sum: number }>(
    `WITH l AS (
       SELECT item_id, location, sum(delta)::bigint AS sum FROM ledger
        WHERE character_id = $1 AND kind = 'item' GROUP BY item_id, location)
     SELECT coalesce(i.item_id, l.item_id) AS item_id, coalesce(i.location, l.location) AS location,
            coalesce(i.quantity, 0)::bigint AS quantity, coalesce(l.sum, 0)::bigint AS sum
       FROM (SELECT * FROM inventory_items WHERE character_id = $1) i
       FULL JOIN l ON l.item_id = i.item_id AND l.location = i.location
      WHERE coalesce(i.quantity, 0) <> coalesce(l.sum, 0)`,
    [characterId],
  );
  for (const r of items.rows) problems.push({ kind: 'item', itemId: r.item_id, location: r.location, balance: r.quantity, ledgerSum: r.sum });
  return problems;
}
