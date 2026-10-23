import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.ts'

export type Db = NodePgDatabase<typeof schema>

export type DbHandle = {
  db: Db
  /** Closes all pooled connections. */
  close: () => Promise<void>
}

export function createDb(connectionString: string): DbHandle {
  const pool = new pg.Pool({ connectionString, max: 10 })
  // An idle client erroring (e.g. the database restarting) must not crash the process.
  pool.on('error', (err) => console.error('Postgres pool error:', err.message))
  return { db: drizzle(pool, { schema }), close: () => pool.end() }
}
