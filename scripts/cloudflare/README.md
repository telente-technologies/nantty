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

In this opt-in build only, visitor-locale API lookup and the web-app login
destination are disabled; ordinary `apps/web` builds retain their current
behavior. The waitlist endpoint and enable flag are forced off even if shell
environment variables configure the live integration, and those values are
overridden before Next compiles public environment variables into JavaScript.
Static locale display therefore stays neutral (`your local currency`) until the
live app can resolve a visitor's supported currency. Artifact checks scan
HTML and emitted JavaScript for API/BFF/login references, and the served-output
test verifies all allowlisted pages, denied auth/API routes, countdown targets,
and the disabled inline waitlist state.

Included are `/`, `/about`, `/sellers`, `/contact`, and the existing public legal,
policy and guidelines pages required by the site's shared header/footer. Dynamic
legal archive versions are not included. Product portals and backend routes are
never copied.

## Route audit / current limitations

- `apps/web`: the allowlisted public routes are statically prerenderable and
  contain Nantty-branded public content. The artifact is checked for local link
  targets, missing assets, Next's request-time image optimizer, login/BFF URLs,
  and secret-like values.
- `apps/ads`, `apps/seller` and `apps/studio`: their ordinary production builds
  remain request/session-aware and retain app login/BFF routes. The separate
  product exporter below builds only each original `/` marketing page in an
  explicit prelaunch mode, disables sign-in, and excludes those app routes.
  The exporter uses Nantty-branded HTML/CSS previews and deliberately omits
  screenshot directories that contain legacy branding.
- `apps/admin` remains private and is never part of this export.

The product roots were built and their export/HTTP tests passed (see below).
This does not make the full Ads, Seller, or Studio applications static, nor does
it bypass their proxies or bake request-time account data into the artifact.

The repo's current `cf` CLI beta does not accept an `assets.directory` field in
`cloudflare.config.ts`; deployment wiring should be checked against the CLI
version and the chosen Workers Static Assets path when deployment is authorized.
No Wrangler config is created here.

## Product landing pages (prelaunch only)

Run from the repository root:

```bash
node scripts/cloudflare/export-product-marketing.mjs
node --test scripts/cloudflare/export-product-marketing.test.mjs
```

The export builds the existing `/` pages from `apps/ads`, `apps/seller` and
`apps/studio` one at a time, using each app's original landing components and
assets. It sets `NANTTY_CLOUDFLARE_PRELAUNCH=1` only in these build processes.
That branch skips request/session data (and the Seller plan API call), turns
sign-in controls into disabled lock-marked buttons, and enables Next's static
export only for this build. Ordinary app builds retain the existing proxy,
session providers, server pricing and sign-in links.

The artifact at `dist/cloudflare/product-marketing/` contains only `/` for Ads,
Seller/Creator and Studio. The approved product hosts are `ads.nantty.com` and
`creator.nantty.com`. `studio.nantty.com` has not been approved and must not be
configured. The main public-site artifact maps to `nantty.com`;
`web.nantty.com` is reserved for the real web app and must not receive a static
marketing export unless the owner later explicitly requests a clearly labeled
demo. The product export deliberately omits every other app route, including
login, BFF, session, account/workspace, API and admin paths.
Each root is checked for static lock controls, excluded route links, the Next
image optimizer, secret-like strings and accidental screenshot-directory
uploads; the HTTP test confirms that login and BFF paths return 404.
`apps/seller/public/serviceWorker.js` is not copied.

This creates a local artifact only. It does not authenticate, create a Worker,
upload files, configure DNS or deploy anything. Inspect the generated manifest
and artifact before deployment; the main agent owns Cloudflare resource changes.
