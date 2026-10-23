// Captures the README screenshots from a running stack (docker compose up -d).
//   node scripts/screenshots.mjs
import { chromium } from '@playwright/test'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const out = new URL('../docs/screenshots/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
)

const browser = await chromium.launch()

// Start from a known set of sample orders.
const setup = await browser.newPage()
await setup.request.post(`${base}/api/samples`)
await setup.close()

for (const theme of ['light', 'dark']) {
  const suffix = theme === 'dark' ? '-dark' : ''
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: theme,
  })
  const page = await context.newPage()

  await page.goto(`${base}/orders`)
  await page.getByText('Aisyah Rahman').waitFor()
  await page.screenshot({ path: `${out}orders${suffix}.png` })

  await page.goto(`${base}/quotes/new`)
  await page.getByLabel('Customer name').fill('Aisyah Rahman')
  await page.getByLabel('Rush order (+15%)').check()
  await page.getByRole('row', { name: /^Total/ }).waitFor()
  await page.screenshot({ path: `${out}new-quote${suffix}.png` })

  await page.goto(`${base}/orders?q=priya`)
  await page.getByRole('link', { name: /Priya Nair/ }).click()
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.getByText('History').waitFor()
  await page.screenshot({ path: `${out}order-detail${suffix}.png` })

  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto(`${base}/orders`)
  await page.getByText('Aisyah Rahman').waitFor()
  await page.screenshot({ path: `${out}orders-mobile${suffix}.png` })

  await context.close()
}

await browser.close()
console.log('Screenshots written to docs/screenshots')
