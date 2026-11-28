import pg from 'pg';

export type Db = pg.Pool;
/** A client inside an open transaction. Economy functions only accept this. */
export type Tx = pg.PoolClient & { readonly __tx: true };

// bigint columns (money, quantities) come back as JS numbers. All values are
// capped well below 2^53 by CHECK constraints, so this is lossless.
pg.types.setTypeParser(20, (v) => Number(v));

export function createPool(connectionString: string): Db {
  return new pg.Pool({ connectionString, max: 20 });
}

/**
 * Runs fn in a transaction. Retries on serialization failures and deadlocks,
 * which are expected under contention and always safe to retry because the
 * whole transaction was rolled back.
 */
export async function withTx<T>(db: Db, fn: (tx: Tx) => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client as Tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const code = (err as { code?: string }).code;
      if ((code === '40001' || code === '40P01') && attempt < retries) continue;
      throw err;
    } finally {
      client.release();
    }
  }
}
