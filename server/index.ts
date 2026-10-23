import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createDb } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import { seedIfEmpty } from './db/seed.ts'

const config = loadConfig()
const { db, close } = createDb(config.DATABASE_URL)

if (config.AUTO_MIGRATE) {
  await runMigrations(db)
  console.log('Migrations applied')
}
if (config.SEED_ON_START) {
  const seeded = await seedIfEmpty(db)
  if (seeded > 0) console.log(`Seeded ${seeded} sample orders`)
}

const app = createApp({
  db,
  version: config.GIT_SHA,
  webDist: config.WEB_DIST,
  rateLimitMax: config.RATE_LIMIT_MAX,
})

const server = app.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`)
})

// Let in-flight requests finish when Docker stops the container.
function shutdown() {
  server.close(async () => {
    await close()
    process.exit(0)
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
