import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { sql } from 'drizzle-orm'
import type { Db } from './db/client.ts'
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
}: AppOptions) {
  const app = express()

  app.disable('x-powered-by')
  app.use(
    helmet({
      // Plain http://localhost must keep working.
      contentSecurityPolicy: {
        directives: { upgradeInsecureRequests: null },
      },
    }),
  )
  app.use(express.json({ limit: '10kb' }))

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

  app.get('/api/health', async (_req, res) => {
    try {
      await db.execute(sql`select 1`)
      res.json({ status: 'ok', db: 'ok', version })
    } catch {
      res.status(503).json({ status: 'error', db: 'down', version })
    }
  })

  app.use('/api/orders', ordersRouter(db, writeLimiter))
  app.use('/api/samples', samplesRouter(db, writeLimiter))
  app.use('/api', apiNotFound)

  if (webDist && fs.existsSync(path.join(webDist, 'index.html'))) {
    const root = path.resolve(webDist)
    app.use(express.static(root))
    // Client-side routes (/orders/:id, ...) fall back to the SPA shell.
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(root, 'index.html'))
    })
  }

  app.use(errorHandler)
  return app
}
