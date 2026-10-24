import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sessions } from '../db/schema.ts'
import { CSRF_VALUE } from '../http/csrf.ts'
import {
  TEST_PASSWORD,
  createTestContext,
  validOrderBody,
} from '../test/helpers.ts'

const ctx = createTestContext({ enableDemo: true })
beforeEach(() => ctx.reset())
afterAll(() => ctx.close())

/** A client that is not signed in but sends the CSRF header like our web app. */
const anon = (app: Parameters<typeof request>[0]) =>
  request.agent(app).set('X-Requested-With', CSRF_VALUE)

const email = () => `user-${crypto.randomUUID()}@example.com`
const register = (body: Record<string, unknown> = {}) =>
  anon(ctx.app)
    .post('/api/auth/register')
    .send({
      name: 'Pat Customer',
      email: email(),
      password: TEST_PASSWORD,
      ...body,
    })

const NO_ORDER = '00000000-0000-4000-8000-000000000000'

describe('registration and login', () => {
  it('registers a customer and starts a session cookie', async () => {
    const mixed = `Pat-${crypto.randomUUID()}@Example.com`
    const res = await register({ email: mixed })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      email: mixed.toLowerCase(),
      role: 'customer',
    })
    expect(res.body.passwordHash).toBeUndefined()
    const cookie = String(res.headers['set-cookie'])
    expect(cookie).toMatch(/pf_session=/)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
  })

  it('never lets a visitor choose their own role', async () => {
    const res = await register({ role: 'admin' })

    expect(res.status).toBe(201)
    expect(res.body.role).toBe('customer')
  })

  it('rejects weak passwords, bad emails and duplicate emails', async () => {
    const weak = await register({ password: 'short' })
    expect(weak.body.error.fields.password).toBeDefined()
    const bad = await register({ email: 'nope' })
    expect(bad.body.error.fields.email).toBeDefined()

    const address = `dup-${crypto.randomUUID()}@example.com`
    expect((await register({ email: address })).status).toBe(201)
    const second = await register({ email: address.toUpperCase() })
    expect(second.status).toBe(400)
    expect(second.body.error.fields.email).toBeDefined()
  })

  it('logs in with the right password and reports /me', async () => {
    const address = email()
    await register({ email: address })
    const agent = anon(ctx.app)
    const login = await agent
      .post('/api/auth/login')
      .send({ email: address, password: TEST_PASSWORD })

    expect(login.status).toBe(200)
    expect((await agent.get('/api/auth/me')).body.email).toBe(address)
  })

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const address = email()
    await register({ email: address })
    const wrong = await anon(ctx.app)
      .post('/api/auth/login')
      .send({ email: address, password: 'not the password!!' })
    const unknown = await anon(ctx.app)
      .post('/api/auth/login')
      .send({ email: email(), password: 'not the password!!' })

    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body).toEqual(unknown.body)
  })

  it('logout ends the session on the server, not just in the browser', async () => {
    const { agent } = await ctx.signIn('customer')
    expect((await agent.get('/api/auth/me')).status).toBe(200)

    expect((await agent.post('/api/auth/logout')).status).toBe(204)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })

  it('does not accept an expired session', async () => {
    const { agent } = await ctx.signIn('customer')
    await ctx.db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })

    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })

  it('stores only a hash of the session token', async () => {
    const res = await register()
    const token = /pf_session=([^;]+)/.exec(
      String(res.headers['set-cookie']),
    )![1]!
    const stored = (await ctx.db.select().from(sessions)).map(
      (row) => row.tokenHash,
    )

    expect(stored).not.toContain(token)
  })

  it('rate limits credential attempts', async () => {
    const strict = createTestContext({ authRateLimitMax: 2 })
    try {
      const attempt = () =>
        anon(strict.app)
          .post('/api/auth/login')
          .send({ email: 'a@example.com', password: 'x' })
      expect((await attempt()).status).toBe(401)
      expect((await attempt()).status).toBe(401)
      expect((await attempt()).status).toBe(429)
    } finally {
      await strict.close()
    }
  })
})

describe('access control', () => {
  it('answers 401 to every order route when signed out', async () => {
    const app = anon(ctx.app)
    expect((await app.get('/api/orders')).status).toBe(401)
    expect((await app.post('/api/orders').send(validOrderBody)).status).toBe(
      401,
    )
    expect((await app.get(`/api/orders/${NO_ORDER}`)).status).toBe(401)
    expect(
      (await app.post(`/api/orders/${NO_ORDER}/transitions`).send({})).status,
    ).toBe(401)
  })

  it('lets a customer see only their own orders', async () => {
    const alice = await ctx.signIn('customer')
    const bob = await ctx.signIn('customer')
    expect(
      (await alice.agent.post('/api/orders').send(validOrderBody)).status,
    ).toBe(201)

    expect((await alice.agent.get('/api/orders')).body).toHaveLength(1)
    expect((await bob.agent.get('/api/orders')).body).toHaveLength(0)
  })

  it("answers 404 (not 403) when a customer opens someone else's order", async () => {
    const alice = await ctx.signIn('customer')
    const bob = await ctx.signIn('customer')
    const order = (await alice.agent.post('/api/orders').send(validOrderBody))
      .body

    expect((await alice.agent.get(`/api/orders/${order.id}`)).status).toBe(200)
    expect((await bob.agent.get(`/api/orders/${order.id}`)).status).toBe(404)
  })

  it('lets staff see every order', async () => {
    const alice = await ctx.signIn('customer')
    const staff = await ctx.signIn('staff')
    const order = (await alice.agent.post('/api/orders').send(validOrderBody))
      .body

    expect((await staff.agent.get(`/api/orders/${order.id}`)).status).toBe(200)
    expect((await staff.agent.get('/api/orders')).body).toHaveLength(1)
  })

  it('only lets staff and admins advance an order', async () => {
    const alice = await ctx.signIn('customer')
    const staff = await ctx.signIn('staff')
    const order = (await alice.agent.post('/api/orders').send(validOrderBody))
      .body
    const url = `/api/orders/${order.id}/transitions`
    const body = { from: 'quote', to: 'approved' }

    const denied = await alice.agent.post(url).send(body)
    expect(denied.status).toBe(403)
    expect(denied.body.error.code).toBe('FORBIDDEN')
    expect((await staff.agent.post(url).send(body)).status).toBe(200)
  })

  it('keeps the demo endpoints admin-only', async () => {
    const staff = await ctx.signIn('staff')
    const admin = await ctx.signIn('admin')

    expect((await anon(ctx.app).post('/api/samples')).status).toBe(401)
    expect((await staff.agent.post('/api/samples')).status).toBe(403)
    expect((await admin.agent.post('/api/samples')).status).toBe(201)
  })

  it('does not mount the demo endpoints unless the demo is enabled', async () => {
    const prod = createTestContext()
    try {
      const admin = await prod.signIn('admin')
      expect((await admin.agent.post('/api/samples')).status).toBe(404)
    } finally {
      await prod.close()
    }
  })
})

describe('CSRF protection', () => {
  it('rejects state-changing requests without the custom header', async () => {
    const { cookie } = await ctx.signIn('customer')
    // A valid session cookie, but sent the way a forged form post would be.
    const forged = await request(ctx.app)
      .post('/api/orders')
      .set('Cookie', cookie)
      .send(validOrderBody)

    expect(forged.status).toBe(403)
    expect(forged.body.error.code).toBe('FORBIDDEN')
    const login = await request(ctx.app).post('/api/auth/login').send({})
    expect(login.status).toBe(403)
  })

  it('rejects a browser request from another origin even with the header', async () => {
    const { agent } = await ctx.signIn('customer')
    const res = await agent
      .post('/api/orders')
      .set('Origin', 'https://evil.example')
      .send(validOrderBody)

    expect(res.status).toBe(403)
  })

  it('accepts a same-origin Origin header, and reads need no header', async () => {
    const proxied = createTestContext({ trustProxy: 1 })
    try {
      const { agent } = await proxied.signIn('customer')
      const ok = await agent
        .post('/api/orders')
        .set('X-Forwarded-Host', 'shop.example.com')
        .set('Origin', 'https://shop.example.com')
        .send(validOrderBody)

      expect(ok.status).toBe(201)
      expect((await request(ctx.app).get('/api/health')).status).toBe(200)
    } finally {
      await proxied.close()
    }
  })
})
