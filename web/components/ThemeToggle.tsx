import { useTheme } from '../lib/useTheme.ts'

/** Header switch between light and dark mode. */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className="relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border border-slate-300 bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      {/* Icons sit on the track; the knob slides over the active one. */}
      <SunIcon className="absolute left-1.5 size-4 text-amber-900" />
      <MoonIcon className="absolute right-1.5 size-4 text-indigo-700" />
      <span
        aria-hidden="true"
        className={`absolute top-0.5 size-6 rounded-full bg-brand shadow transition-all ${
          dark ? 'left-[1.625rem]' : 'left-0.5'
        }`}
      />
      <span
        aria-hidden="true"
        className={`absolute top-0.5 flex size-6 items-center justify-center text-white transition-all ${
          dark ? 'left-[1.625rem]' : 'left-0.5'
        }`}
      >
        {dark ? (
          <MoonIcon className="size-3.5" />
        ) : (
          <SunIcon className="size-3.5" />
        )}
      </span>
    </button>
  )
}

function SunIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}
