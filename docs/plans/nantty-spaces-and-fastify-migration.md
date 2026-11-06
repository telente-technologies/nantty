# Nantty Spaces, LIVE beta, and TypeScript Fastify migration

Status: **implementation plan / not yet launch-ready** (2026-10-26)

## Product decisions

- **Nantty Spaces** is a separate, audio-only live conversation product. It is not a video stream with the camera hidden in the UI: the media grant must reject camera/screen-share tracks as well as the client hiding video controls.
- Only eligible creators can host, start or schedule a Space. A scheduled Space has a public detail page, shareable link, reminder/follow controls, and a publishable feed announcement. Anyone may listen, subject to standard account safety restrictions; listeners can request the microphone and speak only after host/moderator approval. Hosts and moderators can mute, remove, or move speakers back to the audience. Resolve creator eligibility from the canonical server-side account/profile state, never a client-supplied role flag.
- Space states are `scheduled → live → ended`, with `cancelled` for a host-cancelled schedule. Listing responses distinguish `live` and `upcoming`; an ended Space is not joinable. Scheduling/editing/cancellation is host-only. Use a stable Space ID and UTC timestamps; render local time in `Africa/Lagos` where appropriate.
- Use Nantty's blue brand token for Space identity and actions. Keep the existing red live indicator for video LIVE; blue “Space” is not a LIVE-state indicator.
- **Video livestream remains beta** until the reliability, safety and device QA gates below pass. It must not be represented as a launch-ready general feature. Keep existing data and APIs compatible while adding an explicit rollout gate.
- **Spaces gifts are permitted by owner direction, purchased with coins and sent to the Space host only.** Render a static gift confirmation/state; do not animate gifts. Do not add gift leaderboards, gift battles, video/live gifts or cash tips to Spaces. Use the canonical coin wallet/ledger, server-side pricing, idempotency, age-safety and fraud controls; never accept client-provided values or directly mutate balances. Gate the UI and endpoint independently so disabled configuration fails closed. Other video-LIVE gifts remain governed by their beta/launch gate and must not be inferred to be enabled by this Spaces decision.
- **Gifting is an in-product capability, never a standalone product.** Do not provision `gift.nantty.com`, a gift portal, or a separate gifting login. Surface approved coin-gift actions only inside the mobile app and the real webapp, where the canonical wallet, safety gates, identity and receipts are available.

## Current architecture and ownership

- The repository's backend plan places live sessions, LiveKit credentials, stage membership and live safety in **Go `go-live`**. The existing Go live service already has scheduled sessions, LiveKit token issuance, audience presence, comments, safety controls and a retention worker. Extend that single authority for Spaces rather than creating a second source of truth.
- TypeScript deployables are `gateway`, `social`, `notifications`, `media`, `search` and `support`. All six now use Fastify through `@nantty/fastify-platform`; the previous HTTP, schema and logging packages have been removed. Social uses Prisma; other services retain their storage/integration ownership. Browser/mobile BFFs remain Next.js/Expo.
- Consequently, the Fastify migration is a separate platform migration for the TypeScript HTTP deployables. Space lifecycle and LiveKit authorization remain in `go-live`; TypeScript consumes its existing public/internal contracts and events. Do not dual-write live state from social or gateway.

## Implementation status (2026-10-26)

- **Verified:** creator-gated hosting, public listener participation, speaker request/moderation persistence, rate-limited/idempotent Space mutations, audio-only LiveKit grants, access-filtered list/detail presenters, and a mobile LiveKit connection hook. Focused mobile typecheck/tests and Go controller/route tests pass.
- **Verified wallet slice, not enabled:** creators money service has a server-priced, Space-host-derived coin-gift RPC with balanced ledger posting, idempotent replay and `gifts_enabled` enforcement. The Go live gateway/HTTP caller, account-age/fraud policy gates and static gift confirmation UI are not yet integrated. Keep gifts disabled until all those layers pass together.
- **Still open:** publish/link a Space announcement post and expose its post ID so all discussion remains in that post's comment thread; reminders; real device audio QA; web experience; complete integration/security gates; and the six-service Fastify migration. Do not add a Space comment/chat surface, gift animation or leaderboard while closing these gaps.

### Verified update (2026-10-29)

- The Go live service exposes `POST /api/v1/spaces/{spaceId}/gifts` and delegates coin charging to the money service, but the create handler now explicitly stores `gifts_enabled=false`. The endpoint rejects gifts unless that stored flag is enabled. Both the mobile app and webapp hide the gift picker/action while the safety and rollout gates remain incomplete; do not infer gift availability from the presence of a route or wallet RPC.
- Public Spaces created from the mobile or webapp publish and attach a feed announcement; private invite-only Spaces are shared by invitation and do not publish a public announcement. Comments for a published Space remain on its announcement post. The private-Space exception is intentional to avoid exposing invite-only rooms in a public feed.
- Verification: Go sessions-controller package tests pass, including a regression assertion that new Spaces persist gifts disabled. Mobile focused Spaces/audio tests pass (6 tests); webapp TypeScript check passes. Device audio QA and live DB/integration verification remain open.

## Nantty Spaces implementation

### API contract (all under `/api/v1`)

| Method + path | Purpose and access |
| --- | --- |
| `GET /spaces?state=live,upcoming&cursor=&limit=` | Public/guest-safe discovery; bounded cursor pagination, stable ordering (live first, then scheduled time), privacy filtering. |
| `GET /api/v1/spaces/invitations?cursor=&limit=` | Authenticated recipient-only pending invitations; returns `{data,nextCursor}`. Each item contains UUID `spaceId`/`invitationId`, stored `role` (`listener`, `speaker`, or `moderator`; cohost invitations are persisted as `moderator`), optional stage `title` (≤60 characters), `invitedAt`, `inviterId`, and a safe `space` summary (`id`, `title`, optional `description`, `state`, optional `scheduledAt`/`startedAt`, `listenerCount`, `visibility`, `host`). `inviterId` is the Space host because current invite creation is host-only. Default page size is 30; maximum is 100. The opaque keyset cursor is bound to the authenticated account and contains validated canonical UUIDs. Results sort by `invitedAt` descending, then Space ID and invitation ID descending. Only the caller's pending invitations for moderation-visible Spaces are returned; malformed stored invitation IDs/timestamps are skipped. |
| `POST /spaces` | Authenticated eligible host creates a Space, immediately or with `scheduledAt`; validate title, audience policy and UTC schedule. Return `201`. |
| `GET /spaces/{spaceId}` | Read public detail and host, schedule, state, listener count, speaker roster and viewer-specific RSVP/request state. |
| `PATCH /spaces/{spaceId}` | Host updates permitted fields or scheduled time; reject edits after start except safe metadata. |
| `POST /spaces/{spaceId}/start` / `end` / `cancel` | Host-only, idempotent state transitions; no start from cancelled/ended. |
| `POST /spaces/{spaceId}/join` / `leave` | Authenticated listener presence; idempotent and rate-limited. Join returns listener-scoped audio grant only. |
| `POST /spaces/{spaceId}/speaker-requests` | Listener asks to speak. One active request per user/Space. |
| `POST /spaces/{spaceId}/speaker-requests/{requestId}/approve` / `decline` | Host/moderator decision; approval changes role and issues microphone-only grant. |
| `POST /spaces/{spaceId}/speakers/{userId}/mute` / `remove` / `demote` | Host/moderator controls, audited and broadcast to the room. |
| `PUT /spaces/{spaceId}/reminder` / `DELETE /spaces/{spaceId}/reminder` | RSVP/reminder subscription, idempotent. |
| `POST /spaces/{spaceId}/announcement` | Publish a feed announcement referencing the Space; unique per host + Space; no duplicate post on retry. |
| `POST /spaces/{spaceId}/coin-gifts` | Optional, rollout-gated coin gift to the host only; authenticated sender, server-priced catalog item, idempotent ledger transfer and auditable receipt. UI confirms without animation. |

Every mutation requires authenticated identity, boundary validation, rate limits, authorization checks and audit/event records where it changes room roles or safety. `Idempotency-Key` is required for create/start/end/cancel and announcement creation. Use structured API errors consistent with the existing contract (`code`, `message`, optional safe `details`). Never expose LiveKit API secrets or room names to clients.

Creator eligibility is checked server-side on create/start/schedule and rechecked before host-only controls. Listener access is open by default to accounts permitted by platform safety rules. For coin gifts, resolve the recipient from the Space's immutable host ID; reject requests naming a different recipient. Use the existing coin-gift accounting policy and ledger transaction; retries must return the original result and must never double-debit or double-credit. Coin gifts must remain unavailable when the gift feature flag, account-age policy or wallet safety gate is closed. Do not create a Space gift leaderboard or animated rendering path.

### Data and media model

- Add a distinct `Space` record in the live-owned schema (or a separately typed live-session discriminator only if the migration proves it preserves all current invariants). Fields: immutable ID/host, title/description, state, scheduled/start/end timestamps, audience policy, LiveKit room reference, listener count/peak, moderation visibility, announcement post reference, created/updated timestamps. Add unique room ID and indexes for state + scheduled time and host + state.
- Store `SpaceParticipant` presence with a unique `(spaceId, accountId)` key and server-owned role/state; store speaker requests with unique active-request protection and explicit pending/approved/declined/cancelled state. Keep high-churn viewer count as a reconciled presence/read model, not an unbounded participant history table.
- LiveKit grants: listeners may subscribe and send data only; speakers/hosts may publish **microphone only**; no camera, screen share, recording, or video source grants. Enforce role checks server-side and reissue grants after speaker approval/demotion. Rooms are closed on end/cancel and stale presence expires.
- Create an outbox event in the same transaction for `space.scheduled`, `space.updated`, `space.cancelled`, `space.started`, `space.ended`, `space.reminderDue`, `space.speakerRequested`, `space.speakerApproved` and `space.participantChanged`. Notifications consume these events; reminder delivery is deduplicated and respects notification preferences. Feed announcement creation must be retriable without duplicate posts.
- Audio Spaces are not recorded by default. If recording/replay is proposed later, it needs explicit host/participant notice and consent, retention/legal-hold rules and a separate launch decision.

### App experience

- Add a Spaces discovery screen with clear `Live now` and `Upcoming` sections, scheduled time in the viewer's locale, host identity, listener count and one clear Join/Set reminder action. Include real loading, empty, retry/offline and sign-in-required states; no seed content outside mock/test mode.
- Detail/room screen is audio-first: host and speaker portraits, restrained blue sound-wave activity, listener roster/count, mute/unmute, request-to-speak, accessible live captions only if supported, share, report, leave/end controls. Only creators see host/scheduling controls; everyone eligible to access a Space can listen. A separately gated coin-gift action may target the host only and uses a static, non-animated confirmation. Discussion is shown in comments under the feed post that announces/hosts the Space; do not build a separate Space chat or leaderboard. No video surfaces, camera permission requests, animated gift tray or sales product assumptions.
- Host flow supports title, short description, audience, start-now vs schedule, timezone-aware picker, edit/cancel, and optional feed announcement. Add notification/reminder opt-in instead of silently enrolling followers.
- Webapp gets the same discovery/detail/schedule capabilities after the API contract and mobile beta flow pass. Use a responsive list/room composition rather than copying X's visual layout.

### Video LIVE beta exit gates

1. Define and enforce rollout flags for video LIVE and gifts separately; disabled flags must hide entry points and fail mutations safely.
2. Pass automated contract/unit/integration tests for host eligibility, creator restrictions, private/restricted access, microphone/camera permission denial, reconnect, host backgrounding, stale room closure, stage role transitions, safety hold/report/block and duplicate start/end.
3. Run physical iOS/Android device QA for low bandwidth, network handoff, Bluetooth/audio route changes, interruptions, app background/foreground, camera/microphone denial, screen rotation, and OS-level audio focus. Verify TalkBack/VoiceOver and reduce-motion states.
4. Verify stream health/room closure and telemetry dashboards/alerts, safe rollback, moderation incident process and support guidance. Do not remove the beta label or enable general launch before product sign-off.
5. Keep video-LIVE gifts disabled unless separately approved. Spaces coin gifts require wallet/idempotency/age-safety/fraud/refund and host-only recipient enforcement before their rollout flag is enabled; gifts remain static (no animation) and there is no leaderboard.

## TypeScript services migration to Fastify

### Verified migration progress (2026-10-27)

- `@nantty/fastify-platform` now owns Fastify construction, request IDs, security plugins, metrics, readiness helpers and the small framework-neutral request/response/middleware contract used by domain handlers. Its validation contract is backed by Zod v4.
- All six HTTP deployables use `@nantty/fastify-platform`. Public routes, headers, request IDs and response envelopes are preserved. Notifications retains its queue consumers and outbox processing.
- Verification: Gateway typecheck plus 1,709 tests; Search typecheck plus 74 active tests (4 intentionally skipped); Notifications typecheck plus 314 active tests (4 intentionally skipped) pass. This is not a deployment approval: staging infrastructure, contract snapshots and canary evidence are still required.
- No TypeScript service imports the retired framework. Source/test typechecks and HTTP tests have passed; remaining Social fixture failures and final cross-service verification must be closed before release.

### Target and non-goals

- Replace the HTTP server/router/runtime of the six TypeScript deployables with supported Fastify APIs and plugins. Do not rewrite their domain handlers, Prisma repositories, queues, event consumers, BFFs or public API paths as part of the first pass.
- Keep framework-neutral route contracts during migration; Fastify must own route matching and network I/O. Remove transitional adapters after each service has direct route parity.
- Keep Go and Elixir services unchanged. Keep deployment names, ports, health/readiness paths, OpenTelemetry attributes, auth contracts, headers, request IDs and JSON error semantics stable.

### Phases and order

0. **Inventory / baseline** — enumerate routes, middleware order, request size limits, parsers, auth, rate limiting, CORS, proxy trust, error mapping, metrics, readiness, shutdown, streaming, raw webhook body requirements, and service-specific hooks. Capture OpenAPI/contract snapshots and per-service latency/error baselines. Record every route's authentication and validation rules.
1. **Shared Fastify platform package** — add a pinned compatible Fastify version and `@nantty/fastify-platform` package. Provide typed config, logger integration, request ID propagation, safe error envelope, Ajv/Zod-compatible boundary validation, OpenAPI generation, auth decorators, permission-deny-by-default helpers, rate-limit hooks, request body limits, readiness/liveness, tracing/metrics, graceful shutdown and test inject helpers. Pin plugin versions and register plugins in one documented order.
2. **Pilot `search` — complete in local verification.** Preserve all URLs/status/body/error behavior. The local Fastify migration is typechecked and tested; contract inventory/snapshot comparison and staging canary evidence remain before it can be called shipped.
3. **`support`, then `media`** — migrate CRUD and upload/stream paths with raw-body, streaming, timeout and body-size tests. Preserve signed media/security behavior and SSRF protections.
4. **`notifications` — complete in local verification.** HTTP ingress now runs in Fastify without changing queue consumers, retry/DLQ, provider callbacks or outbox behavior. Staging raw-body signature and duplicate-delivery validation remain required.
5. **`social`** — migrate route groups incrementally by module using Fastify plugins and encapsulated dependencies. Preserve identity middleware, optional/required principal semantics, age-context propagation, idempotency, Prisma transaction boundaries and response codes. Do not rewrite domain handlers in the same change.
6. **`gateway` — complete in local verification.** Preserve JWT/JWKS validation, service proxying, route-specific auth, rate limits, streaming, timeout behavior, trusted proxy configuration and request/correlation IDs. Staging canary and rollback validation remain before deployment.
7. **Removal / hardening** — verify retired packages are absent from source and lockfile; remove transitional adapters, align docs/runbooks, pin dependencies, and run full CI, API smoke, integration, security and load suites.

### Acceptance gates per service

- Every route and method has a contract snapshot and explicit authentication, validation and rate-limit policy; no route silently becomes public.
- Existing mobile/web/admin clients pass without URL or payload changes. Error envelope/status, idempotency replay, pagination, content types, CORS, cookies/headers, request IDs and cache headers remain stable.
- Tests cover malformed params/query/body, oversized payload, unauthenticated/forbidden access, known domain error, unknown 500 without stack leakage, abort/timeout, readiness dependency failure and graceful shutdown.
- Production canary shows no material regression in p95/p99 latency, 4xx/5xx rate, memory, CPU or event-loop lag. Preserve a one-deploy rollback path until each service is stable.
- Dependencies are pinned/approved; no Fastify plugin is registered without security review, explicit options, and tests. No `any`-typed request decorators or global mutable request state.

### Risks / sequencing constraints

- This is a multi-service migration, not a package replacement; changing all six servers at once is high-risk and makes regressions hard to localize.
- Existing observability auto-instrumentation notes ESM import ordering. Keep explicit request metrics during migration and verify spans/metrics end-to-end before removing any instrumentation.
- Route schemas now use Zod through the shared platform; avoid duplicated validation logic and derive JSON Schema from the canonical schema where needed.
- Prisma generation/build scripts are service-specific and stay untouched unless Fastify integration proves a need.
- Re-evaluate cost and performance after the pilot; Fastify is the chosen target, but adoption is gated by parity and production evidence, not a blind simultaneous cutover.

## Delivery checklist

- [ ] Confirm API and deployment inventory; publish route parity matrix.
- [ ] Implement Spaces backend schema, migrations, routes, microphone-only LiveKit grants, outbox events and integration tests in Go `go-live`.
- [ ] Build mobile Space discovery, schedule, detail, listener and speaker-request flows against the real contract.
- [ ] Add launch/rollout flags: video LIVE beta; Spaces audio-only; Spaces coin gifts independently gated (host-only recipient); animated/live gifts unavailable in Spaces.
- [ ] Add webapp Space discovery/detail after mobile+API contract stability.
- [ ] Complete video LIVE beta exit gates before enabling general launch.
- [x] Build the shared Fastify platform and complete locally verified Gateway/Search migrations.
- [x] Migrate all six TypeScript service package dependencies and imports to Fastify.
- [ ] Complete final integration, security and load verification and remove transitional route adapters.
- [ ] Do not commit or deploy without explicit request and validated release configuration.
