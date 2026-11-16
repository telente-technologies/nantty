# Nantty master implementation tracker

This folder coordinates execution across the Nantty ecosystem. It is an index and status ledger, not a replacement for product specifications or service-owned API contracts.

## Working rules

- Read the current product/architecture source before changing a domain. Resolve conflicts using the latest explicit product decision and record the resolution.
- Mark a capability verified only at the level actually exercised: unit, integration, local browser, device, or production. A build is not runtime evidence.
- Keep mocks and previews visibly distinct from real services. Do not create fake records or enable controls that lack an owning service.
- Preserve unrelated working-tree changes. Do not commit, push, deploy, or run database migrations unless specifically authorized.
- Keep SQL migrations versioned and unapplied until the reviewed migration window. The pending Identity organization, audit, invitation, application-registry, and application-grant migrations are grouped as one planned application batch, but remain separate versioned steps so ordering and rollback history stay explicit. No migration was executed by this work.
- “Both notification streams” remains the user’s choice when both Nantty and Messenger are installed; routing/deduplication still requires device verification.

## Tracker documents

- [Repository and product inventory](NANTTY_REPOSITORY_INVENTORY.md)
- [Requirements and evidence matrix](NANTTY_REQUIREMENTS_MATRIX.md)
- [Prioritized implementation backlog](NANTTY_IMPLEMENTATION_BACKLOG.md)
- [External and verification blockers](NANTTY_BLOCKERS.md)

## Current implementation slice

Developer organization CRUD, membership/role management, access descriptions, step-up ownership transfer and owner audit access are present in the Identity service and Developer portal source. The organization invitation flow supports recipient consent and a portal inbox. The Postgres invitation integration test is skipped because local Postgres authentication is unavailable. Browser smoke renders the portal, but authenticated organization data flows are not verified. No migration was run and no invitation email is sent. Checks used Node 24.19 although the repository requires Node 26.13+. See [the Developer inventory](../architecture/messenger-developer-page-inventory.md) and backlog for exact gates.

This increment adds the org-scoped Developer application draft registry to Go Identity, its Gateway/BFF allowlists, and a working `/applications` draft interface. Owner/admin access only, pending per-app grant support. It has request validation, an audited lifecycle, idempotent creation, and no credentials or public API activation. Go tests pass with the Postgres integration explicitly skipped; the focused Gateway tests (17), Developer/Gateway typechecks, Developer lint and configured Developer production build pass. The page rendered locally, but the Identity gateway was unconfigured, so authenticated database-backed browser behavior is not verified. Node 24.19 remains below the workspace's declared 26.13+. Its migration is unapplied and batched with the other pending Identity migrations.

Messenger now has photo-Story publishing, encrypted Story replies and active video playback using existing Media/Social/chat-crypto APIs and the same Expo Video version as the main app. Replies share the chat crypto client and sealed outbox; the Social handler passes the request idempotency key to its existing message repository path. Messenger typecheck and 34 tests pass; Social typecheck and 673 tests pass. No signed-in device session or native device run was available, so media playback and Story workflows remain runtime-unverified.

The latest execution moved the remaining six source-local Go test files into `services/go/**/tests`, refactored their exercised contracts to be production-used rather than test-only, and verified the live inventory at **665/665 test files under `tests/` (zero source-local)**. Full Orders, Live, Platform, Auth and Wallet `go test ./...` suites pass when run with the disposable PostgreSQL test database where required. Auth organization creation was exercised end-to-end and fixed: idempotency rows now persist `created_at`, audit subject IDs no longer reuse a UUID parameter as text, developer management routes use request rate limiting rather than the authentication-attempt limiter, and integration fixtures now forward SQL arguments correctly. Wallet's isolated integration harness now asserts that its package/purchase/transfer migrations exist before exercising flows; the chargeback integration expectation was corrected to the configured 2% transfer fee (78 net coins from an 80-coin transfer). A first broad workspace sweep had transient/inconsistent Wallet DB failures; the clean, isolated Wallet rerun passed. The disposable Postgres container is task-created/test-only; no persistent database or migration was changed. Sandbox control-plane and device verification remain as recorded below and in the matrices.

Latest increment: Identity serves the current user's effective capabilities and actor UUID for one non-archived Developer application. The Developer server BFF now requires `credentials.manage` and exact org/app identity before calling private Sandbox control routes. A responsive `/credentials` screen supports Sandbox-only metadata listing, issue with one-time reveal, rotation, optional expiry and app-scoped revocation. Sandbox stores token digests and audits the Identity actor. Verification: Auth full suite passed against disposable PostgreSQL; Developer BFF 11/11 tests, typecheck and configured production build passed; Sandbox 32/32 tests passed with a SQL integration against its grouped schema in a disposable database and source/test typechecks passed; Gateway 17 focused tests and source/test typechecks passed; mobile viewport rendered. The combined signed-in browser-to-Identity/Gateway/Sandbox workflow remains unverified. The Sandbox schema was not applied to any persistent database. No production keys, deployment or public API operations were enabled. Persistent PostgreSQL at `localhost:15432` remains unresolved.

Last reviewed: 2026-11-16. Status describes this checkout, not a deployed environment.
