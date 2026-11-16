# ADR: Isolated Sandbox service boundary

**Status:** Accepted; implementation in progress  
**Date:** 2026-11-14  
**Deciders:** Nantty engineering

## Context

The Sandbox portal originally had no isolated API service or synthetic data plane. A first service slice now exists at `services/typescript/sandbox`, with a dedicated PostgreSQL target, test-prefixed credentials stored as SHA-256 digests, and synthetic messaging records. It must not proxy to production or imply that the full Sandbox product is ready.

## Decision

The portal exposes a server-only readiness probe configured through `SANDBOX_API_BASE_URL`. It requests only `/readyz`, does not forward browser credentials or user payloads, rejects non-HTTPS production URLs, and accepts only `sandbox-api.nantty.com` or `*.sandbox.nantty.com` production hosts. Local HTTP is permitted only in development. The new service fails startup without its own database URL and control token; production requires a production DB reference and rejects matching host/port/database targets. Its initial schema is one grouped migration and has not been applied. Current source/test typechecks and direct local Vitest pass; database-backed behavior remains unverified. The service also has transactional outbound message state transitions on its service-authenticated control plane. Readiness still does not prove Developer authorization or full portal workflows.

## Options considered

### Probe the configured dedicated Sandbox gateway

**Complexity:** Low. **Isolation:** Explicitly enforced by host policy. **Operational value:** Shows whether the dedicated service is reachable without suggesting that test workflows work.

### Reuse the production API gateway

Rejected because it risks mixing production identities/data and creates a misleading Sandbox surface.

### Keep the status entirely static

Safe but cannot distinguish an unconfigured gateway from a configured but unavailable one.

## Consequences

- The readiness route is read-only, bounded by a short timeout, uncached, and returns no upstream payload.
- A real isolated service and its own credentials/data plane are still required before enabling requests or test scenarios.
- The health contract must return `{ "status": "ready" }` or `{ "ready": true }`; generic HTTP success is insufficient.

## Follow-up

1. [x] Add an independently deployable service boundary and initial synthetic messaging data-plane source.
2. [ ] Integrate control routes with Identity organization membership, application ownership, roles, and grants; the service-only control token is not a substitute.
3. [x] Add outbound delivery/read/failure transitions on the control plane, with state and event/audit persistence in one transaction and idempotent repeat requests. [ ] Add webhook registration/delivery, scenarios, reset, and quota enforcement; corresponding portal actions remain disabled.
4. [ ] Apply the grouped migration only in the reviewed migration window and run DB-backed isolation and idempotency tests.
5. [ ] Add public gateway routing and connect portal actions only after authorization and deployment gates pass.
