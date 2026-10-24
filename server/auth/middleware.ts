import type { Request, RequestHandler } from 'express'
import type { Db } from '../db/client.ts'
import type { UserRole } from '../../shared/roles.ts'
import { AppError } from '../http/errors.ts'
import { SESSION_COOKIE, findSessionUser, readCookie } from './sessions.ts'
import type { AuthUser } from './sessions.ts'

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by loadUser when the request carries a valid session cookie. */
    user?: AuthUser
  }
}

/** Looks up the session cookie (if any) and sets req.user. Never rejects. */
export function loadUser(db: Db): RequestHandler {
  return async (req, _res, next) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE)
    if (token) req.user = await findSessionUser(db, token)
    next()
  }
}

/** The signed-in user, or a 401 error. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue')
  }
  return req.user
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  currentUser(req)
  next()
}

/** 401 when signed out, 403 when signed in with the wrong role. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const user = currentUser(req)
    if (!roles.includes(user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to this')
    }
    next()
  }
}

/** Admins and staff see every order; customers only their own. */
export const isStaff = (user: AuthUser) =>
  user.role === 'admin' || user.role === 'staff'
