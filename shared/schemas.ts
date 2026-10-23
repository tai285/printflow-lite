import { z } from 'zod'
import { PRODUCT_IDS } from './catalogue.ts'
import { ORDER_STATUSES } from './orderStatus.ts'
import type { QuoteInput } from './quote.ts'
import { checkBusinessRules } from './rules.ts'
import type { FieldErrors } from './rules.ts'

/**
 * Parses text typed into a form field as a whole number.
 * Deliberately not Number(): Number("") is 0 and Number("1e2") is 100.
 */
export function parseWholeNumber(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isSafeInteger(value) ? value : null
}

const quantity = z
  .number({ error: 'Enter a quantity' })
  .int('Quantity must be a whole number')

const rush = z.boolean({ error: 'Rush must be true or false' }).default(false)

const tshirtSchema = z.object({
  productId: z.literal('tshirt'),
  method: z.enum(['screen', 'dtf'], { error: 'Choose a print method' }),
  quantity,
  locations: z.union([z.literal(1), z.literal(2)], {
    error: 'Choose 1 or 2 print locations',
  }),
  colours: z.number({ error: 'Enter the number of colours' }).int().optional(),
  rush,
})

const cardsSchema = z.object({
  productId: z.literal('business-cards'),
  method: z.enum(['digital', 'offset'], { error: 'Choose a print method' }),
  quantity,
  doubleSided: z.boolean().default(false),
  lamination: z.boolean().default(false),
  rush,
})

const bannerSchema = z.object({
  productId: z.literal('banner'),
  method: z.enum(['inkjet'], { error: 'Choose a print method' }),
  size: z.enum(['S', 'M', 'L'], { error: 'Choose a size' }),
  quantity,
  eyelets: z.boolean().default(false),
  rush,
})

/** Shape check only. Use validateQuote to also apply business rules. */
export const quoteInputSchema = z.discriminatedUnion(
  'productId',
  [tshirtSchema, cardsSchema, bannerSchema],
  { error: `Choose a product (${PRODUCT_IDS.join(', ')})` },
)

// Compile-time guarantee that the schema and the hand-written type agree.
type SchemaOutput = z.infer<typeof quoteInputSchema>
const _assertAssignable = (value: SchemaOutput): QuoteInput => value
void _assertAssignable

function issuesToErrors(
  issues: readonly z.core.$ZodIssue[],
  prefix = '',
): FieldErrors {
  const errors: FieldErrors = {}
  for (const issue of issues) {
    const key = prefix + (issue.path.length ? issue.path.join('.') : 'input')
    errors[key] ??= issue.message
  }
  return errors
}

export type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; errors: FieldErrors }

/** Full validation of untrusted quote input: shape first, then business rules. */
export function validateQuote(raw: unknown): ValidationResult<QuoteInput> {
  const parsed = quoteInputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, errors: issuesToErrors(parsed.error.issues) }
  }
  const input: QuoteInput = parsed.data
  const errors = checkBusinessRules(input)
  if (Object.keys(errors).length > 0) return { ok: false, errors }

  // DTF has no colour count; don't store a meaningless value.
  if (input.productId === 'tshirt' && input.method === 'dtf') {
    delete input.colours
  }
  return { ok: true, value: input }
}

export const CUSTOMER_NAME_MAX = 80
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CreateOrderRequest = {
  customerName: string
  customerEmail: string | null
  input: QuoteInput
}

/**
 * Validates the body of POST /api/orders. Unknown keys (for example a
 * client-supplied total) are ignored. Quote field errors are keyed
 * "input.<field>".
 */
export function validateCreateOrder(
  raw: unknown,
): ValidationResult<CreateOrderRequest> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: { body: 'Request body must be a JSON object' } }
  }
  const body = raw as Record<string, unknown>
  const errors: FieldErrors = {}

  const name =
    typeof body.customerName === 'string' ? body.customerName.trim() : ''
  if (name.length === 0) errors.customerName = 'Enter the customer name'
  else if (name.length > CUSTOMER_NAME_MAX) {
    errors.customerName = `Customer name must be at most ${CUSTOMER_NAME_MAX} characters`
  }

  let email: string | null = null
  if (body.customerEmail !== undefined && body.customerEmail !== null) {
    const trimmed =
      typeof body.customerEmail === 'string' ? body.customerEmail.trim() : null
    if (trimmed === null || (trimmed !== '' && !EMAIL_PATTERN.test(trimmed))) {
      errors.customerEmail = 'Enter a valid email address'
    } else if (trimmed.length > 120) {
      errors.customerEmail = 'Email must be at most 120 characters'
    } else if (trimmed !== '') {
      email = trimmed
    }
  }

  const quote = validateQuote(body.input)
  if (!quote.ok) {
    for (const [key, message] of Object.entries(quote.errors)) {
      errors[`input.${key}`] = message
    }
  }

  if (Object.keys(errors).length > 0 || !quote.ok) return { ok: false, errors }
  return {
    ok: true,
    value: { customerName: name, customerEmail: email, input: quote.value },
  }
}

export const transitionRequestSchema = z.object({
  from: z.enum(ORDER_STATUSES, { error: 'Unknown "from" status' }),
  to: z.enum(ORDER_STATUSES, { error: 'Unknown "to" status' }),
})
export type TransitionRequest = z.infer<typeof transitionRequestSchema>

export function validateTransition(
  raw: unknown,
): ValidationResult<TransitionRequest> {
  const parsed = transitionRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, errors: issuesToErrors(parsed.error.issues) }
  }
  return { ok: true, value: parsed.data }
}
