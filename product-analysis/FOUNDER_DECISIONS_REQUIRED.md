# Founder decisions required

> **Updated 2026-10-29:** The founder has set the plan taxonomy and major entitlements in the restructuring brief. Items below are narrowed to unresolved conflicts or operational confirmation; see the final subscription and pricing specs.

No changes were implemented. Decisions below unblock the entitlement/pricing design.

## Product model

1. **Resolved 2026-10-29:** Gold Premium Nigeria web monthly price is ₦30,000 (supersedes ₦17,000 working assumption). Existing active database rows still require an effective-dated admin price change; this confirmation alone does not reprice subscribers.
2. **Resolved 2026-11-16 (Founder Decision):** Black Government monthly price is **USD 300/month** for verified Nigeria (`NG`) legal jurisdiction and **USD 500/month** for all non-Nigeria international jurisdictions. Annual billing and discounts are permanently disabled; web-only; mandatory recurring USD card; `BlackGraceDays = 0`.
3. Confirm Blue + Gold combo discount interpretation: 10% off combined subtotal, or a discount amount equal to 10% of only the more expensive plan. Also confirm whether it can combine with the annual reduction; default remains no stacking until specified.
4. Confirm ad-load percentages mean a percentage of normal inventory (Blue Basic 60%, Gold Basic 50%, Black 20%), rather than “percent reduced.”
5. Confirm a priority-support response target only if a staffed operating SLA will exist.
6. **Resolved 2026-11-16:** Black annual billing is disabled (`AnnualDisabled: true`, `WebYearlyMinor: 0`); Flutterwave USD card tokenization (`"USD": "card"`) is enabled with live recurring-currency capability verification (`SupportsRecurringCardCurrency("USD")`) before checkout/card replacement. Production Flutterwave merchant USD settlement credentials remain an operational environment check.

## Pricing and billing

6. Which price source is authoritative at launch: backend `plan_prices`, admin seed, or product/help content? Active runtime DB must be queried read-only before approval.
7. Confirm currency/platform pricing matrix and whether app-store prices intentionally exceed web prices.
8. Annual discount default is 20%; future changes use the pricing approval process. Combo discount remains inactive pending item 3.
9. Fee policy is resolved by the founder: no sales commission; actual Flutterwave processing and withdrawal fees are passed through at cost. Before staging, verify and audit-update any persisted `revenue` platform setting that still contains the superseded 150/100-bps escrow fee defaults.
10. Black’s seeded regional price exists even though it is non-purchasable. Confirm removal from all user-visible price pages and whether any internal non-chargeable plan row is needed.

## Verification and entitlement

11. Approve operational verification criteria and re-review cadence for Blue, Gold and government identity separately from payment.
12. Confirm Black policy for failed renewal, grace, cancellation, refund/chargeback, revocation and appeal; preserve verification and billing as separate states.
13. Confirm bundle account/profile binding: the personal Blue subscriber and exact Gold business profiles covered, preserving the one-owned-store rule.
14. Creator Program approval and creator fan subscriptions remain separate from paid Blue plans unless explicitly changed.

## Product gaps

17. Decide whether public Developer API/webhooks should be launched; current plan/help copy mentions it, but the public API surface was not found.
18. Scheduled post content/media editing, cursor listing, retries/backoff and publication-time moderation are implementation requirements from the new brief; no additional policy choice is blocking design.
