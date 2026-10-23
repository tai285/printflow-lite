import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import {
  CATALOGUE,
  PRICING_VERSION,
  PRODUCT_IDS,
} from '../../shared/catalogue.ts'
import { canTransition } from '../../shared/orderStatus.ts'
import type { OrderStatus } from '../../shared/orderStatus.ts'
import type {
  Order,
  OrderDetail,
  OrderStatusEvent,
} from '../../shared/orders.ts'
import { calculateQuote } from '../../shared/pricing.ts'
import type { CreateOrderRequest } from '../../shared/schemas.ts'
import { AppError, notFound } from '../http/errors.ts'
import type { Db } from '../db/client.ts'
import { orderStatusEvents, orders } from '../db/schema.ts'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type OrderRow = typeof orders.$inferSelect
type EventRow = typeof orderStatusEvents.$inferSelect

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    number: row.number,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    productId: row.productId as Order['productId'],
    status: row.status,
    input: row.input,
    breakdown: row.breakdown,
    totalSen: row.totalSen,
    pricingVersion: row.pricingVersion,
    isSample: row.isSample,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toEvent(row: EventRow): OrderStatusEvent {
  return {
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Creates an order in status "quote". The price is computed here, from the
 * validated input, never taken from the client.
 */
export async function createOrder(
  db: Db,
  request: CreateOrderRequest,
  options: { isSample?: boolean } = {},
): Promise<OrderDetail> {
  const breakdown = calculateQuote(request.input)

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(orders)
      .values({
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        productId: request.input.productId,
        input: request.input,
        breakdown,
        totalSen: breakdown.totalSen,
        pricingVersion: PRICING_VERSION,
        isSample: options.isSample ?? false,
      })
      .returning()
    const [event] = await tx
      .insert(orderStatusEvents)
      .values({ orderId: row!.id, fromStatus: null, toStatus: 'quote' })
      .returning()
    return { ...toOrder(row!), history: [toEvent(event!)] }
  })
}

/** Escapes LIKE wildcards so user text is matched literally. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export async function listOrders(
  db: Db,
  filters: { status?: OrderStatus; q?: string },
): Promise<Order[]> {
  const conditions = []
  if (filters.status) conditions.push(eq(orders.status, filters.status))

  const q = filters.q?.trim()
  if (q) {
    const pattern = `%${escapeLike(q)}%`
    const needle = q.toLowerCase()
    const productMatches = PRODUCT_IDS.filter(
      (id) =>
        id.includes(needle) ||
        CATALOGUE[id].name.toLowerCase().includes(needle),
    )
    conditions.push(
      or(
        ilike(orders.number, pattern),
        ilike(orders.customerName, pattern),
        productMatches.length > 0
          ? inArray(orders.productId, productMatches)
          : undefined,
      )!,
    )
  }

  const rows = await db
    .select()
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt), desc(orders.seq))
  return rows.map(toOrder)
}

export async function getOrder(db: Db, id: string): Promise<OrderDetail> {
  if (!UUID_PATTERN.test(id)) throw notFound('Order')

  const [row] = await db.select().from(orders).where(eq(orders.id, id))
  if (!row) throw notFound('Order')

  const events = await db
    .select()
    .from(orderStatusEvents)
    .where(eq(orderStatusEvents.orderId, id))
    .orderBy(orderStatusEvents.id)
  return { ...toOrder(row), history: events.map(toEvent) }
}

/**
 * Moves an order forward one step.
 *  - 404 if the order does not exist
 *  - 409 CONFLICT if `from` is not the order's current status (stale client)
 *  - 409 INVALID_TRANSITION if `to` is not the next status
 * The final UPDATE re-checks the status, so two simultaneous requests cannot
 * both succeed (optimistic concurrency).
 */
export async function transitionOrder(
  db: Db,
  id: string,
  from: OrderStatus,
  to: OrderStatus,
): Promise<OrderDetail> {
  if (!UUID_PATTERN.test(id)) throw notFound('Order')

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, id))
    if (!current) throw notFound('Order')

    if (current.status !== from) {
      throw new AppError(
        409,
        'CONFLICT',
        `This order was updated elsewhere. It is now "${current.status}".`,
      )
    }
    if (!canTransition(from, to)) {
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        `Cannot move an order from "${from}" to "${to}".`,
      )
    }

    const updated = await tx
      .update(orders)
      .set({ status: to, updatedAt: sql`now()` })
      .where(and(eq(orders.id, id), eq(orders.status, from)))
      .returning({ id: orders.id })
    if (updated.length === 0) {
      throw new AppError(
        409,
        'CONFLICT',
        'This order was updated elsewhere. Reload and try again.',
      )
    }
    await tx
      .insert(orderStatusEvents)
      .values({ orderId: id, fromStatus: from, toStatus: to })
  })

  return getOrder(db, id)
}

export async function countOrders(db: Db): Promise<number> {
  const rows = await db.select({ id: orders.id }).from(orders).limit(1)
  return rows.length
}
