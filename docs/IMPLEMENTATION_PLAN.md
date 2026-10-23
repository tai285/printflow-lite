# Implementation plan

The whole system is built first (backend, then frontend, then containers and pipeline). Study and interview preparation happen afterwards. Status is tracked by checkbox.

## Phase 1: Foundation

- [x] Node 24, single-package layout (`shared/`, `server/`, `web/`)
- [x] Vite + React + Tailwind; Express `/api/health`
- [x] Vitest + Supertest; oxlint; Prettier
- [x] `ci.yml` v1 (lint, format, typecheck, test, build)
- [x] Docs; pricing rules approved
- [x] First commit, public GitHub repo

## Phase 2: Shared domain (test-first)

- [x] `money.ts`, `catalogue.ts`, `pricing.ts` (all four worked examples)
- [x] `schemas.ts` (Zod) + business-rule validation
- [x] `orderStatus.ts`
- [x] Tier-boundary and validation tests

## Phase 3: Database and API

- [x] Postgres via `compose.yaml`; Drizzle schema, migration, seed
- [x] Config via Zod; error handler; validation middleware
- [x] Orders: create, list, detail, transition (optimistic concurrency)
- [x] Integration tests against real Postgres; CI `integration` job
- [x] Helmet, rate limiting

## Phase 4: Frontend

- [x] Router, TanStack Query, typed API client
- [x] Quote builder with live preview and server field errors
- [x] Orders list (search/filter in URL), order detail, advance + 409 handling
- [x] Loading, error and empty states; responsive layout; accessibility
- [x] Printable quote
- [x] Component tests

## Phase 5: Containers and CI

- [x] Multi-stage `Dockerfile`; `compose.yaml` with app + Postgres
- [x] CI builds the image; Playwright E2E job
- [x] Smoke script; CI `stack` job boots the Compose stack and smoke-tests it
- [x] Dependabot

## Phase 6: Free self-hosting and SEO

- [x] Cloudflare quick tunnel overlay (`compose.public.yaml`) with demo reset, rate limit and trusted proxy
- [x] Landing page, titles, Open Graph, canonical, JSON-LD, robots.txt, sitemap.xml, noindex until `SITE_URL` is set
- [x] Deployment and SEO guide
- [ ] Stable free address (free subdomain + named tunnel), owner action

## Phase 7: Release

- [x] README with screenshots, API reference, demo script
- [x] Final regression on the local Docker stack
- [ ] Study / interview preparation (owner)
