# Hosting and deployment (free, self-hosted)

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
