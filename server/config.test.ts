import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.ts'

const base = { DATABASE_URL: 'postgres://x' }

describe('loadConfig demo guard', () => {
  it('defaults to a production-safe setup', () => {
    const config = loadConfig(base)
    expect(config.ENABLE_DEMO).toBe(false)
    expect(config.COOKIE_SECURE).toBe(false)
  })

  it('refuses demo seeding or resets unless ENABLE_DEMO is on', () => {
    expect(() => loadConfig({ ...base, SEED_ON_START: 'true' })).toThrow(
      /ENABLE_DEMO/,
    )
    expect(() => loadConfig({ ...base, DEMO_RESET_MINUTES: '60' })).toThrow(
      /ENABLE_DEMO/,
    )
    expect(
      loadConfig({ ...base, SEED_ON_START: 'true', ENABLE_DEMO: 'true' })
        .SEED_ON_START,
    ).toBe(true)
  })
})
