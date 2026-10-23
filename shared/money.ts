/** Money is always an integer number of sen (1 RM = 100 sen). */
export type Sen = number

/**
 * `percent`% of `sen`, rounded half-up to the nearest sen.
 * Integer-only arithmetic avoids floating-point drift (e.g. 0.1 + 0.2).
 */
export function percentOf(sen: Sen, percent: number): Sen {
  return Math.floor((sen * percent + 50) / 100)
}

/** Formats sen as e.g. "RM 1,234.50". */
export function formatRM(sen: Sen): string {
  const negative = sen < 0
  const abs = Math.abs(Math.round(sen))
  const ringgit = Math.floor(abs / 100)
  const cents = String(abs % 100).padStart(2, '0')
  const grouped = String(ringgit).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}RM ${grouped}.${cents}`
}
