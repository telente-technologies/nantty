# Pricing recommendations

> **Updated 2026-10-29:** The current restructuring brief supersedes earlier plan-count and Black pricing recommendations. See [FINAL_SUBSCRIPTION_SPEC.md](FINAL_SUBSCRIPTION_SPEC.md) and [PRICING_DECISIONS_PENDING.md](PRICING_DECISIONS_PENDING.md).

These are product recommendations, not approved amounts.

## Simplify first

1. Use four commercial plans: Blue Basic, Blue Premium, Gold Basic and Gold Premium. Retire Blue Essential only after moving essential security/recovery benefits to Free and preserving existing paid agreements.
2. Black Government is a paid, manually approved, web-only subscription. Keep self-serve checkout disabled; USD 300/month vs USD 500/month remains unresolved, and annual billing requires separate approval.
3. Gold Premium includes existing Business seller workspace entitlements without a second seller subscription; preserve seller Free access and migrate legacy plans safely.
4. Maintain one canonical price table served by backend and consumed by every client; mocks must not contain alternate prices in production-facing views.

## What should remain free

Core account access, recovery, privacy/security controls, reporting/appeals, basic social participation, legal disclosures, baseline store operations, payment protection and accurate transaction records. Charge for additional capacity/analytics/automation, not for safeguards or the truthfulness of identity claims.

## Revenue policy is confirmed; persisted settings need verification

The founder has resolved fees: no sales commission; actual Flutterwave processing and withdrawal costs pass through at cost. The fresh-install platform-settings default is now zero escrow fee. Existing database settings may retain the superseded 150/100-bps fee and must be read and corrected through an audited admin change before staging/launch. Keep checkout, receipts and terms aligned to the effective setting.

## Working founder prices and unresolved values

Current intended Nigeria web prices are Blue Basic ₦2,500, Blue Premium ₦20,000, Gold Basic ₦5,000 and Gold Premium ₦30,000 monthly. The founder confirmed the Gold Premium amount on 2026-10-29. Black remains USD 300 vs USD 500 pending confirmation. The Gold Premium fresh-install source default now reflects ₦30,000; deployed database rows are not automatically overwritten, and historical/active subscribers are not repriced. Legacy regional defaults remain migration evidence unless explicitly updated. App-store and web prices must be separately calculated/approved with account-specific fee schedules, taxes and supported price points. Never invent FX or reprice existing subscribers without required notice/consent/provider handling.

## Discount governance

The 20% annual discount remains a configurable default. Proposed Blue + Gold bundle discount is 10%, but whether this means 10% off the combined subtotal or a discount amount equal to 10% of only the more expensive plan is unresolved. Do not activate or stack it until confirmed. Preserve legacy bundle agreements and bind bundle coverage to explicit account/profile ownership.
