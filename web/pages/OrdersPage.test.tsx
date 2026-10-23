// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders, sampleOrder } from '../test/utils.tsx'
import OrdersPage from './OrdersPage.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('OrdersPage', () => {
  it('shows an empty state with a way to load sample data', async () => {
    const user = userEvent.setup()
    let loaded = false
    const { calls } = mockFetch((url, init) => {
      if (init?.method === 'POST' && url === '/api/samples') {
        loaded = true
        return { status: 201, body: { count: 8 } }
      }
      if (url.startsWith('/api/orders')) {
        return { body: loaded ? [sampleOrder({ isSample: true })] : [] }
      }
    })
    renderWithProviders(<OrdersPage />, '/orders')

    expect(await screen.findByText('No orders yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Load sample orders' }))

    expect(await screen.findByText('Aisyah Rahman')).toBeInTheDocument()
    expect(screen.getByText('Sample')).toBeInTheDocument()
    expect(
      calls.some((c) => c.method === 'POST' && c.url === '/api/samples'),
    ).toBe(true)
  })

  it('lists orders with number, customer, total and status', async () => {
    mockFetch(() => ({
      body: [
        sampleOrder(),
        sampleOrder({
          id: 'b',
          number: 'PF-0002',
          customerName: 'Lim Kai Wen',
          status: 'ready',
        }),
      ],
    }))
    renderWithProviders(<OrdersPage />, '/orders')

    expect(await screen.findByText('PF-0001')).toBeInTheDocument()
    expect(screen.getByText('Lim Kai Wen')).toBeInTheDocument()
    expect(screen.getByText('2 orders')).toBeInTheDocument()
    expect(screen.getAllByText('RM 840.00')).toHaveLength(2)
  })

  it('sends the status filter from the URL to the API', async () => {
    const { calls } = mockFetch(() => ({
      body: [sampleOrder({ status: 'ready' })],
    }))
    renderWithProviders(<OrdersPage />, '/orders?status=ready&q=aisyah')

    await screen.findByText('PF-0001')

    expect(calls[0]!.url).toBe('/api/orders?q=aisyah&status=ready')
    expect(
      screen.getByRole('button', { name: 'Ready', pressed: true }),
    ).toBeInTheDocument()
  })

  it('offers to clear filters when nothing matches', async () => {
    const user = userEvent.setup()
    mockFetch((url) => ({ body: url.includes('q=zzz') ? [] : [sampleOrder()] }))
    renderWithProviders(<OrdersPage />, '/orders?q=zzz')

    expect(
      await screen.findByText('No orders match your search'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByText('PF-0001')).toBeInTheDocument()
  })

  it('shows an error with a working retry', async () => {
    const user = userEvent.setup()
    let attempts = 0
    mockFetch(() => {
      attempts++
      return attempts === 1
        ? {
            status: 500,
            body: {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Something went wrong',
              },
            },
          }
        : { body: [sampleOrder()] }
    })
    renderWithProviders(<OrdersPage />, '/orders')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong',
    )
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('PF-0001')).toBeInTheDocument()
  })
})
