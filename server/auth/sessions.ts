import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { sessions, users } from '../db/schema.ts'
import type { UserRole } from '../../shared/roles.ts'

export const SESSION_COOKIE = 'pf_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type AuthUser = {
  id: string
  email: string
  name: string
  role: UserRole
}

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

/** Starts a session. Only the token's hash is stored; the token goes in the cookie. */
export async function createSession(
  db: Db,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db
    .insert(sessions)
    .values({ tokenHash: hashToken(token), userId, expiresAt })
  // Housekeeping: drop sessions that have already expired.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
  return { token, expiresAt }
}

/** The user behind a cookie token, or undefined if it is unknown or expired. */
export async function findSessionUser(
  db: Db,
  token: string,
): Promise<AuthUser | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
  return row
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
}

/** Reads one cookie from a Cookie header without needing a parser dependency. */
export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}
