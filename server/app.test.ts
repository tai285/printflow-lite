import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.ts'

describe('GET /api/health', () => {
  it('reports ok and the build version', async () => {
    const app = createApp({ version: 'test-sha' })

    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', version: 'test-sha' })
  })

  it('returns 404 for unknown API routes', async () => {
    const res = await request(createApp({ version: 'x' })).get('/api/nope')

    expect(res.status).toBe(404)
  })
})
