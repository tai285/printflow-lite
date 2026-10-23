# PrintFlow Lite

A full-stack quote and order tracker for a **fictional** print shop. You build a
quote with live, itemised pricing, save it for a customer, and move the order
through **Quote → Approved → In Production → Ready → Done**.

> Status: **in development.** Live demo link, screenshots and the CI badge are
> added once they exist.

Pricing rules are illustrative and invented for this project. They are not
based on any real company's pricing.

## Stack

| Layer    | Choice                                                        |
| -------- | ------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4                  |
| Backend  | Node 24, Express 5 (TypeScript run directly by Node)          |
| Database | PostgreSQL 17 + Drizzle ORM                                   |
| Testing  | Vitest, Supertest; React Testing Library and Playwright later |
| Tooling  | oxlint, Prettier, Docker + Compose, GitHub Actions CI/CD      |

The reasoning behind each choice is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Getting started

Requirements: Node 24 (`nvm use` reads `.nvmrc`) and Docker.

**Everything in containers** (app + Postgres, http://localhost:3000):

```bash
docker compose up --build
```

**Development on the host** (Postgres in Docker, hot reload):

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run db:migrate && npm run db:seed
npm run dev        # web on http://localhost:5173, API on http://localhost:3000
```

## Scripts

| Command                | What it does                                |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Vite dev server + API with auto-restart     |
| `npm test`             | Run all unit/integration tests once         |
| `npm run typecheck`    | Type-check web, server and config code      |
| `npm run lint`         | Lint with oxlint                            |
| `npm run format:check` | Check formatting with Prettier              |
| `npm run build`        | Type-check and build the web app to `dist/` |
| `npm start`            | Run the API (production mode)               |

## Documentation

- [Product spec](docs/PRODUCT_SPEC.md): users, scope, stories, pricing rules
- [Architecture](docs/ARCHITECTURE.md): structure, decisions, CI/CD
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md): the 10-day schedule
- [Test plan](docs/TEST_PLAN.md): test layers and manual checklist
- [AI code-review log](docs/AI_CODE_REVIEW_LOG.md): how AI-generated code was checked
