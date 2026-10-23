import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** A name unique to this run so tests never collide with sample or earlier data. */
const unique = (label: string) =>
  `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

async function createQuote(page: Page, customer: string) {
  await page.goto('/quotes/new')
  await page.getByLabel('Customer name').fill(customer)
  await page.getByRole('button', { name: 'Save quote' }).click()
  await expect(page.getByText(/Quote PF-\d+ saved/)).toBeVisible()
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/)
}

test('quote -> save -> advance to Done -> visible in the list', async ({
  page,
}) => {
  const customer = unique('Workflow')
  await createQuote(page, customer)

  // Spec example 1: 50 screen-printed shirts, 2 colours = RM 840.00.
  await expect(page.getByRole('row', { name: /^Total/ })).toContainText(
    'RM 840.00',
  )
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Quote')

  const steps = [/Approve quote/, /Start production/, /Mark ready/, /Mark done/]
  for (const step of steps) {
    await page.getByRole('button', { name: step }).click()
  }
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Done')
  await expect(page.getByRole('button', { name: /→/ })).toHaveCount(0)
  await expect(page.getByText('Quote → Approved')).toBeVisible()
  await expect(page.getByText('Ready → Done')).toBeVisible()

  // The data survives a reload and shows up in the list.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Done')
  await page.goto(`/orders?q=${encodeURIComponent(customer)}`)
  const row = page.getByRole('link', { name: new RegExp(customer) })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Done')
  await expect(row).toContainText('RM 840.00')
})

test('shows validation errors, then lets the user fix them', async ({
  page,
}) => {
  await page.goto('/quotes/new')
  const quantity = page.getByLabel(/Quantity/)

  await quantity.fill('24')
  await quantity.blur()
  await expect(
    page.getByText(/Screen print needs at least 25 shirts/),
  ).toBeVisible()
  await expect(
    page.getByText('Fix the highlighted fields to see a price.'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Save quote' }).click()
  await expect(page.getByLabel('Customer name')).toBeFocused()
  await expect(page).toHaveURL(/\/quotes\/new$/)

  await quantity.fill('50')
  await expect(page.getByRole('row', { name: /^Total/ })).toContainText(
    'RM 840.00',
  )
})

test('prices each product and option live', async ({ page }) => {
  await page.goto('/quotes/new')
  const total = page.getByRole('row', { name: /^Total/ })

  await page.getByLabel('Rush order (+15%)').check()
  await expect(total).toContainText('RM 966.00')

  await page.getByRole('radio', { name: 'Business cards' }).click()
  await page.getByLabel(/Quantity/).fill('3')
  await page.getByLabel(/Double-sided/).check()
  await page.getByLabel(/Matte lamination/).check()
  await expect(total).toContainText('RM 136.28') // spec example 4

  await page.getByRole('radio', { name: 'Vinyl banner' }).click()
  await page.getByLabel('Size').selectOption('S')
  await page.getByLabel(/Quantity/).fill('20')
  await page.getByLabel(/Eyelets/).check()
  await page.getByLabel('Rush order (+15%)').check()
  await expect(total).toContainText('RM 774.41') // spec example 3
})

test('searches and filters orders, kept in the URL', async ({ page }) => {
  const customer = unique('Searchable')
  await createQuote(page, customer)

  await page.goto('/orders')
  await page.getByLabel('Search orders').fill(customer.toUpperCase())
  await expect(page).toHaveURL(/q=/)
  await expect(
    page.getByRole('link', { name: new RegExp(customer) }),
  ).toHaveCount(1)

  await page.getByRole('button', { name: 'Ready', exact: true }).click()
  await expect(page).toHaveURL(/status=ready/)
  await expect(page.getByText('No orders match your search')).toBeVisible()

  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page).not.toHaveURL(/q=|status=/)
})

test('a stale tab gets a conflict message and the latest status', async ({
  browser,
}) => {
  const context = await browser.newContext()
  const first = await context.newPage()
  const second = await context.newPage()
  await createQuote(first, unique('Conflict'))
  await second.goto(first.url())
  await expect(
    second.getByRole('button', { name: /Approve quote/ }),
  ).toBeVisible()

  await first.getByRole('button', { name: /Approve quote/ }).click()
  await expect(
    first.getByRole('button', { name: /Start production/ }),
  ).toBeVisible()

  // The second tab still believes the order is a quote.
  await second.getByRole('button', { name: /Approve quote/ }).click()
  await expect(second.getByRole('alert')).toContainText('updated elsewhere')
  await expect(
    second.getByRole('button', { name: /Start production/ }),
  ).toBeVisible()
  await context.close()
})

test('sample data can be loaded and removed', async ({ page }) => {
  await page.goto('/orders')
  // Loading replaces any existing sample orders with a fresh set.
  await page.request.post('/api/samples')
  await page.reload()
  await expect(page.getByText('Sample').first()).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Remove sample data' }).click()
  await expect(page.getByText('Sample', { exact: true })).toHaveCount(0)
})

test('unknown routes and orders are handled', async ({ page }) => {
  await page.goto('/nope')
  await expect(page.getByText('Page not found')).toBeVisible()

  await page.goto('/orders/00000000-0000-4000-8000-000000000000')
  await expect(page.getByText('This order does not exist.')).toBeVisible()
})

test('print view hides navigation', async ({ page }) => {
  await createQuote(page, unique('Printable'))
  await page.emulateMedia({ media: 'print' })

  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()
  await expect(page.getByText('Contoh Print Co. (fictional)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Print quote' })).toBeHidden()
})

test('works at phone width without horizontal scrolling', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 800 },
  })
  const page = await context.newPage()
  await page.request.post('/api/samples')
  for (const path of ['/orders', '/quotes/new']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0)
  }
  await context.close()
})

test.describe('accessibility (axe)', () => {
  test('pages have no detectable WCAG A/AA violations', async ({ page }) => {
    await createQuote(page, unique('Axe'))
    const orderUrl = page.url()

    for (const url of ['/', '/orders', '/quotes/new', orderUrl]) {
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
})

test('landing page, page titles and search-engine settings', async ({
  page,
  request,
}) => {
  const response = await page.goto('/')
  await expect(page).toHaveTitle(/PrintFlow Lite/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Quotes and orders for print shops',
  )
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /quote and order tracker/,
  )

  await page.getByRole('link', { name: 'View orders' }).click()
  await expect(page).toHaveTitle('Orders · PrintFlow Lite')

  // No public SITE_URL is configured in the local stack, so indexing is off.
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow')
  const robots = await request.get('/robots.txt')
  expect(await robots.text()).toContain('Disallow: /')
  expect((await request.get('/sitemap.xml')).status()).toBe(404)
  expect((await request.get('/favicon.svg')).status()).toBe(200)
})

test.describe('dark mode', () => {
  test('toggle switches theme, persists and survives reload without a flash', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/orders')
    const toggle = page.getByRole('switch', { name: 'Dark mode' })
    const html = page.locator('html')

    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(html).not.toHaveClass(/dark/)
    const lightBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    )

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(html).toHaveClass(/dark/)
    const darkBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    )
    expect(darkBackground).not.toBe(lightBackground)

    // The choice is remembered across reloads and across pages.
    await page.reload()
    await expect(html).toHaveClass(/dark/)
    await page.goto('/quotes/new')
    await expect(html).toHaveClass(/dark/)

    await page.getByRole('switch', { name: 'Dark mode' }).click()
    await expect(html).not.toHaveClass(/dark/)
  })

  test('follows the system setting until the user chooses', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(
      page.getByRole('switch', { name: 'Dark mode' }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  test('is keyboard operable', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await page.getByRole('switch', { name: 'Dark mode' }).focus()
    await page.keyboard.press('Space')
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('every page passes the WCAG A/AA scan (including colour contrast) in dark mode', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await createQuote(page, unique('DarkAxe'))
    const orderUrl = page.url()
    await page.request.post('/api/samples')

    // Include a validation-error state, which uses the red palette.
    await page.goto('/quotes/new')
    await page.getByLabel(/Quantity/).fill('24')
    await page.getByRole('button', { name: 'Save quote' }).click()

    const urls = ['/', '/orders', '/quotes/new', orderUrl]
    for (const url of urls) {
      if (url !== '/quotes/new') await page.goto(url)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.locator('html')).toHaveClass(/dark/)
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
      expect(
        results.violations.map(
          (v) =>
            `${v.id}: ${v.help} (${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(' '))
              .join(', ')})`,
        ),
        `axe violations in dark mode on ${url}`,
      ).toEqual([])
    }
  })

  test('printed quotes stay light even in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await createQuote(page, unique('DarkPrint'))
    await page.emulateMedia({ colorScheme: 'dark', media: 'print' })

    const background = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    )
    expect(background).toBe('rgb(255, 255, 255)')
  })
})
