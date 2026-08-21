import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  // 20s: the data-collection integration tests run the real calculation
  // pipeline (several sequential DB round trips inside one transaction)
  // against the live seeded database, not a mock — the default 5s is too
  // tight for that, not a sign anything is actually slow.
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 20000 },
  resolve: { alias: [{ find: '@', replacement: srcDir }] },
});
