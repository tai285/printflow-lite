import { useId } from 'react'
import type { ReactNode } from 'react'
import { STATUS_LABELS } from '../../shared/orderStatus.ts'
import type { OrderStatus } from '../../shared/orderStatus.ts'

export const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus-visible:border-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-indigo-600 aria-[invalid=true]:border-red-600'

export const primaryButton =
  'inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60'

export const secondaryButton =
  'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60'

const STATUS_STYLES: Record<OrderStatus, string> = {
  quote: 'bg-slate-100 text-slate-700 ring-slate-300',
  approved: 'bg-blue-50 text-blue-800 ring-blue-300',
  in_production: 'bg-amber-50 text-amber-900 ring-amber-300',
  ready: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
  done: 'bg-green-100 text-green-900 ring-green-400',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

const NOTICE_STYLES = {
  error: 'border-red-300 bg-red-50 text-red-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  success: 'border-green-300 bg-green-50 text-green-900',
  info: 'border-slate-300 bg-slate-50 text-slate-800',
}

export function Notice({
  tone,
  children,
  action,
}: {
  tone: keyof typeof NOTICE_STYLES
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${NOTICE_STYLES[tone]}`}
    >
      <div>{children}</div>
      {action}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 py-12 text-sm text-slate-600"
    >
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"
      />
      {label}
    </div>
  )
}

export function EmptyState({
  title,
  children,
  actions,
}: {
  title: string
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children && <p className="mt-1 text-sm text-slate-600">{children}</p>}
      {actions && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {actions}
        </div>
      )}
    </div>
  )
}

export type FieldControlProps = {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

/** Label + control + hint + error, wired together for screen readers. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: (control: FieldControlProps) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-slate-800"
      >
        {label}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
