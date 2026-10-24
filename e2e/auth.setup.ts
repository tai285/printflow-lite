import { expect, test as setup } from '@playwright/test'

export const ADMIN_STATE = 'e2e/.auth/admin.json'

// The stack must already contain this admin (CI creates it with
// `docker compose exec app node server/auth/create-user.ts ...`).
setup('sign in as the admin account', async ({ request }) => {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (see README)')
  }
  const response = await request.post('/api/auth/login', {
    data: { email, password },
  })
  expect(response.status(), 'admin login').toBe(200)
  await request.storageState({ path: ADMIN_STATE })
})
