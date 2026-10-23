import { defineConfig } from 'drizzle-kit'

// Used only by `npm run db:generate` to turn schema changes into SQL migrations.
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './drizzle',
})
