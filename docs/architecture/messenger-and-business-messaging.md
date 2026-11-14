# Nantty Messenger and Business Messaging

Status: architecture and implementation inventory, verified 2026-11-13. This document distinguishes shipped shared messaging foundations from the not-yet-built standalone Messenger and public business API. It is not a claim of production launch readiness.

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

The separate `apps/messenger` Expo foundation now has a Nantty login/session shell, authenticated conversation list, adaptive phone/tablet navigation, and distinct loading/empty/error states. It reads the existing conversation API and does not fork message records. It is not yet the complete Messenger client: conversation detail/actions, device-key bootstrap in this app, realtime, offline sending, push registration, and shared Stories are release gates. Typecheck, five inbox contract tests, Expo config validation, and Android/iOS JavaScript bundle exports passed; these are not native APK/IPA device tests or proof of encryption/realtime functionality. See `apps/messenger/README.md`.

No public business messaging API, business application credentials/scopes, or public webhook subscription/delivery pipeline exists in the audited source. The standalone `apps/developer` and `apps/sandbox` apps now include a proposed Business Messaging documentation/Scenario surface, clearly disabled and labeled non-operational. The existing internal first-party Store inbox is not a public partner API. Seller-side developer/integration surfaces are not evidence that this public API exists.

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
7. **Messenger client:** an initial Expo auth/inbox shell exists, but not the full client. Continue only after shared API and session behavior are stable. Preserve current identity, shared history and Stories; measure binary size, cold start, memory, battery, offline sync, and accessibility against agreed budgets.

No phase is complete based only on UI scaffolding. Each requires service-level tests and the relevant cross-client/integration/security checks; external provider, deployment, and production behavior must be reported separately from local verification.

## Current verification

On 2026-11-13, `pnpm --filter @nantty/social test -- src/modules/messages` completed with 109 test files passing (4 skipped) and 659 tests passing (6 skipped). The script runs the complete Social test suite; the trailing path was passed through to Vitest and did not narrow the run. This is local unit/contract evidence only: it does not validate a live database, realtime deployment, public API, developer/sandbox apps, or production E2EE deployment.

The command emitted an engine warning: the workspace requires Node `>=26.13.0 <27`, while the local runtime is Node `v24.19.0`. Address the runtime mismatch before treating the test result as release CI evidence.

The Developer and Sandbox apps were separately verified on Node `v26.13.0`: TypeScript, ESLint, scoped CSS lint, and production builds passed for both. Builds used explicit local `NEXT_PUBLIC_SITE_URL` values (`http://localhost:3700` and `http://localhost:3800`). This verifies the frontend shells and route compilation only; it does not verify authentication, business API calls, credentials, isolated sandbox behavior, or webhook delivery.
