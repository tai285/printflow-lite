import { describe, expect, it } from 'vitest'
import { formatRM, percentOf } from './money.ts'

describe('percentOf', () => {
  it('rounds half-up to the nearest sen', () => {
    expect(percentOf(3490, 85)).toBe(2967) // 2966.5
    expect(percentOf(11850, 15)).toBe(1778) // 1777.5
    expect(percentOf(1, 50)).toBe(1) // 0.5
  })

  it('rounds down below the half', () => {
    expect(percentOf(1, 49)).toBe(0)
    expect(percentOf(1001, 15)).toBe(150) // 150.15
  })

  it('handles zero and 100%', () => {
    expect(percentOf(0, 15)).toBe(0)
    expect(percentOf(12345, 100)).toBe(12345)
  })

  it('does not drift like floating point would', () => {
    // 0.07 * 100 === 7.000000000000001 in floating point
    expect(percentOf(100, 7)).toBe(7)
  })
})

describe('formatRM', () => {
  it('formats sen with two decimals', () => {
    expect(formatRM(0)).toBe('RM 0.00')
    expect(formatRM(5)).toBe('RM 0.05')
    expect(formatRM(84000)).toBe('RM 840.00')
    expect(formatRM(77441)).toBe('RM 774.41')
  })

  it('groups thousands', () => {
    expect(formatRM(123450)).toBe('RM 1,234.50')
    expect(formatRM(100000000)).toBe('RM 1,000,000.00')
  })

  it('formats negatives', () => {
    expect(formatRM(-250)).toBe('-RM 2.50')
  })
})
