# Widgets — API contract

Home-screen widgets (iOS WidgetKit, Android AppWidget) and the embeddable web widget. Shapes are the TypeScript interfaces in `packages/contracts/src/widgets.contract.ts`.

## Where each endpoint lives

There is no aggregator. The gateway is a router, and each widget reads data owned by one service, so each endpoint lives in that service and the gateway routes `/api/v1/widgets/*` to it (`services/typescript/gateway/src/routes/widget.routes.ts`).

| Endpoint | Service (module) | Reads |
|---|---|---|
| `GET /api/v1/widgets/orders` | go-commerce (`orders/src/modules/widgets`) | buyer's order groups |
| `GET /api/v1/widgets/seller-today` | go-commerce (`orders/src/modules/widgets`) | store orders + wallet balance relay from go-money |
| `GET /api/v1/widgets/live-now` | go-live (`live/src/modules/widgets`) | live sessions + social follow/block grants |
| `GET /api/v1/widgets/creator-today` | go-money (`creators/src/modules/creatorMoney`) | creator earnings + social follows/post_daily_stats grants |
| `GET /api/v1/widgets/stories` | social (`src/modules/widgets`) | stories, follows, blocks, private accounts |

## Widget token

- `POST /api/v1/auth/widget-token` — session access token only (a widget token is refused). Rate limit 10/min per account.
  - Response 200: `{ widgetToken, expiresIn: 86400, scope: "widgets:read" }`. `Cache-Control: no-store`.
  - Errors: 401 (no session, revoked session, inactive account), 403 ACCOUNT_SUSPENDED, 503 WIDGET_TOKENS_UNAVAILABLE (no Valkey in production).
- `DELETE /api/v1/auth/widget-token` — revokes this session's widget token. 204.

The token is an EdDSA JWT from the auth signing keys with `aud: "zudomart-widgets"`, `scope: "widgets:read"`, `sid` (the device's session), `jti` and `age`. TTL `AUTH_WIDGET_TOKEN_TTL` (default 24h, max 7 days). The app rotates it when less than 6 hours remain, on foreground and in the background refresh task.

Rules:
- One live widget token per session (device). Valkey key `auth:widget-token:<sid>` holds the current `jti`; issuing a new token replaces it, so the previous token stops working.
- Signing out, `DELETE /auth/sessions/{id}`, revoke-all, a password change and a ban all revoke the session. The session denylist entry (`auth:revoked-session:<sid>`) is kept for the widget-token lifetime, and the widget key is deleted.
- Signing keys stay published for the widget-token lifetime after rotation, so widgets don't break on key rotation.
- The gateway (`WidgetTokenVerifier`) and the Go services (`jwtauth.VerifyWidgetTokenAndExtractPrincipal`) both check the signature, audience, scope, denylist and the current `jti`. On a Valkey error they fail closed.
- A widget token on any route that isn't `GET /api/v1/widgets/*` gets `401 WIDGET_TOKEN_SCOPE` at the gateway without reaching a service. The Go services reject it too, because their normal verifier only accepts `aud: zudomart-api`.

## Read endpoints

All of them:
- are `GET` only and accept either a session access token or a widget token;
- are rate limited at the gateway to 30/min per account (`widgetRead`);
- are cached per viewer in memory for 45s and return `Cache-Control: private, max-age=60` and `Vary: Authorization`;
- contain no email, phone, address or payment details. Avatars and images are the stored URLs.

### GET /api/v1/widgets/orders
Response 200 `OrderWidgetResponseContract`. Lists up to 3 of the buyer's orders in `new | processing | ready | shipped | delivered`, most recently updated first, plus `activeCount`. The status is `out_for_delivery` when the order has shipped and a rider is assigned. `deepLink: zudomart://orders/<id>`.

### GET /api/v1/widgets/seller-today[?amounts=hidden]
Response 200 `SellerTodayWidgetResponseContract` for the caller's default store, which needs the `dashboard:view` permission. It returns sales and orders since local midnight in the store's timezone, `ordersToShip` (paid `new | processing | ready`) and `availableBalance` (only with `wallet:view`).
- With `amounts=hidden`, `salesToday` and `availableBalance` are `null` and are never computed.
- Errors: 403 NOT_STORE_MEMBER (the widget shows "Open a store…").

### GET /api/v1/widgets/live-now
Response 200 `LiveNowWidgetResponseContract`. Up to 8 lives that are live now, hosted by accounts the viewer follows, ordered by viewer count.
- Blocked hosts (in either direction) and lives hidden by moderation are excluded.
- Subscriber-only lives are excluded unless the viewer is an active subscriber.
- `deepLink: zudomart://live/<id>`.

### GET /api/v1/widgets/creator-today[?amounts=hidden&currency=NGN]
Response 200 `CreatorTodayWidgetResponseContract`.
- For a Creator Program member: today's (UTC) impressions across their posts, new accepted followers since UTC midnight, and today's earnings total. `earningsToday` is `null` with `amounts=hidden`.
- For a non-member: `creatorProgramMember: false` with `deepLink: zudomart://creator`. No numbers are returned.

### GET /api/v1/widgets/stories
Response 200 `StoriesWidgetResponseContract`. Up to 8 accounts the viewer follows that have active stories, ordered unseen first and then by newest story.
- Excluded: expired stories (`expiresAt <= now`), stories hidden by moderation, subscriber-only stories, blocked accounts in either direction, and private accounts the viewer doesn't follow.
- The thumbnail is dropped for stories with sensitive labels.
- `deepLink: zudomart://stories/<userId>`.
- There is no close-friends audience in the data model yet. When one is added, it must be filtered here too.

## Silent refresh push

Notifications (`modules/widgetRefresh`) listens to domain events:

| Event | Who is refreshed | Widget |
|---|---|---|
| `order.paid`, `order.sellerAccepted`, `order.sellerRejected`, `order.shipped`, `order.delivered`, `order.completed`, `order.cancelled` | the buyer | orders |
| `order.paid`, `order.completed`, `order.cancelled` | the sellers | sellerToday |
| `live.started` | the `notifyUserIds` list | liveNow |
| `post.created` with `kind: story` | followers who turned on the post bell, through paged `widgets.refreshFanout` jobs | stories |

It sends an Expo data-only push `{ type: "widgetRefresh", widgets: [kind] }` with `_contentAvailable: true` and `priority: "normal"`.

Budget: at most one push per user per widget in each window (orders 5 min, sellerToday 10 min, liveNow 15 min, creatorToday and stories 30 min), deduplicated through the deliveries table. A live alert reaches at most 1000 recipients directly.

The app needs `expo-notifications` to receive these pushes. It is blocked by the supply-chain policy (see the widgets report), so for now widgets refresh on their timeline (20–30 min) and through `expo-background-task`.

## Web embed (apps/webapp)

| Route | Purpose |
|---|---|
| `GET /embed/loader.js` | Loader script. `Access-Control-Allow-Origin: *`, cached 1h |
| `GET /embed/store/{storeIdOrSlug}?theme=&size=` | Store card |
| `GET /embed/products/{storeIdOrSlug}?theme=&layout=grid\|carousel&limit=1-12&products=id,id&size=` | Products |
| `GET /embed/product/{productId}?theme=&view=button\|card` | Buy on Nantty button or product card |
| `GET /oembed?url=<zudomart store or product url>&format=json&maxwidth=` | oEmbed `rich` JSON with a sandboxed iframe (`OembedResponseContract`) |

Who can be embedded:
- any **active** store that moderation has not hidden, with products that are active, published online, public and not hidden by moderation;
- automatic product lists show in-stock products only, and products a seller picks show "Sold out" with no buy link;
- suspended, closed or moderated stores return 404 and show "This store isn't available on Nantty right now."

Verification is not required: unverified sellers already sell through escrow inside Nantty, and every purchase still happens there.

Security:
- **Embed pages** are server-built HTML route handlers, outside the session proxy, with no cookies read or set.
  - CSP: `default-src 'none'; script-src 'sha256-<resize script>'; style-src 'unsafe-inline'; img-src https: data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors *`.
  - Seller text is HTML-escaped and only `https:` images load.
- **Other pages**: every other webapp path keeps `X-Frame-Options: DENY` and `frame-ancestors 'none'` (`next.config.ts` uses the source `/:path((?!embed(?:/|$)|oembed(?:/|$)).*)`). Unknown `/embed/*` paths return an unframeable 404.
- **Loader iframe**:
  - It is sandboxed with `allow-scripts allow-popups allow-popups-to-escape-sandbox`, without `allow-same-origin`. Its origin is opaque, so it can't read the host page or Nantty cookies, and the host page can't read it.
  - Resize uses `postMessage`. The loader accepts a message only if it comes from that iframe's window, from origin `null` or the embed origin, and carries the random per-iframe `frame` id. Height is clamped to 64–2400px.
- **Caching and limits**:
  - Rendered embeds are cached for 5 min in memory, and unavailable ones for 1 min.
  - `Cache-Control: public, max-age=300, s-maxage=600` lets the CDN absorb traffic.
  - Each client IP gets 120 embed requests per minute, then 429.

## Deep links (mobile)

`zudomart://orders/<orderId>`, `zudomart://seller/dashboard`, `zudomart://creator/dashboard`, `zudomart://creator`, `zudomart://live/<liveId>`, `zudomart://stories/<userId>`, `zudomart://settings/widgets`.
