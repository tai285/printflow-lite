# Architecture

## Overview

One npm package with three source folders:

```
shared/   pure TypeScript domain logic + Zod schemas (no React, no Node APIs)
server/   Express 5 API on Node 24; in the container also serves the built web app
web/      React SPA built by Vite (Vite's root)
```

`server/` and `web/` both import from `shared/` with plain relative imports. The pricing function that shows a live preview in the browser is the **same code** the API uses to compute the stored price.

Planned request flow for saving a quote:

```
React form ──(shared validation + live price preview)──► POST /api/orders
  routes.ts   validate body with the shared Zod schema → 400 if invalid
  service.ts  checkBusinessRules → calculateQuote (server is the price authority)
  Drizzle     INSERT order + INSERT status event in one transaction → 201
TanStack Query invalidates ['orders'] → the list refetches
```

## Data model

- `orders`: `id uuid pk`, `number text unique` (`PF-0001`, from a sequence), `customer_name`, `customer_email null`, `product_id`, `input jsonb`, `breakdown jsonb`, `total_sen int`, `pricing_version int`, `status` (enum), `is_sample bool`, `created_at`, `updated_at`.
- `order_status_events`: `id`, `order_id → orders` (cascade), `from_status null`, `to_status`, `created_at`.

Status transitions use one conditional update:

```sql
UPDATE orders SET status = $to WHERE id = $id AND status = $from RETURNING *
```

If no row comes back, the order either doesn't exist (404) or someone else changed it first (409). That's optimistic concurrency without locks.

`input` is `jsonb` because each product has different options. It's validated by Zod before it's written, and `total_sen` is a real column for sorting.

## Decisions

| Decision                                        | Why                                                                                                                                                                                | Alternative considered                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Single package, three folders                   | One `package.json`, shared code via relative imports                                                                                                                               | npm workspaces: more config for no benefit at this size                                  |
| Express 5                                       | Widely known, simple; Express 5 passes errors from async handlers to the error handler; easy to test with Supertest                                                                | Fastify: faster with better typing, but a steeper learning curve                         |
| **Node runs the server's `.ts` files directly** | Node 24 strips types natively, so there's no server build step and no `tsx`/esbuild. `erasableSyntaxOnly` in `tsconfig.server.json` bans TS features that can't simply be stripped | esbuild bundle (the original plan; dropped once the Day 1 spike showed it wasn't needed) |
| PostgreSQL                                      | Transactions, enums, jsonb; the database a real system would use                                                                                                                   | SQLite: simpler, but weaker for a realistic multi-user system                            |
| Drizzle ORM + drizzle-kit                       | SQL-like and TypeScript-first, so SQL knowledge carries over                                                                                                                       | Prisma: heavier, separate schema language                                                |
| Zod schemas in `shared/`                        | One definition gives server validation, client validation and TS types                                                                                                             | Hand-written checks duplicated on both sides                                             |
| TanStack Query                                  | Handles loading, error, caching and refetch-after-change                                                                                                                           | Hand-written `useEffect` fetching                                                        |
| React Router                                    | Deep links to `/orders/:id`; filters kept in the URL                                                                                                                               | View-state switch without URLs                                                           |
| Docker (multi-stage image + Compose)            | The whole system starts with one command, and the same image is used locally and in CI; Postgres without a native install                                                          | Native installs and platform buildpacks                                                  |
| Express serves the SPA in the container         | One service, one URL, no CORS                                                                                                                                                      | Separate frontend host plus CORS configuration                                           |
| oxlint                                          | Ships with the current Vite template; fast, minimal config                                                                                                                         | ESLint: more plugins, more config                                                        |
| TypeScript 6.0                                  | Matches the Vite template's pinned version (npm's default had moved to 7.x)                                                                                                        | TypeScript 7: newer, but the ecosystem hasn't been checked against it here               |

## Containers

- `Dockerfile` (multi-stage): `deps` installs dependencies, `build` builds the web app, `runtime` is a slim Node 24 image with production dependencies, `server/`, `shared/`, `drizzle/` and `dist/web`. It runs as a non-root user and starts with `node server/index.ts`.
- `compose.yaml`: `db` (postgres:17 with a healthcheck and a named volume) and `app` (the image above, waits for a healthy `db`, runs migrations on start). `docker compose up --build` gives a complete local system on http://localhost:3000.
- Local development can use only the `db` service (`docker compose up -d db`) with `npm run dev` on the host.
- The system is run locally with Docker only; there is no hosted deployment. CI builds the image and boots the full Compose stack on every PR so a broken Dockerfile or migration fails early.

## Hosting

The stack is self-hosted. `compose.public.yaml` adds a `cloudflared` quick tunnel in front of the app, plus demo guard rails (hourly data reset, stricter rate limit, trusted-proxy setting). See [DEPLOYMENT.md](DEPLOYMENT.md).

## Testing boundaries

- `shared/`: pure unit tests (pricing, validation, status rules).
- `server/`: Supertest against `createApp()`; integration tests use a real Postgres test database that is truncated between tests, with no database mocks.
- `web/`: component tests (React Testing Library, jsdom) with a mocked API layer.
- `e2e/`: Playwright happy path against the running app and a real database.

## CI/CD

```
PR opened/updated ──► ci.yml
  quality       npm ci → lint → format:check → typecheck → test → build
  integration   postgres:17 service → db:migrate → integration tests
  stack         docker compose up --build → wait for health → smoke script → logs on failure
  e2e           Compose stack → Playwright → upload report on failure

(the same checks run on pushes to main)
```

Delivery is local: `docker compose up --build` starts Postgres and the app, runs migrations, and serves everything on http://localhost:3000. The `stack` CI job proves this on every PR, using the exact same Compose file.

- Migrations are additive, so older code keeps working right after one.
- Rolling back means checking out the previous commit and rebuilding the image.

## Security basics

- Every request body is validated.
- Queries are parameterised through Drizzle.
- 10 kB JSON body limit; `x-powered-by` disabled; Helmet headers; rate limiting on write endpoints (the demo has no authentication).
- Generic 500 messages in production.
- Secrets live only in `.env` (git-ignored); `.env.example` documents the variables.
- The container runs as a non-root user.
