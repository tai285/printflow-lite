import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { ORDER_STATUSES } from '../../shared/orderStatus.ts'
import type { QuoteBreakdown, QuoteInput } from '../../shared/quote.ts'

export const orderStatus = pgEnum('order_status', ORDER_STATUSES)

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Sequence behind the human-friendly order number. */
    seq: serial('seq').notNull(),
    /** PF-0001, PF-0002, ... derived from seq by the database. */
    number: text('number')
      .notNull()
      .unique()
      .generatedAlwaysAs(sql`'PF-' || lpad(seq::text, 4, '0')`),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email'),
    productId: text('product_id').notNull(),
    /** The validated quote input; shape differs per product, hence jsonb. */
    input: jsonb('input').$type<QuoteInput>().notNull(),
    /** Price snapshot computed by the server when the order was created. */
    breakdown: jsonb('breakdown').$type<QuoteBreakdown>().notNull(),
    totalSen: integer('total_sen').notNull(),
    pricingVersion: integer('pricing_version').notNull(),
    status: orderStatus('status').notNull().default('quote'),
    isSample: boolean('is_sample').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('orders_status_idx').on(table.status),
    index('orders_created_at_idx').on(table.createdAt),
  ],
)

export const orderStatusEvents = pgTable(
  'order_status_events',
  {
    id: serial('id').primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatus('from_status'),
    toStatus: orderStatus('to_status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('order_status_events_order_idx').on(table.orderId)],
)
