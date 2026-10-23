import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'

export function renderWithProviders(ui: ReactElement, route = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

export type MockResponse = { status?: number; body?: unknown }
export type FetchHandler = (
  url: string,
  init: RequestInit | undefined,
) => MockResponse | undefined

/** Replaces global fetch with a handler that returns canned JSON responses. */
export function mockFetch(handler: FetchHandler) {
  const calls: { url: string; method: string }[] = []
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, method: init?.method ?? 'GET' })
    const result = handler(url, init)
    if (!result)
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`)
    return new Response(
      result.body === undefined ? null : JSON.stringify(result.body),
      { status: result.status ?? 200 },
    )
  })
  vi.stubGlobal('fetch', fn)
  return { calls }
}

export const sampleOrder = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  number: 'PF-0001',
  customerName: 'Aisyah Rahman',
  customerEmail: 'aisyah@example.com',
  productId: 'tshirt',
  status: 'quote',
  input: {
    productId: 'tshirt',
    method: 'screen',
    quantity: 50,
    locations: 1,
    colours: 2,
    rush: false,
  },
  breakdown: {
    lines: [
      { label: 'Garments', detail: '50 × RM 12.00', amountSen: 60000 },
      { label: 'Screen print printing', amountSen: 20000 },
      { label: 'Screen setup', amountSen: 4000 },
    ],
    subtotalSen: 84000,
    rushSen: 0,
    totalSen: 84000,
  },
  totalSen: 84000,
  pricingVersion: 1,
  isSample: false,
  createdAt: '2026-10-23T08:00:00.000Z',
  updatedAt: '2026-10-23T08:00:00.000Z',
  history: [
    {
      fromStatus: null,
      toStatus: 'quote',
      createdAt: '2026-10-23T08:00:00.000Z',
    },
  ],
  ...over,
})
