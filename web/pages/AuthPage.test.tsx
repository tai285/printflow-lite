// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../api/client.ts'
import RequireAuth from '../components/RequireAuth.tsx'
import {
  meFor,
  mockFetch,
  renderWithProviders,
  sampleOrder,
} from '../test/utils.tsx'
import AuthPage from './AuthPage.tsx'
import OrderDetailPage from './OrderDetailPage.tsx'

afterEach(() => {
  cleanup()
  setUnauthorizedHandler(undefined)
  vi.unstubAllGlobals()
})

const ID = sampleOrder().id

function renderApp(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="login" element={<AuthPage mode="login" />} />
      <Route path="register" element={<AuthPage mode="register" />} />
      <Route element={<RequireAuth />}>
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="orders" element={<p>Orders list</p>} />
      </Route>
    </Routes>,
    route,
  )
}

describe('signing in', () => {
  it('sends signed-out visitors to the login page, then back after signing in', async () => {
    const user = userEvent.setup()
    let signedIn = false
    const { calls } = mockFetch(
      (url, init) => {
        if (url === '/api/auth/login' && init?.method === 'POST') {
          expect(JSON.parse(String(init.body))).toEqual({
            email: 'sam@example.com',
            password: 'correct horse battery',
          })
          signedIn = true
          return { body: meFor('staff') }
        }
        if (url.endsWith(ID)) return { body: sampleOrder() }
      },
      // Once login succeeds, /api/auth/me reports the user.
      { me: () => (signedIn ? meFor('staff') : null) },
    )
    renderApp(`/orders/${ID}`)

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse battery')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('PF-0001')).toBeInTheDocument()
    expect(calls.some((c) => c.url === '/api/auth/login')).toBe(true)
  })

  it('shows the server message for wrong credentials', async () => {
    const user = userEvent.setup()
    mockFetch(
      (url) => {
        if (url === '/api/auth/login') {
          return {
            status: 401,
            body: {
              error: {
                code: 'UNAUTHENTICATED',
                message: 'Email or password is wrong',
              },
            },
          }
        }
      },
      { me: null },
    )
    renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), 'a@example.com')
    await user.type(screen.getByLabelText('Password'), 'whatever password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email or password is wrong',
    )
  })

  it('shows field errors from the server when registering', async () => {
    const user = userEvent.setup()
    mockFetch(
      (url) => {
        if (url === '/api/auth/register') {
          return {
            status: 400,
            body: {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Some fields are invalid',
                fields: { password: 'Use at least 12 characters' },
              },
            },
          }
        }
      },
      { me: null },
    )
    renderApp('/register')

    await user.type(await screen.findByLabelText('Name'), 'Sam')
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      await screen.findByText('Use at least 12 characters'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })
})

describe('roles in the UI', () => {
  it('offers the next step to staff but not to customers', async () => {
    mockFetch(
      (url) => (url.endsWith(ID) ? { body: sampleOrder() } : undefined),
      {
        me: meFor('customer'),
      },
    )
    renderApp(`/orders/${ID}`)

    expect(await screen.findByText('PF-0001')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /→/ })).not.toBeInTheDocument()
  })
})

describe('writes and expired sessions', () => {
  it('sends the CSRF header on writes but not on reads', async () => {
    const user = userEvent.setup()
    const seen: { url: string; headers: Record<string, string> }[] = []
    mockFetch((url, init) => {
      seen.push({
        url,
        headers: (init?.headers ?? {}) as Record<string, string>,
      })
      if (init?.method === 'POST')
        return { body: sampleOrder({ status: 'approved' }) }
      if (url.endsWith(ID)) return { body: sampleOrder() }
    })
    renderApp(`/orders/${ID}`)
    await user.click(
      await screen.findByRole('button', { name: /Approve quote/ }),
    )

    await waitFor(() =>
      expect(seen.some((c) => c.url.endsWith('/transitions'))).toBe(true),
    )
    const write = seen.find((c) => c.url.endsWith('/transitions'))!
    const read = seen.find((c) => c.url.endsWith(ID))!
    expect(write.headers['X-Requested-With']).toBe('printflow')
    expect(read.headers['X-Requested-With']).toBeUndefined()
  })

  it('calls the unauthorized handler when a data request returns 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    mockFetch((url) =>
      url.endsWith(ID)
        ? {
            status: 401,
            body: { error: { code: 'UNAUTHENTICATED', message: 'Sign in' } },
          }
        : undefined,
    )
    renderApp(`/orders/${ID}`)

    await waitFor(() => expect(handler).toHaveBeenCalled())
  })
})
