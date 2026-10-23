import express from 'express'

export type AppOptions = {
  /** Git commit SHA of the running build, reported by /api/health. */
  version: string
}

/**
 * Builds the Express app without starting a server, so tests can
 * send requests to it directly (see app.test.ts).
 */
export function createApp({ version }: AppOptions) {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '10kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version })
  })

  return app
}
