import type {
  BannerSize,
  CardMethod,
  ProductId,
  TshirtMethod,
} from '../../shared/catalogue.ts'
import { calculateQuote } from '../../shared/pricing.ts'
import type { QuoteBreakdown, QuoteInput } from '../../shared/quote.ts'
import type { FieldErrors } from '../../shared/rules.ts'
import {
  CUSTOMER_NAME_MAX,
  parseWholeNumber,
  validateQuote,
} from '../../shared/schemas.ts'

/** Everything the quote form holds, as the strings/booleans the inputs use. */
export type FormState = {
  customerName: string
  customerEmail: string
  productId: ProductId
  /** Print method; its allowed values depend on the product. */
  method: TshirtMethod | CardMethod | 'inkjet'
  quantity: string
  locations: '1' | '2'
  colours: string
  size: BannerSize
  doubleSided: boolean
  lamination: boolean
  eyelets: boolean
  rush: boolean
}

const PRODUCT_DEFAULTS: Record<
  ProductId,
  Pick<FormState, 'method' | 'quantity' | 'colours'>
> = {
  tshirt: { method: 'screen', quantity: '50', colours: '2' },
  'business-cards': { method: 'digital', quantity: '3', colours: '' },
  banner: { method: 'inkjet', quantity: '1', colours: '' },
}

export function emptyForm(productId: ProductId = 'tshirt'): FormState {
  return {
    customerName: '',
    customerEmail: '',
    productId,
    ...PRODUCT_DEFAULTS[productId],
    locations: '1',
    size: 'M',
    doubleSided: false,
    lamination: false,
    eyelets: false,
    rush: false,
  }
}

/** Switching product resets every product-specific field but keeps the customer. */
export function withProduct(form: FormState, productId: ProductId): FormState {
  return {
    ...emptyForm(productId),
    customerName: form.customerName,
    customerEmail: form.customerEmail,
    rush: form.rush,
  }
}

/** Parses quantity text into a number, or an error message. */
function quantityFrom(text: string): { value?: number; error?: string } {
  if (text.trim() === '') return { error: 'Enter a quantity' }
  const value = parseWholeNumber(text)
  if (value === null) return { error: 'Quantity must be a whole number' }
  return { value }
}

export type Evaluation = {
  /** Valid, server-ready quote input, or null while the form has errors. */
  input: QuoteInput | null
  /** Quote-field errors keyed by form field (no customer fields). */
  errors: FieldErrors
  /** Live price for the current input, or null while the form has errors. */
  breakdown: QuoteBreakdown | null
}

/** Turns the form into a validated quote and a live price, using the shared rules. */
export function evaluateQuote(form: FormState): Evaluation {
  const quantity = quantityFrom(form.quantity)
  const base = {
    productId: form.productId,
    method: form.method,
    quantity: quantity.value,
    rush: form.rush,
  }

  let candidate: Record<string, unknown>
  switch (form.productId) {
    case 'tshirt': {
      // Missing or non-numeric colours stay undefined; the shared rules then
      // report "Choose 1–4 colours" for screen print.
      const colours =
        form.method === 'screen' ? parseWholeNumber(form.colours) : null
      candidate = {
        ...base,
        locations: Number(form.locations),
        colours: colours ?? undefined,
      }
      break
    }
    case 'business-cards':
      candidate = {
        ...base,
        doubleSided: form.doubleSided,
        lamination: form.lamination,
      }
      break
    case 'banner':
      candidate = { ...base, size: form.size, eyelets: form.eyelets }
      break
  }

  const result = validateQuote(candidate)
  const errors: FieldErrors = result.ok ? {} : { ...result.errors }
  if (quantity.error) errors.quantity = quantity.error

  if (!result.ok || quantity.error) {
    return { input: null, errors, breakdown: null }
  }
  return {
    input: result.value,
    errors: {},
    breakdown: calculateQuote(result.value),
  }
}

/** Customer-field validation mirroring the server's rules, for instant feedback. */
export function validateCustomer(
  form: Pick<FormState, 'customerName' | 'customerEmail'>,
): FieldErrors {
  const errors: FieldErrors = {}
  const name = form.customerName.trim()
  if (name === '') errors.customerName = 'Enter the customer name'
  else if (name.length > CUSTOMER_NAME_MAX) {
    errors.customerName = `Customer name must be at most ${CUSTOMER_NAME_MAX} characters`
  }
  const email = form.customerEmail.trim()
  if (email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.customerEmail = 'Enter a valid email address'
  }
  return errors
}
