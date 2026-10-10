# Requirements traceability (4 Oct 2026)

Static read of the tree (rg and sed only; no builds, tests or docker were run). "done" means code and a test or doc exist at the cited path; it is not a runtime verification. Sources: `docs/plans.md`, `backendPlan.md`, `pricing.md`, `checkoutPaymentFlowPlan.md`, `CHANGELOG.md`, owner memory rules. Items marked VERIFY were not found by a quick search and need a human or the QA agent to confirm.

## Top 15 gaps

1. Renewals still charge the full plan price after a checkmark rejection (no checkmark-less price). plans.md 53.6. Owned by the billing agent.
2. Tagged people on posts and clips: mock UI only, no table, migration or API (plans.md 52).
3. Native in-app purchase on the apps is not built; "Buy now" opens the web checkout (53.6).
4. ~~Escrow 24h payout lock~~ corrected: implemented as `SELLER_CREDIT_HOLD_PERIOD` (default 24h) in `services/go/modules/escrow/src/configs/escrow.config.go`, applied as `AvailableAt` in `escrowHolding.service.go` and `escrowChargebacks.service.go`; covered by the escrow harness integration test.
5. Smile ID: live document `id_type` codes per country and Play `fullRefund` context are unconfirmed against live APIs; consent text needs legal review (NDPA).
6. Apple and Google checkmark-share refunds are manual flags (no partial refund API wired).
7. Refund after a renewal uses `billing_reference` (first charge), not the latest charge (53.6).
8. Seller-fault direct-share clawback: whether Paystack reverses a subaccount share on refund is UNCONFIRMED; handled as seller debt.
9. Under-18 hiding of sensitive content: only a search hydrator field was found; confirm the feed filter in social (VERIFY).
10. Copyright strikes: moderation has audio match advisory and strike code but the end-to-end strike ladder was not traced (VERIFY).
11. Rekognition live safety exists only in Python intelligence; live ingest and go-live are still mock (plans.md 8, 18).
12. Backend for most feature sections (13 to 52) is "mock UI" for mobile and webapp; gateway wiring is partial (see frontendWiring.md).
13. Comments rule: cleaned on 5 Oct (108 files); only directives and the copyright legal notice remain.
14. Emoji rule: remaining emoji literals are user content (reaction pickers, emoji keyboard, mocks); stray scripts `m1.py`, `m2.py` deleted.
15. The old monolith was legacy (Prisma) with type errors; it was removed on 2026-10-10 after its live features were ported.

## Payments

| Rule | Status | Where | Gap |
|---|---|---|---|
| Paystack only | done | `docs/checkoutPaymentFlowPlan.md` s1, `services/go/modules/payments/src/modules/gateway`, `docs/integrations/paystack.md` | Bachs removal documented; confirm no leftover Bachs files (VERIFY) |
| 0% product commission | done | `checkoutPaymentFlowPlan.md` 2.2, `payments/src/configs/payments.config.go` | none |
| Escrow 1.5% / 1% Business | done | `payments.config.go` (`ESCROW_FEE_BPS` 150, `ESCROW_FEE_BUSINESS_PLAN_BPS` 100), `escrow/src/configs/escrow.config.go` | Two env readers for the same value; keep in sync |
| Paystack fee paid by seller as a separate line | partial | `payments/.../paymentSettlement.service.go`, `docs/architecture/payments.md` 4.2 | Escrow-side deduction of the Paystack fee is an assumption pending owner confirmation |
| Unverified = escrow only | done | `checkoutPaymentFlowPlan.md` s1, orders and payments checkout code | VERIFY server-side enforcement test |
| Escrow auto-release 3 days after delivery | done | `escrow/src/configs/escrow.config.go`, `modules/disputes` pauses timer | none |
| 24h lock before payout | done | `escrow/src/configs/escrow.config.go` (`SELLER_CREDIT_HOLD_PERIOD`), `escrowHolding.service.go` | none |
| One payment per checkout | done | `checkoutPaymentFlowPlan.md` 6.1, `database/schema.md` G6 | none |
| USD fallback | done | `services/go/platform/regionpricing/regionPricing.region.go` | none |
| Regional prices | done | `regionpricing/*`, `docs/pricing.md`, admin regional pricing | Rows editable in admin; seed values only |
| Per-country seller prices, hide unshippable | done | `catalog/src/services/regionalPricing.service.go`, `regionAvailability.service.go`, plans.md 45 | Search and social filter wiring VERIFY |
| Money as int64 minor units | done | `amountMinor` throughout; `services/go/platform/money` | none found |

## Checkmarks and plans

| Rule | Status | Where | Gap |
|---|---|---|---|
| Blue/Gold/Black tiers | done | `subscriptions/src/constants/plans.constant.go`, `pricing.md` s2 | none |
| Seller Pro N5,000, Business N15,000 | done | `pricing.md`, `regionpricing/regionPricing.plans.go` | none |
| Blue+Gold bundle 15%, yearly 20% | done | `subscriptions/src/loaders/subscriptionRules.loader.go`, `pricing.md` 2.1 | Bundle never stacks with yearly: confirm test (VERIFY) |
| Smile ID verification | done (mock-tested) | `users/src/integrations/smileId.integration.go`, `users/src/modules/identityVerification`, `docs/integrations/smileId.md` | Live id_type codes unconfirmed |
| Reject refund | partial | `subscriptions/.../verificationRefunds.service.go`, `checkmarkShare.service.go`, `payments.checkmarkShareRefund_integration_test.go` | Stores manual; renewals; latest-charge refund |
| Trials with N50 card check, refunded | done | `regionpricing/regionPricing.cardVerification.go`, `payments.cardVerificationRefund_integration_test.go` | none |

## Feed and social

| Rule | Status | Where | Gap |
|---|---|---|---|
| Creator is a status, not a profile | done | `users/src/types/profileView.type.go` (`creatorStatus`) | none |
| Capped, disclosed boosts | done | `social/src/constants/ranking.constant.ts`, `rankedFeed.service.ts`, plans.md 46 | Cap values admin-configurable? VERIFY |
| X-style Explore | done (mock UI) | `social/src/configs/social.config.ts`, plans.md 46 | Production ranking data not wired |
| Guests view-only | done | `gateway/src/routes/upstream.routes.ts`, plans.md 28, 41 | none |
| Sensitive interstitial + under-18 hiding | partial | `social/src/jobs/contentEvents.job.ts`, plans.md 42 | Under-18 filter not confirmed |
| Copyright strikes | partial | `moderation/src/integrations/audioMatchAdvisor.integration.go`, plans.md 49 | Strike ladder VERIFY |
| Abuse detection with Turnstile, no auto-delete | done | `gateway/src/services/security/*`, `moderation/.../securityCase.schema.go` (auto_suspended only), plans.md 48 | none |
| Live safety with Rekognition | partial | `services/python/intelligence/src/modules/live_safety/services/rekognition_image_moderation_model_service.py`, `live_host_restrictions` | Live ingest is mock |
| 30-day deletion grace | done | `users/src/configs/privacy.config.go`, `deletionGraceCancel.service.go` | none |
| Birthday balloons / Zudoversary email | done | `users/src/utils/celebrations.util.go`, `celebrationSetting.schema.go`, plans.md 47 | none |
| Help centre auto-FAQ | done | `services/typescript/support/src`, plans.md 44 | none |

## Emails

| Rule | Status | Where | Gap |
|---|---|---|---|
| No social links in footers | done | `packages/emailTemplates/src` (no social network names found) | none |
| Official store badges | done | `packages/emailTemplates/assets/storeBadges`, `NOTICE.md` | none |
| Domain emails | done | `docs/emailAddresses.md`, `packages/emailTemplates/src/config/emailSenders.config.ts` | DNS and SES setup is owner work |
| Unbranded sample photos | done 4 Oct | `packages/emailTemplates/src/samples/sampleData.ts` and previews now use neutral placeholders | Headphones, watch, perfume and camera still Unsplash; confirm unbranded |

## Newest features

| Rule | Status | Where | Gap |
|---|---|---|---|
| Composer UX | done (mock UI) | `apps/mobile/src/components/create/*`, plans.md 51 | Backend pending |
| Clickable URLs + in-app browser | done | `apps/mobile/src/services/webHandoff.service.ts`, plans.md 51 | none |
| Tagging display | partial | plans.md 52 | No backend table |
| Clip counts | done (mock UI) | plans.md 52 | Backend pending |
| Username suggestions | done | plans.md 50, `users/.../usernames` | none |

## Code rules (scan results)

- No comments: done. Full-line comments removed across `services/` and `apps/` (generated code excluded); kept `//go:generate`, eslint/stylelint directives, `// Legal wording pending counsel review` in `copyrightLegal.constant.ts`. Status: done.
- Files over 300 lines: none in backend. Frontend remaining: `apps/webapp/src/app/(auth)/signup/page.tsx` 309, `apps/mobile/src/services/mediaUploadQueue.service.ts` 305 (not split). `models.type.ts` and `social.type.ts` were split below 300. Generated `.pb.go`/`_pb.ts` excluded.
- No emoji icons: UI emoji replaced earlier with icon components; remaining literals are user content (`MESSAGE_REACTION_EMOJI`, `QUICK_REACTION_EMOJI`, `LIVE_REACTION_EMOJI`, composer emoji keyboard, `live.sendReaction`, mock emitter text). Status: done.
- Money as int64 minor units: done (`amountMinor`, `*_minor` bigint columns); VERIFY no float in `apps/*` price math.
