import type { ProductId } from './catalogue.ts'
import type { Sen } from './money.ts'
import type { OrderStatus } from './orderStatus.ts'
import type { QuoteBreakdown, QuoteInput } from './quote.ts'

/** An order as returned by the API. A saved quote is an order in status "quote". */
export type Order = {
  id: string
  /** Human-friendly number such as PF-0001. */
  number: string
  customerName: string
  customerEmail: string | null
  productId: ProductId
  status: OrderStatus
  input: QuoteInput
  breakdown: QuoteBreakdown
  totalSen: Sen
  /** Which version of the pricing rules produced the breakdown. */
  pricingVersion: number
  isSample: boolean
  createdAt: string
  updatedAt: string
}

export type OrderStatusEvent = {
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  createdAt: string
}

export type OrderDetail = Order & { history: OrderStatusEvent[] }

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode
    message: string
    fields?: Record<string, string>
  }
}
