/**
 * Singleton DB connection. Every module that touches the DB imports `db`
 * from here, which guarantees migrations have run before any query does.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

const DB_PATH = process.env.SG_DB_PATH ?? path.join(process.cwd(), 'data', 'rounds.db');
const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

if (fs.existsSync(MIGRATIONS_FOLDER)) {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

export function closeDb(): void {
  sqlite.close();
}
