import pg from 'pg'
import { createDb } from '../db/client.ts'
import { runMigrations } from '../db/migrate.ts'

export const DEFAULT_TEST_DATABASE_URL =
  'postgres://printflow:printflow@localhost:5432/printflow_test'

/**
 * Runs once before the integration tests: creates the test database if it
 * is missing and applies all migrations to it.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL
  const target = new URL(url)
  const dbName = target.pathname.slice(1)
  if (!/^[a-z0-9_]+$/i.test(dbName)) {
    throw new Error(`Unsafe test database name: ${dbName}`)
  }

  const adminUrl = new URL(url)
  adminUrl.pathname = '/postgres'
  const admin = new pg.Client({ connectionString: adminUrl.toString() })
  try {
    await admin.connect()
  } catch (error) {
    throw new Error(
      `Cannot reach Postgres at ${adminUrl.host}. Start it with "docker compose up -d db". (${(error as Error).message})`,
    )
  }
  try {
    const exists = await admin.query(
      'select 1 from pg_database where datname = $1',
      [dbName],
    )
    if (exists.rowCount === 0) await admin.query(`create database ${dbName}`)
  } finally {
    await admin.end()
  }

  const handle = createDb(url)
  try {
    await runMigrations(handle.db)
  } finally {
    await handle.close()
  }
}
