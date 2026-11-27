/**
 * Atomic trade commit: one transaction, rows locked in id order, every
 * transfer re-checked with conditional updates. If anything changed since
 * the offer (item sold elsewhere, second tab), the whole trade rolls back.
 */
import { withTx, type Db, type Tx } from '../db/pool';
import { addItem, addMoney, InsufficientError, lockCharacters, takeItem, takeMoney } from '../economy/ledger';
import { TRADE } from '../../../shared/economy';
import { getItem } from '../../../shared/items';
import type { TradeOffer } from '../../../shared/protocol';
import { levelFromXp } from '../../../src/game/xp/xp';

export interface CommitInput {
  tradeId: string;
  a: { id: string; offer: TradeOffer };
  b: { id: string; offer: TradeOffer };
  createdAt: number;
}

export type CommitResult = { ok: true } | { ok: false; reason: 'items_changed' | 'not_allowed' };

/** Value of an offer at NPC base values, cents. Used for new-account limits and the scam warning. */
export function offerValue(offer: TradeOffer): number {
  return offer.money + offer.items.reduce((sum, it) => sum + (getItem(it.itemId)?.valueCents ?? 0) * it.quantity, 0);
}

export function hasStreetGoods(offer: TradeOffer): boolean {
  return offer.items.some((it) => getItem(it.itemId)?.tradeability === 'street');
}

/** Heat added to both parties when street goods change hands face to face. */
export const STREET_TRADE_HEAT = 8;

async function givenToday(tx: Tx, characterId: string): Promise<number> {
  const { rows } = await tx.query<{ a_id: string; a_offer: TradeOffer; b_offer: TradeOffer }>(
    `SELECT a_id, a_offer, b_offer FROM trades
      WHERE status = 'completed' AND completed_at > now() - interval '1 day' AND (a_id = $1 OR b_id = $1)`,
    [characterId],
  );
  return rows.reduce((sum, r) => sum + offerValue(r.a_id === characterId ? r.a_offer : r.b_offer), 0);
}

async function checkGiver(tx: Tx, characterId: string, offer: TradeOffer, status: string): Promise<boolean> {
  if (status === 'banned' || status === 'trade_banned') return false;
  const { rows } = await tx.query<{ xp: number; play_seconds: number; jailed_until: Date | null }>(
    'SELECT xp, play_seconds, jailed_until FROM characters WHERE id = $1',
    [characterId],
  );
  const c = rows[0]!;
  if (c.jailed_until && c.jailed_until > new Date()) return false;
  const value = offerValue(offer);
  if (value === 0) return true;
  const lim = TRADE.newAccount;
  const isNew = c.play_seconds < lim.minPlaySeconds || levelFromXp(c.xp) < lim.minLevel;
  if (!isNew) return true;
  return (await givenToday(tx, characterId)) + value <= lim.dailyGiveCents;
}

async function transfer(tx: Tx, from: string, to: string, offer: TradeOffer, tradeId: string): Promise<void> {
  const ref = { type: 'trade', id: tradeId };
  for (const it of offer.items) {
    await takeItem(tx, from, it.itemId, it.quantity, 'trade', ref);
    await addItem(tx, to, it.itemId, it.quantity, 'trade', ref);
  }
  if (offer.money > 0) {
    await takeMoney(tx, from, offer.money, 'trade', ref);
    await addMoney(tx, to, offer.money, 'trade', ref);
  }
}

class NotAllowed extends Error {}

export async function commitTrade(db: Db, input: CommitInput): Promise<CommitResult> {
  try {
    await withTx(db, async (tx) => {
      const locked = await lockCharacters(tx, [input.a.id, input.b.id]);
      for (const side of [input.a, input.b]) {
        if (!(await checkGiver(tx, side.id, side.offer, locked.get(side.id)!.accountStatus))) throw new NotAllowed();
      }
      await transfer(tx, input.a.id, input.b.id, input.a.offer, input.tradeId);
      await transfer(tx, input.b.id, input.a.id, input.b.offer, input.tradeId);
      if (hasStreetGoods(input.a.offer) || hasStreetGoods(input.b.offer)) {
        await tx.query('UPDATE characters SET heat = least(100, heat + $1), heat_updated_at = now() WHERE id = ANY($2)', [
          STREET_TRADE_HEAT,
          [input.a.id, input.b.id],
        ]);
      }
      await tx.query(
        `INSERT INTO trades (id, a_id, b_id, a_offer, b_offer, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'completed', to_timestamp($6 / 1000.0))`,
        [input.tradeId, input.a.id, input.b.id, JSON.stringify(input.a.offer), JSON.stringify(input.b.offer), input.createdAt],
      );
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof InsufficientError) return { ok: false, reason: 'items_changed' };
    if (err instanceof NotAllowed) return { ok: false, reason: 'not_allowed' };
    // Primary key clash: this trade id was already committed (replay). Never apply twice.
    if ((err as { code?: string }).code === '23505') return { ok: false, reason: 'items_changed' };
    throw err;
  }
}

/** Fast pre-check when an offer is edited (the commit re-checks authoritatively). */
export async function ownsOffer(db: Db, characterId: string, offer: TradeOffer): Promise<boolean> {
  const { rows } = await db.query<{ money: number; items: Record<string, number> | null }>(
    `SELECT c.money,
            (SELECT jsonb_object_agg(item_id, quantity) FROM inventory_items WHERE character_id = c.id AND location = 'pack') AS items
       FROM characters c WHERE c.id = $1`,
    [characterId],
  );
  const row = rows[0];
  if (!row || row.money < offer.money) return false;
  return offer.items.every((it) => (row.items?.[it.itemId] ?? 0) >= it.quantity);
}
