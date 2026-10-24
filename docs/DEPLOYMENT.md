# Hosting and deployment (free, self-hosted)

## Production: continuous delivery

```
git push / merge to main
  └─ CI: quality + integration + stack (smoke, e2e)  all green
       └─ publish job: builds the image, pushes ghcr.io/tai285/printflow-lite:<commit-sha> and :latest
            └─ on the server:  npm run deploy   (pulls the newest image, restarts, verifies, rolls back on failure)
                 └─ Cloudflare tunnel (outbound only) ──► https address
```

The image is published automatically, only from `main`, only after every check passes. The server pulls it when you run `npm run deploy` (pull-based, so the server never accepts inbound connections and CI holds no credentials for it).

### One-time setup

1. **Make the package pullable.** After the first publish run on `main`, open GitHub → your profile → Packages → `printflow-lite` → Package settings → change visibility to **Public** (the code is public anyway). Otherwise run `docker login ghcr.io` on the server with a token that has `read:packages`.
2. **Configure the server.** On the machine that runs the app:
   ```bash
   cp .env.production.example .env.production
   # set POSTGRES_PASSWORD (openssl rand -hex 24) and choose COMPOSE_PROFILES=quick or named
   ```
3. **Stop the old demo stack** if it is running (`npm run public:down`, then `docker compose down`), because it has no login and wipes data.
4. **Deploy:** `npm run deploy`. It prints the public address for a quick tunnel.
5. **Create the first admin** (customers sign up themselves):
   ```bash
   docker compose --env-file .env.production -f compose.prod.yaml exec -T -e PF_PASSWORD='a-long-password' app \
     node server/auth/create-user.ts you@example.com "Your Name" admin
   ```

### Every release

```bash
npm run deploy                 # newest image
npm run deploy -- <commit-sha> # a specific build; this is also the rollback command
```

The script pulls the image, runs `docker compose up --wait` (waits for the health checks), confirms the app reports the expected build, and records it as the last good build. If the new build does not come up healthy it restores the last good one and exits with an error.

### What the production stack does differently from the demo

|                                        | Demo (`compose.yaml` + `compose.public.yaml`) | Production (`compose.prod.yaml`)                                  |
| -------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| Image                                  | built from source locally                     | pulled from GHCR (built and tested by CI)                         |
| Demo helpers, sample data, hourly wipe | on                                            | off (`ENABLE_DEMO=false`)                                         |
| Database password                      | default `printflow`                           | required, from `.env.production`                                  |
| Database port on the host              | published                                     | not published                                                     |
| Cookies                                | plain                                         | `Secure`, with HSTS (`COOKIE_SECURE=true`)                        |
| Container                              | default                                       | read-only filesystem, all capabilities dropped, no-new-privileges |

### Stable address (named tunnel)

A quick tunnel's address changes whenever the tunnel container is recreated, which is fine for testing but not for customers. For a stable address you need a hostname on a Cloudflare-managed domain: create a tunnel in Cloudflare Zero Trust, point its public hostname at `http://app:3000`, then set `COMPOSE_PROFILES=named`, `TUNNEL_TOKEN=...` and `SITE_URL=https://your-hostname` in `.env.production` and run `npm run deploy`. The named profile is defined and validated in `compose.prod.yaml` but has not been run against a real Cloudflare account.

### What is verified, and what is not

Verified locally: the production compose file under the hardened settings, deploy, upgrade and rollback with locally built images, no demo endpoints, `Secure` cookies and HSTS. **Not verified until it runs:** the GitHub Actions publish job, pulling from GHCR, either tunnel with this compose file, and the first real deploy.

---

# Demo hosting (no login, throwaway data)

Everything below describes the older public **demo** stack. Do not use it for real customer data.

Goal: put PrintFlow Lite on the public internet with no paid service, no VPS and no purchased domain, using only things we run ourselves.

## What is set up

The Docker stack runs on your own machine. A free **Cloudflare quick tunnel** (the `cloudflared` container) opens an outbound connection to Cloudflare and gives the app a public `https://….trycloudflare.com` address.

```
visitor ──HTTPS──► Cloudflare edge ◄──outbound tunnel── cloudflared ──► app (Express) ──► PostgreSQL
                                                          (all containers on your machine)
```

- No account, no domain, no router port forwarding and no inbound firewall rules.
- HTTPS is provided by Cloudflare.
- Everything (app, database, tunnel) is defined in `compose.yaml` + `compose.public.yaml`.

```bash
npm run public:up      # build, start, print the public URL
npm run public:url     # print the current URL again
npm run public:down    # stop publishing (the local stack on :3000 can keep running)
```

## Safeguards for a public, no-login demo

The app has no authentication, so the public overlay adds guard rails:

| Guard                                               | Setting                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Visitor data wiped and samples reloaded             | `DEMO_RESET_MINUTES=60`                                                                 |
| Write requests limited per visitor IP               | `RATE_LIMIT_MAX=30` per minute, `TRUST_PROXY=1` so each visitor has their own allowance |
| Body size limit, security headers, JSON-only errors | always on                                                                               |
| Search engines told not to index                    | automatic while `SITE_URL` is unset                                                     |

Never enter real personal data in a public demo.

## Limits to know about

- **Your machine must be on** and Docker running; otherwise the site is down.
- **The URL changes** whenever the tunnel container is recreated.
- Quick tunnels are for testing and demos: Cloudflare gives no uptime guarantee for them.
- `trycloudflare.com` addresses are not indexed by search engines (Cloudflare sends `X-Robots-Tag: none` itself), so real SEO needs a stable address (below).

## Getting a stable address for free

A stable address needs a hostname that Cloudflare can manage, and a hostname normally means a domain. Free routes, in order of effort:

1. **Free subdomain + named tunnel (recommended).** Register a free subdomain at a free-domain registry such as [eu.org](https://nic.eu.org) (manual approval, can take days to weeks), then:
   1. Create a free Cloudflare account and add the domain; point the registry's name servers at the ones Cloudflare gives you.
   2. In the Cloudflare dashboard (Zero Trust → Networks → Tunnels) create a tunnel and copy its token.
   3. Add a public hostname on the tunnel pointing at `http://app:3000`.
   4. Put `TUNNEL_TOKEN=…` in `.env` and change the `tunnel` service command to `tunnel --no-autoupdate run --token ${TUNNEL_TOKEN}` (this path has not been tested in this repo).
   5. Set `SITE_URL=https://your-name.eu.org` in `.env` so the site becomes indexable.
2. **Keep the quick tunnel** and accept a changing URL; fine for interviews and demos you start yourself.
3. **Always-on:** run the same Compose files on a spare laptop or Raspberry Pi instead of your daily machine. No code changes are needed.

## SEO

Done in the code:

- Landing page at `/` with one `h1`, descriptive copy and links into the app.
- Unique `<title>` per page and a meta description.
- Open Graph and Twitter card tags with a share image (`/og.png`), a canonical URL, favicon and JSON-LD `SoftwareApplication` data.
- `robots.txt` and `sitemap.xml` generated from `SITE_URL`; with no `SITE_URL`, robots blocks everything, a `noindex` header is sent and no sitemap exists. App pages (`/orders`, `/quotes`, `/api`) are never listed.
- Semantic HTML, labelled controls and WCAG A/AA checks (axe) in CI, `lang` set, fast static assets, mobile-friendly layout.

Needs a stable public address (not possible on a changing tunnel URL):

1. Set `SITE_URL` and restart.
2. Check `https://<site>/robots.txt`, `/sitemap.xml` and the page source for the canonical tag.
3. Add the site to Google Search Console and Bing Webmaster Tools (both free) and submit `sitemap.xml`.

Honest expectation: this is a single-page demo app with one indexable page, so it will rank only for its own name. The value is demonstrating correct technical SEO, not traffic.

## Updating the live demo

```bash
git pull
npm run public:up      # rebuilds the image and restarts; the tunnel URL may change
```

Rollback: check out the previous commit and run the same command.
