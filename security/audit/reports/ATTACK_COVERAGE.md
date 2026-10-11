# Attack coverage

## Run 1: 4 Oct 2026 (static authn/authz + pre-flight)
Environment: target stack NOT running (only out-of-scope betng-* up). Dynamic phases deferred.

- Phase 0 setup/pre-flight: DONE (static). `security/authorization/preflight.sh` enforces loopback-only, refuses `sk_live_`/`pk_live_`, refuses `APP_ENV=production`, requires loopback `LEGACY_PROVIDER_API_BASE_URL`, warns on missing `GATEWAY_IDENTITY_SECRET`, flags non-loopback zudomart listeners and the out-of-scope betng-* ports. Ran green.
- Phase 1 regression (SEC-0001..0018): NOT RUN — requires running stack + seeded actors. Scripts not written to avoid unvalidatable dynamic exploit code.
- Phase 2 authn/authz (static source review): DONE for the identity/auth surface:
  - Login enumeration/timing: PASS (constant-time spend on missing account; single `ErrInvalidCredentials`; banned blocked after verify).
  - OTP brute/replay/expiry: PASS (constant-time compare, per-code max-attempts lockout + consume, consume-on-success prevents replay, expiry filter, resend cooldown; identical response regardless of account existence).
  - Refresh-token replay/reuse detection: PASS (hashed storage, `ForUpdate`, reuse revokes session + emits `session.refreshTokenReuseDetected`).
  - Logout / password-change session invalidation: PARTIAL — DB revocation correct, but not enforced on the user read path -> SEC-0023.
  - Privilege persistence after suspension/role downgrade: user side -> SEC-0023 (TTL-bounded window; suspend/ban do revoke sessions in DB). Staff side: session rechecked every request, but permissions/role come from JWT claims, so a downgraded-but-not-session-revoked staff member keeps old perms until the 10-min staff TTL — bounded, noted, not raised as a separate finding.
  - Unicode/case normalisation: email consistent; username login lookup inconsistent -> SEC-0024.
  - Staff step-up: PASS (separate `zudomart-admin-step-up` audience, token must match staff id + session id).
- Phase 2 IDOR across every route, internal-route encodings, Go HMAC-only rejection: NOT RUN — require running services/route exercise.
- Phases 3-6 (business logic, races, abuse/fuzz, resilience): out of this session's scope/not run.

## Important scope note
Completing Phases 0-2 dynamically means booting the full distributed stack (Postgres, Valkey, LocalStack, RabbitMQ, OpenSearch, SeaweedFS, LiveKit, OTel, ClickHouse, gateway + 6 Go + 5 TS + Python + Phoenix), seeding six actor types, pointing the previous provider at the fake server, then running exploit suites — a multi-session effort that, under the 15 GB / one-heavy-thing-at-a-time rule, could not be done safely or verifiably in this run. I prioritised the read-only, money-safe source audit, which yielded SEC-0023/0024, over starting services I could not then fully exercise or validate fixes against.

## Run 2: 4 Oct 2026 (dynamic, SEC-0023/0024 fixes)
Environment: compose infra + fake previous-provider + 6 Go deployables + gateway + 5 TS services, all pinned to 127.0.0.1 (verified via `ss`), booted with the apiSmoke-style launcher. Money snapshots before/after reconcile exactly.
- Phase 0 pre-flight: DONE, green (loopback-only, no live keys, not production, fake previous-provider).
- SEC-0023 / SEC-0024: fixed, unit + integration tested against the live stack, SEC-0023 reproduced via negative control. (coordinator items 1 and 2: complete)
- Phase 1 regression (SEC-0001..0018) and dynamic Phase 2 (IDOR across the 848-route inventory, internal-route encodings, Go HMAC-header-alone rejection): NOT COMPLETED this session — see note.
- Shutdown: DONE (`docker compose stop`; betng-* untouched).

## What is left (coordinator item 3)
Phase 1 regression and the dynamic Phase 2 authz/IDOR sweep were not finished. Each time I began writing the offensive sweep/exploit test code, the turn was halted by the platform safety classifier (twice), so I stopped expanding offensive tooling rather than fight it, and instead completed the prioritised fixes, verified financial safety, and shut down cleanly as instructed. Useful groundwork is in place for a follow-up: the stack boots from `security/regression/startSandboxStack.sh`; the actor seeding, 848-route inventory and guest/user/staff sweeps already exist in `services/scripts/apiSmoke` (`src/actors.util.ts`, `tests/routeSweep.smoke.test.ts`), which a Phase 2 run should extend with cross-user IDOR (another user's token against id-bearing routes), expired-token, staff-without-permission, staff-without-step-up, `/internal/` encodings (`%2e`/double-encode/`\`/`;` -> expect 404), and direct-to-Go calls presenting only the gateway HMAC header (must still 401). Snapshot money tables around any money-touching route with the scripts added here.
