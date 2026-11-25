# Nantty Messenger and Business Messaging

Status: architecture and implementation inventory, refreshed 2026-11-14. This document distinguishes implemented local application slices from services, platform behavior, and deployments that remain unavailable. It is not a claim of production launch readiness.

## Product boundaries

- Messenger is a lightweight, ad-free client for existing Nantty accounts, conversations, and Stories. It must not duplicate social identity, create an independent message history, or include feed, Mart, livestream, or advertising surfaces.
- The Developer web app (`apps/developer`) is the business integration console: application registration, scoped credential lifecycle, API documentation, webhook configuration/delivery inspection, usage and audit views.
- The Sandbox web app (`apps/sandbox`) is a separate, isolated environment for test credentials, synthetic business/customer/conversation data, deterministic API and webhook scenarios, and request inspection. Sandbox credentials and data must never authorize or address production resources.
- Developer and Sandbox are separate workspace applications, not routes embedded in Seller, Studio, or the consumer webapp. They share design tokens and web primitives where appropriate, but retain separate deployment configuration, auth boundaries, and data-access policy.

## Verified existing foundation

The main React Native app and web clients already use the Social service's shared conversations and encrypted-message model. Social owns conversations, encrypted messages, messaging keys, and message persistence; it is not appropriate to add another message database under Messenger.

Existing foundations include:

- Authenticated conversation list/search/create and message list/send APIs under `/api/v1/conversations`.
- Message membership, block, channel-posting permission, encryption, registered-device-key, and media-ownership checks in the Social service.
- Ciphertext-only message persistence; plaintext message bodies are rejected. `packages/chatCrypto` provides the existing client cryptography implementation. A formal independent protocol/security audit is not evidenced by this inventory.
- Transactional message persistence plus outbox event publication, and Phoenix raw JSON WebSocket fan-out at `/ws` after authentication and topic-membership authorization.
- Cursor/`after` message synchronization and client-side offline queueing with stable client message IDs/idempotency behavior.
- Shared Stories and Story-reply API surfaces in the main product.
- Group invitations and opaque share links exist, but accepting an invitation does not activate membership. The documented E2EE key handoff/group epoch transition is still a blocker; do not bypass it by granting membership or historical ciphertext access.

Source references: `services/typescript/social/src/modules/messages/routes/messages.routes.ts`, `services/typescript/social/src/modules/conversations/routes/conversations.routes.ts`, `services/typescript/social/src/modules/messages/handlers/sendMessage.handler.ts`, `services/elixir/realtime/lib/realtime/events/conversationEvent.router.ex`, `packages/chatCrypto`, and `services/typescript/social/docs/group-invitations-e2ee-boundary.md`.

The separate `apps/messenger` Expo app now has Nantty authentication and trusted-device authorization, an authenticated inbox, encrypted text/image conversation flows, realtime updates, cursor history, an encrypted offline outbox, reactions, typing/read state, notification actions and settings, shared Stories viewing, photo publishing, encrypted Story replies and cross-platform in-app floating conversations. Story replies reuse the existing chat crypto client and sealed outbox; Social derives the recipient conversation from the Story and passes the stable client ID through to message persistence. Video playback reuses the main app's Expo Video stack, pauses in the background, defaults to muted and does not enable PiP. These Story workflows remain source/contract verified, not device verified. Android system-bubble and notification-action integrations are present in source; iOS interactive notification actions are present in source. Native Android/iOS build and lifecycle validation remain open. Current per-requirement evidence and blockers are recorded in `apps/messenger/docs/CHAT_BUBBLES_IMPLEMENTATION_STATUS.md` and `apps/messenger/README.md`.

Implementation correction (2026-11-25): the Developer platform now has application/credential/webhook surfaces, account-level recipient consent and a separate Commerce-verified store authorization/grant API. Production conversation/history/status handlers persist and read Developer API records under credential, app, quota, recipient-consent and exact store-grant/capability checks. Store-scoped authorization was merged in PR #72 (`d85670af122403a7d9980beef35b8854fff7a655`) but has not been deployed. The public send route intentionally remains 503; no Social-owned business-mode dispatch receiver, customer-initiated eligibility/window, inbound synchronization or delivery/read receipts exist. Do not interpret the dormant Auth send handler or the existing first-party Store inbox as a completed public messaging integration.

The standalone `apps/developer` and `apps/sandbox` apps have responsive portals; Developer organization management and portions of the application/credential/webhook services are connected in source, while complete production billing and deployment remain unavailable. Sandbox has isolated synthetic messaging capabilities with deployment/browser gates still open. The existing internal first-party Store inbox is not a public partner API. Seller-side developer/integration surfaces are not evidence that the public Business Messaging lifecycle is complete.

## Public business API trust boundary

The public business API is a new, separately authorized product surface. It must not reuse a user's mobile access token as a business credential and must not expose internal service routes.

Before publishing endpoints, define and implement:

1. Business application ownership, review/approval state, environment separation, credential rotation/revocation, and secret-at-rest handling.
2. Explicit, least-privilege scopes and resource ownership checks on every operation; deny by default. Keep application authorization separate from the user/customer's consent and conversation membership.
3. Production and Sandbox isolation, per-app rate/usage limits, audit records, request correlation, idempotency, stable error envelopes, and OpenAPI contract tests.
4. A customer-initiated/consented conversation model and the 24-hour service window. Marketing messages remain disabled unless separately approved and consented.
5. Signed, at-least-once webhooks with timestamp/replay protection, bounded exponential retries, observable terminal/dead-letter state, operator replay, and SSRF/DNS-rebinding protections for callback URLs.
6. A human/automation handover state that is visible to the customer and business team. Business integrations cannot read or bypass personal E2EE conversations.

The public API must not claim E2EE for business-managed conversations where server-side business integrations can read content. Keep personal E2EE and business API conversations as explicit, distinguishable trust modes. Do not add plaintext fallback to personal chats.

## Candidate API surface (not implemented)

The user-provided specification proposes versioned resources for business conversations/messages, customer access, media, templates, webhook management, and analytics. The Developer portal presents that route list only as a draft contract; it does not claim OpenAPI publication or submit requests. Exact authorization mapping, payload schemas, retention, quotas, errors, and pricing remain contract work. Do not ship fake-success handlers. Public endpoints must be routed through the gateway and a dedicated public business API module, not mounted directly on Social's internal/mobile routes.

## Delivery sequence and acceptance gates

1. **Contract and threat model:** approve data ownership, app credentials, scopes, consent, E2EE boundary, rate limits, retention, error/idempotency rules, and Sandbox isolation. Add OpenAPI schemas and negative authorization tests before route implementation.
2. **Shared identity/conversation vertical slice:** prove existing user identity → authorized conversation load → encrypted send → durable persistence → realtime delivery → reconnect/`after` resync on existing web and React Native clients. Add integration coverage and record limitations. No standalone duplicate store.
3. **Business API foundation:** schema/migrations, app credentials, scope enforcement, consent/window policy, idempotency, audit, rate limiting, and public API contract tests. Fail closed if tenant, scope, consent, or environment is missing.
4. **Developer web app:** responsive shell and draft Business Messaging documentation are implemented in `apps/developer`. Connect operations only after the business API exists; show only service-returned data. Credential secrets must be shown once, never re-readable, and all changes auditable.
5. **Sandbox web app and service mode:** the separate labeled shell and messaging-scenario release gates are implemented in `apps/sandbox`. The isolated service mode remains unimplemented: it needs isolated test credentials and synthetic data, deterministic message/webhook scenarios, request/event inspection, and proof that production credentials and identifiers are rejected.
6. **Webhook delivery and operations:** implement signing, retry scheduling, delivery history, dead-letter handling, alerting, and safe replay; test SSRF/DNS rebinding and duplicate/reordered deliveries.
7. **Messenger client:** the authenticated shared-message client and major bubble/notification flows exist in source. Close the remaining native build/device tests, Story feature gaps, accessibility checks, performance measurements, and end-to-end synchronization/revocation tests. Do not count TypeScript success as native or release verification.

No phase is complete based only on UI scaffolding. Each requires service-level tests and the relevant cross-client/integration/security checks; external provider, deployment, and production behavior must be reported separately from local verification.

## Current verification

On 2026-11-13, `pnpm --filter @nantty/social test -- src/modules/messages` completed with 109 test files passing (4 skipped) and 659 tests passing (6 skipped). The script runs the complete Social test suite; the trailing path was passed through to Vitest and did not narrow the run. This is local unit/contract evidence only: it does not validate a live database, realtime deployment, public API, developer/sandbox apps, or production E2EE deployment. On 2026-11-14, Messenger typecheck and 28 tests passed after conversation history retry/scroll changes; Android/iOS device acceptance remains blocked as detailed in the Messenger implementation status.

The command emitted an engine warning: the workspace requires Node `>=26.13.0 <27`, while the local runtime is Node `v24.19.0`. Address the runtime mismatch before treating the test result as release CI evidence.

The Developer and Sandbox apps were previously verified on Node `v26.13.0` for TypeScript, ESLint, scoped CSS lint, and production builds. On 2026-11-14 the Developer app was typechecked, linted, and production-built with HTTPS host configuration; local runtime here used Node `v24.19.0` despite the workspace requirement `>=26.13.0 <27`. Gateway organization and Sandbox readiness tests passed (14 tests); the Go organization role-policy package passed. These results verify local code and contracts only, not production SSO, database migrations, business API calls, credentials, isolated Sandbox behavior, or webhook delivery.
