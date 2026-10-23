import { BANNER, BUSINESS_CARDS, RUSH_PERCENT, TSHIRT } from './catalogue.ts'
import type { Tier } from './catalogue.ts'
import { formatRM, percentOf } from './money.ts'
import type { Sen } from './money.ts'
import type {
  BannerInput,
  BusinessCardsInput,
  LineItem,
  QuoteBreakdown,
  QuoteInput,
  TshirtInput,
} from './quote.ts'
import { checkBusinessRules } from './rules.ts'

/** Unit price of the highest tier whose minQty <= quantity. */
export function tierUnitPrice(tiers: readonly Tier[], quantity: number): Sen {
  let match: Tier | undefined
  for (const tier of tiers) {
    if (tier.minQty <= quantity) match = tier
  }
  if (!match) throw new RangeError(`No pricing tier for quantity ${quantity}`)
  return match.unitSen
}

function times(quantity: number, unitSen: Sen): string {
  return `${quantity} × ${formatRM(unitSen)}`
}

function priceTshirt(input: TshirtInput): LineItem[] {
  const { quantity, locations } = input
  const lines: LineItem[] = [
    {
      label: 'Garments',
      detail: times(quantity, TSHIRT.garmentSen),
      amountSen: quantity * TSHIRT.garmentSen,
    },
  ]

  const method = TSHIRT.methods[input.method]
  const unit = tierUnitPrice(method.tiers, quantity)
  lines.push({
    label: `Printing (${method.label})`,
    detail: `${quantity} × ${locations} location${locations > 1 ? 's' : ''} × ${formatRM(unit)}`,
    amountSen: quantity * locations * unit,
  })

  if (input.method === 'screen') {
    const colours = input.colours ?? 0
    const setup =
      TSHIRT.methods.screen.setupPerColourPerLocationSen * colours * locations
    lines.push({
      label: 'Screen setup',
      detail: `${colours} colour${colours > 1 ? 's' : ''} × ${locations} location${locations > 1 ? 's' : ''} × ${formatRM(TSHIRT.methods.screen.setupPerColourPerLocationSen)}`,
      amountSen: setup,
    })
  }
  return lines
}

function priceCards(input: BusinessCardsInput): LineItem[] {
  const { quantity } = input
  const method = BUSINESS_CARDS.methods[input.method]
  const unit = tierUnitPrice(method.tiers, quantity)
  const lines: LineItem[] = [
    {
      label: `${method.label} printing`,
      detail: `${quantity} box${quantity > 1 ? 'es' : ''} × ${formatRM(unit)}`,
      amountSen: quantity * unit,
    },
  ]
  if (method.setupSen > 0) {
    lines.push({ label: 'Offset setup', amountSen: method.setupSen })
  }
  if (input.doubleSided) {
    lines.push({
      label: 'Double-sided',
      detail: times(quantity, BUSINESS_CARDS.doubleSidedPerBoxSen),
      amountSen: quantity * BUSINESS_CARDS.doubleSidedPerBoxSen,
    })
  }
  if (input.lamination) {
    lines.push({
      label: 'Matte lamination',
      detail: times(quantity, BUSINESS_CARDS.laminationPerBoxSen),
      amountSen: quantity * BUSINESS_CARDS.laminationPerBoxSen,
    })
  }
  return lines
}

function priceBanner(input: BannerInput): LineItem[] {
  const { quantity } = input
  const size = BANNER.sizes[input.size]
  let discountPercent = 0
  for (const d of BANNER.discounts) {
    if (d.minQty <= quantity) discountPercent = d.percent
  }
  // Discount is applied to the unit price and rounded per unit, then multiplied.
  const unit = percentOf(size.unitSen, 100 - discountPercent)
  const lines: LineItem[] = [
    {
      label: `Banner ${size.label}`,
      detail:
        discountPercent > 0
          ? `${times(quantity, unit)} (${discountPercent}% volume discount)`
          : times(quantity, unit),
      amountSen: quantity * unit,
    },
  ]
  if (input.eyelets) {
    lines.push({
      label: 'Eyelets',
      detail: times(quantity, BANNER.eyeletsPerBannerSen),
      amountSen: quantity * BANNER.eyeletsPerBannerSen,
    })
  }
  return lines
}

/**
 * Prices a quote. Pure and deterministic.
 * Throws RangeError if the input breaks a business rule; validate first
 * (see validateQuote) to get friendly field errors instead.
 */
export function calculateQuote(input: QuoteInput): QuoteBreakdown {
  const errors = checkBusinessRules(input)
  if (Object.keys(errors).length > 0) {
    throw new RangeError(`Invalid quote input: ${JSON.stringify(errors)}`)
  }

  let lines: LineItem[]
  switch (input.productId) {
    case 'tshirt':
      lines = priceTshirt(input)
      break
    case 'business-cards':
      lines = priceCards(input)
      break
    case 'banner':
      lines = priceBanner(input)
      break
  }

  const subtotalSen = lines.reduce((sum, line) => sum + line.amountSen, 0)
  const rushSen = input.rush ? percentOf(subtotalSen, RUSH_PERCENT) : 0
  return { lines, subtotalSen, rushSen, totalSen: subtotalSen + rushSen }
}
