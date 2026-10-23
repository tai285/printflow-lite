import { sql } from 'drizzle-orm'
import { createApp } from '../app.ts'
import type { AppOptions } from '../app.ts'
import { createDb } from '../db/client.ts'
import type { DbHandle } from '../db/client.ts'
import { DEFAULT_TEST_DATABASE_URL } from './global-setup.ts'

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL

export type TestContext = DbHandle & {
  app: ReturnType<typeof createApp>
  /** Deletes all orders (and, by cascade, their events). */
  reset: () => Promise<void>
}

export function createTestContext(
  options: Partial<Omit<AppOptions, 'db'>> = {},
): TestContext {
  const handle = createDb(TEST_DATABASE_URL)
  const app = createApp({
    db: handle.db,
    version: 'test-sha',
    rateLimitMax: 10_000,
    ...options,
  })
  return {
    ...handle,
    app,
    reset: async () => {
      await handle.db.execute(
        sql`truncate table orders restart identity cascade`,
      )
    },
  }
}

export const validTshirt = {
  productId: 'tshirt',
  method: 'screen',
  quantity: 50,
  locations: 1,
  colours: 2,
  rush: false,
}

export const validOrderBody = {
  customerName: 'Test Customer',
  customerEmail: 'test@example.com',
  input: validTshirt,
}
