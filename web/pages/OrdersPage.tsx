import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatRM } from '../../shared/money.ts'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  isOrderStatus,
} from '../../shared/orderStatus.ts'
import type { OrderStatus } from '../../shared/orderStatus.ts'
import { useLoadSamples, useOrders, useRemoveSamples } from '../api/orders.ts'
import {
  EmptyState,
  Notice,
  Spinner,
  StatusBadge,
  inputClass,
  primaryButton,
  secondaryButton,
} from '../components/ui.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'
import { describeInput, formatDate, productName } from '../lib/format.ts'

export default function OrdersPage() {
  useDocumentTitle('Orders')
  // Search and filter live in the URL so they survive reload and can be shared.
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const statusParam = params.get('status') ?? ''
  const status: OrderStatus | '' = isOrderStatus(statusParam) ? statusParam : ''

  const [text, setText] = useState(q)
  const orders = useOrders({ q, status })
  const loadSamples = useLoadSamples()
  const removeSamples = useRemoveSamples()

  function updateParams(next: { q?: string; status?: string }) {
    const copy = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value) copy.set(key, value)
      else copy.delete(key)
    }
    setParams(copy, { replace: true })
  }

  // Debounce typing into the URL; keep the box in sync when the URL changes.
  useEffect(() => {
    if (text === q) return
    const timer = setTimeout(() => updateParams({ q: text.trim() }), 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  useEffect(() => setText(q), [q])

  const filtered = q !== '' || status !== ''
  const list = orders.data
  const hasSamples = list?.some((order) => order.isSample) ?? false

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-slate-600">
            Track quotes through production.
          </p>
        </div>
        <Link to="/quotes/new" className={primaryButton}>
          New quote
        </Link>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor="order-search" className="sr-only">
            Search orders
          </label>
          <input
            id="order-search"
            type="search"
            placeholder="Search by order number, customer or product"
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div
          role="group"
          aria-label="Filter by status"
          className="flex flex-wrap gap-2"
        >
          {(['', ...ORDER_STATUSES] as const).map((value) => (
            <button
              key={value || 'all'}
              type="button"
              aria-pressed={status === value}
              onClick={() => updateParams({ status: value })}
              className={`rounded-full border px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                status === value
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {value === '' ? 'All' : STATUS_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {orders.isPending && <Spinner label="Loading orders…" />}

      {orders.isError && (
        <Notice
          tone="error"
          action={
            <button
              type="button"
              className={secondaryButton}
              onClick={() => orders.refetch()}
            >
              Retry
            </button>
          }
        >
          Could not load orders. {orders.error.message}
        </Notice>
      )}

      {list && list.length === 0 && !filtered && (
        <EmptyState
          title="No orders yet"
          actions={
            <>
              <Link to="/quotes/new" className={primaryButton}>
                Create quote
              </Link>
              <button
                type="button"
                className={secondaryButton}
                disabled={loadSamples.isPending}
                onClick={() => loadSamples.mutate()}
              >
                {loadSamples.isPending ? 'Loading…' : 'Load sample orders'}
              </button>
            </>
          }
        >
          Create your first quote, or load fictional sample orders to explore.
        </EmptyState>
      )}

      {list && list.length === 0 && filtered && (
        <EmptyState
          title="No orders match your search"
          actions={
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                setText('')
                setParams({}, { replace: true })
              }}
            >
              Clear filters
            </button>
          }
        >
          Try a different search or status.
        </EmptyState>
      )}

      {list && list.length > 0 && (
        <>
          <p className="text-sm text-slate-600" aria-live="polite">
            {list.length} order{list.length === 1 ? '' : 's'}
            {filtered ? ' found' : ''}
          </p>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {list.map((order) => (
              <li key={order.id}>
                <Link
                  to={`/orders/${order.id}`}
                  className="grid gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 sm:grid-cols-[7rem_1fr_8rem_7rem] sm:items-center"
                >
                  <span className="font-mono text-sm font-medium text-indigo-700">
                    {order.number}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-slate-900">
                      {order.customerName}
                      {order.isSample && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                          Sample
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {productName(order.productId)} ·{' '}
                      {describeInput(order.input)} ·{' '}
                      {formatDate(order.createdAt)}
                    </span>
                  </span>
                  <span className="text-sm font-medium tabular-nums sm:text-right">
                    {formatRM(order.totalSen)}
                  </span>
                  <span className="sm:text-right">
                    <StatusBadge status={order.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {hasSamples && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>The list includes fictional sample orders.</span>
          <button
            type="button"
            className={secondaryButton}
            disabled={removeSamples.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'Remove all sample orders? Your own orders are kept.',
                )
              ) {
                removeSamples.mutate()
              }
            }}
          >
            Remove sample data
          </button>
        </div>
      )}
    </div>
  )
}
