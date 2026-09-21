/**
 * Apply pending SQL migrations from ./drizzle to whichever database `client.ts`
 * connected to. Split out of client.ts so importing `db` never has side effects.
 *
 *   pnpm db:migrate            (local PGlite, or Neon when DATABASE_URL is set)
 *
 * Tests call `runMigrations()` directly against a fresh in-memory PGlite.
 */
import path from 'node:path';
import { migrate as migrateNeon } from 'drizzle-orm/neon-serverless/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { db, isRemoteDb } from './client';

export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  // Both migrators share a signature; the cast just picks the right driver's flavour.
  if (isRemoteDb) await migrateNeon(db as never, { migrationsFolder });
  else await migratePglite(db as never, { migrationsFolder });
}
