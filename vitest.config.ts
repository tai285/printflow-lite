import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts because Vite's root is `web/`,
// while tests live in shared/, server/ and web/.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['shared/**/*.test.ts', 'web/**/*.test.{ts,tsx}'],
          environment: 'node',
          // Component tests opt into the browser-like environment per file with
          // `// @vitest-environment jsdom`.
          setupFiles: ['./web/test-setup.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['server/**/*.int.test.ts'],
          environment: 'node',
          globalSetup: ['./server/test/global-setup.ts'],
          // All tests share one database, so files must run one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
})
