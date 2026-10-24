import type { RequestHandler } from 'express'
import { AppError } from './errors.ts'

/** Header every state-changing request must carry; see csrfProtection. */
export const CSRF_HEADER = 'x-requested-with'
export const CSRF_VALUE = 'printflow'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defence for the cookie-based login. Two independent checks on every
 * request that changes data:
 *  1. A custom header. A page on another site cannot add custom headers to a
 *     cross-origin request without a CORS preflight, and this API allows none.
 *  2. If the browser sent an Origin, it must be this site (req.host honours
 *     the trusted-proxy setting). Requests without Origin (curl, server to
 *     server) are not browser CSRF and rely on check 1 only.
 * SameSite=Lax on the session cookie is a third, browser-level layer.
 */
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next()

  if (req.get(CSRF_HEADER) !== CSRF_VALUE) {
    throw new AppError(403, 'FORBIDDEN', 'Missing request header')
  }
  const origin = req.get('origin')
  if (origin) {
    let sameSite = false
    try {
      sameSite = new URL(origin).host === req.host
    } catch {
      // A malformed Origin is treated as foreign.
    }
    if (!sameSite) throw new AppError(403, 'FORBIDDEN', 'Cross-site request')
  }
  next()
}
