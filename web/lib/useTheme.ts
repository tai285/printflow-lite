import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

// Keep in sync with web/public/theme-init.js, which applies the theme before first paint.
const STORAGE_KEY = 'printflow-theme'

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#020617' : '#4f46e5')
}

/**
 * Current theme and a toggle. Defaults to the system setting (and follows it)
 * until the user picks one, after which their choice is remembered.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readStored() ?? systemTheme())

  useEffect(() => {
    apply(theme)
  }, [theme])

  // Follow the operating system while the user has not made a choice.
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return
    const onChange = () => {
      if (readStored() === null) setTheme(query.matches ? 'dark' : 'light')
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Not persisted (storage unavailable); the choice still applies this visit.
      }
      return next
    })
  }, [])

  return { theme, toggle }
}
