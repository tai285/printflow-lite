import { CATALOGUE } from '../../shared/catalogue.ts'
import type { ProductId } from '../../shared/catalogue.ts'
import type { QuoteInput } from '../../shared/quote.ts'

export function productName(id: ProductId): string {
  return CATALOGUE[id].name
}

/** One-line summary such as "Screen print · 50 shirts · 2 colours · rush". */
export function describeInput(input: QuoteInput): string {
  const parts: string[] = []
  switch (input.productId) {
    case 'tshirt': {
      parts.push(CATALOGUE.tshirt.methods[input.method].label)
      parts.push(`${input.quantity} shirts`)
      parts.push(`${input.locations} location${input.locations > 1 ? 's' : ''}`)
      if (input.method === 'screen' && input.colours) {
        parts.push(`${input.colours} colour${input.colours > 1 ? 's' : ''}`)
      }
      break
    }
    case 'business-cards': {
      parts.push(CATALOGUE['business-cards'].methods[input.method].label)
      parts.push(`${input.quantity} × 100 cards`)
      if (input.doubleSided) parts.push('double-sided')
      if (input.lamination) parts.push('matte lamination')
      break
    }
    case 'banner': {
      parts.push(CATALOGUE.banner.sizes[input.size].label)
      parts.push(`${input.quantity} banner${input.quantity > 1 ? 's' : ''}`)
      if (input.eyelets) parts.push('eyelets')
      break
    }
  }
  if (input.rush) parts.push('rush')
  return parts.join(' · ')
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', { dateStyle: 'medium' })
}
