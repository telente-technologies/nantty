# Docs cleanup (2026-10-11)

Scope: every project markdown file outside node_modules, .git, .next, .venv, Elixir `deps/` (third-party), `.pytest_cache`, the generated browserE2e reports (gitignored) and the help content (product content, KEEP, untouched).
Nothing committed. Deletions were done with `git rm` (staged).

## Counts

| | Before | After |
|---|---|---|
| Project docs (excluding AGENTS.md/CLAUDE.md agent files and help content) | 103 | 97 (7 deleted, 1 added: docs/README.md) |
| `docs/**/*.md` | 68 | 62 |
| Help Centre articles (`services/typescript/support/content/help`) | 252 | 252 |

## DELETE (git rm)

| File | Why | Links fixed |
|---|---|---|
| docs/integrations/bachsMigrationCase.md | Decision final (no Bachs; Paystack, then Flutterwave) | none existed |
| docs/verification/finalCheckReport.md | Finished one-off QA run (4–5 Oct) | FINDINGS.md L90, architecture/recommendations.md L163, verification/apiContractCheck.md L18 |
| docs/verification/darkModeScan.md | Finished one-off visual scan (4 Oct) | none |
| docs/verification/requirementsTraceability.md | Outdated 4 Oct gap snapshot | none |
| docs/verification/securityReview.md | Duplicate pointer page | MERGED into security/README.md (report list + SEC-0001..0022 status) |
| docs/architecture/improvementReport.md | Outdated 3 Oct research, pre-backend | README.md (phased plan source, doc index), docs/architecture/README.md |
| docs/architecture/awsServicesAndIntegrations.md | Duplicate of docs/awsAndThirdPartyIntegrations.md | MERGED: "Later or not planned" AWS table, exchange-rate feed row; no inbound links |

## MERGE

- architecture/awsServicesAndIntegrations.md → docs/awsAndThirdPartyIntegrations.md (canonical; linked from awsSalesCallPrep.md). Also added a Flutterwave row and marked Paystack "being replaced".
- verification/securityReview.md → security/README.md.
- README.md "Documentation index" table → replaced by a pointer to the new docs/README.md (single index).

## UPDATE (small edits made)

| File | Edit |
|---|---|
| docs/architecture/payments.md | Flutterwave provider-change banner |
| docs/checkoutPaymentFlowPlan.md | banner (superseded for money flows by flutterwaveMigration.md) |
| docs/integrations/paystack.md | banner (record of the code being replaced) |
| docs/integrations/paystackWalletKycPlan.md | banner (kept only for licence analysis + CBN-tier caps §5.2) |
| docs/billing/renewalsAndTrials.md | banner (rules stay, Paystack mechanics change) |
| docs/database/transactions.md | banner |
| docs/pricing.md §7 | note to re-check currency rules against Flutterwave §6 |
| docs/architecture/privacy.md | processor line mentions Flutterwave + BVN |
| docs/database/query-patterns.md | "rankings page" → live host rank ring (livestream-only) |
| README.md | money-flow note (Flutterwave target), improvementReport link removed, doc index → docs/README.md |
| security/README.md | merged securityReview, lists all reports incl. VERIFICATION_SUMMARY, provider-neutral test-key rule |
| security/audit/reports/FINDINGS.md, docs/architecture/recommendations.md, docs/verification/apiContractCheck.md | removed finalCheckReport references (one line each) |
| docs/CHANGELOG.md | 2026-10-11 cleanup entry |
| docs/README.md | NEW single index, one line per doc by area |

## KEEP

- Root: README.md (UPDATE above), SECURITY.md.
- Root security reports, all with open items, so not deleted:
  - DEEPSCAN_REPORT.md: M3, A5, A7 open, plus the H1 allowlist default.
  - GO_DEEPSCAN_REPORT.md: M4, M5 open (accepted, configurable).
  - GO_FINANCIAL_AUDIT_REPORT.md: the F8 UX item is open (the withdrawal quote ignores debt).
  - The move into security/audit/reports/ is **deferred**: the Flutterwave agent edited all three plus VERIFICATION_SUMMARY.md at 06:29, and flutterwaveMigration.md §9 references them. The ready script is `scratchpad/moveRootSecurityReports.sh`.
- docs: plans.md, backendPlan.md, CHANGELOG.md, pricing.md, emailAddresses.md, darkModePlan.md (theme API reference, mostly shipped), awsAndThirdPartyIntegrations.md, awsSalesCallPrep.md (call is today, 2026-10-11; delete after), design/brandWordmark.md, design/studioLandingReferences.md, billing/renewalsAndTrials.md.
- docs/integrations:
  - KEEP: flutterwaveMigration.md and flutterwaveApiReference.md (Flutterwave agent, untouched), appStoreProducts.md, smileId.md, frontendWiring.md.
  - KEEP for now: paystack.md, paystackWalletKycPlan.md.
- docs/architecture: README, inventory, system, backend, frontend, database, events, marketplace, payments, realtime, liveSafety, media, search, recommendations, analytics, fraud, privacy, security, observability, devops, disaster-recovery, widgetsApiContract (untracked, new), microservicesPlan.json.
- docs/database: all 11.
- docs/verification/apiContractCheck.md (being updated by another agent).
- docs/legal/README.md + 7 templates (untracked, new legal pack).
- security: README, audit/ENVIRONMENT_BOUNDARY, reports/{VERIFICATION_SUMMARY, GO_BACKEND_DEEP_SCAN, PYTHON_BACKEND_DEEP_SCAN, FINDINGS, REMEDIATIONS, ATTACK_SURFACE, FINAL_SECURITY_AUDIT, FINANCIAL_INTEGRITY, ACTIVE_TEST_PLAN, ATTACK_COVERAGE} (interlinked and still cited; FINDINGS/REMEDIATIONS hold open follow-ups).
- services: README.md, zudojsStructure.md, python/README.md, python/intelligence/README.md (read by its Dockerfile), python/intelligence/apiContract.md, contracts/events/consumers/notifications.md.
- apps: admin/ads/seller apiContract.md (seller is untouched, being edited by the seller chat agent), seller/README.md, all storeBadges/NOTICE.md (licence notices), packages/emailTemplates/assets/storeBadges/NOTICE.md.
- Agent files apps/*/AGENTS.md, CLAUDE.md: KEEP (gitignored local config, not docs).
- Ignored or generated, left alone: services/elixir/realtime/deps/**, intelligence/.pytest_cache/README.md, intelligence/.venv/**, services/scripts/browserE2e/reports/**.

## Big rewrites needed (listed, not done)

1. docs/integrations/paystackWalletKycPlan.md + paystack.md + checkoutPaymentFlowPlan.md: move the CBN-tier caps (§5.2) and the licence analysis into flutterwaveMigration.md, re-point its line 5/394 links, then delete all three once the Flutterwave build lands. Blocked because flutterwaveMigration.md is owned by the payments agent.
2. docs/architecture/payments.md, README.md "Money flow", "Tech stack", "Pricing" and "Status and roadmap": rewrite for Flutterwave. The README status table also still says E2EE chat is "designed, not built".
3. docs/architecture/* and docs/database/* are all "as of 2026-10-03" snapshots citing inventory.md. They need a refresh against the current code. inventory.md could be deleted once nothing cites it.
4. docs/backendPlan.md (3 Oct draft, 1,240 lines) and docs/plans.md (2,235 lines): prune the [DONE] sections into the CHANGELOG.
5. flutterwaveMigration.md §5 L0 says "email + phone OTP". Phone OTP was removed, so the payments agent should fix it.
6. infra/aws/README.md, pricing.md §7 and billing/renewalsAndTrials.md: Paystack WAF IPs, currencies and authorizations need Flutterwave equivalents.

## QA

- Link checker (`scratchpad/mdlinks.py`; skips app routes like /help/...): 0 broken relative links across 348 markdown files after the cleanup (0 before as well).
- Grep for the deleted filenames across tracked and untracked files: only the intentional "merged from" note in awsAndThirdPartyIntegrations.md and the CHANGELOG entry remain.
- No code or test reads any deleted doc. The only doc readers in code are the support help-content loader and the intelligence Dockerfile (README.md), and both are untouched. The support content tests passed under the heavy lock: 2 files, 8 tests.
