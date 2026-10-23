import { Link } from 'react-router'
import { primaryButton, secondaryButton } from '../components/ui.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

const FEATURES = [
  {
    title: 'Instant, itemised quotes',
    text: 'T-shirts, business cards and vinyl banners with quantity tiers, setup fees, options and a rush surcharge. Every line of the price is shown.',
  },
  {
    title: 'One source of truth for prices',
    text: 'The browser previews the price, but the server recalculates it from validated input, so a quote can never be tampered with.',
  },
  {
    title: 'A clear order workflow',
    text: 'Quote, Approved, In production, Ready, Done: one step at a time, with a full history and safe handling when two people act at once.',
  },
]

export default function HomePage() {
  useDocumentTitle()
  return (
    <div className="space-y-10">
      <section className="py-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Quotes and orders for{' '}
          <span className="text-indigo-600">print shops</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          PrintFlow Lite is a demo of a quote and order tracker for a fictional
          print shop: price a job in seconds, save it, and follow it through
          production.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/quotes/new" className={primaryButton}>
            Build a quote
          </Link>
          <Link to="/orders" className={secondaryButton}>
            View orders
          </Link>
        </div>
      </section>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">
          Features
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="rounded-lg border border-slate-200 bg-surface p-5"
            >
              <h3 className="text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-sm text-slate-500">
        Built with React, TypeScript, Express and PostgreSQL. Everything here is
        fictional demo data; prices are illustrative.
      </p>
    </div>
  )
}
