import { runMigrations } from '../src/db/migrate';
import { closeDb, isRemoteDb } from '../src/db/client';

async function main() {
  console.log(`Migrating ${isRemoteDb ? 'Neon (DATABASE_URL)' : 'local PGlite'}…`);
  await runMigrations();
  console.log('Migrations up to date.');
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
