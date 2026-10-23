import { Link, NavLink, Outlet } from 'react-router'
import ThemeToggle from './ThemeToggle.tsx'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${
    isActive
      ? 'bg-indigo-50 text-indigo-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

export default function Layout() {
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-surface print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            PrintFlow <span className="text-indigo-600">Lite</span>
          </Link>
          <div className="flex items-center gap-3">
            <nav aria-label="Main" className="flex gap-1">
              <NavLink to="/orders" className={navClass}>
                Orders
              </NavLink>
              <NavLink to="/quotes/new" className={navClass}>
                New quote
              </NavLink>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-500 print:hidden">
        Fictional print shop demo. Prices are illustrative and not based on any
        real company's pricing.
      </footer>
    </div>
  )
}
