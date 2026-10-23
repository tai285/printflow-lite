import { z } from 'zod'

const booleanString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  /** Git commit of the running build, reported by /api/health. */
  GIT_SHA: z.string().min(1).default('dev'),
  /** Run pending database migrations when the server starts. */
  AUTO_MIGRATE: booleanString.default(true),
  /** Insert fictional sample orders on start if the database has none. */
  SEED_ON_START: booleanString.default(false),
  /** Built web app to serve; skipped when the folder does not exist. */
  WEB_DIST: z.string().default('dist/web'),
  /**
   * Public address of the site (for example https://example.org). When set the
   * site is indexable and gets canonical URLs and a sitemap; when unset every
   * response says noindex, which suits temporary tunnel URLs.
   */
  SITE_URL: z
    .string()
    .optional()
    .transform((value) => value?.trim().replace(/\/+$/, '') || undefined),
  /** Wipe all orders and reload the sample orders every N minutes (0 = never). */
  DEMO_RESET_MINUTES: z.coerce.number().int().min(0).default(0),
  /**
   * Number of reverse proxies in front of the app (for example 1 behind a
   * Cloudflare tunnel). Needed so rate limiting sees each visitor's real IP.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  /** Max write requests per IP per minute. */
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
})

export type Config = z.infer<typeof envSchema>

/** Reads and validates environment variables, failing fast with a clear message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${problems}`)
  }
  return parsed.data
}
