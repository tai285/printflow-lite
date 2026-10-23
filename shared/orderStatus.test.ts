import { describe, expect, it } from 'vitest'
import {
  ORDER_STATUSES,
  canTransition,
  isOrderStatus,
  nextStatus,
} from './orderStatus.ts'

describe('nextStatus', () => {
  it('walks the workflow in order and ends at done', () => {
    expect(nextStatus('quote')).toBe('approved')
    expect(nextStatus('approved')).toBe('in_production')
    expect(nextStatus('in_production')).toBe('ready')
    expect(nextStatus('ready')).toBe('done')
    expect(nextStatus('done')).toBeNull()
  })
})

describe('canTransition', () => {
  it('allows exactly the next step and nothing else (all 25 pairs)', () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const expected =
          ORDER_STATUSES.indexOf(to) === ORDER_STATUSES.indexOf(from) + 1
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected)
      }
    }
  })
})

describe('isOrderStatus', () => {
  it('recognises valid statuses only', () => {
    expect(isOrderStatus('ready')).toBe(true)
    expect(isOrderStatus('shipped')).toBe(false)
    expect(isOrderStatus(undefined)).toBe(false)
  })
})
