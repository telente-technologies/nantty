# Free vs paid feature matrix

> **Updated 2026-10-29:** The founder’s restructuring brief supersedes earlier queue-cap and Black noncommercial proposals. The matrix separates the target model from verified repository behavior; current source does not yet enforce every proposed entitlement.

Proposal only. “Current” references repository behavior; the proposed column is not approved.

| Feature | Current source behavior | Free Individual | Blue Basic | Blue Premium | Free Business/Store | Gold Basic | Gold Premium | Black Government |
|---|---|---|---|---|---|---|---|---|
| Account safety, recovery, privacy, appeals | Some Blue Essential marketing perks overlap safety | Full baseline | Same | Same | Full baseline | Same | Same | Same |
| Core profile, follow, feed, post, comment, messaging | Core free | Full baseline | Same | Same | Full baseline | Same | Same | Same |
| Badge | Paid Blue/Gold; Black reviewed | None | Blue after eligibility | Same Blue | None | Gold after business review | Same Gold | Black after official review |
| Ad load | Free 100% | Standard | Reduced | Ad-free recommendation | Standard | Reduced | Ad-free recommendation | 20% of standard load |
| Basic post analytics | Inconsistent by plan | Basic lifetime/short range free | Same | Advanced range/export | Basic store metrics | Same | Advanced reports/export | Basic account metrics |
| Post scheduling | Server requires an active paid Blue/Gold entitlement for create/reschedule; unlimited queue, 90-day horizon and cursor-paginated list. Content/media editing, robust retries and publication-time moderation recheck remain gaps. | Not included | Unlimited; <=90 days | Unlimited; <=90 days | Not included | Unlimited; <=90 days | Unlimited; <=90 days | No Black-specific scheduling entitlement |
| Creator Studio / live / affiliate / gifts | Separate Creator Program approval | Eligibility-based | No bypass | No bypass; subscription may improve analytics only | N/A | N/A | N/A | N/A |
| Store selling / core orders / inventory | Seller Free plan has real cap and sales tooling | N/A | N/A | N/A | Core selling; current resolver: 100 active products, 1 location, 0 staff, 30d analytics | Core selling plus verified Gold identity | Includes existing Business seller capabilities through Gold Premium; no second seller subscription | Government eligibility is manually reviewed; Black is not a seller entitlement |
| Advanced seller tools | Pro/Business gates exist | N/A | N/A | N/A | Paid seller plan required today | Do not imply Gold Basic grants Pro | Recommend bundle or add-on after model decision | Not a badge perk |
| Business profile linking | Premium currently up to 5, one owned store rule | Current non-Premium baseline 2 linked profiles | Baseline | Up to 5; one owned store invariant | One store ownership | Same | Higher workspace capability | Institutional profiles by official policy |
| API/webhooks | Pro gate/help copy; public interface unverified | None | None | Optional only after secure API launch | No public API verified | None | Consider after API ships | Not a badge privilege |
| Ads campaign spend | Separate app/budget | Available per eligibility and billing | Same | Possible boost credit only if costed | Campaign access | Same | Tools/credit as separately priced | Subject to public-sector ad policy |
| Security, moderation, support appeals, payment safety | Core system controls | Always available | Always available | Never bypassed | Always available | Always available | Never bypassed | Always available |

### Monetization principles

Keep core social interaction, account recovery, privacy, consent, moderation/reporting, payment security, consumer protection and required disclosure free. Monetize additional capacity, time-saving tools and advanced analytics. Do not charge for authenticity itself as a substitute for verification, nor let paid status bypass enforcement.

Scheduling target has no per-day, per-month, queue-count or tier quota; it keeps the global 90-day horizon and platform-wide anti-spam/publishing protections. Server-side paid entitlement checks and cursor pagination are present. Scheduled-content editing, retry/lease recovery, publication-time moderation and full concurrency verification remain open (see [POST_SCHEDULING_ARCHITECTURE.md](POST_SCHEDULING_ARCHITECTURE.md)).
