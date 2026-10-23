// Smoke test for a running PrintFlow stack. Read-only apart from one rejected
// (invalid) write, so it is safe to run against any environment.
//
//   npm run smoke                       -> http://localhost:3000
//   BASE_URL=http://host:3000 npm run smoke
//   EXPECT_VERSION=abc1234 npm run smoke   (also checks the build version)

const base = (process.env.BASE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
)
const expectedVersion = process.env.EXPECT_VERSION
const waitSeconds = Number(process.env.WAIT_SECONDS ?? 60)

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`)
  if (!ok) failures++
}

async function waitForHealth() {
  const deadline = Date.now() + waitSeconds * 1000
  let last = 'no response'
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`)
      const body = await res.json()
      if (res.ok && body.db === 'ok') return body
      last = `HTTP ${res.status} ${JSON.stringify(body)}`
    } catch (error) {
      last = error.message
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(`Health check did not pass within ${waitSeconds}s (${last})`)
}

try {
  const health = await waitForHealth()
  check(
    'health reports ok with database ok',
    health.status === 'ok' && health.db === 'ok',
  )
  if (expectedVersion) {
    check(
      `health reports version ${expectedVersion}`,
      health.version === expectedVersion,
      `got ${health.version}`,
    )
  }

  const list = await fetch(`${base}/api/orders`)
  const orders = await list.json()
  check('GET /api/orders returns an array', list.ok && Array.isArray(orders))

  if (Array.isArray(orders) && orders.length > 0) {
    const detail = await fetch(`${base}/api/orders/${orders[0].id}`)
    const order = await detail.json()
    check(
      'GET /api/orders/:id returns the order with history',
      detail.ok && order.id === orders[0].id && Array.isArray(order.history),
    )
  }

  const invalid = await fetch(`${base}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const invalidBody = await invalid.json()
  check(
    'POST /api/orders rejects an empty body with field errors',
    invalid.status === 400 &&
      invalidBody.error?.fields?.customerName !== undefined,
    `HTTP ${invalid.status}`,
  )

  const home = await fetch(`${base}/`)
  const html = await home.text()
  check('GET / serves the web app', home.ok && html.includes('PrintFlow Lite'))

  const route = await fetch(`${base}/orders/some-id`)
  check(
    'client-side routes fall back to the web app',
    route.ok && (await route.text()).includes('<div id="root">'),
  )
} catch (error) {
  check('stack is reachable', false, error.message)
}

if (failures > 0) {
  console.error(`\n${failures} smoke check(s) failed`)
  process.exit(1)
}
console.log('\nAll smoke checks passed')
