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
import { USER_ROLES } from '../../shared/roles.ts'
import { ORDER_STATUSES } from '../../shared/orderStatus.ts'
import type { QuoteBreakdown, QuoteInput } from '../../shared/quote.ts'

export const orderStatus = pgEnum('order_status', ORDER_STATUSES)

export const userRole = pgEnum('user_role', USER_ROLES)

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Stored lowercase so lookups are case-insensitive. */
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  /** scrypt hash in the form "scrypt$salt$hash"; never the password itself. */
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('customer'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the cookie token, so a leaked table cannot be replayed. */
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('sessions_user_idx').on(table.userId)],
)

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
    /** Who the order belongs to; null for sample and legacy orders (staff only). */
    ownerId: uuid('owner_id').references(() => users.id, {
      onDelete: 'set null',
    }),
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
    index('orders_owner_idx').on(table.ownerId),
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
