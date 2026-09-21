/**
 * Test helper: a brand-new in-memory Postgres (PGlite) with every migration
 * applied, plus the app modules bound to it. Each call resets the module graph,
 * so tests never share a database.
 */
import { vi } from 'vitest';

export async function freshDb() {
  process.env.PGLITE_DIR = 'memory://';
  delete process.env.DATABASE_URL;
  vi.resetModules();

  const client = await import('./client');
  const schema = await import('./schema');
  const { runMigrations } = await import('./migrate');
  await runMigrations();

  return { db: client.db, closeDb: client.closeDb, schema };
}

/** Insert a user row directly (bypasses the invite gate — for arranging test data). */
export async function makeUser(
  ctx: Awaited<ReturnType<typeof freshDb>>,
  id: string,
  opts: { email?: string; name?: string; emailVerified?: boolean } = {},
) {
  const [row] = await ctx.db
    .insert(ctx.schema.user)
    .values({ id, name: opts.name ?? id, email: opts.email ?? `${id}@example.com`, emailVerified: opts.emailVerified ?? true })
    .returning();
  return row!;
}
