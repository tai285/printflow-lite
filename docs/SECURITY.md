# Security

Status of the production-hardening plan. Only items marked **Done** are
implemented and tested in this repository; everything else is an open gap.

## Done

| Control                                                                                                                                                                                       | Where                               | Tested by               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------- |
| Accounts with scrypt-hashed passwords (min 12 characters)                                                                                                                                     | `server/auth/`                      | `auth.int.test.ts`      |
| Server-side sessions in Postgres; cookie holds a random token, only its SHA-256 is stored; HttpOnly, SameSite=Lax, Secure when `COOKIE_SECURE=true`; 7-day expiry; logout deletes the session | `server/auth/sessions.ts`           | integration + e2e       |
| Same answer for unknown email and wrong password; hash check always runs                                                                                                                      | `server/auth/routes.ts`             | integration             |
| Roles `admin` / `staff` / `customer`; sign-up always creates a customer                                                                                                                       | `server/auth/middleware.ts`         | integration + e2e       |
| Ownership: customers see only their own orders; other people's orders return 404                                                                                                              | `server/orders/`                    | integration + e2e       |
| Only staff/admin can advance an order (403 otherwise)                                                                                                                                         | `server/orders/routes.ts`           | integration + e2e       |
| Demo helpers (`/api/samples`, seeding, periodic reset) off unless `ENABLE_DEMO=true`, admin-only, config refuses half-enabled demo                                                            | `server/app.ts`, `server/config.ts` | integration + unit      |
| CSRF: required `X-Requested-With: printflow` header on every write, plus Origin check when a browser sends one, plus SameSite=Lax                                                             | `server/http/csrf.ts`               | integration, smoke, e2e |
| Stricter rate limit on login/sign-up (`AUTH_RATE_LIMIT_MAX`, default 10/min/IP)                                                                                                               | `server/app.ts`                     | integration             |
| HSTS (Helmet default) and CSP `upgrade-insecure-requests` when `COOKIE_SECURE=true`                                                                                                           | `server/app.ts`                     | manual                  |
| Web: signed-out visitors redirected to sign-in; 401 mid-session ends the session in the UI; no cached orders survive logout                                                                   | `web/api/`                          | unit + e2e              |

| Production compose: read-only filesystem, all capabilities dropped, no-new-privileges, database port not published, required database password, demo off | `compose.prod.yaml` | local run (not CI) |
| Image published only from `main` after all checks pass; deploy verifies the running build and rolls back on failure | `.github/workflows/ci.yml`, `scripts/deploy.mjs` | local run only |

## Open gaps (not done)

- **Public read-only demo.** Deferred. Visitors must register; sample orders have no owner so only staff/admins see them. Public tunnel overlay (`compose.public.yaml`) still has `ENABLE_DEMO` on and wipes all orders hourly, so never put real data there.
- **TLS and secrets in a real deployment.** TLS comes from Cloudflare and is not verified end to end yet. `compose.yaml` (local demo) still has the default database password; `compose.prod.yaml` requires one.
- **Least-privilege DB roles; migrations as a separate CI/CD step.** The app still migrates on start with the same role.
- **Login lockout per account, password reset, email verification, MFA.**
- **Rate limiting uses in-memory counters** (not shared between instances).
- **Pagination and `q` length limit on `GET /api/orders`.**
- **Audit log, structured logging, error tracking, uptime alerts.**
- **PII retention/deletion/export, backups and restore drills.**
- **CI scanning** (CodeQL, `npm audit` gate, image scan, secret scanning), pinning GitHub Actions and base images to digests, branch protection.
- **Container hardening** (read-only filesystem, dropped capabilities), no published DB port in production.
- **CORS** is not configured (same-origin only), which is the safe default.
- **Tighter CSP review**, extra headers (`Referrer-Policy`, `Permissions-Policy`).
- **WAF / DDoS layer** and a vulnerability-disclosure contact.
