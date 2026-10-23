import { useNavigate } from 'react-router'
import { useCreateOrder } from '../api/orders.ts'
import { ApiError } from '../api/client.ts'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'
import QuoteForm from '../components/QuoteForm.tsx'
import { Notice } from '../components/ui.tsx'

export default function NewQuotePage() {
  useDocumentTitle('New quote')
  const navigate = useNavigate()
  const create = useCreateOrder()

  const error = create.error
  const fieldErrors =
    error instanceof ApiError && error.status === 400 ? error.fields : undefined
  // Field-level problems are shown next to their inputs; anything else here.
  const generalError = error && !fieldErrors ? error.message : undefined

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New quote</h1>
        <p className="text-sm text-slate-600">
          Build a quote, then save it to track it as an order.
        </p>
      </div>
      {generalError && <Notice tone="error">{generalError}</Notice>}
      <QuoteForm
        submitting={create.isPending}
        serverErrors={fieldErrors}
        onSubmit={(request) =>
          create.mutate(request, {
            onSuccess: (order) =>
              navigate(`/orders/${order.id}`, { state: { created: true } }),
          })
        }
      />
    </div>
  )
}
