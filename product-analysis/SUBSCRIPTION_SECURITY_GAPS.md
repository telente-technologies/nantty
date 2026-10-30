# Subscription security and entitlement gaps

Audit date: 2026-10-29. Source review only; no runtime exploit testing performed.

## Positive controls found

- Checkout and plan changes are server APIs; prices are resolved from persisted active `plan_prices`, not trusted from browser amounts.
- Plan definitions constrain profile types; Black is not self-serve and catalogue logic prevents enabling its purchase.
- Verification/application routes and admin review are backend-backed.
- Internal entitlement endpoint is token-protected; seller-plan resolver returns Free on fetch failure in production, and paid cache duration is bounded (currently up to one minute).
- Premium linked-profile count is checked server-side; the one-store invariant is separate.
- Creator fan subscription access checks membership status and period end in model logic.

## Gaps or reconciliation items

| Issue | Evidence | Risk / follow-up |
|---|---|---|
| Paid scheduling is implemented but lifecycle coverage remains incomplete | `services/typescript/social/src/modules/posts/commands/createPost/createPost.handler.ts` enforces `canSchedulePosts` server-side; scheduled-post routes enforce author ownership and the 90-day horizon | Existing implementation covers the principal creation gate, but audit entitlement expiry, reschedule authorization/gating, accepted scheduled posts after expiry, publication moderation/retries, cancellation races, pagination, and DB-backed cross-account cases before launch. |
| Plan sources disagree | Subscription plan catalogue, admin mocks, sellerplan resolver and help pages have distinct names/perks/limits | A feature may be displayed as included but enforced differently, or vice versa. Establish a canonical versioned entitlement registry. |
| Existing revenue settings may retain a superseded fee | Fresh-install `configurationDocuments.service.go` default was changed to 0 bps for standard and Business; the payment environment fallback is also zero. Previously seeded database settings are not automatically overwritten and may still hold 150/100 bps. | Inspect the effective settings in staging and update them through an audited admin action before launch. Verify checkout/ledger fee allocation and all public disclosures; no live or existing DB was read in this audit. |
| Mock prices are not authoritative | Admin `peopleVerifications.mock.ts` has NGN Blue 2,500/5,000/12,000 and Gold Pro/Business 45,000/120,000, versus current source defaults 1,000/2,500/20,000 and Gold Pro/Business 5,000/30,000 | Demo/admin mock could display inaccurate pricing. Reconcile the mock with the canonical API instead of treating it as a price source. |
| Gold caps conflict | Plan catalogue: Pro 3 seats/1 location; Business 15 seats/10; sellerplans: Pro 5/3; Business 25/10. Support pages also differ. | Avoid presenting limits as product promise until canonical source and enforcement are reconciled. |
| Price table active values not queried | Database-backed `plan_prices`; staff can update | Repository defaults do not establish live price. Verify using authorized staging/runtime read-only endpoint before launch. |
| Entitlement lifecycle states | Subscription `LiveStatuses` includes trialing, active, past_due, grace; entitlement and lifecycle job interaction not dynamically exercised | Verify grace/past_due policy, cancellation at period-end, delayed jobs, refunds/chargebacks, stale caches and receipt/webhook replay. |
| Annual/bundle discounts | Source default annual discount is 20%; old help/billing proposals include 15% bundle and other multi-business rules, while current combo proposal is pending confirmation | Validate effective server quote, ownership scope and single-discount stacking. Do not promise an unconfigured bundle. |
| Gold bundle semantics | `gold_combined` is personal account code mapped to Gold bundle, while Gold checkmark plans also grant seller tiers | Cross-profile ownership, number of covered businesses, renewal/partial cancellation and profile removal need explicit tests. |
| API/webhook entitlement not backed by located public surface | `api_webhooks` feature gate exists but no public developer API/key route located | Do not sell this entitlement until it is implemented and tested, or mark clearly as unavailable. |
| Development-only permissive seller resolver | `AllowAll` when URL absent outside production | Ensure production config validation catches missing URL; never reuse dev config in a production deployment. |

## Required verification before launch

1. Build synthetic-account tests for each profile/plan/status, plus cross-account access attempts.
2. Read the actual staging `plan_prices` and compare web/mobile client displays; never infer production values from seed.
3. Verify expired, canceled, past_due and grace statuses at API boundaries, including cache invalidation and cross-service cache TTL.
4. Verify upgrade/downgrade side effects, refunds, Apple/Google receipt authority, payment webhooks and idempotency.
5. Verify Gold bundle membership and Premium five-profile checks under concurrent changes.
6. Verify every promised perk via server enforcement; remove or relabel mock/docs-only perks.
7. Resolve fee-policy contradiction before marketing/subscription release.
