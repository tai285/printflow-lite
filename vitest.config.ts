import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts because Vite's root is `web/`,
// while tests live in shared/, server/ and web/.
export default defineConfig({
  test: {
    include: ['{shared,server,web}/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
