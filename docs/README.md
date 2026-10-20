# Zudomart documentation index

Every maintained document in the repo, one line each. Third-party files (`deps/`, `node_modules/`), generated test reports and the agent files (`AGENTS.md`, `CLAUDE.md`) are not listed. Last cleaned up 2026-10-11 (see [CHANGELOG.md](CHANGELOG.md)).

## Start here

- [../README.md](../README.md): what Zudomart is, the repo map, quick start and common commands.
- [runningLocally.md](runningLocally.md): switch the apps between mocks and the real backend, start the local stack, demo accounts, testing on a phone.
- [plans.md](plans.md): the living work plan, with status markers and owner decisions.
- [CHANGELOG.md](CHANGELOG.md): what changed, by date.
- [../SECURITY.md](../SECURITY.md): baseline security rules for every module.

## Architecture (`docs/architecture`)

- [architecture/system.md](architecture/system.md): the current system overview (services, data ownership, events, money flow, auth, realtime, deployment). Start here.
- [architecture/README.md](architecture/README.md): index of the topic documents, which are current and which are dated, and the fixed decisions.
- [architecture/inventory.md](architecture/inventory.md): historical audit of the repo on 2026-10-03.
- [architecture/backend.md](architecture/backend.md): deployables, ownership matrix, API design audit (dated design notes).
- [architecture/frontend.md](architecture/frontend.md): front-end apps, BFFs, mock switching.
- [architecture/database.md](architecture/database.md): domain ERDs and schema ownership.
- [architecture/events.md](architecture/events.md): outbox, event catalog, queues and background jobs.
- [architecture/marketplace.md](architecture/marketplace.md): catalog, carts by seller, checkout, orders, shipping.
- [architecture/logisticsV2.md](architecture/logisticsV2.md): V2 provider delivery (Chowdeck Relay first), delivery cost allocation, insurance, redelivery; not launch work.
- [architecture/payments.md](architecture/payments.md): ledger, escrow, wallets, coins, payouts (architecture view; Flutterwave is the only provider).
- [architecture/realtime.md](architecture/realtime.md): Phoenix realtime and the livestream stack.
- [architecture/liveSafety.md](architecture/liveSafety.md): live reports, frame sampling, safety holds.
- [architecture/media.md](architecture/media.md): uploads, processing, storage, delivery.
- [architecture/search.md](architecture/search.md): Postgres search now, OpenSearch later.
- [architecture/recommendations.md](architecture/recommendations.md): ranking and personalisation.
- [architecture/analytics.md](architecture/analytics.md): product, seller and creator analytics.
- [architecture/fraud.md](architecture/fraud.md): fraud, trust and moderation.
- [architecture/privacy.md](architecture/privacy.md): consent, data rights, retention.
- [architecture/security.md](architecture/security.md): security controls mapped to services.
- [architecture/observability.md](architecture/observability.md): traces, logs, metrics, alerts.
- [architecture/devops.md](architecture/devops.md): CI/CD, environments, AWS layout.
- [architecture/disaster-recovery.md](architecture/disaster-recovery.md): backup, restore, failover.
- [architecture/widgetsApiContract.md](architecture/widgetsApiContract.md): home-screen and embeddable web widget API.
- [architecture/microservicesPlan.json](architecture/microservicesPlan.json): early proposed service map (historical).

## Database (`docs/database`)

- [database/README.md](database/README.md): index and labels.
- [database/domains.md](database/domains.md): domain map and table ownership by schema.
- [database/schema.md](database/schema.md): ERDs per domain.
- [database/indexes.md](database/indexes.md): index plan and validation follow-ups.
- [database/query-patterns.md](database/query-patterns.md): hot queries and caches.
- [database/transactions.md](database/transactions.md): transaction boundaries and idempotency keys.
- [database/migrations.md](database/migrations.md): Atlas/ent migration rules.
- [database/partitioning.md](database/partitioning.md): partitioning and retention.
- [database/performance.md](database/performance.md): connections, capacity and database security.
- [database/sharding.md](database/sharding.md): when (and whether) to shard.
- [database/backup-recovery.md](database/backup-recovery.md): backups and restore drills.

## Backend services

- [../services/README.md](../services/README.md): how to run and test every backend service.
- [../services/zudojsStructure.md](../services/zudojsStructure.md): the shared code layout for every stack.
- [backendPlan.md](backendPlan.md): backend contracts and wiring order (3 Oct draft, partly built).
- [../services/python/README.md](../services/python/README.md): rules for the Python intelligence layer.
- [../services/python/intelligence/README.md](../services/python/intelligence/README.md): intelligence service setup (read by its Dockerfile).
- [../services/python/intelligence/apiContract.md](../services/python/intelligence/apiContract.md): intelligence HTTP contract.
- [../services/contracts/events/consumers/notifications.md](../services/contracts/events/consumers/notifications.md): events the notifications service consumes.

## Front ends and API contracts

- [../apps/seller/README.md](../apps/seller/README.md): seller dashboard overview and setup.
- [../apps/seller/apiContract.md](../apps/seller/apiContract.md): seller dashboard API contract.
- [../apps/ads/apiContract.md](../apps/ads/apiContract.md): Ads Manager API contract.
- [../apps/admin/apiContract.md](../apps/admin/apiContract.md): admin console API contract.
- [integrations/frontendWiring.md](integrations/frontendWiring.md): switching each app from mocks to the real gateway.
- [verification/apiContractCheck.md](verification/apiContractCheck.md): every front-end call checked against the backend routes.
- [darkModePlan.md](darkModePlan.md): design tokens, theme API and per-app dark mode status.

## Payments, pricing and billing

- [integrations/flutterwaveMigration.md](integrations/flutterwaveMigration.md): payments design and cutover status (Flutterwave is the sole provider since 2026-10-11: payout subaccounts, escrow, payouts, KYC levels).
- [integrations/flutterwaveApiReference.md](integrations/flutterwaveApiReference.md): Flutterwave v3/v4 API facts we rely on.
- The spec's appendices hold the [licence analysis and CBN tiers](integrations/flutterwaveMigration.md#appendix-a-licence-analysis-and-cbn-tiers), and the [checkout and payout rules](integrations/flutterwaveMigration.md#appendix-b-checkout-and-payout-rules).
- [integrations/appStoreProducts.md](integrations/appStoreProducts.md): App Store and Google Play creator-subscription products.
- [integrations/smileId.md](integrations/smileId.md): Smile ID identity verification for checkmarks and payouts.
- [pricing.md](pricing.md): regional prices for every plan, coin pack, boost and ad floor.
- [billing/renewalsAndTrials.md](billing/renewalsAndTrials.md): renewals, retries, grace and free trials.

## Infrastructure and operations

- [../infra/aws/README.md](../infra/aws/README.md): the Terraform layout (never applied).
- [awsAndThirdPartyIntegrations.md](awsAndThirdPartyIntegrations.md): every AWS service and third-party provider, and the go-live checklist.
- [awsSalesCallPrep.md](awsSalesCallPrep.md): notes for the AWS sales call of 2026-10-11.
- [emailAddresses.md](emailAddresses.md): company mailboxes and sending addresses.

## Security

- [../security/README.md](../security/README.md): security workspace layout, rules and review status.
- [../security/audit/reports/VERIFICATION_SUMMARY.md](../security/audit/reports/VERIFICATION_SUMMARY.md): status of every deep-scan finding (start here).
- [../security/audit/reports/GO_BACKEND_DEEP_SCAN.md](../security/audit/reports/GO_BACKEND_DEEP_SCAN.md): Go backend deep scan.
- [../security/audit/reports/PYTHON_BACKEND_DEEP_SCAN.md](../security/audit/reports/PYTHON_BACKEND_DEEP_SCAN.md): Python intelligence deep scan.
- [../security/audit/reports/DEEPSCAN_REPORT.md](../security/audit/reports/DEEPSCAN_REPORT.md): TypeScript deep scan (open items remain).
- [../security/audit/reports/GO_DEEPSCAN_REPORT.md](../security/audit/reports/GO_DEEPSCAN_REPORT.md): Go deep scan (open items remain).
- [../security/audit/reports/GO_FINANCIAL_AUDIT_REPORT.md](../security/audit/reports/GO_FINANCIAL_AUDIT_REPORT.md): Go money audit (one open UX item).
- [../security/audit/reports/FINDINGS.md](../security/audit/reports/FINDINGS.md): SEC-0001 to SEC-0022 findings.
- [../security/audit/reports/REMEDIATIONS.md](../security/audit/reports/REMEDIATIONS.md): fixes, deploy checklist, open follow-ups.
- [../security/audit/reports/ATTACK_SURFACE.md](../security/audit/reports/ATTACK_SURFACE.md): route inventory and auth model.
- [../security/audit/reports/FINAL_SECURITY_AUDIT.md](../security/audit/reports/FINAL_SECURITY_AUDIT.md): 4 Oct audit scorecard.
- [../security/audit/reports/FINANCIAL_INTEGRITY.md](../security/audit/reports/FINANCIAL_INTEGRITY.md): money controls and snapshot results.
- [../security/audit/reports/ACTIVE_TEST_PLAN.md](../security/audit/reports/ACTIVE_TEST_PLAN.md): live red-team phases.
- [../security/audit/reports/ATTACK_COVERAGE.md](../security/audit/reports/ATTACK_COVERAGE.md): which red-team phases were run, and when.
- [../security/audit/ENVIRONMENT_BOUNDARY.md](../security/audit/ENVIRONMENT_BOUNDARY.md): what may be tested, and the redacted credential inventory.

## Design, brand and legal

- [design/brandWordmark.md](design/brandWordmark.md): brand marks and how to use them.
- [design/studioLandingReferences.md](design/studioLandingReferences.md): Studio landing references and decisions.
- [legal/README.md](legal/README.md): legal pack and contract templates (drafts for counsel).
- `apps/*/public/storeBadges/NOTICE.md`, `packages/emailTemplates/assets/storeBadges/NOTICE.md`: App Store and Google Play badge licence notices.

## Product content (not docs)

- `services/typescript/support/content/help/**`: Help Centre articles, loaded by the support service at startup.
