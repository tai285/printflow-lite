import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { sql } from 'drizzle-orm'
import type { Db } from './db/client.ts'
import { authRouter } from './auth/routes.ts'
import { loadUser } from './auth/middleware.ts'
import { csrfProtection } from './http/csrf.ts'
import { apiNotFound, errorHandler } from './http/errors.ts'
import { ordersRouter } from './orders/routes.ts'
import { samplesRouter } from './samples/routes.ts'

export type AppOptions = {
  db: Db
  /** Git commit SHA of the running build, reported by /api/health. */
  version: string
  /** Folder with the built web app; served when it exists. */
  webDist?: string
  /** Max write requests per IP per minute. */
  rateLimitMax?: number
  /** Public address; makes the site indexable. Unset means noindex everywhere. */
  siteUrl?: string
  /** Number of trusted reverse proxies in front of the app (0 = none). */
  trustProxy?: number
  /** Max login/register attempts per IP per minute. */
  authRateLimitMax?: number
  /** Site is served over HTTPS: Secure cookies and upgrade-insecure-requests. */
  secureCookies?: boolean
  /** Mounts /api/samples (admin only). Off unless this is a demo. */
  enableDemo?: boolean
}

/**
 * Builds the Express app without starting a server, so tests can
 * send requests to it directly.
 */
export function createApp({
  db,
  version,
  webDist,
  rateLimitMax = 120,
  siteUrl,
  trustProxy = 0,
  authRateLimitMax = 10,
  secureCookies = false,
  enableDemo = false,
}: AppOptions) {
  const app = express()

  app.disable('x-powered-by')
  if (trustProxy > 0) app.set('trust proxy', trustProxy)
  app.use(
    helmet({
      // Plain http://localhost must keep working, so only upgrade on HTTPS.
      contentSecurityPolicy: {
        directives: secureCookies ? {} : { upgradeInsecureRequests: null },
      },
    }),
  )
  app.use(express.json({ limit: '10kb' }))

  // Without a permanent public address (for example a temporary tunnel URL),
  // ask search engines not to index anything.
  if (!siteUrl) {
    app.use((_req, res, next) => {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow')
      next()
    })
  }

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(robotsTxt(siteUrl))
  })
  app.get('/sitemap.xml', (_req, res) => {
    // A sitemap only makes sense once the site has a public address.
    if (!siteUrl)
      return void res.status(404).type('text/plain').send('Not found')
    res.type('application/xml').send(sitemapXml(siteUrl))
  })

  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: rateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Try again in a minute.',
        },
      })
    },
  })

  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: authRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Try again in a minute.',
        },
      })
    },
  })

  app.get('/api/health', async (_req, res) => {
    try {
      await db.execute(sql`select 1`)
      res.json({ status: 'ok', db: 'ok', version })
    } catch {
      res.status(503).json({ status: 'error', db: 'down', version })
    }
  })

  // After /api/health so a database outage still reports 503 there.
  app.use('/api', csrfProtection, loadUser(db))

  app.use(
    '/api/auth',
    authRouter({
      db,
      authLimiter,
      secureCookies,
      demoEnabled: enableDemo,
    }),
  )
  app.use('/api/orders', ordersRouter(db, writeLimiter))
  if (enableDemo) app.use('/api/samples', samplesRouter(db, writeLimiter))
  app.use('/api', apiNotFound)

  if (webDist && fs.existsSync(path.join(webDist, 'index.html'))) {
    const root = path.resolve(webDist)
    // `index: false` so "/" is served by the handler below, with SEO tags filled in.
    app.use(express.static(root, { index: false }))
    const shell = renderShell(
      fs.readFileSync(path.join(root, 'index.html'), 'utf-8'),
      siteUrl,
    )
    // Client-side routes (/orders/:id, ...) fall back to the SPA shell.
    app.get('/{*splat}', (_req, res) => {
      res.type('html').send(shell)
    })
  }

  app.use(errorHandler)
  return app
}

/** robots.txt: block everything unless the site has a public address. */
export function robotsTxt(siteUrl?: string): string {
  if (!siteUrl) return ['User-agent: *', 'Disallow: /', ''].join('\n')
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /orders',
    'Disallow: /quotes',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
}

/** Only the public landing page is worth indexing; the rest is app data. */
export function sitemapXml(siteUrl: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${siteUrl}/</loc></url>`,
    '</urlset>',
    '',
  ].join('\n')
}

/**
 * Fills the __SITE_URL__ placeholders in the built index.html. Without a site
 * URL the lines that need one (canonical, og:url, og:image) are removed.
 */
export function renderShell(html: string, siteUrl?: string): string {
  if (siteUrl) return html.replaceAll('__SITE_URL__', siteUrl)
  return html
    .split('\n')
    .filter((line) => !line.includes('__SITE_URL__'))
    .join('\n')
}
