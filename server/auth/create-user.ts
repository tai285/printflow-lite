import { createDb } from '../db/client.ts'
import { USER_ROLES } from '../../shared/roles.ts'
import type { UserRole } from '../../shared/roles.ts'
import { createUser } from './users.ts'

// `npm run user:create -- <email> <name> <role>` with PF_PASSWORD in the
// environment (so the password never lands in shell history or `ps`).
// This is how the first admin is made; customers sign up themselves.
if (import.meta.main) {
  const [email, name, role] = process.argv.slice(2)
  const password = process.env.PF_PASSWORD
  const url = process.env.DATABASE_URL
  if (!email || !name || !USER_ROLES.includes(role as UserRole)) {
    throw new Error(
      `Usage: user:create <email> <name> <${USER_ROLES.join('|')}>`,
    )
  }
  if (!password || password.length < 12) {
    throw new Error('Set PF_PASSWORD (at least 12 characters)')
  }
  if (!url) throw new Error('DATABASE_URL is required')

  const handle = createDb(url)
  try {
    const user = await createUser(handle.db, {
      email,
      name,
      password,
      role: role as UserRole,
    })
    console.log(
      user ? `Created ${user.role} ${user.email}` : 'Email already exists',
    )
    if (!user) process.exitCode = 1
  } finally {
    await handle.close()
  }
}
