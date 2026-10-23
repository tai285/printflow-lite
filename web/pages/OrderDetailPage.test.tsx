// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders, sampleOrder } from '../test/utils.tsx'
import OrderDetailPage from './OrderDetailPage.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ID = '11111111-1111-4111-8111-111111111111'

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/orders/:id" element={<OrderDetailPage />} />
    </Routes>,
    `/orders/${ID}`,
  )
}

describe('OrderDetailPage', () => {
  it('shows the order, its breakdown and the next action', async () => {
    mockFetch((url) => (url.endsWith(ID) ? { body: sampleOrder() } : undefined))
    renderPage()

    expect(await screen.findByText('PF-0001')).toBeInTheDocument()
    expect(screen.getByText('Aisyah Rahman')).toBeInTheDocument()
    expect(screen.getAllByText('RM 840.00').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: 'Approve quote → Approved' }),
    ).toBeEnabled()
  })

  it('advances the order and shows the new status', async () => {
    const user = userEvent.setup()
    let current = sampleOrder()
    mockFetch((url, init) => {
      if (init?.method === 'POST' && url.endsWith('/transitions')) {
        expect(JSON.parse(String(init.body))).toEqual({
          from: 'quote',
          to: 'approved',
        })
        current = sampleOrder({ status: 'approved' })
        return { body: current }
      }
      return url.endsWith(ID) ? { body: current } : undefined
    })
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: /Approve quote/ }),
    )

    expect(
      await screen.findByRole('button', {
        name: 'Start production → In production',
      }),
    ).toBeInTheDocument()
  })

  it('explains a 409 conflict and refreshes to the latest version', async () => {
    const user = userEvent.setup()
    // The first load shows "quote", but another user already approved the order.
    let serverStatus = 'quote'
    mockFetch((url, init) => {
      if (init?.method === 'POST' && url.endsWith('/transitions')) {
        serverStatus = 'approved'
        return {
          status: 409,
          body: {
            error: {
              code: 'CONFLICT',
              message:
                'This order was updated elsewhere. It is now "approved".',
            },
          },
        }
      }
      return url.endsWith(ID)
        ? { body: sampleOrder({ status: serverStatus }) }
        : undefined
    })
    renderPage()
    await user.click(
      await screen.findByRole('button', { name: /Approve quote/ }),
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('updated elsewhere')
    expect(alert).toHaveTextContent('Showing the latest version')
    // The page refetched and now offers the next step after "approved".
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'Start production → In production',
        }),
      ).toBeInTheDocument(),
    )
  })

  it('offers no action for a finished order', async () => {
    mockFetch(() => ({ body: sampleOrder({ status: 'done' }) }))
    renderPage()

    expect(await screen.findByText('PF-0001')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /→/ })).not.toBeInTheDocument()
  })

  it('shows a friendly message when the order does not exist', async () => {
    mockFetch(() => ({
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'Order not found' } },
    }))
    renderPage()

    expect(
      await screen.findByText('This order does not exist.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to orders' }),
    ).toBeInTheDocument()
  })

  it('shows an error with retry when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot reach the server',
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
