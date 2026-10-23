import { describe, expect, it } from 'vitest'
import {
  emptyForm,
  evaluateQuote,
  validateCustomer,
  withProduct,
} from './formModel.ts'
import type { FormState } from './formModel.ts'

const form = (over: Partial<FormState> = {}): FormState => ({
  ...emptyForm(),
  ...over,
})

describe('evaluateQuote', () => {
  it('prices the default T-shirt form as in the spec (RM 840.00)', () => {
    const result = evaluateQuote(emptyForm())
    expect(result.errors).toEqual({})
    expect(result.breakdown?.totalSen).toBe(84000)
    expect(result.input).toMatchObject({ productId: 'tshirt', quantity: 50 })
  })

  it('prices the default business cards and banner forms', () => {
    expect(evaluateQuote(emptyForm('business-cards')).breakdown?.totalSen).toBe(
      7500,
    )
    expect(evaluateQuote(emptyForm('banner')).breakdown?.totalSen).toBe(5500)
  })

  it.each([
    ['', 'Enter a quantity'],
    ['   ', 'Enter a quantity'],
    ['abc', 'Quantity must be a whole number'],
    ['1.5', 'Quantity must be a whole number'],
    ['1e2', 'Quantity must be a whole number'],
    ['-3', 'Quantity must be a whole number'],
    ['0', 'T-shirts: 1–500 shirts per order'],
    ['501', 'T-shirts: 1–500 shirts per order'],
    ['24', 'Screen print needs at least 25 shirts. Try DTF for smaller runs.'],
  ])('quantity %j -> %j', (quantity, message) => {
    const result = evaluateQuote(form({ quantity }))
    expect(result.errors.quantity).toBe(message)
    expect(result.input).toBeNull()
    expect(result.breakdown).toBeNull()
  })

  it('accepts surrounding spaces in the quantity', () => {
    expect(evaluateQuote(form({ quantity: ' 50 ' })).input).not.toBeNull()
  })

  it('requires colours for screen print only', () => {
    expect(evaluateQuote(form({ colours: '' })).errors.colours).toMatch(/1–4/)
    expect(evaluateQuote(form({ colours: '5' })).errors.colours).toMatch(/1–4/)
    expect(evaluateQuote(form({ colours: 'x' })).errors.colours).toMatch(/1–4/)

    const dtf = evaluateQuote(
      form({ method: 'dtf', quantity: '10', colours: '' }),
    )
    expect(dtf.errors).toEqual({})
    expect(dtf.input).not.toHaveProperty('colours')
  })

  it('lets a small run through DTF but not screen print', () => {
    expect(
      evaluateQuote(form({ method: 'dtf', quantity: '1' })).errors,
    ).toEqual({})
    expect(
      evaluateQuote(form({ method: 'screen', quantity: '1' })).errors.quantity,
    ).toBeDefined()
  })

  it('applies offset minimums for business cards', () => {
    const cards = withProduct(emptyForm(), 'business-cards')
    const offset = evaluateQuote({ ...cards, method: 'offset', quantity: '4' })
    expect(offset.errors.quantity).toMatch(/at least 5 boxes/)
    expect(
      evaluateQuote({ ...cards, method: 'offset', quantity: '5' }).errors,
    ).toEqual({})
  })

  it('includes options and rush in the price', () => {
    const cards = withProduct(emptyForm(), 'business-cards')
    const result = evaluateQuote({
      ...cards,
      doubleSided: true,
      lamination: true,
      rush: true,
    })
    expect(result.breakdown?.totalSen).toBe(13628) // spec example 4
  })
})

describe('withProduct', () => {
  it('resets product-specific fields but keeps customer details and rush', () => {
    const before = form({
      customerName: 'Aisyah',
      customerEmail: 'a@example.com',
      quantity: '99',
      colours: '4',
      rush: true,
    })
    const after = withProduct(before, 'banner')

    expect(after).toMatchObject({
      productId: 'banner',
      method: 'inkjet',
      quantity: '1',
      colours: '',
      customerName: 'Aisyah',
      customerEmail: 'a@example.com',
      rush: true,
    })
  })
})

describe('validateCustomer', () => {
  it('requires a name', () => {
    expect(
      validateCustomer({ customerName: '  ', customerEmail: '' }).customerName,
    ).toBeDefined()
  })

  it('limits the name length', () => {
    const long = 'x'.repeat(81)
    expect(
      validateCustomer({ customerName: long, customerEmail: '' }).customerName,
    ).toMatch(/80/)
  })

  it('treats the email as optional but checks its format', () => {
    expect(validateCustomer({ customerName: 'A', customerEmail: '' })).toEqual(
      {},
    )
    expect(
      validateCustomer({ customerName: 'A', customerEmail: 'a@b.co' }),
    ).toEqual({})
    expect(
      validateCustomer({ customerName: 'A', customerEmail: 'nope' })
        .customerEmail,
    ).toBeDefined()
  })
})
