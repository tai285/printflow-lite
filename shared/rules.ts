import { CATALOGUE } from './catalogue.ts'
import type { QuoteInput } from './quote.ts'

/** Field name -> message. Empty when the input is valid. */
export type FieldErrors = Record<string, string>

/**
 * Business rules that a type-correct input can still violate
 * (quantity ranges, per-method minimums, colour counts).
 * Never throws.
 */
export function checkBusinessRules(input: QuoteInput): FieldErrors {
  const errors: FieldErrors = {}
  const product = CATALOGUE[input.productId]

  if (input.quantity < product.minQty || input.quantity > product.maxQty) {
    errors.quantity = `${product.plural}: ${product.minQty}–${product.maxQty} ${product.unit} per order`
  } else if (input.productId === 'tshirt') {
    const method = CATALOGUE.tshirt.methods[input.method]
    if (input.quantity < method.minQty) {
      errors.quantity = `${method.label} needs at least ${method.minQty} shirts. Try DTF for smaller runs.`
    }
  } else if (input.productId === 'business-cards') {
    const method = CATALOGUE['business-cards'].methods[input.method]
    if (input.quantity < method.minQty) {
      errors.quantity = `${method.label} needs at least ${method.minQty} boxes. Try Digital for smaller runs.`
    }
  }

  if (input.productId === 'tshirt' && input.method === 'screen') {
    const colours = input.colours
    if (
      colours === undefined ||
      !Number.isInteger(colours) ||
      colours < 1 ||
      colours > CATALOGUE.tshirt.maxColours
    ) {
      errors.colours = `Choose 1–${CATALOGUE.tshirt.maxColours} colours for screen print`
    }
  }

  return errors
}
