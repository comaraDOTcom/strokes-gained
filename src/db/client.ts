/**
 * Singleton DB connection (Postgres). Every module that touches the DB imports
 * `db` from here.
 *
 *  - `DATABASE_URL` set  -> Neon serverless **Pool** (WebSocket). A Pool, not the
 *    HTTP driver: recompute/edit paths need real interactive transactions.
 *  - otherwise          -> PGlite (Postgres compiled to WASM), persisted at
 *    `PGLITE_DIR` (default `data/pglite`), or in memory when `PGLITE_DIR=memory://`
 *    (what the tests use). So local dev and CI need no Postgres install.
 *
 * Migrations are NOT run on import any more — run `pnpm db:migrate` (see
 * `src/db/migrate.ts`). Queries are async; every call site must be awaited.
 */
import path from 'node:path';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PGlite } from '@electric-sql/pglite';
import ws from 'ws';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
/** The transaction handle passed to `db.transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Either `db` or a `tx` — for helpers that work inside or outside a transaction. */
export type DbOrTx = Db | Tx;

function createDb(): { db: Db; close: () => Promise<void> } {
  const url = process.env.DATABASE_URL;

  if (url) {
    // Node < 22 has no global WebSocket; the driver needs one for the Pool.
    if (typeof WebSocket === 'undefined') neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: url });
    return {
      db: drizzleNeon(pool, { schema }) as unknown as Db,
      close: () => pool.end(),
    };
  }

  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), 'data', 'pglite');
  const client = new PGlite(dir);
  // PGlite's on-disk files don't survive a hard kill mid-write. Close cleanly on Ctrl-C / SIGTERM
  // so stopping `pnpm dev` doesn't corrupt data/pglite. (A SIGKILL still can — it's a dev database.)
  if (!dir.startsWith('memory://')) {
    for (const sig of ['SIGINT', 'SIGTERM'] as const) {
      process.once(sig, () => {
        void client.close().finally(() => process.exit(0));
      });
    }
  }
  return {
    db: drizzlePglite(client, { schema }) as unknown as Db,
    close: () => client.close(),
  };
}

type Created = { db: Db; close: () => Promise<void> };

/**
 * ONE connection per process (per database). Next's dev server compiles pages and
 * route handlers as separate module graphs, each of which would otherwise build its
 * own client — for PGlite that means several WASM instances fighting over one data
 * directory ("RuntimeError: Aborted()"), and for Neon a pool per bundle. Caching on
 * `globalThis` survives those separate graphs and hot reloads.
 *
 * In-memory databases (`memory://`, used by tests and the demo seed) are deliberately
 * NOT cached: every import gets a fresh one, which is what test isolation needs.
 */
const cache = ((globalThis as unknown as { __sgDbCache?: Map<string, Created> }).__sgDbCache ??= new Map());

function getOrCreate(): Created {
  const key = process.env.DATABASE_URL ?? process.env.PGLITE_DIR ?? 'default-pglite';
  if (key.startsWith('memory://')) return createDb();
  let hit = cache.get(key);
  if (!hit) {
    hit = createDb();
    cache.set(key, hit);
  }
  return hit;
}

const created = getOrCreate();

export const db: Db = created.db;

export async function closeDb(): Promise<void> {
  await created.close();
  for (const [k, v] of cache) if (v === created) cache.delete(k);
}

/** True when talking to Neon/Postgres over the network rather than local PGlite. */
export const isRemoteDb = Boolean(process.env.DATABASE_URL);
