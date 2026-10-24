import { eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { users } from '../db/schema.ts'
import type { UserRole } from '../../shared/roles.ts'
import { hashPassword } from './passwords.ts'

export const normaliseEmail = (email: string) => email.trim().toLowerCase()

/** Inserts a user. Returns undefined when the email is already registered. */
export async function createUser(
  db: Db,
  input: { email: string; name: string; password: string; role: UserRole },
) {
  const [row] = await db
    .insert(users)
    .values({
      email: normaliseEmail(input.email),
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      role: input.role,
    })
    .onConflictDoNothing({ target: users.email })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
  return row
}

export async function findUserByEmail(db: Db, email: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, normaliseEmail(email)))
  return row
}
