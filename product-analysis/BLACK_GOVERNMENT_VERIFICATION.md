# Black government verification

> **Updated 2026-11-16 (Founder Decision finalized & implemented):** Black Government is a paid, manually approved, web-only, monthly-only, USD-only subscription with mandatory recurring card authorization and no discounts or annual billing:
> - **Nigeria:** **USD 300/month** (`30000` minor USD) based on verified legal jurisdiction (`NG`).
> - **International (all non-NG jurisdictions):** **USD 500/month** (`50000` minor USD) based on verified legal jurisdiction.
> - **Zero unpaid grace period:** `BlackGraceDays = 0` (`GracePeriodEligible: false`). Removing a recurring card pauses entitlement immediately (`StatusPaused` / `entitlement.paused`). Failed renewals never extend the badge unpaid beyond paid coverage.

Current source (`services/go/modules/subscriptions`, `services/go/modules/users`, `services/go/modules/payments`): `black` maps exclusively to `government` profiles, disables public self-serve checkout (`SelfServe: false`, `AnnualDisabled: true`, `DiscountsDisabled: true`, `GracePeriodEligible: false`), and keeps `AdLoadPercent: 20`.

## Implemented architecture and verification policy

- Keep Black as one government verification category with a single Black badge color. Verification (`users.black_applications`) and commercial billing (`subscriptions`) are strictly separated: two-admin approval + verified institutional email OTP reserves the handle and authorizes time-limited private USD checkout (`private_checkout_enabled`, 14-day default window), while the Black badge (`ProfileCheckmark`) remains hidden until server-verified USD payment with a reusable recurring card authorization (`entitlement.granted`).
- Enforce institutional email 6-digit OTP verification (`black_institutional_email_otps`) before admin approval (`INSTITUTIONAL_EMAIL_NOT_VERIFIED`). Email OTP verifies domain control only and never grants approval.
- Keep public self-serve checkout and offer-link discounts disabled for `black`. Private checkout (`/api/v1/verification/black/checkout`) resolves price strictly from verified `black_applications.jurisdiction_country_code` (never IP/headers), requires recurring disclosures (`termsAccepted` + `recurringConsent`), and verifies Flutterwave USD recurring card capability (`SupportsRecurringCardCurrency("USD")`).
- Deleting or revoking the saved card authorization (`DELETE /api/v1/payments/saved-cards/{authorizationId}`) fires `BillingAuthorizationRevokedObserver`, immediately pausing the Black subscription (`status = 'paused'`) and emitting `entitlement.paused` (`StatusSuspended`, badge hidden).
- Supports re-verification triggers (`require-reverification`), written appeals (`black_verification_appeals`), and admin Black billing controls (`pause`, `cancel`, `retry`, `reconcile`).
