# Black government verification

> **Updated 2026-11-16 (owner-approved pricing; implementation remains incomplete):** Black Government is intended to be a paid, manually approved, web-only, monthly-only, USD-only subscription with mandatory recurring card authorization and no discounts or annual billing:
> - **Nigeria:** **USD 300/month** (`30000` minor USD) based on verified legal jurisdiction (`NG`).
> - **International (all non-NG jurisdictions):** **USD 500/month** (`50000` minor USD) based on verified legal jurisdiction.
> - **Zero unpaid grace period:** `BlackGraceDays = 0` (`GracePeriodEligible: false`). Removing a recurring card pauses entitlement immediately (`StatusPaused` / `entitlement.paused`). Failed renewals never extend the badge unpaid beyond paid coverage.
> - Authorized monetization administrators may change a regional monthly price through an audited, effective-dated price version with a required reason. Existing subscription terms and price history must remain unchanged.

Current source (`services/go/modules/subscriptions`, `services/go/modules/users`, `services/go/modules/payments`): `black` maps exclusively to `government` profiles, disables public self-serve checkout (`SelfServe: false`, `AnnualDisabled: true`, `DiscountsDisabled: true`, `GracePeriodEligible: false`), and keeps `AdLoadPercent: 20`.

## Product rules and implementation status

The price decision is approved. This does not mean the full verification and billing journey is implemented: OTP email delivery, a single-use private checkout invitation, provider-specific recurring USD capability, and end-to-end payment lifecycle verification remain incomplete.

- Intended policy: keep Black as one government verification category with a single Black badge color. Verification (`users.black_applications`) and commercial billing (`subscriptions`) are strictly separated. The current implementation has review/approval and checkout-state fields, but the complete two-admin approval, verified institutional email OTP, private single-use checkout authorization, recurring-card authorization, and payment-gated badge lifecycle are not yet verified end to end.
- Required policy: institutional email 6-digit OTP verification (`black_institutional_email_otps`) must precede admin approval (`INSTITUTIONAL_EMAIL_NOT_VERIFIED`). Email OTP verifies mailbox control only and never grants approval. Current OTP issuance is not connected to secure email delivery, so this requirement is incomplete.
- Keep public self-serve checkout and offer-link discounts disabled for `black`. Private checkout (`/api/v1/verification/black/checkout`) resolves price strictly from verified `black_applications.jurisdiction_country_code` (never IP/headers), requires recurring disclosures (`termsAccepted` + `recurringConsent`), and verifies Flutterwave USD recurring card capability (`SupportsRecurringCardCurrency("USD")`).
- Deleting or revoking the saved card authorization (`DELETE /api/v1/payments/saved-cards/{authorizationId}`) fires `BillingAuthorizationRevokedObserver`, immediately pausing the Black subscription (`status = 'paused'`) and emitting `entitlement.paused` (`StatusSuspended`, badge hidden).
- Supports re-verification triggers (`require-reverification`), written appeals (`black_verification_appeals`), and admin Black billing controls (`pause`, `cancel`, `retry`, `reconcile`).
