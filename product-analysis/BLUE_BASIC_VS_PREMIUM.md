# Blue Basic vs Blue Premium

> **Updated 2026-10-29:** Earlier queue-count suggestions are superseded by [FINAL_SUBSCRIPTION_SPEC.md](FINAL_SUBSCRIPTION_SPEC.md): all four commercial plans get unlimited accepted scheduled posts with a 90-day horizon. Nigeria working web prices are ₦2,500/month for Blue Basic and ₦20,000/month for Blue Premium; app-store amounts are configured separately.

Proposal for the individual subscription family. Both tiers should display the same Blue checkmark. Verification approval must remain separate from payment; buying Premium must not bypass identity, trust, moderation, or safety rules.

| Benefit | Free Individual | Blue Basic (proposed) | Blue Premium (proposed) |
|---|---|---|---|
| Core account safety, recovery and privacy | Full access | Full access | Full access |
| Blue checkmark | None | Blue after identity/trust approval | Same Blue badge and review standard |
| Ads | Standard load | Reduced load; current repository default is 60% of normal | Ad-free recommendation; define whether creator promotions and sponsored content count |
| Post scheduling | Capability currently exists without a subscription gate | Paid entitlement; unlimited accepted queue; maximum 90 days ahead | Paid entitlement; unlimited accepted queue; maximum 90 days ahead |
| Analytics | Basic post statistics | Basic statistics and modest history | Advanced audience/content trends, exports and longer history |
| Post editing / clip limits | Standard product policy | Consider existing longer-edit/clip benefits only if verified and enforced | Higher content-management allowance only if backed by server entitlements |
| Linked business profiles | Current baseline is 2 linked profiles; one-store ownership remains a separate rule | Same as Free unless explicitly approved | Up to 5 linked business profiles; one owned-store invariant remains |
| Boost credit | None | None | Monthly credit only after cost and abuse controls are approved |
| Creator Studio, Live and Spaces hosting | Requires Creator Program approval where applicable | Still requires approval | Still requires approval; subscription cannot bypass it |
| Support | Standard support and appeals | Standard support and appeals | Optional faster response target, never preferential safety or payment decisions |

## Recommendation

Make Basic a useful verification/ads/scheduling tier. Premium should primarily buy capacity, deeper insight and convenience. Keep account recovery, impersonation reporting/protection, privacy controls, moderation appeals and account security free for everyone; the current Blue Essential copy attaches some of these safeguards to a paid tier.

## Existing implementation notes

- Current backend plans are `blue_essential`, `blue` (Blue Verified), and `premium` (Blue Premium), not the proposed Basic/Premium pair.
- Repository defaults show Blue Verified ad load at 60% of normal and Premium at 0% (no ads); these are defaults, not confirmed live settings.
- Premium is documented as including up to five linked business profiles, subject to the separate one-owned-store restriction.
- Scheduling is now paid-gated on create and reschedule in `services/typescript/social/src/modules/posts/commands/createPost/createPost.handler.ts` and `controllers/scheduledPosts.controller.ts`; the 90-day horizon and cursor-paginated list are implemented. The worker and focused tests exist. Scheduled-content/media editing, bounded retry/lease recovery and a complete publication-time moderation recheck remain gaps; preserve accepted posts on expiry.
- Confirm any monthly boost credit, priority support and profile limits have backend enforcement and defined expiry behavior before promising them publicly.
