import AxeBuilder from '@axe-core/playwright'
import { expect, request as playwrightRequest, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// These tests start signed out, unlike the rest of the suite.
test.use({ storageState: { cookies: [], origins: [] } })

const PASSWORD = 'a long enough password'
const unique = (label: string) =>
  `${label}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

async function register(page: Page, name: string) {
  const email = `${unique('e2e')}@example.com`
  await page.goto('/register')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/orders$/)
  return email
}

test('private pages send signed-out visitors to sign in, then back', async ({
  page,
}) => {
  await page.goto('/quotes/new')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Orders' })).toHaveCount(0)

  const email = await (async () => {
    const address = `${unique('back')}@example.com`
    const created = await page.request.post('/api/auth/register', {
      data: { name: 'Back Again', email: address, password: PASSWORD },
    })
    expect(created.status()).toBe(201)
    await page.request.post('/api/auth/logout')
    return address
  })()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/quotes\/new$/)
})

test('wrong password shows an error and stays on the form', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('nobody@example.com')
  await page.getByLabel('Password').fill('not the password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Email or password is wrong',
  )
  await expect(page).toHaveURL(/\/login$/)
})

test('a customer can quote and track, but cannot advance production', async ({
  page,
}) => {
  const name = unique('Customer')
  await register(page, name)
  await expect(page.getByText('customer', { exact: true })).toBeVisible()

  await page.goto('/quotes/new')
  await page.getByLabel('Customer name').fill(name)
  await page.getByRole('button', { name: 'Save quote' }).click()
  await expect(page.getByText(/Quote PF-\d+ saved/)).toBeVisible()
  const orderUrl = page.url()

  // No production buttons for customers.
  await expect(page.getByRole('button', { name: /→/ })).toHaveCount(0)

  // The list holds only their own order, none of the admin-created ones.
  await page.goto('/orders')
  await expect(page.getByRole('link', { name: new RegExp(name) })).toHaveCount(
    1,
  )
  await expect(page.getByText('1 order', { exact: true })).toBeVisible()

  // The API enforces the same rule, whatever the UI shows.
  const forbidden = await page.request.post(
    `${orderUrl.replace('/orders/', '/api/orders/')}/transitions`,
    {
      data: { from: 'quote', to: 'approved' },
    },
  )
  expect(forbidden.status()).toBe(403)
})

test("a customer cannot open another customer's order", async ({ browser }) => {
  const alice = await browser.newContext()
  const bob = await browser.newContext()
  const alicePage = await alice.newPage()
  const bobPage = await bob.newPage()
  await register(alicePage, unique('Alice'))
  await register(bobPage, unique('Bob'))

  await alicePage.goto('/quotes/new')
  await alicePage.getByLabel('Customer name').fill(unique('AliceOrder'))
  await alicePage.getByRole('button', { name: 'Save quote' }).click()
  await expect(alicePage).toHaveURL(/\/orders\/[0-9a-f-]{36}$/)

  await bobPage.goto(alicePage.url())
  await expect(bobPage.getByText('This order does not exist.')).toBeVisible()
  await alice.close()
  await bob.close()
})

test('signing out ends the session and protects the API', async ({ page }) => {
  await register(page, unique('Leaver'))
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  expect((await page.request.get('/api/orders')).status()).toBe(401)
  await page.goto('/orders')
  await expect(page).toHaveURL(/\/login$/)
})

test('an expired session sends the user back to sign in', async ({ page }) => {
  await register(page, unique('Expired'))
  // Simulate the server forgetting the session (expiry, logout elsewhere).
  await page.context().clearCookies()
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'New quote' })
    .click()
  await page.getByLabel('Customer name').fill('Whoever')
  await page.getByRole('button', { name: 'Save quote' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('the API refuses writes that lack the CSRF header', async ({
  page,
  baseURL,
}) => {
  await register(page, unique('Csrf'))
  const cookies = await page.context().cookies()
  const cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

  // A forged cross-site request carries the cookie but cannot add the header.
  // The config adds the CSRF header to every context; override it with a
  // wrong value, as a forged request could not send the right one anyway.
  const bare = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: { 'X-Requested-With': 'forged' },
  })
  const forged = await bare.post('/api/orders', {
    headers: { cookie },
    data: {},
  })
  expect(forged.status()).toBe(403)
  const crossSite = await bare.post('/api/orders', {
    headers: {
      cookie,
      origin: 'https://evil.example',
      'x-requested-with': 'printflow',
    },
    data: {},
  })
  expect(crossSite.status()).toBe(403)
  await bare.dispose()
})

test('sign-in and register pages pass the WCAG A/AA scan', async ({ page }) => {
  for (const url of ['/login', '/register']) {
    await page.goto(url)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(
      results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`),
      `axe violations on ${url}`,
    ).toEqual([])
  }
})
