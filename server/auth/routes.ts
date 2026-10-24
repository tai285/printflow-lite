import { Router } from 'express'
import type { RequestHandler, Response } from 'express'
import { z } from 'zod'
import type { Db } from '../db/client.ts'
import { AppError, validationError } from '../http/errors.ts'
import { DUMMY_HASH, verifyPassword } from './passwords.ts'
import { currentUser } from './middleware.ts'
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  deleteSession,
  readCookie,
} from './sessions.ts'
import { createUser, findUserByEmail } from './users.ts'

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.email('Enter a valid email').max(254),
  password: z
    .string()
    .min(12, 'Use at least 12 characters')
    .max(128, 'Use at most 128 characters'),
})

const loginSchema = z.object({
  email: z.string().max(254),
  password: z.string().max(128),
})

function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    fields[issue.path.join('.') || 'body'] ??= issue.message
  }
  return fields
}

export type AuthRouterOptions = {
  db: Db
  /** Strict limiter for credential endpoints (login, register). */
  authLimiter: RequestHandler
  /** Adds the Secure flag to the cookie (needs HTTPS, so off for plain localhost). */
  secureCookies: boolean
  /** Lets the UI know whether the admin demo helpers exist. */
  demoEnabled: boolean
}

export function authRouter({
  db,
  authLimiter,
  secureCookies,
  demoEnabled,
}: AuthRouterOptions): Router {
  const router = Router()

  const setCookie = (res: Response, token: string, expiresAt: Date) => {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies,
      path: '/',
      expires: expiresAt,
      maxAge: SESSION_TTL_MS,
    })
  }

  // Public sign-up always creates a customer; staff accounts are made by an admin.
  router.post('/register', authLimiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) throw validationError(fieldErrors(parsed.error))
    const user = await createUser(db, { ...parsed.data, role: 'customer' })
    if (!user) throw validationError({ email: 'This email is already in use' })
    const session = await createSession(db, user.id)
    setCookie(res, session.token, session.expiresAt)
    res.status(201).json(user)
  })

  router.post('/login', authLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) throw validationError(fieldErrors(parsed.error))
    const found = await findUserByEmail(db, parsed.data.email)
    // Always run one hash check so timing does not reveal which emails exist.
    const ok = await verifyPassword(
      parsed.data.password,
      found?.passwordHash ?? DUMMY_HASH,
    )
    if (!found || !ok) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Email or password is wrong')
    }
    const session = await createSession(db, found.id)
    setCookie(res, session.token, session.expiresAt)
    res.json({
      id: found.id,
      email: found.email,
      name: found.name,
      role: found.role,
    })
  })

  router.post('/logout', async (req, res) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE)
    if (token) await deleteSession(db, token)
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    res.status(204).end()
  })

  router.get('/me', (req, res) => {
    res.json({ ...currentUser(req), demoEnabled })
  })

  return router
}
