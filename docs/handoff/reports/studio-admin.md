# Studio + Admin pass (2026-10-11)

## Studio (apps/studio)
- Nav: Home, Content, Live, Earnings, Subscribers, Audience, Account (Embed lives under Account). Sign-in lands on /home.
- Home: "Do next" list from live status, takedown deadlines, restrictions, program suspension, payout verification, withdraw prompt, no tiers, no lives.
- Content: posts/clips with real totals; per-item views, engagement, watch time/completion, 7-day views, follower split.
- Subscribers: tiers from the backend price ladder, iOS/Android price + store fee shown before publishing; stop/resume confirmed.
- Audience: followers, coins, gifts, leaderboard place. Account: copyright strike ladder, Creator Program status, tools, settings.
- Earnings: one wallet + lines, payout setup, history, withdrawals, brand deals (Withdraw links to web wallet).
- Live: real totals; rank ring in control room; end live / rotate key confirmed.
- Removed: always-zero "New subscribers", empty "Battle results", old health card. Non-creators see their real eligibility.
- Fixed mismatches: missing unpin mock, ignored hostRanking, report detail >500 chars, email step-up mocks, studio server forwarded any /api/v1 path (now allow-list, 404 NOT_AVAILABLE_IN_STUDIO), generic errors.
- Tests: studioApiAccess, studioBffGuard, creatorNextActions, embedProductLink. tsc, 54 tests, mock `next build` pass. No backend edits.
- Open: constant-built paths listed by hand in allow-list; non-creator gate not run live; `document-link/complete` mock-only.

## Admin (apps/admin)
- Route table `src/config/apiRoutes.config.ts` (method + path, ~230 routes): each names permissions, step-up, reason. Unknown route/method = 404. `anyAdmin` replaced by `ownAccount` (own account/consents/preferences only). /admin/roles and /admin/staff-settings GET now staff:manage (BFF + Go).
- `apiAccess.config.ts` is the single helper (findAdminApiRoute / doesApiCallRequireStepUp / isReasonMissing) used by BFF and the mock backend.
- Step-up added: PII reveal (GET personal-data), user suspend, suspension decisions, checkmark grant/revoke, accounts create, verification case decisions, black approve/reject, legal rollback, chat-report SUSPEND/BAN/REMOVE_GROUP (body-conditional), plus all money/role/legal ones already there.
- Reason (>=5 chars) enforced at BFF (400 REASON_REQUIRED) for destructive routes; pricing dialogs raised 3 -> 5.
- Pages deny by default (unmapped page -> redirect + "You don't have access" notice). Nav requirements now any-of lists that match backend.
- Sessions: BFF 15 min idle / 12 h absolute (unchanged); Go absolute 7 d -> 12 h, new 30 min idle on refresh; permission change revokes target's sessions (Go) and BFF signs out on privilege change (SESSION_PRIVILEGES_CHANGED, also in session-refresh).
- ADMIN_IP_ALLOWLIST: IPs + IPv4 CIDR; empty = allow-all outside production; production refuses to start (src/instrumentation.ts) and denies if empty. Also validates session secret, API URL, origin, no mocks. Documented in .env.example and apiContract.md.
- Audit: Go catch-all audit now stores the request reason; new filters action, target ID, request ID, step-up only (Go + mock + UI).
- Errors: every error shows message + code; mapping in utils/adminErrorMessages.util.ts; error pages show digest.
- Removed dead pages with no backend: /config/flags (flags+experiments), /config/templates (notification templates) + their components, types, mocks. Backup of featureFlagsTab.tsx (had a 1-line uncommitted `intent` edit) in scratchpad/backups/. Waitlist/phone/loyalty/referral/cashback: none left. Chat reports confirmed evidence-only.
- Go edits: staffauth audit middleware (+ new test), admin staffAdmins routes, changeAdminPermissions, staffSession/rotateStaffRefreshToken, auditLog filter; users accountEnforcement routes (suspend + PII step-up), checkmarks routes (grants list any of grant/revoke; accounts/created any of users:read/verification:grant). Tests updated.

## QA
- Admin: tsc clean; 34 contract tests pass (new adminAccessRules + bffGatewayEnforcement: every console call maps to a rule, forged call 403, unknown 404, CSRF 403, missing/blank reason 400, step-up required, replayed-from-other-session and expired step-up refused, privilege change signs out, nav hidden for support agent); mock `next build` passes (stale .next/dev/types cache cleared).
- Go: 6 deployables build (flutterwaveFlows is test-only); staffauth + users tests pass; admin passes except TestSettingsWritesNeedStepUpVersionAndValidValues (expects 18 settings, now 20 after other agents added payments.limits / seller.debtLimits; not from this pass).
- Double-submit: mutations carry Idempotency-Key; mock replays (Idempotent-Replayed).

## Open / for owner
- Withdrawals and staff disputes lists sort newest first (wallet/escrow modules, payments agent's area); should be oldest first for pending.
- Coin/subscription price-table GET in Go needs money.monetization.manage, so config:read-only staff get 403 there.
- Step-up is a 5-minute session-bound window, not single-use.
- Empty dirs components/configuration/{flags,templates} left (rmdir was blocked).
- admin flags:manage / templates:manage permissions still exist but have no pages.
