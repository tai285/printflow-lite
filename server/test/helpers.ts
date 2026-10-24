import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import request from 'supertest'
import { createApp } from '../app.ts'
import { createUser } from '../auth/users.ts'
import { CSRF_VALUE } from '../http/csrf.ts'
import type { UserRole } from '../../shared/roles.ts'
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
  /** Creates a user with the role and returns an agent signed in as them. */
  signIn: (role: UserRole) => Promise<SignedIn>
}

export const TEST_PASSWORD = 'correct horse battery'

export type SignedIn = {
  agent: ReturnType<typeof request.agent>
  user: { id: string; email: string; role: UserRole }
  /** The raw Cookie header value, for building requests without the agent. */
  cookie: string
}

export function createTestContext(
  options: Partial<Omit<AppOptions, 'db'>> = {},
): TestContext {
  const handle = createDb(TEST_DATABASE_URL)
  const app = createApp({
    db: handle.db,
    version: 'test-sha',
    rateLimitMax: 10_000,
    authRateLimitMax: 10_000,
    ...options,
  })
  return {
    ...handle,
    app,
    signIn: async (role) => {
      const user = await createUser(handle.db, {
        email: `${role}-${randomUUID()}@example.com`,
        name: `Test ${role}`,
        password: TEST_PASSWORD,
        role,
      })
      const agent = request.agent(app).set('X-Requested-With', CSRF_VALUE)
      const res = await agent
        .post('/api/auth/login')
        .send({ email: user!.email, password: TEST_PASSWORD })
      if (res.status !== 200) throw new Error('Test sign-in failed')
      const cookie = String(res.headers['set-cookie']).split(';')[0]!
      return { agent, user: user!, cookie }
    },
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
