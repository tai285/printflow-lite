import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { ORDER_STATUSES } from '../../shared/orderStatus.ts'
import { orderStatusEvents, orders } from '../db/schema.ts'
import { resetDemoData, seedIfEmpty, seedSamples } from '../db/seed.ts'
import {
  createTestContext,
  type SignedIn,
  validOrderBody,
  validTshirt,
} from '../test/helpers.ts'

const ctx = createTestContext({ enableDemo: true })

// Most tests act as an admin, who can see and advance every order.
let admin: SignedIn['agent']
const api = () => admin

beforeEach(async () => {
  await ctx.reset()
  admin = (await ctx.signIn('admin')).agent
})
afterAll(() => ctx.close())

type Named = { customerName: string }
const names = (body: Named[]) => body.map((o) => o.customerName)

async function create(overrides: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/orders')
    .send({ ...validOrderBody, ...overrides })
  expect(res.status).toBe(201)
  return res.body
}

const advance = (id: string, from: string, to: string) =>
  api().post(`/api/orders/${id}/transitions`).send({ from, to })

const eventsFor = (orderId: string) =>
  ctx.db
    .select()
    .from(orderStatusEvents)
    .where(eq(orderStatusEvents.orderId, orderId))

const banner = {
  productId: 'banner',
  method: 'inkjet',
  size: 'S',
  quantity: 1,
  eyelets: false,
  rush: false,
}

describe('POST /api/orders', () => {
  it('creates a quote with a server-computed price', async () => {
    const res = await api().post('/api/orders').send(validOrderBody)

    expect(res.status).toBe(201)
    expect(res.headers.location).toBe(`/api/orders/${res.body.id}`)
    expect(res.body).toMatchObject({
      number: 'PF-0001',
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      productId: 'tshirt',
      status: 'quote',
      totalSen: 84000, // spec example 1: RM 840.00
      pricingVersion: 1,
      isSample: false,
    })
    expect(res.body.breakdown.totalSen).toBe(84000)
    expect(res.body.history).toHaveLength(1)
    expect(res.body.history[0]).toMatchObject({
      fromStatus: null,
      toStatus: 'quote',
    })
  })

  it('ignores any total or status sent by the client', async () => {
    const res = await api()
      .post('/api/orders')
      .send({
        ...validOrderBody,
        totalSen: 1,
        total: 1,
        breakdown: { totalSen: 1 },
        status: 'done',
      })

    expect(res.status).toBe(201)
    expect(res.body.totalSen).toBe(84000)
    expect(res.body.status).toBe('quote')
  })

  it('numbers orders sequentially', async () => {
    const first = await create()
    const second = await create()
    expect([first.number, second.number]).toEqual(['PF-0001', 'PF-0002'])
  })

  it('trims the customer name and stores a missing email as null', async () => {
    const order = await create({ customerName: '  Siti  ', customerEmail: '' })
    expect(order.customerName).toBe('Siti')
    expect(order.customerEmail).toBeNull()
  })

  it('returns 400 with field errors for an invalid body and stores nothing', async () => {
    const res = await api()
      .post('/api/orders')
      .send({
        customerName: '',
        customerEmail: 'nope',
        input: { ...validTshirt, quantity: 24 },
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(Object.keys(res.body.error.fields).sort()).toEqual([
      'customerEmail',
      'customerName',
      'input.quantity',
    ])
    expect(await ctx.db.select().from(orders)).toHaveLength(0)
  })

  it('returns 400 for an unknown product', async () => {
    const res = await api()
      .post('/api/orders')
      .send({ ...validOrderBody, input: { productId: 'mug', quantity: 1 } })
    expect(res.status).toBe(400)
    expect(res.body.error.fields['input.productId']).toBeDefined()
  })

  it('prices the other products according to the spec', async () => {
    const bannerOrder = await create({
      input: { ...banner, quantity: 20, eyelets: true, rush: true },
    })
    const cardsOrder = await create({
      input: {
        productId: 'business-cards',
        method: 'digital',
        quantity: 3,
        doubleSided: true,
        lamination: true,
        rush: true,
      },
    })
    expect(bannerOrder.totalSen).toBe(77441)
    expect(cardsOrder.totalSen).toBe(13628)
  })
})

describe('GET /api/orders', () => {
  it('returns an empty list when there are no orders', async () => {
    const res = await api().get('/api/orders')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('lists newest first', async () => {
    await create({ customerName: 'First' })
    await create({ customerName: 'Second' })
    await create({ customerName: 'Third' })

    const res = await api().get('/api/orders')
    expect(names(res.body)).toEqual(['Third', 'Second', 'First'])
  })

  it('filters by status', async () => {
    const a = await create({ customerName: 'A' })
    await create({ customerName: 'B' })
    await advance(a.id, 'quote', 'approved')

    const approved = await api().get('/api/orders?status=approved')
    expect(names(approved.body)).toEqual(['A'])
    const quotes = await api().get('/api/orders?status=quote')
    expect(names(quotes.body)).toEqual(['B'])
  })

  it('rejects an unknown status', async () => {
    const res = await api().get('/api/orders?status=shipped')
    expect(res.status).toBe(400)
    expect(res.body.error.fields.status).toBeDefined()
  })

  it('searches case-insensitively by customer, order number and product', async () => {
    await create({ customerName: 'Aisyah Rahman' })
    await create({ customerName: 'Lim', input: banner })

    const search = async (q: string) =>
      names((await api().get('/api/orders').query({ q })).body)
    expect(await search('aISy')).toEqual(['Aisyah Rahman'])
    expect(await search('pf-0002')).toEqual(['Lim'])
    expect(await search('BANNER')).toEqual(['Lim'])
    expect(await search('vinyl')).toEqual(['Lim'])
    expect(await search('t-shirt')).toEqual(['Aisyah Rahman'])
    expect(await search('zzz')).toEqual([])
  })

  it('treats % and _ in the search as literal characters', async () => {
    await create({ customerName: 'Plain Name' })
    await create({ customerName: '100% Print_Fan' })

    const count = async (q: string) =>
      (await api().get('/api/orders').query({ q })).body.length
    expect(await count('%')).toBe(1)
    expect(await count('_')).toBe(1)
    expect(await count('n_m')).toBe(0)
  })

  it('combines search and status filters', async () => {
    const a = await create({ customerName: 'Sam One' })
    await create({ customerName: 'Sam Two' })
    await advance(a.id, 'quote', 'approved')

    const res = await api()
      .get('/api/orders')
      .query({ q: 'sam', status: 'approved' })
    expect(names(res.body)).toEqual(['Sam One'])
  })
})

describe('GET /api/orders/:id', () => {
  it('returns the order with its history', async () => {
    const created = await create()
    const res = await api().get(`/api/orders/${created.id}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(created.id)
    expect(res.body.history).toHaveLength(1)
  })

  it('returns 404 for an unknown id', async () => {
    const res = await api().get(
      '/api/orders/00000000-0000-4000-8000-000000000000',
    )
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 (not 500) for a malformed id', async () => {
    const res = await api().get('/api/orders/not-a-uuid')
    expect(res.status).toBe(404)
  })
})

describe('POST /api/orders/:id/transitions', () => {
  it('walks an order through the whole workflow and records history', async () => {
    const order = await create()
    for (let i = 1; i < ORDER_STATUSES.length; i++) {
      const res = await advance(
        order.id,
        ORDER_STATUSES[i - 1]!,
        ORDER_STATUSES[i]!,
      )
      expect(res.status).toBe(200)
      expect(res.body.status).toBe(ORDER_STATUSES[i])
    }

    const detail = await api().get(`/api/orders/${order.id}`)
    expect(detail.body.status).toBe('done')
    expect(
      detail.body.history.map((h: { toStatus: string }) => h.toStatus),
    ).toEqual([...ORDER_STATUSES])
    expect(detail.body.history[1]).toMatchObject({
      fromStatus: 'quote',
      toStatus: 'approved',
    })
  })

  it('updates updatedAt', async () => {
    const order = await create()
    const res = await advance(order.id, 'quote', 'approved')
    expect(Date.parse(res.body.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(order.updatedAt),
    )
  })

  it('rejects skipping a step with 409 INVALID_TRANSITION and changes nothing', async () => {
    const order = await create()
    const res = await advance(order.id, 'quote', 'ready')

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INVALID_TRANSITION')
    expect(await eventsFor(order.id)).toHaveLength(1)
    expect((await api().get(`/api/orders/${order.id}`)).body.status).toBe(
      'quote',
    )
  })

  it('rejects moving backwards and moving on from done', async () => {
    const order = await create()
    await advance(order.id, 'quote', 'approved')
    const back = await advance(order.id, 'approved', 'quote')
    expect(back.body.error.code).toBe('INVALID_TRANSITION')

    await advance(order.id, 'approved', 'in_production')
    await advance(order.id, 'in_production', 'ready')
    await advance(order.id, 'ready', 'done')
    const res = await advance(order.id, 'done', 'quote')
    expect(res.status).toBe(409)
  })

  it('returns 409 CONFLICT when `from` is stale', async () => {
    const order = await create()
    await advance(order.id, 'quote', 'approved')

    // A second client still believes the order is a quote.
    const res = await advance(order.id, 'quote', 'approved')
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
    expect(res.body.error.message).toMatch(/updated elsewhere/)
  })

  it('lets only one of two simultaneous identical requests win', async () => {
    const order = await create()
    const results = await Promise.all([
      advance(order.id, 'quote', 'approved'),
      advance(order.id, 'quote', 'approved'),
    ])

    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(await eventsFor(order.id)).toHaveLength(2) // creation + one transition
  })

  it('returns 404 for an unknown or malformed order id', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000'
    expect((await advance(unknown, 'quote', 'approved')).status).toBe(404)
    expect((await advance('nope', 'quote', 'approved')).status).toBe(404)
  })

  it('returns 400 for an invalid body', async () => {
    const order = await create()
    const res = await api()
      .post(`/api/orders/${order.id}/transitions`)
      .send({ from: 'quote', to: 'shipped' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.to).toBeDefined()
  })
})

describe('seed data', () => {
  it('inserts labelled sample orders covering every status', async () => {
    expect(await seedSamples(ctx.db)).toBe(8)

    const res = await api().get('/api/orders')
    expect(res.body).toHaveLength(8)
    expect(res.body.every((o: { isSample: boolean }) => o.isSample)).toBe(true)
    const statuses = new Set(res.body.map((o: { status: string }) => o.status))
    expect([...statuses].sort()).toEqual([...ORDER_STATUSES].sort())
  })

  it('seedIfEmpty does nothing when orders already exist', async () => {
    await create()
    expect(await seedIfEmpty(ctx.db)).toBe(0)
    expect((await api().get('/api/orders')).body).toHaveLength(1)

    await ctx.reset()
    expect(await seedIfEmpty(ctx.db)).toBe(8)
  })
})

describe('sample data endpoints', () => {
  it('POST /api/samples replaces sample orders and leaves real ones alone', async () => {
    await create({ customerName: 'Real Customer' })

    const first = await api().post('/api/samples')
    expect(first.status).toBe(201)
    expect(first.body.count).toBe(8)
    // Loading twice must not duplicate the samples.
    await api().post('/api/samples')

    const all = (await api().get('/api/orders')).body
    expect(all).toHaveLength(9)
    expect(all.filter((o: { isSample: boolean }) => !o.isSample)).toHaveLength(
      1,
    )
  })

  it('DELETE /api/samples removes only sample orders', async () => {
    await create({ customerName: 'Real Customer' })
    await api().post('/api/samples')

    const res = await api().delete('/api/samples')
    expect(res.body.count).toBe(8)
    expect(names((await api().get('/api/orders')).body)).toEqual([
      'Real Customer',
    ])
  })
})

describe('demo reset', () => {
  it('removes every order, including real ones, and reloads the samples', async () => {
    await create({ customerName: 'Visitor Order' })
    await seedSamples(ctx.db)

    expect(await resetDemoData(ctx.db)).toBe(8)

    const all = (await api().get('/api/orders')).body
    expect(all).toHaveLength(8)
    expect(all.every((o: { isSample: boolean }) => o.isSample)).toBe(true)
    expect(names(all)).not.toContain('Visitor Order')
  })
})
