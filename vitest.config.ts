import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // DB-backed tests boot an in-memory Postgres (WASM) and run every migration; the first
    // one in a file can take several seconds on a busy machine.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
