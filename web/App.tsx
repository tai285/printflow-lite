import { useEffect, useState } from 'react'

type Health =
  | { state: 'loading' }
  | { state: 'ok'; version: string }
  | { state: 'error'; message: string }

// Day 1 placeholder: proves the browser -> Vite proxy -> Express path works.
// Replaced by real pages (and TanStack Query) on Day 6.
export default function App() {
  const [health, setHealth] = useState<Health>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false

    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ version: string }>
      })
      .then((body) => {
        if (!cancelled) setHealth({ state: 'ok', version: body.version })
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error'
        if (!cancelled) setHealth({ state: 'error', message })
      })

    // If the component unmounts before the request finishes, ignore the result.
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="mx-auto max-w-xl p-6 font-sans">
      <h1 className="text-2xl font-semibold">PrintFlow Lite</h1>
      <p className="mt-1 text-slate-600">
        Quotes and orders for a fictional print shop.
      </p>
      <p className="mt-6 rounded border p-3 text-sm">
        API: {health.state === 'loading' && 'checking…'}
        {health.state === 'ok' && `ok (version ${health.version})`}
        {health.state === 'error' && `unreachable: ${health.message}`}
      </p>
    </main>
  )
}
