# CLAUDE.md

Guidance for AI coding assistants working in this repo.

## Purpose

PrintFlow Lite is a portfolio project: a full-stack quote and order tracker for a fictional print shop. The owner wants the whole system built, tested, containerized and deployed first, and will study the code afterwards. Build complete, working features; keep the code readable so it can be studied later.

## Rules

- `shared/` must stay pure TypeScript: no React, no Node APIs, no I/O.
- Money is always integer sen (`1 RM = 100 sen`). Never use floats for prices.
- The server is the price authority: never trust a total sent by the client.
- Every behaviour change comes with a test at the right layer (see docs/TEST_PLAN.md).
- Before proposing a commit run: `npm run lint && npm run format:check && npm run typecheck && npm test`.
- Commit messages: Conventional Commits, lowercase, imperative, ≤72 chars. Work on feature branches and merge through PRs once CI is set up.
- Pricing rules are fictional and must never be described as YoPrint's or any real shop's.
- Never commit secrets. `.env` is git-ignored; `.env.example` documents variables.
- Only `docs/AI_CODE_REVIEW_LOG.md` entries that really happened may be recorded there.

## Layout

- `shared/` domain logic and Zod schemas used by both server and web
- `server/` Express 5 API, run directly by Node 24 (type stripping, no build step)
- `web/` React + Vite + Tailwind UI (Vite root)
- `e2e/` Playwright tests
- `docs/` spec, architecture, plan, test plan, AI code-review log
- `Dockerfile`, `compose.yaml` containerization (Postgres + app)
