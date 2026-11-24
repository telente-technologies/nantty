# Nantty Security Verification Evidence

All commands and outcomes below were executed directly in `/home/user/nantty` on branch `arena/341bf572-nantty` (`2026-11-20`). No test outputs were fabricated or extrapolated.

---

## 1. Environment Facts

- **Node.js**: `v22.22.3` (`package.json` specifies `>=26.13.0 <27`)
- **pnpm**: `11.24.0` (invoked via `corepack pnpm`)
- **Available Runtimes**: Node.js, Python 3, Bash
- **Unavailable / Blocked in Sandbox**: `go`, `mix` (Elixir/OTP), `pytest` (Python test env), Docker/PostgreSQL/Valkey servers, `binaries.prisma.sh` (blocked by egress policy), Xcode / Android NDK, live AWS & PSP/Smile ID credentials

---

## 2. Recorded Command Outputs

1. **Backend File Length Policy**:
   - Command: `bash services/scripts/check-backend-file-lengths.sh`
   - Output: `All backend files are at most 300 lines.` (Exit `0`)
2. **Production Dependency Audit**:
   - Command: `corepack pnpm audit --prod --audit-level=high`
   - Output: `No known vulnerabilities found` (Exit `0`)
3. **Gateway (`@nantty/gateway`)**:
   - Command: `corepack pnpm --filter @nantty/gateway test`
   - Output: `Test Files  44 passed (44)` | `Tests  1937 passed (1937)` (Exit `0`)
4. **E2EE Crypto (`@nantty/chat-crypto`)**:
   - Command: `corepack pnpm --filter @nantty/chat-crypto test`
   - Output: `Test Files  14 passed (14)` | `Tests  98 passed (98)` (Exit `0`)
5. **Sandbox Service (`@nantty/sandbox-service`)**:
   - Command: `corepack pnpm --filter @nantty/sandbox-service test`
   - Output: `Test Files  7 passed | 2 skipped (9)` | `Tests  55 passed | 2 skipped (57)` (Exit `0`)
6. **Developer & Sandbox Portals**:
   - Command: `corepack pnpm --filter @nantty/developer test` -> `# tests 35` `# pass 35` `# fail 0` (Exit `0`)
   - Command: `apps/developer/node_modules/.bin/tsx --test apps/sandbox/tests/*.test.ts` -> `# tests 1` `# pass 1` `# fail 0` (Exit `0`)
7. **Admin BFF & Access Control (`@nantty/admin`)**:
   - Command: `corepack pnpm --filter @nantty/admin exec tsx --test src/contracts/bffGatewayEnforcement.test.ts && corepack pnpm --filter @nantty/admin typecheck`
   - Output: `# tests 12` `# pass 12` `# fail 0`, `tsc --noEmit` exit `0`
   - Command: `corepack pnpm --filter @nantty/admin exec tsx --test src/contracts/clientIpAllowlist.test.ts src/contracts/bffExpiredSession.test.ts src/contracts/adminAccessRules.test.ts src/contracts/blackGovernmentContracts.test.ts`
   - Output: `# tests 23` `# suites 6` `# pass 23` `# fail 0` (Exit `0`)
8. **Webapp SSO Handoff & Units (`@nantty/webapp`)**:
   - Command: `corepack pnpm --filter @nantty/webapp exec tsx --test src/server/developerSsoHandoff.service.test.ts && corepack pnpm --filter @nantty/webapp typecheck`
   - Output: `# tests 2` `# pass 2` `# fail 0`, `tsc --noEmit` exit `0`
   - Command: `corepack pnpm --filter @nantty/webapp test:units` -> `# tests 373` `# suites 106` `# pass 373` `# fail 0`
9. **Ads, Seller, Studio, Messenger, Mobile**:
   - `@nantty/ads` security contracts (`bffExpiredSession`, `bffStepUp`, `accountForwardPath`, `reportsPdfExport`): `# tests 7` `# pass 7`
   - `@nantty/seller` (`test:units` + `bffExpiredSession` + `storeChatEncryption`): `17/17` + `7/7` passed
   - `@nantty/studio` (`test:contracts`): `# tests 111` `# pass 111`
   - `@nantty/messenger` (`tsx --test src/**/*.test.ts`): `# tests 37` `# pass 37`
   - `@nantty/mobile` (`jest src/services/ src/contracts/ --runInBand`): `Test Suites: 69 passed, 69 total` | `Tests: 307 passed, 307 total`
10. **Static Route Inventory (`security/authorization/routeInventory.py`)**:
    - Command: `python3 security/authorization/routeInventory.py`
    - Summary: `Total backend routes: 1324; gateway route entries: 249` (`routed: 1126`, `hidden: 131`, `ops endpoint: 6`; `11` regex mismatches & `6` non-intelligence `UNROUTED` entries verified via `verificationMoney.routes.ts`, `developerOrganization.routes.ts`, `widget.routes.ts`, and `upstreamDispatch.handler.ts`).
