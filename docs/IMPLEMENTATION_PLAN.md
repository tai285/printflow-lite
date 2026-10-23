# Implementation plan

The whole system is built first (backend, then frontend, then containers and pipeline). Study and interview preparation happen afterwards. Status is tracked by checkbox.

## Phase 1: Foundation

- [x] Node 24, single-package layout (`shared/`, `server/`, `web/`)
- [x] Vite + React + Tailwind; Express `/api/health`
- [x] Vitest + Supertest; oxlint; Prettier
- [x] `ci.yml` v1 (lint, format, typecheck, test, build)
- [x] Docs; pricing rules approved
- [ ] First commit, public GitHub repo, CI green

## Phase 2: Shared domain (test-first)

- [ ] `money.ts`, `catalogue.ts`, `pricing.ts` (all four worked examples)
- [ ] `schemas.ts` (Zod) + business-rule validation
- [ ] `orderStatus.ts`
- [ ] Tier-boundary and validation tests

## Phase 3: Database and API

- [ ] Postgres via `compose.yaml`; Drizzle schema, migration, seed
- [ ] Config via Zod; error handler; validation middleware
- [ ] Orders: create, list, detail, transition (optimistic concurrency)
- [ ] Integration tests against real Postgres; CI `integration` job
- [ ] Helmet, rate limiting

## Phase 4: Frontend

- [ ] Router, TanStack Query, typed API client
- [ ] Quote builder with live preview and server field errors
- [ ] Orders list (search/filter in URL), order detail, advance + 409 handling
- [ ] Loading, error and empty states; responsive layout; accessibility
- [ ] Printable quote
- [ ] Component tests

## Phase 5: Containers and delivery

- [ ] Multi-stage `Dockerfile`; `compose.yaml` with app + Postgres
- [ ] CI builds the image; Playwright E2E job
- [ ] `deploy.yml`: migrate → deploy → wait for health SHA → smoke checks
- [ ] Dependabot

## Phase 6: Release

- [ ] README with screenshots, API reference, demo script
- [ ] Final regression and production smoke test
- [ ] Study / interview preparation (owner)
