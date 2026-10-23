# Product spec

## Problem and user

**User:** owner or front-desk staff at a small fictional print shop, "Contoh Print Co."

**Problem:** prices are worked out by hand on a calculator, so they come out inconsistent, and job status lives in chat threads.

**Primary journey:** build a quote with a live price → save it for a customer (the server recalculates and stores the price) → Approved → In Production → Ready → Done. Orders can be found by search and status filter, and every status change is recorded.

## Scope

| Priority    | Features                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Must (P0)   | Shared pricing engine (3 products) + validation; REST API for orders and status transitions on PostgreSQL; status history; quote builder with live preview; order list (search, filter); order detail with advance-status; loading, error and empty states; seed script; CI (lint, types, unit, integration, build); Docker image + Compose stack that starts the whole system locally with one command; smoke-tested in CI |
| Should (P1) | Playwright E2E in CI; React component tests; printable quote; responsive and accessibility pass; API rate limiting; Dependabot                                                                                                                                                                                                                                                                                              |
| Could (P2)  | Customers table; nightly demo reset; edit quote while in Quote; AI email → draft quote; staging environment                                                                                                                                                                                                                                                                                                                 |

**Design decisions**

- A saved quote **is** an order with status `quote`: one entity, one lifecycle.
- The **server is the price authority.** The UI previews prices with the same shared function, but the API ignores any client-sent total and recalculates it.
- In P0, customer name and email are fields on the order, not a separate table.

**Non-goals:** authentication and roles, payments, tax, inventory, artwork upload, email sending, real-time updates, garment size breakdowns, real-world pricing. The public demo is one shared workspace.

## User stories

| ID    | Story                  | Acceptance criteria                                                                                                                                                             | Pri |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| SH-1  | Deterministic pricing  | `calculateQuote(input)` is pure, returns an itemised breakdown in sen, and matches the worked examples below                                                                    | P0  |
| SH-2  | Shared validation      | Zod `quoteInputSchema` + `checkBusinessRules` return field-keyed messages, never throw, and run on both server and web                                                          | P0  |
| SH-3  | Status rules           | `canTransition(from, to)` allows only the next step; `nextStatus('done')` is `null`                                                                                             | P0  |
| DB-1  | Schema and migrations  | `orders` and `order_status_events` are created by a migration; `npm run db:migrate` is repeatable                                                                               | P0  |
| DB-2  | Seed data              | `npm run db:seed` inserts about 8 fictional orders marked `is_sample`, across all statuses                                                                                      | P0  |
| API-1 | Health                 | `GET /api/health` → 200 `{status, db, version}`; 503 if the database is unreachable                                                                                             | P0  |
| API-2 | Create order           | `POST /api/orders` → 201 with `PF-000N`, status `quote`, server-computed breakdown. Invalid body → 400 `VALIDATION_ERROR` with `fields`. A client total is ignored              | P0  |
| API-3 | List orders            | `GET /api/orders?status=&q=` → newest first, case-insensitive search on number, customer and product; invalid status → 400                                                      | P0  |
| API-4 | Order detail           | `GET /api/orders/:id` → order + history; unknown or malformed id → 404                                                                                                          | P0  |
| API-5 | Transition             | `POST /api/orders/:id/transitions {from, to}` → 200 + event row in one transaction; illegal move or stale `from` → 409                                                          | P0  |
| API-6 | Consistent errors      | `{error:{code, message, fields?}}`; no stack traces in production; 10 kB body limit                                                                                             | P0  |
| CI-1  | PR checks              | Lint, format, typecheck, unit + integration tests, build on every PR; required to merge                                                                                         | P0  |
| DK-1  | One-command stack      | `docker compose up --build` starts Postgres + app, applies migrations, seeds sample data on request, serves UI and API on http://localhost:3000; CI boots it and smoke-tests it | P0  |
| UI-1  | Quote builder          | Product-specific fields, live itemised preview, client errors and server 400 `fields` shown next to their inputs                                                                | P0  |
| UI-2  | Orders list            | Search and filter kept in the URL; loading, error (retry) and empty states                                                                                                      | P0  |
| UI-3  | Order detail + advance | Snapshot breakdown, history, single "Move to X" button; a 409 refetches and explains the conflict                                                                               | P0  |
| E2E-1 | Happy-path E2E         | Playwright: quote → save → advance to Done → check the list, in CI                                                                                                              | P1  |
| PQ-1  | Print quote            | Print CSS: shop header, customer, line items, total, "illustrative pricing" note                                                                                                | P1  |

## Pricing rules (illustrative)

> Approved by the project owner. These rules are made up to demonstrate business logic. They are **not** based on any real print shop's pricing. Prices are in fictional MYR, stored as integer sen, and exclude tax.

**Formula (all products)**

```
subtotal = setup + Σ(quantity × per-unit components)
rush     = round(subtotal × 15 / 100)   // half-up to the nearest sen, applied once
total    = subtotal + rush
```

The tier for a quantity is the highest tier whose `minQty ≤ quantity`.

### T-shirt

Quantity 1–500; print locations 1–2 (front/back); garment RM 12.00 per shirt.

| Method       | Min qty | Setup                                        | Print per unit per location                               |
| ------------ | ------- | -------------------------------------------- | --------------------------------------------------------- |
| Screen print | 25      | RM 20.00 × colours × locations (colours 1–4) | 25–49: 5.00 · 50–99: 4.00 · 100–249: 3.00 · 250–500: 2.50 |
| DTF          | 1       | none (colours not asked)                     | 1–9: 9.00 · 10–49: 7.00 · 50–500: 6.00                    |

### Business cards

Sold in boxes of 100; quantity is the number of boxes, 1–20. Options per box: double-sided +RM 8.00, matte lamination +RM 6.50.

| Method  | Min boxes | Setup    | Per box                  |
| ------- | --------- | -------- | ------------------------ |
| Digital | 1         | none     | 1–4: 25.00 · 5–20: 20.00 |
| Offset  | 5         | RM 60.00 | 12.00                    |

Offset becomes cheaper than digital from 8 boxes.

### Vinyl banner

Quantity 1–50; one method (large-format inkjet). Sizes: S 60×160 cm RM 34.90 · M 90×180 cm RM 55.00 · L 120×240 cm RM 89.00.

Volume discount on the banner unit price: 5–19 → −10%, 20–50 → −15%. The discounted unit price is **rounded per unit, then multiplied by quantity**. Eyelets cost +RM 4.00 per banner and are not discounted.

### Worked examples (these are test cases)

| #   | Input                                              | Calculation                                                                        | Total         |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------- |
| 1   | Screen, 50 shirts, 1 location, 2 colours           | garment 600.00 + print 200.00 + setup 40.00                                        | **RM 840.00** |
| 2   | DTF, 10 shirts, 2 locations, rush                  | 120.00 + 140.00 = 260.00; rush 39.00                                               | **RM 299.00** |
| 3   | Banner S × 20, eyelets, rush                       | unit round(3490 × 85 / 100 = 2966.5) = 29.67; 593.40 + 80.00 = 673.40; rush 101.01 | **RM 774.41** |
| 4   | Digital cards × 3, double-sided + lamination, rush | 3 × 39.50 = 118.50; rush round(1777.5) = 17.78                                     | **RM 136.28** |

### Validation

- Quantity must be a whole number: the trimmed string must match `/^\d+$/`, so `""`, `"1.5"`, `"1e2"` and `"-3"` are rejected.
- Quantity must be within the product range and at or above the method minimum. Messages are specific, e.g. "Screen printing needs at least 25 shirts. Try DTF for smaller runs."
- Colours are 1–4 and apply to screen print only.
- An unknown product or method is a validation error (400), never a crash.
- Customer name is 1–80 characters after trimming. Email is optional and must be a valid format if given.

Known pitfall: `z.coerce.number()` uses JavaScript `Number()`, where `Number("") === 0` and `Number("1e2") === 100`. Form strings are therefore parsed with an explicit pattern rather than coerced.
