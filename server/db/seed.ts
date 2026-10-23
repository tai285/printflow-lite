import { eq } from 'drizzle-orm'
import { ORDER_STATUSES } from '../../shared/orderStatus.ts'
import type { OrderStatus } from '../../shared/orderStatus.ts'
import type { QuoteInput } from '../../shared/quote.ts'
import { createOrder, countOrders, transitionOrder } from '../orders/service.ts'
import { createDb } from './client.ts'
import type { Db } from './client.ts'
import { orders } from './schema.ts'

type Sample = {
  customerName: string
  customerEmail: string | null
  input: QuoteInput
  status: OrderStatus
}

// Entirely fictional customers (example.com is reserved for documentation).
const SAMPLES: Sample[] = [
  {
    customerName: 'Aisyah Rahman',
    customerEmail: 'aisyah@example.com',
    status: 'quote',
    input: {
      productId: 'tshirt',
      method: 'screen',
      quantity: 50,
      locations: 1,
      colours: 2,
      rush: false,
    },
  },
  {
    customerName: 'Lim Kai Wen',
    customerEmail: null,
    status: 'quote',
    input: {
      productId: 'banner',
      method: 'inkjet',
      size: 'M',
      quantity: 6,
      eyelets: true,
      rush: false,
    },
  },
  {
    customerName: 'Priya Nair',
    customerEmail: 'priya@example.com',
    status: 'approved',
    input: {
      productId: 'business-cards',
      method: 'digital',
      quantity: 3,
      doubleSided: true,
      lamination: true,
      rush: true,
    },
  },
  {
    customerName: 'Ahmad Faris',
    customerEmail: null,
    status: 'approved',
    input: {
      productId: 'tshirt',
      method: 'dtf',
      quantity: 10,
      locations: 2,
      rush: true,
    },
  },
  {
    customerName: 'Chong Mei Ling',
    customerEmail: 'meiling@example.com',
    status: 'in_production',
    input: {
      productId: 'tshirt',
      method: 'screen',
      quantity: 120,
      locations: 2,
      colours: 3,
      rush: false,
    },
  },
  {
    customerName: 'Daniel Tan',
    customerEmail: null,
    status: 'in_production',
    input: {
      productId: 'banner',
      method: 'inkjet',
      size: 'S',
      quantity: 20,
      eyelets: true,
      rush: true,
    },
  },
  {
    customerName: 'Nur Izzati',
    customerEmail: 'izzati@example.com',
    status: 'ready',
    input: {
      productId: 'business-cards',
      method: 'offset',
      quantity: 10,
      doubleSided: false,
      lamination: true,
      rush: false,
    },
  },
  {
    customerName: 'Kumar Raj',
    customerEmail: null,
    status: 'done',
    input: {
      productId: 'banner',
      method: 'inkjet',
      size: 'L',
      quantity: 2,
      eyelets: false,
      rush: false,
    },
  },
]

/** Inserts the sample orders and advances each one to its target status. */
export async function seedSamples(db: Db): Promise<number> {
  for (const sample of SAMPLES) {
    const created = await createOrder(
      db,
      {
        customerName: sample.customerName,
        customerEmail: sample.customerEmail,
        input: sample.input,
      },
      { isSample: true },
    )
    const target = ORDER_STATUSES.indexOf(sample.status)
    for (let step = 1; step <= target; step++) {
      await transitionOrder(
        db,
        created.id,
        ORDER_STATUSES[step - 1]!,
        ORDER_STATUSES[step]!,
      )
    }
  }
  return SAMPLES.length
}

/** Deletes all sample orders (and their history). Returns how many were removed. */
export async function removeSamples(db: Db): Promise<number> {
  const removed = await db
    .delete(orders)
    .where(eq(orders.isSample, true))
    .returning({ id: orders.id })
  return removed.length
}

/** Deletes every order and loads a fresh set of sample orders (public demo mode). */
export async function resetDemoData(db: Db): Promise<number> {
  await db.delete(orders)
  return seedSamples(db)
}

/** Seeds only when there are no orders at all. Returns how many were inserted. */
export async function seedIfEmpty(db: Db): Promise<number> {
  if ((await countOrders(db)) > 0) return 0
  return seedSamples(db)
}

// `npm run db:seed`: replaces previous sample orders, leaving real ones alone.
if (import.meta.main) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const handle = createDb(url)
  try {
    await removeSamples(handle.db)
    console.log(`Seeded ${await seedSamples(handle.db)} sample orders`)
  } finally {
    await handle.close()
  }
}
