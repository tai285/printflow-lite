export const ORDER_STATUSES = [
  'quote',
  'approved',
  'in_production',
  'ready',
  'done',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const STATUS_LABELS: Record<OrderStatus, string> = {
  quote: 'Quote',
  approved: 'Approved',
  in_production: 'In production',
  ready: 'Ready',
  done: 'Done',
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (ORDER_STATUSES as readonly unknown[]).includes(value)
}

/** The only status an order may move to next, or null when finished. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = ORDER_STATUSES.indexOf(status)
  return ORDER_STATUSES[index + 1] ?? null
}

/** Orders move forward exactly one step at a time. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return nextStatus(from) === to
}
