import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // evals/ has its own tsx-run harness; only tests/ belongs to vitest.
    include: ['tests/**/*.test.ts'],
  },
});
