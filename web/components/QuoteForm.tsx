import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CATALOGUE, PRODUCT_IDS } from '../../shared/catalogue.ts'
import type { ProductId } from '../../shared/catalogue.ts'
import type { CreateOrderRequest } from '../../shared/schemas.ts'
import {
  emptyForm,
  evaluateQuote,
  validateCustomer,
  withProduct,
} from '../quote/formModel.ts'
import type { FormState } from '../quote/formModel.ts'
import BreakdownTable from './BreakdownTable.tsx'
import { Field, Notice, inputClass, primaryButton } from './ui.tsx'

type Props = {
  onSubmit: (request: CreateOrderRequest) => void
  submitting?: boolean
  /** Field errors returned by the API; keys like "customerName" or "input.quantity". */
  serverErrors?: Record<string, string>
}

const METHODS: Record<ProductId, { value: string; label: string }[]> = {
  tshirt: Object.entries(CATALOGUE.tshirt.methods).map(([value, m]) => ({
    value,
    label: m.label,
  })),
  'business-cards': Object.entries(CATALOGUE['business-cards'].methods).map(
    ([value, m]) => ({ value, label: m.label }),
  ),
  banner: Object.entries(CATALOGUE.banner.methods).map(([value, m]) => ({
    value,
    label: m.label,
  })),
}

function quantityHint(productId: ProductId): string {
  const product = CATALOGUE[productId]
  return `${product.minQty}–${product.maxQty} ${product.unit}`
}

/** "input.quantity" -> "quantity"; customer fields keep their names. */
function stripInputPrefix(errors: Record<string, string> = {}) {
  return Object.fromEntries(
    Object.entries(errors).map(([key, message]) => [
      key.replace(/^input\./, ''),
      message,
    ]),
  )
}

export default function QuoteForm({
  onSubmit,
  submitting = false,
  serverErrors,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm())
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  // Fields edited since the current server errors arrived hide their error.
  const [edits, setEdits] = useState<{
    source?: Record<string, string>
    fields: string[]
  }>({ fields: [] })
  const formRef = useRef<HTMLFormElement>(null)

  const remote = useMemo(() => stripInputPrefix(serverErrors), [serverErrors])
  const editedFields = edits.source === serverErrors ? edits.fields : []

  const evaluation = evaluateQuote(form)
  const clientErrors = { ...validateCustomer(form), ...evaluation.errors }

  function errorFor(field: string): string | undefined {
    if (remote[field] && !editedFields.includes(field)) return remote[field]
    return submitted || touched[field] ? clientErrors[field] : undefined
  }

  function update(patch: Partial<FormState>, fields: string[]) {
    setForm((current) => ({ ...current, ...patch }))
    markEdited(fields)
  }

  function markEdited(fields: string[]) {
    setEdits((current) => ({
      source: serverErrors,
      fields: [
        ...(current.source === serverErrors ? current.fields : []),
        ...fields,
      ],
    }))
  }

  const blur = (field: string) => () =>
    setTouched((current) => ({ ...current, [field]: true }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (
      evaluation.input === null ||
      Object.keys(validateCustomer(form)).length > 0
    ) {
      // Move focus to the first field with a problem.
      setTimeout(
        () =>
          formRef.current
            ?.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus(),
        0,
      )
      return
    }
    onSubmit({
      customerName: form.customerName.trim(),
      customerEmail: form.customerEmail.trim() || null,
      input: evaluation.input,
    })
  }

  const product = CATALOGUE[form.productId]
  const hasQuoteErrors = Object.keys(evaluation.errors).length > 0
  const unit = product.unit

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_22rem]"
    >
      <div className="space-y-6">
        <section
          aria-labelledby="customer-heading"
          className="rounded-lg border border-slate-200 bg-surface p-5"
        >
          <h2 id="customer-heading" className="mb-4 text-base font-semibold">
            Customer
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name" error={errorFor('customerName')}>
              {(control) => (
                <input
                  {...control}
                  type="text"
                  autoComplete="off"
                  className={inputClass}
                  value={form.customerName}
                  onChange={(e) =>
                    update({ customerName: e.target.value }, ['customerName'])
                  }
                  onBlur={blur('customerName')}
                />
              )}
            </Field>
            <Field label="Email (optional)" error={errorFor('customerEmail')}>
              {(control) => (
                <input
                  {...control}
                  type="email"
                  autoComplete="off"
                  className={inputClass}
                  value={form.customerEmail}
                  onChange={(e) =>
                    update({ customerEmail: e.target.value }, ['customerEmail'])
                  }
                  onBlur={blur('customerEmail')}
                />
              )}
            </Field>
          </div>
        </section>

        <section
          aria-labelledby="job-heading"
          className="rounded-lg border border-slate-200 bg-surface p-5"
        >
          <h2 id="job-heading" className="mb-4 text-base font-semibold">
            Job details
          </h2>

          <fieldset className="mb-5">
            <legend className="mb-2 text-sm font-medium text-slate-800">
              Product
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {PRODUCT_IDS.map((id) => (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo-600"
                >
                  <input
                    type="radio"
                    name="product"
                    value={id}
                    checked={form.productId === id}
                    onChange={() => {
                      setForm((current) => withProduct(current, id))
                      setTouched({})
                      markEdited(Object.keys(remote))
                    }}
                    className="accent-indigo-600"
                  />
                  {CATALOGUE[id].name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Print method" error={errorFor('method')}>
              {(control) => (
                <select
                  {...control}
                  className={inputClass}
                  value={form.method}
                  onChange={(e) =>
                    update({ method: e.target.value as FormState['method'] }, [
                      'method',
                      'quantity',
                    ])
                  }
                >
                  {METHODS[form.productId].map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field
              label={`Quantity (${unit})`}
              hint={`Allowed: ${quantityHint(form.productId)}`}
              error={errorFor('quantity')}
            >
              {(control) => (
                <input
                  {...control}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className={inputClass}
                  value={form.quantity}
                  onChange={(e) =>
                    update({ quantity: e.target.value }, ['quantity'])
                  }
                  onBlur={blur('quantity')}
                />
              )}
            </Field>

            {form.productId === 'tshirt' && (
              <>
                <Field label="Print locations" error={errorFor('locations')}>
                  {(control) => (
                    <select
                      {...control}
                      className={inputClass}
                      value={form.locations}
                      onChange={(e) =>
                        update(
                          {
                            locations: e.target.value as FormState['locations'],
                          },
                          ['locations'],
                        )
                      }
                    >
                      <option value="1">1 (front)</option>
                      <option value="2">2 (front and back)</option>
                    </select>
                  )}
                </Field>
                {form.method === 'screen' && (
                  <Field
                    label="Ink colours"
                    hint={`1–${CATALOGUE.tshirt.maxColours}`}
                    error={errorFor('colours')}
                  >
                    {(control) => (
                      <input
                        {...control}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        className={inputClass}
                        value={form.colours}
                        onChange={(e) =>
                          update({ colours: e.target.value }, ['colours'])
                        }
                        onBlur={blur('colours')}
                      />
                    )}
                  </Field>
                )}
              </>
            )}

            {form.productId === 'banner' && (
              <Field label="Size" error={errorFor('size')}>
                {(control) => (
                  <select
                    {...control}
                    className={inputClass}
                    value={form.size}
                    onChange={(e) =>
                      update({ size: e.target.value as FormState['size'] }, [
                        'size',
                      ])
                    }
                  >
                    {Object.entries(CATALOGUE.banner.sizes).map(
                      ([key, size]) => (
                        <option key={key} value={key}>
                          {size.label}
                        </option>
                      ),
                    )}
                  </select>
                )}
              </Field>
            )}
          </div>

          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-medium text-slate-800">
              Options
            </legend>
            <div className="space-y-2 text-sm">
              {form.productId === 'business-cards' && (
                <>
                  <Checkbox
                    label="Double-sided (+RM 8.00 per box)"
                    checked={form.doubleSided}
                    onChange={(checked) => update({ doubleSided: checked }, [])}
                  />
                  <Checkbox
                    label="Matte lamination (+RM 6.50 per box)"
                    checked={form.lamination}
                    onChange={(checked) => update({ lamination: checked }, [])}
                  />
                </>
              )}
              {form.productId === 'banner' && (
                <Checkbox
                  label="Eyelets (+RM 4.00 per banner)"
                  checked={form.eyelets}
                  onChange={(checked) => update({ eyelets: checked }, [])}
                />
              )}
              <Checkbox
                label="Rush order (+15%)"
                checked={form.rush}
                onChange={(checked) => update({ rush: checked }, [])}
              />
            </div>
          </fieldset>
        </section>
      </div>

      <aside
        aria-labelledby="summary-heading"
        className="h-fit rounded-lg border border-slate-200 bg-surface p-5 lg:sticky lg:top-4"
      >
        <h2 id="summary-heading" className="mb-3 text-base font-semibold">
          Quote summary
        </h2>
        {evaluation.breakdown ? (
          <BreakdownTable breakdown={evaluation.breakdown} />
        ) : (
          <p className="text-sm text-slate-600">
            {hasQuoteErrors
              ? 'Fix the highlighted fields to see a price.'
              : 'Fill in the job details to see a price.'}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Illustrative pricing for a fictional shop. The server recalculates the
          price when you save.
        </p>
        {submitted && Object.keys(clientErrors).length > 0 && (
          <div className="mt-4">
            <Notice tone="error">Please fix the errors in the form.</Notice>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={`${primaryButton} mt-4 w-full`}
        >
          {submitting ? 'Saving…' : 'Save quote'}
        </button>
      </aside>
    </form>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-indigo-600"
      />
      {label}
    </label>
  )
}
