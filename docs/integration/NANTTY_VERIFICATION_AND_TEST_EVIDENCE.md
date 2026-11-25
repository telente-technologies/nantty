# Nantty Verification & Test Evidence

## PR #72 — Store-scoped Developer Business Messaging authorization (2026-11-25)

- PR head `f50194cf9bf2d50f2b5d222d6420b54220a0652f` passed Frontend, Security, and Backend workflows. The Backend workflow completed the Auth Go unit/race suite and database integration suite using PostgreSQL, Valkey, and RabbitMQ.
- GitHub reports no review comments or unresolved review threads. The PR's source commits and explicit squash commit contain no `Co-authored-by` trailer.
- Squash-merged at `2026-11-25T22:38:42Z` as `d85670af122403a7d9980beef35b8854fff7a655`; the local `main` checkout was fast-forwarded to this commit and is clean.
- This verifies CI and merge only. The change has not been deployed to AWS staging. Production message sending remains intentionally unavailable (503); secure Social dispatch, customer trust/window, inbound synchronization and delivery/read receipts remain incomplete.

## PR #73 — Isolate local PostgreSQL test stacks (2026-11-25; in progress)

- Current PR head: `4e54b8e7781f69e022812bca83bef88051fd70f6`; GitHub reports the branch mergeable, with no review comments or threads recorded at the last check.
- Security checks and CodeQL analyses completed successfully. The Backend integration job is still running; do not merge until it completes successfully.
- The change is scoped to local test infrastructure (`docs/runningLocally.md`, `infra/local/docker-compose.yml`). No merge has been performed.

## PR #71 — Business Messaging merchant authorization UI and preview endpoint (2026-11-25)

- PR #71 head was updated to `7e4b7fedff1f96ff48d41d6d378daa15579875db` after adding the missing Web service contract/types, authenticated Gateway preview route, and a focused integration assertion. This fixes the previous webapp CI typecheck failure, which occurred because the UI commit landed before those service methods/types.
- Local verification: webapp TypeScript check passed on Node 24.19.0 (below required 26.13); Webapp ESLint completed with 0 errors and 73 warnings; Stylelint passed. Gateway full Vitest suite passed 1,949/1,949 tests across 44 files. Two focused Auth tests (business/store grant lifecycle and approved-app preview isolation) passed against a disposable PostgreSQL 17 tmpfs container with a test-only `nantty_readers` role; container stopped/removed, no persistent migration applied.
- GitHub on prior head had Frontend `web (webapp)` typecheck fail for missing preview/authorization methods, while Developer portal and Terraform validate passed; Backend and Security workflows were in progress. Updated-head GitHub Actions results must be refreshed before merge. The database-backed test first skipped on the persistent local Postgres because its default password is wrong; it was then rerun successfully against the isolated test container.
- Not verified: authenticated browser workflow, deployed service-to-service secret, production Social dispatch, inbound sync/receipts, email runtime or AWS staging deployment. Production message send remains fail-closed. No squash merge performed.

## PR #70 — Admin GLib security patch (2026-11-25)

- Live GitHub snapshot at head `32dbb93b9d2cf3efa8829c9638d8c5e7607b435c`: PR is open, mergeable, and `CLEAN`; every currently registered PR check passes except the expected path-filtered Mobile skip.
- Rust CodeQL passed after the repository config property was set, but the config at that head ignored the entire vendored `vendor/glib-0.18.5/**` tree. This result does not prove analysis of the patched `variant_iter.rs`.
- Dependabot alert #66 (`GHSA-wrw7-89jp-8q8g`) remains open and not dismissed.
- Local follow-up adds narrow ignores for five source files associated with seven unrelated upstream CodeQL findings, plus a path-filtered Linux Admin Tauri workflow. It runs the focused GLib test from the vendored crate manifest, then builds the release Admin desktop binary using `apps/admin/src-tauri/Cargo.toml` and `--locked`. These local changes have not run in GitHub Actions yet.
- Email-template suite executed in this workspace: 274/274 passed and TypeScript typecheck passed using Node 24.19.0 (below the repository-required Node 26.13 range); these are unrelated to the GLib remediation.

**Environment:** Node `v22.22.3`, `pnpm` `11.24.0` (via `corepack pnpm`), sandbox workspace `/home/user/nantty`, branch `arena/341bf572-nantty`.

## 1. TypeScript Typechecks (`tsc --noEmit`)
All 10 frontend applications pass `tsc --noEmit` with 0 errors:
- `apps/webapp`, `apps/ads`, `apps/admin`, `apps/seller`, `apps/studio`, `apps/developer`, `apps/sandbox`, `apps/mobile`, `apps/messenger`, `apps/web`.

## 2. Executed Unit, Contract & Integration Test Suites

| Package / App | Command / Scope | Result | Notes |
|---|---|---|---|
| `@nantty/gateway` | `corepack pnpm --filter @nantty/gateway test` | **1,937 / 1,937 passed** (44 files) | Full Vitest suite |
| `@nantty/chat-crypto` | `corepack pnpm --filter @nantty/chat-crypto test` | **98 / 98 passed** (14 files) | Full Vitest suite |
| `@nantty/sandbox-service` | `corepack pnpm --filter @nantty/sandbox-service test` | **55 / 55 passed**, 2 skipped (9 files) | 2 integration tests skipped (no local DB) |
| `@nantty/mobile` | `./node_modules/.bin/jest src/services/ src/contracts/ --runInBand` | **307 / 307 passed** (69 suites) | Includes `parityExtensions.service.test.ts` & `scheduledPosts.service.test.ts` |
| `@nantty/studio` | `corepack pnpm --filter @nantty/studio test:contracts` | **111 / 111 passed** (15 suites) | Uses `ignoreStyles.cjs` hook |
| `@nantty/webapp` (units) | `corepack pnpm --filter @nantty/webapp test:units` | **373 / 373 passed** (106 suites) | Full utility suite |
| `@nantty/webapp` (contracts) | `tsx --test` (excl. `errorExperience.test.ts`) | **167 / 167 passed** (45 suites) | Pre-existing `errorExperience.test.ts:72` fails on `/explore` markup |
| `@nantty/webapp` (services) | `tsx --test` (excl. `smileIdWebIntegration.service.test.ts`) | **28 / 28 passed** (11 suites) | Pre-existing `smileIdWebIntegration.service.test.ts:105` copy assertion mismatch; parity tests 2/2 pass |
| `@nantty/admin` (contracts) | `tsx --test` (excl. `errorScreens.test.ts`) | **82 / 82 passed** (25 suites) | Includes `adminAccessRules.test.ts`, `moneyContracts.test.ts`, `parityRoutes.test.ts` |
| `@nantty/seller` (contracts) | `tsx --test` (excl. `errorScreens.test.ts`) | **57 / 57 passed** (14 suites) | Full contract suite minus CSS import hook |
| `@nantty/seller` (units) | `corepack pnpm --filter @nantty/seller test:units` | **17 / 17 passed** (4 suites) | Full utility suite |
| `@nantty/ads` (contracts) | `tsx --test` (excl. `errorScreens.test.ts`) | **28 / 28 passed** (11 suites) | Includes `reportsPdfExport.test.ts` |
| `@nantty/developer` | `corepack pnpm --filter @nantty/developer test` | **35 / 35 passed** | Full portal test suite |
| `@nantty/messenger` | `tsx --test` across `src/**/*.test.ts` | **37 / 37 passed** | Full unit/contract suite |
| `@nantty/sandbox` | `tsx --test` across `tests/*.test.ts` | **1 / 1 passed** | Security headers contract |
| Backend line-length check | `bash services/scripts/check-backend-file-lengths.sh` | **Passed** | All backend files <= 300 lines |
| Dependency audit | `corepack pnpm audit --prod --audit-level=high` | **Passed** | 0 high/critical vulnerabilities |

## 3. Pre-Existing Unrelated Failures / Environment Limitations
- `apps/{ads,admin,seller}/src/contracts/errorScreens.test.ts`: Pre-existing `SyntaxError: Unexpected token '.'` in `packages/webKit/src/nanttyWordmark.tsx:2:20` when `tsx` executes without `--require ./src/contracts/ignoreStyles.cjs` (note `apps/studio` already passes `ignoreStyles.cjs`).
- `apps/webapp/src/services/smileIdWebIntegration.service.test.ts:105` & `apps/webapp/src/contracts/errorExperience.test.ts:72`: Pre-existing copy/markup mismatches unrelated to parity work.
- `services/typescript/{social,notifications}`: `prisma generate` fails in this sandbox because outbound access to `binaries.prisma.sh` is blocked by network egress policy.
- Go (`go`), Elixir (`mix`), and Python (`pytest`) toolchains are not installed in this sandbox container, so `services/go`, `services/elixir`, and `services/python` suites require execution in CI/local toolchain environments.
