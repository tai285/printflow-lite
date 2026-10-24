// Smoke test for a running PrintFlow stack. Apart from rejected (invalid or
// unauthorised) writes it only reads, so it is safe to run anywhere.
//
// Signed-out checks always run. Set SMOKE_EMAIL and SMOKE_PASSWORD (any
// existing account) to also check the signed-in API.
//
//   npm run smoke                       -> http://localhost:3000
//   BASE_URL=http://host:3000 npm run smoke
//   EXPECT_VERSION=abc1234 npm run smoke   (also checks the build version)

const base = (process.env.BASE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
)
const expectedVersion = process.env.EXPECT_VERSION
const smokeEmail = process.env.SMOKE_EMAIL
const smokePassword = process.env.SMOKE_PASSWORD
const CSRF = { 'X-Requested-With': 'printflow' }
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

  // Signed out: private data is closed and writes need the CSRF header.
  const anon = await fetch(`${base}/api/orders`)
  check(
    'GET /api/orders is closed to signed-out visitors',
    anon.status === 401,
    `HTTP ${anon.status}`,
  )
  const forged = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  check(
    'writes without the CSRF header are refused',
    forged.status === 403,
    `HTTP ${forged.status}`,
  )
  const samples = await fetch(`${base}/api/samples`, {
    method: 'POST',
    headers: CSRF,
  })
  check(
    'POST /api/samples is not open to signed-out visitors',
    samples.status === 401 || samples.status === 404,
    `HTTP ${samples.status}`,
  )

  if (smokeEmail && smokePassword) {
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF },
      body: JSON.stringify({ email: smokeEmail, password: smokePassword }),
    })
    check(
      'login succeeds and sets a session cookie',
      login.status === 200 && login.headers.has('set-cookie'),
      `HTTP ${login.status}`,
    )
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
    const authed = { cookie }

    const list = await fetch(`${base}/api/orders`, { headers: authed })
    const orders = await list.json()
    check(
      'signed in: GET /api/orders returns an array',
      list.ok && Array.isArray(orders),
    )

    if (Array.isArray(orders) && orders.length > 0) {
      const detail = await fetch(`${base}/api/orders/${orders[0].id}`, {
        headers: authed,
      })
      const order = await detail.json()
      check(
        'signed in: GET /api/orders/:id returns the order with history',
        detail.ok && order.id === orders[0].id && Array.isArray(order.history),
      )
    }

    const invalid = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF, ...authed },
      body: '{}',
    })
    const invalidBody = await invalid.json()
    check(
      'signed in: POST /api/orders rejects an empty body with field errors',
      invalid.status === 400 &&
        invalidBody.error?.fields?.customerName !== undefined,
      `HTTP ${invalid.status}`,
    )

    await fetch(`${base}/api/auth/logout`, {
      method: 'POST',
      headers: { ...CSRF, ...authed },
    })
    const after = await fetch(`${base}/api/orders`, { headers: authed })
    check(
      'logout invalidates the session',
      after.status === 401,
      `HTTP ${after.status}`,
    )
  } else {
    console.log('SKIP  signed-in checks (set SMOKE_EMAIL and SMOKE_PASSWORD)')
  }

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
