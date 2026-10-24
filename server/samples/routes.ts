import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { Db } from '../db/client.ts'
import { requireRole } from '../auth/middleware.ts'
import { removeSamples, seedSamples } from '../db/seed.ts'

/**
 * Demo helpers. Only orders flagged `is_sample` are ever touched,
 * so real orders are safe.
 */
export function samplesRouter(db: Db, writeLimiter: RequestHandler): Router {
  const router = Router()
  router.use(requireRole('admin'))

  // Replaces any existing sample orders with a fresh set.
  router.post('/', writeLimiter, async (_req, res) => {
    await removeSamples(db)
    const count = await seedSamples(db)
    res.status(201).json({ count })
  })

  router.delete('/', writeLimiter, async (_req, res) => {
    res.json({ count: await removeSamples(db) })
  })

  return router
}
