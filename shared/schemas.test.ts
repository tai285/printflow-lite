import { describe, expect, it } from 'vitest'
import {
  parseWholeNumber,
  validateCreateOrder,
  validateQuote,
  validateTransition,
} from './schemas.ts'

const goodScreen = {
  productId: 'tshirt',
  method: 'screen',
  quantity: 50,
  locations: 1,
  colours: 2,
  rush: false,
}

describe('parseWholeNumber', () => {
  it.each([
    ['0', 0],
    ['25', 25],
    ['  42  ', 42],
    ['007', 7],
  ])('accepts %j', (text, expected) => {
    expect(parseWholeNumber(text)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '1.5', '1e2', '-3', '+3', '0x10', '1 2', '９'])(
    'rejects %j',
    (text) => {
      expect(parseWholeNumber(text)).toBeNull()
    },
  )

  it('rejects numbers beyond the safe integer range', () => {
    expect(parseWholeNumber('99999999999999999999')).toBeNull()
  })
})

describe('validateQuote', () => {
  it('accepts a valid quote', () => {
    const result = validateQuote(goodScreen)
    expect(result.ok).toBe(true)
  })

  it('defaults optional booleans to false', () => {
    const { rush: _rush, ...withoutRush } = goodScreen
    const result = validateQuote(withoutRush)
    expect(result.ok && result.value.rush).toBe(false)
  })

  it('removes colours from DTF quotes', () => {
    const result = validateQuote({ ...goodScreen, method: 'dtf', quantity: 5 })
    expect(result.ok).toBe(true)
    expect(result.ok && 'colours' in result.value).toBe(false)
  })

  it('ignores unknown extra fields', () => {
    const result = validateQuote({ ...goodScreen, totalSen: 1, evil: true })
    expect(result.ok).toBe(true)
    expect(result.ok && 'totalSen' in result.value).toBe(false)
  })

  it.each([
    [{ quantity: 24 }, 'quantity', /at least 25 shirts.*DTF/],
    [{ quantity: 501 }, 'quantity', /T-shirts: 1–500/],
    [{ quantity: 0 }, 'quantity', /1–500/],
    [{ quantity: -3 }, 'quantity', /1–500/],
    [{ quantity: 1.5 }, 'quantity', /whole number/],
    [{ quantity: '50' }, 'quantity', /Enter a quantity/],
    [{ quantity: null }, 'quantity', /Enter a quantity/],
    [{ quantity: undefined }, 'quantity', /Enter a quantity/],
    [{ colours: 0 }, 'colours', /1–4 colours/],
    [{ colours: 5 }, 'colours', /1–4 colours/],
    [{ colours: undefined }, 'colours', /1–4 colours/],
    [{ method: 'laser' }, 'method', /Choose a print method/],
    [{ locations: 3 }, 'locations', /1 or 2/],
  ])('rejects %j', (override, field, message) => {
    const result = validateQuote({ ...goodScreen, ...override })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[field]).toMatch(message)
  })

  it('rejects unknown products and non-objects without throwing', () => {
    for (const raw of [
      { productId: 'mug' },
      {},
      null,
      undefined,
      'x',
      42,
      [],
    ]) {
      const result = validateQuote(raw)
      expect(result.ok).toBe(false)
    }
  })

  it('applies per-method minimums for business cards', () => {
    const result = validateQuote({
      productId: 'business-cards',
      method: 'offset',
      quantity: 4,
      rush: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.quantity).toMatch(/at least 5 boxes/)
  })

  it('enforces banner quantity range and size', () => {
    const base = {
      productId: 'banner',
      method: 'inkjet',
      size: 'M',
      quantity: 50,
    }
    expect(validateQuote(base).ok).toBe(true)
    const tooMany = validateQuote({ ...base, quantity: 51 })
    expect(!tooMany.ok && tooMany.errors.quantity).toMatch(/1–50/)
    const badSize = validateQuote({ ...base, size: 'XL' })
    expect(!badSize.ok && badSize.errors.size).toMatch(/Choose a size/)
  })
})

describe('validateCreateOrder', () => {
  const body = {
    customerName: ' Aisyah ',
    customerEmail: '',
    input: goodScreen,
  }

  it('trims the name and turns an empty email into null', () => {
    const result = validateCreateOrder(body)
    expect(result.ok && result.value.customerName).toBe('Aisyah')
    expect(result.ok && result.value.customerEmail).toBeNull()
  })

  it('ignores a client-supplied total', () => {
    const result = validateCreateOrder({ ...body, totalSen: 1, total: 1 })
    expect(result.ok).toBe(true)
    expect(result.ok && 'totalSen' in result.value).toBe(false)
  })

  it('reports customer and quote errors together, keyed by field', () => {
    const result = validateCreateOrder({
      customerName: '   ',
      customerEmail: 'nope',
      input: { ...goodScreen, quantity: 24 },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        'customerEmail',
        'customerName',
        'input.quantity',
      ])
    }
  })

  it('limits name length', () => {
    const result = validateCreateOrder({
      ...body,
      customerName: 'x'.repeat(81),
    })
    expect(!result.ok && result.errors.customerName).toMatch(/at most 80/)
    expect(
      validateCreateOrder({ ...body, customerName: 'x'.repeat(80) }).ok,
    ).toBe(true)
  })

  it('rejects non-object bodies', () => {
    for (const raw of [null, undefined, 'x', 1, []]) {
      expect(validateCreateOrder(raw).ok).toBe(false)
    }
  })

  it('rejects non-string email and name types', () => {
    const result = validateCreateOrder({
      ...body,
      customerName: 5,
      customerEmail: 5,
    })
    expect(!result.ok && Object.keys(result.errors)).toEqual(
      expect.arrayContaining(['customerName', 'customerEmail']),
    )
  })
})

describe('validateTransition', () => {
  it('accepts known statuses', () => {
    expect(validateTransition({ from: 'quote', to: 'approved' }).ok).toBe(true)
  })

  it('rejects unknown or missing statuses', () => {
    expect(validateTransition({ from: 'quote', to: 'shipped' }).ok).toBe(false)
    expect(validateTransition({ from: 'quote' }).ok).toBe(false)
    expect(validateTransition(null).ok).toBe(false)
  })
})
