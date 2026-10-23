import { describe, expect, it } from 'vitest'
import { calculateQuote, tierUnitPrice } from './pricing.ts'
import type { QuoteInput, TshirtInput } from './quote.ts'

const screen = (over: Partial<TshirtInput> = {}): TshirtInput => ({
  productId: 'tshirt',
  method: 'screen',
  quantity: 50,
  locations: 1,
  colours: 1,
  rush: false,
  ...over,
})

const dtf = (over: Partial<TshirtInput> = {}): TshirtInput => ({
  productId: 'tshirt',
  method: 'dtf',
  quantity: 10,
  locations: 1,
  rush: false,
  ...over,
})

const total = (input: QuoteInput) => calculateQuote(input).totalSen

describe('worked examples from the spec', () => {
  it('1. screen, 50 shirts, 1 location, 2 colours = RM 840.00', () => {
    const q = calculateQuote(screen({ quantity: 50, colours: 2 }))
    expect(q.lines.map((l) => [l.label, l.amountSen])).toEqual([
      ['Garments', 60000],
      ['Screen print printing', 20000],
      ['Screen setup', 4000],
    ])
    expect(q.subtotalSen).toBe(84000)
    expect(q.rushSen).toBe(0)
    expect(q.totalSen).toBe(84000)
  })

  it('2. DTF, 10 shirts, 2 locations, rush = RM 299.00', () => {
    const q = calculateQuote(dtf({ quantity: 10, locations: 2, rush: true }))
    expect(q.subtotalSen).toBe(26000)
    expect(q.rushSen).toBe(3900)
    expect(q.totalSen).toBe(29900)
  })

  it('3. banner S x 20, eyelets, rush = RM 774.41', () => {
    const q = calculateQuote({
      productId: 'banner',
      method: 'inkjet',
      size: 'S',
      quantity: 20,
      eyelets: true,
      rush: true,
    })
    expect(q.lines[0]!.amountSen).toBe(59340) // 20 x round(2966.5) = 20 x 2967
    expect(q.subtotalSen).toBe(67340)
    expect(q.rushSen).toBe(10101)
    expect(q.totalSen).toBe(77441)
  })

  it('4. digital cards x 3, double-sided + lamination, rush = RM 136.28', () => {
    const q = calculateQuote({
      productId: 'business-cards',
      method: 'digital',
      quantity: 3,
      doubleSided: true,
      lamination: true,
      rush: true,
    })
    expect(q.subtotalSen).toBe(11850)
    expect(q.rushSen).toBe(1778) // 1777.5 rounds up
    expect(q.totalSen).toBe(13628)
  })
})

describe('tier selection', () => {
  const tiers = [
    { minQty: 10, unitSen: 1 },
    { minQty: 20, unitSen: 2 },
  ]

  it('uses the highest tier whose minQty <= quantity', () => {
    expect(tierUnitPrice(tiers, 10)).toBe(1)
    expect(tierUnitPrice(tiers, 19)).toBe(1)
    expect(tierUnitPrice(tiers, 20)).toBe(2)
    expect(tierUnitPrice(tiers, 999)).toBe(2)
  })

  it('throws below the first tier', () => {
    expect(() => tierUnitPrice(tiers, 9)).toThrow(RangeError)
  })
})

describe('screen print tier boundaries (per unit, 1 location, 1 colour)', () => {
  // price = garment 12.00 + print + setup 20.00 (quantity-independent)
  const printPerUnit = (qty: number) =>
    (total(screen({ quantity: qty })) - 2000) / qty - 1200

  it.each([
    [25, 500],
    [49, 500],
    [50, 400],
    [99, 400],
    [100, 300],
    [249, 300],
    [250, 250],
    [500, 250],
  ])('quantity %i -> %i sen per unit', (qty, expected) => {
    expect(printPerUnit(qty)).toBe(expected)
  })
})

describe('DTF tier boundaries (per unit, 1 location)', () => {
  const printPerUnit = (qty: number) =>
    total(dtf({ quantity: qty })) / qty - 1200

  it.each([
    [1, 900],
    [9, 900],
    [10, 700],
    [49, 700],
    [50, 600],
    [500, 600],
  ])('quantity %i -> %i sen per unit', (qty, expected) => {
    expect(printPerUnit(qty)).toBe(expected)
  })
})

describe('business cards', () => {
  const cards = (over: Record<string, unknown> = {}) =>
    ({
      productId: 'business-cards',
      method: 'digital',
      quantity: 1,
      doubleSided: false,
      lamination: false,
      rush: false,
      ...over,
    }) as QuoteInput

  it('digital switches to the cheaper tier at 5 boxes', () => {
    expect(total(cards({ quantity: 4 }))).toBe(4 * 2500)
    expect(total(cards({ quantity: 5 }))).toBe(5 * 2000)
  })

  it('offset has a setup fee and is cheaper than digital from 8 boxes', () => {
    const offset = (qty: number) =>
      total(cards({ method: 'offset', quantity: qty }))
    const digital = (qty: number) => total(cards({ quantity: qty }))
    expect(offset(5)).toBe(6000 + 5 * 1200)
    expect(offset(7)).toBeGreaterThan(digital(7)) // 14400 vs 14000
    expect(offset(7)).toBe(6000 + 7 * 1200)
    expect(offset(8)).toBeLessThan(digital(8)) // 15600 vs 16000
  })

  it('adds options per box', () => {
    expect(total(cards({ quantity: 2, doubleSided: true }))).toBe(
      2 * (2500 + 800),
    )
    expect(total(cards({ quantity: 2, lamination: true }))).toBe(
      2 * (2500 + 650),
    )
  })
})

describe('banners', () => {
  const banner = (quantity: number, size: 'S' | 'M' | 'L' = 'M') =>
    ({
      productId: 'banner',
      method: 'inkjet',
      size,
      quantity,
      eyelets: false,
      rush: false,
    }) as QuoteInput

  it.each([
    [1, 5500],
    [4, 5500],
    [5, 4950], // 10% off
    [19, 4950],
    [20, 4675], // 15% off
    [50, 4675],
  ])('quantity %i -> %i sen per medium banner', (qty, unit) => {
    expect(total(banner(qty)) / qty).toBe(unit)
  })

  it('prices all three sizes', () => {
    expect(total(banner(1, 'S'))).toBe(3490)
    expect(total(banner(1, 'M'))).toBe(5500)
    expect(total(banner(1, 'L'))).toBe(8900)
  })
})

describe('rush and rounding', () => {
  it('adds 15% once, at the end, rounded half-up', () => {
    const base = total(dtf({ quantity: 1 })) // 2100
    expect(base).toBe(2100)
    expect(total(dtf({ quantity: 1, rush: true }))).toBe(2100 + 315)
  })

  it('never produces fractional sen', () => {
    for (let qty = 1; qty <= 60; qty++) {
      const q = calculateQuote(dtf({ quantity: qty, rush: true }))
      expect(Number.isInteger(q.totalSen)).toBe(true)
      expect(q.totalSen).toBe(q.subtotalSen + q.rushSen)
    }
  })
})

describe('invalid input', () => {
  it('refuses to price quantities that break the rules', () => {
    expect(() => calculateQuote(screen({ quantity: 24 }))).toThrow(RangeError)
    expect(() => calculateQuote(screen({ quantity: 501 }))).toThrow(RangeError)
    expect(() => calculateQuote(dtf({ quantity: 0 }))).toThrow(RangeError)
    expect(() => calculateQuote(screen({ colours: 5 }))).toThrow(RangeError)
  })
})
