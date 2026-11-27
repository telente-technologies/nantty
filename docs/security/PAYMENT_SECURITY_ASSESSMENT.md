# Nantty Payment, Ledger, Escrow & Subscription Security Assessment

## Coin price selection update — 2026-11-27

The country-specific coin package change keeps price selection server-side. Package discovery resolves an account/profile or trusted proxy country; checkout independently resolves the charge country and records the chosen amount/currency on the payment intent and purchase. Country override keys are validated against supported country/currency pairs and cannot override a different region's currency. Admin inputs are normalized to uppercase currency/ISO country codes, and duplicate aliases are rejected before persistence so Go map iteration cannot select an arbitrary value. The existing currency and USD fallback remains available. Idempotency binds the purchase request to country and currency, preventing replay under a changed region from silently reusing a different-priced purchase. StoreKit and Play Billing remain authoritative for app-store localized prices; a server-side amount or client callback is not proof of settlement. Focused local tests do not constitute live provider or native-store verification.

Mobile coin StoreKit/Play Billing follow-up: the app now requests the store's localized product display price and submits completed purchase receipt data to the authenticated Wallet receipt endpoint. It acknowledges/finishes the consumable only after the backend reports successful authoritative verification. Client-side tests verify this ordering, but do not validate live Apple/Google credentials, storefront configuration, account-intent binding, pending-purchase restart recovery, or refund notification behavior. Do not represent the store purchase path as end-to-end verified until those are exercised and the remaining recovery/binding gaps are addressed.

- **Scope**: `services/go/modules/{ledger,payments,wallet,subscriptions,escrow,creators}` (`goMoney`), `services/go/modules/orders` (`goCommerce`), `services/go/modules/ads` (`goAds`), `services/go/modules/users` (`checkmarks`), and client billing surfaces (`webapp`, `mobile`, `ads`, `seller`, `admin`).
- **Verification Basis**: White-box Go/TS code review + frontend/gateway contract suites. **Go test execution, live PostgreSQL concurrency stress tests, and live PSP/Apple/Google sandboxes could not execute in this environment (`go`, PostgreSQL, and PSP credentials absent).**

## Verification correction — 2026-11-27

The dated environment limitation above is historical and no longer describes this checkout: Go and isolated PostgreSQL 17 are available. Full Go test suites for Users, Admin, Wallet and Ads passed against the isolated test database; the Ads suite now includes concurrent settlement exact-once assertions. Frontend Admin/Webapp/Mobile/Studio typechecks and the relevant contract/creator tests also passed. These local tests do **not** verify live Flutterwave/Apple/Google transactions, app-store revocation notifications, a production payout provider, deployed database grants, or AWS staging. Coin purchase/refund completion, creator payout cadence, and advertiser-to-creator reserve/refund reconciliation remain partial or externally blocked. Exact commands and boundaries are recorded in `docs/integration/NANTTY_VERIFICATION_AND_TEST_EVIDENCE.md`.

---

## 1. Financial Invariants & Control Review

| Domain | Control Verified in Code | Risk / Gap Status |
| --- | --- | --- |
| **Double-Entry Ledger & Concurrency** | Ledger postings balance debits/credits; checkout (`checkout.service.go`), stock reservations, wallet debits, and account deletion use PostgreSQL transactions with row-level `ForUpdate()` locks. | Static verified; concurrent race tests require Go + PostgreSQL CI run. |
| **Server-Authoritative Pricing** | Order checkout, ad boost pricing, subscription checkouts, and Black Government billing compute prices strictly server-side; client price tampering cannot alter settlement amounts. | Verified in Go services (`checkout.service.go`, `blackGovernmentBilling.service.go`). |
| **Idempotency & Replay Prevention** | Gateway & BFFs forward `Idempotency-Key`; payment webhooks persist `SHA-256` payload digest + `(provider, event_key)` uniqueness in `webhook_events` (`webhookProcessing.service.go`) before claiming & processing. | Static verified; `SEC-2026-002` fixed IAP `OriginalTransactionId` replay/rebind. |
| **Flutterwave Webhook & Card Security** | `webhooks.controller.go` enforces `1 MiB` `MaxBytesReader`; `HandleProviderWebhook` verifies provider signature before DB storage and redacts reusable card secrets (`utils.RedactReusableCardSecrets(rawBody)`). Amount mismatches route to `webhookNeedsFinanceReview` instead of crediting blindly. | Static verified; live Flutterwave sandbox unverified (`SEC-0012`). |
| **Apple App Store & Google Play IAP** | Apple JWS verifies certificate chain/OID/ES256; Google Play verifies push token / RS256 OIDC; `SEC-2026-002` binds `RedeemStoreSubscription` to `OwnerUserID` and `ProfileID`. | Fixed in code (`storeSubscriptionsSecurity_integration_test.go` awaits Go CI). |
| **Escrow & Seller Reserves** | Escrow transitions (`held -> released \| refunded \| disputed \| partiallyRefunded`) require `X-Internal-Token` or staff permission + single-use step-up (`PAR-015` `DELETE /admin/wallet/seller-reserves/:id` marked `sensitive`). | Verified in `apps/admin` (`82/82` non-CSS contract tests) + Go route/permission catalog. |
| **Creator Tiers (`GIFTING_EXCLUDED`)** | Preserves approved scope: creator subscriptions and payouts are enforced; gifting remains excluded per master specification. | Confirmed. |

---

## 2. Black Government Private Billing & Policy Verification

Aligned with the latest approved founder policy:
- **Private Eligibility & Hidden Pricing**: Government Black pricing/checkout is **never** exposed in public plan tables (`apps/admin/src/contracts/blackGovernmentContracts.test.ts` verifies zero unpaid Black grace days and USD-only monthly-only pricing).
- **Pricing**: **USD 300/month** for verified Nigeria (`NG`) legal jurisdiction; **USD 500/month** for verified non-NG jurisdictions; **annual billing disabled**; **discounts disabled** (`ErrBlackDiscountsDisabled`).
- **Manual Review & Checkout Authorization**: Requires manually approved Black verification, verified institutional email (`SendBlackInstitutionalEmailOtp` / `VerifyBlackInstitutionalEmail`, `SEC-0027` sealed OTP), and staff-issued time-bounded `PrivateCheckoutEnabled` window (`UpdateBlackCheckoutAuthorization`).
- **Card Removal Auto-Pause & Settlement Fail-Closed (`SEC-2026-001`)**: Removing the recurring USD card immediately auto-pauses entitlement; delayed/late webhook settlement (`renewalSettlement.service.go`) now fails closed if verification is missing, unapproved, revoked, or institutional email is unverified.

---

## 3. Environment & Runtime Verification Limits

> **Honesty Guardrail**: No payment flow is claimed "verified end-to-end against live PSPs" here. Full Go unit/integration tests (`services/go/deployables/flutterwaveFlows/tests/...`, `services/go/modules/subscriptions/...`) and PostgreSQL snapshot/race checks (`security/database/moneySnapshot*.sh`) **must** pass in CI/staging with real DB + sandbox PSP credentials before launch.
