import { Link, useLocation, useParams } from 'react-router'
import { formatRM } from '../../shared/money.ts'
import { STATUS_LABELS, nextStatus } from '../../shared/orderStatus.ts'
import type { OrderStatus } from '../../shared/orderStatus.ts'
import { isStaffRole } from '../../shared/roles.ts'
import { useCurrentUser } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { useOrder, useTransition } from '../api/orders.ts'
import BreakdownTable from '../components/BreakdownTable.tsx'
import {
  Notice,
  Spinner,
  StatusBadge,
  primaryButton,
  secondaryButton,
} from '../components/ui.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'
import { describeInput, formatDateTime, productName } from '../lib/format.ts'

const ACTION_LABELS: Record<Exclude<OrderStatus, 'done'>, string> = {
  quote: 'Approve quote',
  approved: 'Start production',
  in_production: 'Mark ready',
  ready: 'Mark done',
}

export default function OrderDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const justCreated = (location.state as { created?: boolean } | null)?.created
  const order = useOrder(id)
  useDocumentTitle(order.data ? `Order ${order.data.number}` : 'Order')
  const transition = useTransition(id)
  const me = useCurrentUser()

  if (order.isPending) return <Spinner label="Loading order…" />

  if (order.isError) {
    const missing =
      order.error instanceof ApiError && order.error.status === 404
    return (
      <div className="space-y-4">
        <Notice
          tone="error"
          action={
            missing ? undefined : (
              <button
                type="button"
                className={secondaryButton}
                onClick={() => order.refetch()}
              >
                Retry
              </button>
            )
          }
        >
          {missing ? 'This order does not exist.' : order.error.message}
        </Notice>
        <Link to="/orders" className={secondaryButton}>
          Back to orders
        </Link>
      </div>
    )
  }

  const data = order.data
  // Only staff and admins move orders through production (the API enforces it too).
  const next = me && isStaffRole(me.role) ? nextStatus(data.status) : null
  const error = transition.error

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link to="/orders" className="text-sm text-indigo-700 hover:underline">
          ← Back to orders
        </Link>
      </div>

      {/* Visible only when printing */}
      <div className="hidden border-b border-slate-300 pb-3 print:block">
        <p className="text-xl font-semibold">Contoh Print Co. (fictional)</p>
        <p className="text-sm">Quotation {data.number}</p>
      </div>

      {justCreated && (
        <Notice tone="success">Quote {data.number} saved.</Notice>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            <span className="font-mono">{data.number}</span>
            <StatusBadge status={data.status} />
            {data.isSample && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
                Sample
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-600">
            Created {formatDateTime(data.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => window.print()}
          >
            Print quote
          </button>
          {next !== null && (
            <button
              type="button"
              className={primaryButton}
              disabled={transition.isPending}
              onClick={() => transition.mutate({ from: data.status, to: next })}
            >
              {transition.isPending
                ? 'Updating…'
                : `${ACTION_LABELS[data.status as Exclude<OrderStatus, 'done'>]} → ${STATUS_LABELS[next]}`}
            </button>
          )}
        </div>
      </div>

      {error && (
        <Notice
          tone={
            error instanceof ApiError && error.status === 409
              ? 'warning'
              : 'error'
          }
        >
          {error instanceof ApiError && error.status === 409
            ? `${error.message} Showing the latest version.`
            : error.message}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section
          aria-labelledby="quote-heading"
          className="rounded-lg border border-slate-200 bg-surface p-5 print:border-0 print:p-0"
        >
          <h2 id="quote-heading" className="mb-1 text-base font-semibold">
            {productName(data.productId)}
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            {describeInput(data.input)}
          </p>
          <BreakdownTable breakdown={data.breakdown} />
          <p className="mt-4 text-xs text-slate-500">
            Illustrative pricing for a fictional shop (pricing rules v
            {data.pricingVersion}). Total {formatRM(data.totalSen)}, excluding
            tax.
          </p>
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="customer-heading"
            className="rounded-lg border border-slate-200 bg-surface p-5 print:border-0 print:p-0"
          >
            <h2 id="customer-heading" className="mb-2 text-base font-semibold">
              Customer
            </h2>
            <p className="text-sm font-medium">{data.customerName}</p>
            <p className="text-sm text-slate-600">
              {data.customerEmail ?? 'No email on file'}
            </p>
          </section>

          <section
            aria-labelledby="history-heading"
            className="rounded-lg border border-slate-200 bg-surface p-5 print:hidden"
          >
            <h2 id="history-heading" className="mb-3 text-base font-semibold">
              History
            </h2>
            <ol className="space-y-3">
              {data.history.map((event, index) => (
                <li key={index} className="text-sm">
                  <span className="font-medium">
                    {event.fromStatus === null
                      ? `Created as ${STATUS_LABELS[event.toStatus]}`
                      : `${STATUS_LABELS[event.fromStatus]} → ${STATUS_LABELS[event.toStatus]}`}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {formatDateTime(event.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}
