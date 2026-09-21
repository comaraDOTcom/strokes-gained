import { defineConfig } from 'drizzle-kit';

// `db:generate` only diffs schema.ts against ./drizzle — no connection needed.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
});
