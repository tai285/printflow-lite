import type {
  BannerMethod,
  BannerSize,
  CardMethod,
  TshirtMethod,
} from './catalogue.ts'
import type { Sen } from './money.ts'

export type TshirtInput = {
  productId: 'tshirt'
  method: TshirtMethod
  quantity: number
  locations: 1 | 2
  /** Number of ink colours; required for screen print, ignored for DTF. */
  colours?: number
  rush: boolean
}

export type BusinessCardsInput = {
  productId: 'business-cards'
  method: CardMethod
  /** Number of boxes of 100. */
  quantity: number
  doubleSided: boolean
  lamination: boolean
  rush: boolean
}

export type BannerInput = {
  productId: 'banner'
  method: BannerMethod
  size: BannerSize
  quantity: number
  eyelets: boolean
  rush: boolean
}

export type QuoteInput = TshirtInput | BusinessCardsInput | BannerInput

export type LineItem = {
  label: string
  /** Human-readable working, e.g. "50 × RM 12.00". */
  detail?: string
  amountSen: Sen
}

export type QuoteBreakdown = {
  lines: LineItem[]
  subtotalSen: Sen
  rushSen: Sen
  totalSen: Sen
}
