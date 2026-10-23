import type { Sen } from './money.ts'

/**
 * Illustrative, fictional pricing data. Not based on any real company's prices.
 * All amounts are in sen. Bump PRICING_VERSION whenever a rule changes so that
 * stored quotes can say which rules priced them.
 */
export const PRICING_VERSION = 1
export const RUSH_PERCENT = 15

export const PRODUCT_IDS = ['tshirt', 'business-cards', 'banner'] as const
export type ProductId = (typeof PRODUCT_IDS)[number]

/** A tier applies from `minQty` upward, until the next tier starts. */
export type Tier = { minQty: number; unitSen: Sen }

export const TSHIRT = {
  id: 'tshirt',
  name: 'T-shirt',
  plural: 'T-shirts',
  unit: 'shirts',
  minQty: 1,
  maxQty: 500,
  garmentSen: 1200,
  maxLocations: 2,
  maxColours: 4,
  methods: {
    screen: {
      label: 'Screen print',
      minQty: 25,
      setupPerColourPerLocationSen: 2000,
      tiers: [
        { minQty: 25, unitSen: 500 },
        { minQty: 50, unitSen: 400 },
        { minQty: 100, unitSen: 300 },
        { minQty: 250, unitSen: 250 },
      ] satisfies Tier[],
    },
    dtf: {
      label: 'DTF (direct to film)',
      minQty: 1,
      tiers: [
        { minQty: 1, unitSen: 900 },
        { minQty: 10, unitSen: 700 },
        { minQty: 50, unitSen: 600 },
      ] satisfies Tier[],
    },
  },
} as const

export const BUSINESS_CARDS = {
  id: 'business-cards',
  name: 'Business cards',
  plural: 'Business cards',
  unit: 'boxes of 100',
  minQty: 1,
  maxQty: 20,
  doubleSidedPerBoxSen: 800,
  laminationPerBoxSen: 650,
  methods: {
    digital: {
      label: 'Digital',
      minQty: 1,
      setupSen: 0,
      tiers: [
        { minQty: 1, unitSen: 2500 },
        { minQty: 5, unitSen: 2000 },
      ] satisfies Tier[],
    },
    offset: {
      label: 'Offset',
      minQty: 5,
      setupSen: 6000,
      tiers: [{ minQty: 5, unitSen: 1200 }] satisfies Tier[],
    },
  },
} as const

export const BANNER = {
  id: 'banner',
  name: 'Vinyl banner',
  plural: 'Vinyl banners',
  unit: 'banners',
  minQty: 1,
  maxQty: 50,
  eyeletsPerBannerSen: 400,
  sizes: {
    S: { label: 'Small (60 × 160 cm)', unitSen: 3490 },
    M: { label: 'Medium (90 × 180 cm)', unitSen: 5500 },
    L: { label: 'Large (120 × 240 cm)', unitSen: 8900 },
  },
  methods: {
    inkjet: { label: 'Large-format inkjet', minQty: 1 },
  },
  /** Volume discount on the unit price, applied from `minQty`. */
  discounts: [
    { minQty: 5, percent: 10 },
    { minQty: 20, percent: 15 },
  ],
} as const

export const CATALOGUE = {
  tshirt: TSHIRT,
  'business-cards': BUSINESS_CARDS,
  banner: BANNER,
} as const

export type TshirtMethod = keyof typeof TSHIRT.methods
export type CardMethod = keyof typeof BUSINESS_CARDS.methods
export type BannerMethod = keyof typeof BANNER.methods
export type BannerSize = keyof typeof BANNER.sizes
