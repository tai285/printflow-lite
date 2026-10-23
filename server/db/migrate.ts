import path from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDb } from './client.ts'
import type { Db } from './client.ts'

const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, '../../drizzle')

/** Applies pending migrations from /drizzle. Safe to run repeatedly. */
export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}

// `npm run db:migrate`
if (import.meta.main) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const handle = createDb(url)
  try {
    await runMigrations(handle.db)
    console.log('Migrations applied')
  } finally {
    await handle.close()
  }
}
