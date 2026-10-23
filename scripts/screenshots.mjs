// Captures the README screenshots from a running stack (docker compose up -d).
//   node scripts/screenshots.mjs
import { chromium } from '@playwright/test'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const out = new URL('../docs/screenshots/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

// Start from a known set of sample orders.
await page.request.post(`${base}/api/samples`)

await page.goto(`${base}/orders`)
await page.getByText('Aisyah Rahman').waitFor()
await page.screenshot({ path: `${out}orders.png` })

await page.goto(`${base}/quotes/new`)
await page.getByLabel('Customer name').fill('Aisyah Rahman')
await page.getByLabel('Rush order (+15%)').check()
await page.getByRole('row', { name: /^Total/ }).waitFor()
await page.screenshot({ path: `${out}new-quote.png` })

await page.goto(`${base}/orders?q=priya`)
await page.getByRole('link', { name: /Priya Nair/ }).click()
await page.getByRole('heading', { level: 1 }).waitFor()
await page.getByText('History').waitFor()
await page.screenshot({ path: `${out}order-detail.png` })

await page.setViewportSize({ width: 390, height: 800 })
await page.goto(`${base}/orders`)
await page.getByText('Aisyah Rahman').waitFor()
await page.screenshot({ path: `${out}orders-mobile.png` })

await browser.close()
console.log('Screenshots written to docs/screenshots')
