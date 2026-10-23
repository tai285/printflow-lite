// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeToggle from './ThemeToggle.tsx'

function mockSystemTheme(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: dark && query.includes('dark'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ThemeToggle', () => {
  it('starts in light mode when the system prefers light', () => {
    mockSystemTheme(false)
    render(<ThemeToggle />)

    expect(screen.getByRole('switch', { name: 'Dark mode' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('starts in dark mode when the system prefers dark', () => {
    mockSystemTheme(true)
    render(<ThemeToggle />)

    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeChecked()
    expect(document.documentElement).toHaveClass('dark')
  })

  it('toggles the theme, applies the class and remembers the choice', async () => {
    mockSystemTheme(false)
    const user = userEvent.setup()
    render(<ThemeToggle />)
    const toggle = screen.getByRole('switch', { name: 'Dark mode' })

    await user.click(toggle)
    expect(toggle).toBeChecked()
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('printflow-theme')).toBe('dark')

    await user.click(toggle)
    expect(toggle).not.toBeChecked()
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('printflow-theme')).toBe('light')
  })

  it('prefers the saved choice over the system setting', () => {
    mockSystemTheme(true)
    localStorage.setItem('printflow-theme', 'light')
    render(<ThemeToggle />)

    expect(screen.getByRole('switch', { name: 'Dark mode' })).not.toBeChecked()
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('still works when storage is unavailable', async () => {
    mockSystemTheme(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('switch', { name: 'Dark mode' }))

    expect(document.documentElement).toHaveClass('dark')
    vi.restoreAllMocks()
  })
})
