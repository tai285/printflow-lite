import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { createDb } from './db/client.ts'
import { createTestContext } from './test/helpers.ts'

const ctx = createTestContext()
afterAll(() => ctx.close())

describe('GET /api/health', () => {
  it('reports ok, db ok and the build version', async () => {
    const res = await request(ctx.app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', db: 'ok', version: 'test-sha' })
  })

  it('returns 503 when the database is unreachable', async () => {
    const broken = createDb('postgres://nobody:nope@127.0.0.1:1/none')
    try {
      const app = createApp({ db: broken.db, version: 'x' })
      const res = await request(app).get('/api/health')

      expect(res.status).toBe(503)
      expect(res.body).toEqual({ status: 'error', db: 'down', version: 'x' })
    } finally {
      await broken.close()
    }
  })
})

describe('error handling', () => {
  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await request(ctx.app).get('/api/nope')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 for malformed JSON', async () => {
    const res = await request(ctx.app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .send('{bad')

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 413 for bodies over 10 kB', async () => {
    const res = await request(ctx.app)
      .post('/api/orders')
      .send({ customerName: 'x'.repeat(20_000) })

    expect(res.status).toBe(413)
    expect(res.body.error.message).toMatch(/too large/)
  })

  it('does not leak the framework and sets security headers', async () => {
    const res = await request(ctx.app).get('/api/health')

    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('rejects an empty body with field errors', async () => {
    const res = await request(ctx.app).post('/api/orders').send({})

    expect(res.status).toBe(400)
    expect(res.body.error.fields.customerName).toBeDefined()
    expect(res.body.error.fields['input.productId']).toBeDefined()
  })
})

describe('rate limiting', () => {
  it('limits write requests per IP with a JSON 429', async () => {
    const limited = createTestContext({ rateLimitMax: 2 })
    try {
      const send = () => request(limited.app).post('/api/orders').send({})
      expect((await send()).status).toBe(400)
      expect((await send()).status).toBe(400)
      const res = await send()
      expect(res.status).toBe(429)
      expect(res.body.error.code).toBe('RATE_LIMITED')
      // Reads are not limited.
      expect((await request(limited.app).get('/api/health')).status).toBe(200)
    } finally {
      await limited.close()
    }
  })
})

describe('serving the web app', () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-dist-'))
  fs.writeFileSync(
    path.join(dist, 'index.html'),
    '<html>PrintFlow shell</html>',
  )
  afterAll(() => fs.rmSync(dist, { recursive: true, force: true }))

  it('serves index.html for client-side routes but not for unknown API paths', async () => {
    const web = createTestContext({ webDist: dist })
    try {
      const page = await request(web.app).get('/orders/some-id')
      expect(page.status).toBe(200)
      expect(page.text).toContain('PrintFlow shell')

      const api = await request(web.app).get('/api/missing')
      expect(api.status).toBe(404)
      expect(api.body.error.code).toBe('NOT_FOUND')
    } finally {
      await web.close()
    }
  })

  it('serves no web app when there is no build', async () => {
    const res = await request(ctx.app).get('/')
    expect(res.status).toBe(404)
  })
})
