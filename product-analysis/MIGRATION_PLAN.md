# Subscription taxonomy and entitlement migration plan

Status: design only; do not run against any database yet. No production/staging subscription data was queried. Migrations must preserve prior records and paid-through access.

## Current legacy plan codes

Source: `services/go/modules/subscriptions/src/constants/plans.constant.go`; defaults and prices also exist in `services/go/platform/regionpricing/regionPricing.plans.go` and subscription DB `plan_prices`.

| Legacy code | Current meaning in source | Proposed canonical treatment | Migration caution |
|---|---|---|---|
| `blue_essential` | Personal, no badge; recovery/impersonation features, edit/fewer ads | Map to Free safety baseline plus a temporary grandfathered paid benefit bundle or explicit Blue Basic cohort only after commercial/product mapping approval | First move account safety/recovery to Free; preserve paid-through promised benefits; do not silently grant/revoke Blue badge |
| `blue` | Personal Blue verification plan | Legacy alias for Blue Basic only if its feature/price terms match; otherwise keep as grandfathered Blue plan | Preserve badge approval independently; retain price and renewal SKU |
| `premium` | Personal Premium/Blue and higher features | Legacy alias for Blue Premium | Preserve 5-profile and renewal benefits while reconciling unsupported boost/support promises |
| `gold_only` | Gold checkmark without explicit seller tier | Legacy Gold Basic candidate | Verify current seller access and active price before mapping |
| `seller_pro` | Gold plus seller `pro` entitlement | Gold Basic or grandfathered seller entitlement candidate; never infer from name alone | Current resolver grants Pro; preserve those capabilities until explicit replacement/migration decision |
| `seller_business` | Gold plus seller `business` entitlement | Gold Premium candidate; new canonical plan should imply the existing Business seller capability | Preserve 25 seats/10 locations/730 analytics as enforced, not conflicting catalogue copy; no second seller purchase |
| `gold_combined` | Personal account subscription with covered business profiles | Bundle/coverage construct, not a verification color/tier | Preserve coverage rows and ownership; do not convert into one profile plan without mapping each covered store and subscription periods |
| `black` | Government/official plan, non-self-serve in catalogue | Black Government after manual approval and a separate paid subscription state | Preserve current approval, renewal and paid-through status; keep annual disabled unless approved |

This is a candidate compatibility map, not a bulk SQL update. Individual records with unusual history must be classified from subscription, coverage, verification, price and transaction records.

## Data invariants

- Never delete or rewrite payment/refund/chargeback/provider event history, receipt tokens, original SKU, price/currency, tax, interval, accepted quote, billing dates, cancellation state or audit events.
- Keep legacy `plan_code` and `price_version` on historical subscription periods. If adding canonical codes, use new identifiers/version columns or an append-only mapping table; do not update financial history in place.
- Paid-through entitlement cannot be shortened during migration. A failed or ambiguous mapping is grandfathered with current effective benefits and queued for manual review.
- Verification records remain distinct from plan purchases; new tier cannot create verification approval. Black application records retain their original evidence and two-person decisions.
- Entitlement resolver must apply active dates, cancellation-at-period-end, grace, paid-through, refund/chargeback and account/profile ownership consistently across API services.
- Seller plan is an entitlement derived from commercial plan, legacy seller subscription or independent approved exception. Gold Premium’s integrated seller benefits must not require a second bill.

## Phased rollout and rollback

### 0. Baseline and evidence

1. Snapshot/restore test database; produce counts by legacy code/status/profile/interval/currency/channel; include paid-through, renewal SKU, store token presence, coverage profiles, sellerPlan and verification approval.
2. Compare every existing plan/copy/mock/price source with authoritative `plan_prices` and provider store products. Read production only through an approved read-only access path; do not claim source defaults are live prices.
3. Define expected old-to-new entitlement snapshots and classify ambiguous records for grandfathering.

### 1. Expand schema/code safely

1. Add canonical plan registry and effective-dated, append-only price versions alongside legacy codes; old readers continue working. Add backfill/audit status and source metadata. Make migration additive and reversible; do not touch active subscription rows.
2. Add dual-read entitlement mapping in one release, with metrics for unknown/ambiguous codes. Checkout still creates legacy plan identifiers until new rows/prices are reviewed.
3. Test migration up/down on a copy of a production-like snapshot and validate counts, indices, FK and uniqueness, no paid-through loss, and idempotent rerun.

### 2. Backfill shadow data

1. Compute proposed canonical mapping in a dry-run report only. Store mapping records with source legacy ID, target canonical code, mapping rule version, reviewer and outcome.
2. Backfill shadow associations/price references in bounded batches, idempotently and without changing financial history. Compare pre/post entitlements per account and profile.
3. Route unknown records to manual review. Rollback is to disable canonical read flag; original rows remain intact.

### 3. Switch new purchases and features

1. After founder confirms unresolved prices/discount interpretation and operators approve store fee schedules, enable only approved canonical plan prices.
2. Route new web/store purchases to canonical plans with new immutable product identifiers where store policies require. Existing receipts stay bound to their original SKU and grandfathering rules.
3. Enable paid scheduling only after social service gets authoritative fail-closed entitlement data and tests; keep already accepted schedules on expiry.
4. Enable Black checkout only after separate price/provider approval, manual-vetting integration, token invitation and webhook evidence. Black annual remains disabled.

### 4. Retire old purchase paths

1. Stop offering old plan codes to new customers; continue renewal recognition or provider-specific migration only when legally/store-policy safe.
2. Keep compatibility reads for at least the maximum active billing/restore/refund window, plus the agreed rollback window. Retain immutable data for statutory/financial retention.
3. Remove legacy catalogue UI only after zero active/renewable records or a verified compatibility mechanism exists. Never delete legacy codes from receipt verification while a subscriber may restore/renew.

## Acceptance and rollback gates

- Snapshot and restore succeeds; no migration applies to live data in this implementation task.
- Per-account and per-profile entitlement diff has zero unexplained reductions; exceptions are signed off and grandfathered.
- Subscription count/payment/refund/provider-token/price-history counts reconcile exactly.
- Store restore/renewal tests pass for Apple and Google; provider webhooks remain idempotent.
- Seller Free/Pro/Business capacities and Gold Premium capabilities match expected access before/after.
- Rollback flag restores legacy reads without deleting canonical audit rows or changing already accepted scheduling posts.
- Audit logs capture actor, batch, rule version and errors; batch process is resumable and safe under retries.

