import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  // 30s: the data-collection integration tests run the real calculation
  // pipeline (several sequential DB round trips inside one transaction)
  // against the live seeded database, not a mock — the default 5s is too
  // tight for that. The transaction's own Prisma timeout is 15s (see
  // withOrgTransaction / submitAnswer) to absorb Neon's scale-to-zero cold
  // start, which alone measured 2.4s; this needs enough margin above that
  // for the test framework not to cut it off first.
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 30000 },
  resolve: { alias: [{ find: '@', replacement: srcDir }] },
});
