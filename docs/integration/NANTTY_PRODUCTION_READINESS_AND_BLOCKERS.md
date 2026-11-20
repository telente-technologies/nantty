# Nantty Production Readiness & Blockers

## Verified Ready (Code & Contract Level)
- All 13 actionable parity gaps (`PAR-001`–`PAR-007`, `PAR-010`–`PAR-015`) are implemented across frontend apps, BFF allowlists, Gateway guards, and Go backend permission aliases.
- All 10 frontend apps pass `tsc --noEmit`; Gateway (1,937), Chat Crypto (98), Mobile services/contracts (307), Studio (111), Admin (82 non-CSS), Seller (74 non-CSS), Ads (28 non-CSS), Webapp (568 non-preexisting), Messenger (37), Developer (35), Sandbox (1), and Sandbox-service (55) tests pass.
- Backend file-length constraint (`<= 300` lines) passes cleanly.

## External & Infrastructure Blockers (Not Simulated)
Per `docs/master/NANTTY_BLOCKERS.md`:
1. **External Provider Credentials:**
   - Live PSP / Flutterwave keys, Smile ID keys, Kwikpik partner logistics credentials, and statutory CSAM external matcher / NCMEC reporting credentials are absent in sandbox.
2. **Database & Toolchain Gates Required Before Cutover:**
   - Run `go test ./...` across `services/go` (specifically validating `services/go/platform/staffauth/tests/permissionCatalog.constant_test.go`, `services/go/modules/payments`, `services/go/modules/creators`, `services/go/modules/users`, `services/go/modules/ads`, `services/go/modules/wallet`, and `services/go/modules/catalog`) against PostgreSQL.
   - Run `prisma generate && vitest run` in `services/typescript/social` and `services/typescript/notifications` in an environment with access to `binaries.prisma.sh` (or cached Prisma engines).
   - Run `mix test` in `services/elixir/realtime` and `pytest` in `services/python/intelligence`.
   - Run native iOS (Xcode) and Android (NDK) builds + end-to-end signed-in browser/device smoke tests against a live Gateway + PostgreSQL stack.
   - Apply pending versioned SQL migrations cleanly during the controlled migration window.
