import { defineConfig } from 'vitest/config';

// Unit tests must not depend on canon/persona/memory markdown files (those are
// written by another worker in parallel). Tests target sim/lib/*.test.ts only.
export default defineConfig({
  test: {
    include: ['sim/**/*.test.ts'],
    environment: 'node',
  },
});
