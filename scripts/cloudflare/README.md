# Route-scoped Cloudflare static artifact

Run from the repository root:

```bash
node scripts/cloudflare/export-web-marketing.mjs
```

The script enables the opt-in static-export mode only for the `apps/web` build,
uses Next.js's route-scoped build selector, validates that each selected route
was prerendered, then stages the existing public site at
`dist/cloudflare/web-marketing/`. It carries the authored Nantty branding,
screens, static Next.js payloads, a route-allowlisted `robots.txt`/`sitemap.xml`,
and a Cloudflare Workers Static Assets `_headers` file. It does not deploy,
authenticate to Cloudflare, change DNS, or handle any credential.

Included are `/`, `/about`, `/sellers`, `/contact`, and the existing public legal,
policy and guidelines pages required by the site's shared header/footer. Dynamic
legal archive versions are not included. Product portals and backend routes are
never copied.

## Route audit / current limitations

- `apps/web`: the allowlisted public routes are statically prerenderable and
  contain Nantty-branded public content. The artifact is checked for local link
  targets, missing assets, Next's request-time image optimizer, login/BFF URLs,
  and secret-like values.
- `apps/ads`: `/` is a marketing landing page but reads request cookies to
  personalize signed-in CTAs. Its build is request-rendered and includes login,
  account and `/bff/*` routes. It is intentionally excluded.
- `apps/seller`: `/` is a marketing landing page but loads subscription plans
  server-side; the app also has session-protected workspace and `/bff/*` routes.
  It is intentionally excluded.
- `apps/studio`: `/` is a marketing landing page, but its session-aware proxy
  makes the route request-rendered, and the app includes login, studio and
  `/bff/*` routes. It is intentionally excluded.
- `apps/admin` remains private and is never part of this export.

To export the three product marketing roots safely, each app needs a deliberate
prelaunch/static rendering mode that disables login CTAs while preserving the
existing page components and keeping all authenticated routes and BFF handlers
out of the emitted bundle. This script does not bypass their proxies or bake
request-time account data into static files.

The repo's current `cf` CLI beta does not accept an `assets.directory` field in
`cloudflare.config.ts`; deployment wiring should be checked against the CLI
version and the chosen Workers Static Assets path when deployment is authorized.
No Wrangler config is created here.
