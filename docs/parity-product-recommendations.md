# Product recommendation surfaces and parity

Status checked: 2026-11-13. This describes the React Native, web, and backend paths currently present in the repository; it is not a production deployment or recommendation-quality certification.

## Surface behavior

| Surface | Client placement | Request / ranking surface | Interaction surface | Behavior |
| --- | --- | --- | --- | --- |
| Feed | Optional product shelf among organic feed modules | `for_you` | `feed_recommendations` | Shared module cadence; sponsored posts do not advance its organic-post count. |
| Clips / Reels | A full-page product carousel inserted between clips, not a Mart shelf | `clips` | `clips_recommendations` | Insert after 16 organic clips, then every 45 organic clips. Sponsored clips do not advance the cadence. Products already tagged on the immediately preceding clip are excluded. The slot is omitted if no eligible recommendations remain. Each carousel is capped at six products. |
| Mart | Ranked product results in the Mart experience | `mart_home` | `mart_recommendations` | Uses the dedicated Mart ranking surface; selecting a category follows the existing category-browse behavior rather than presenting the For You shelf as Mart's only algorithm. |

The shared cadence and Clips shelf cap are in `packages/contracts/src/feeds.contract.ts`. Both `apps/mobile` and `apps/webapp` consume the shared contract. The mobile Clips pager keeps recommendations as a separate full-page item; it does not replace a clip. Web Clips renders the equivalent recommendation page in its vertical scroller, with a horizontally browsable product row.

## Backend and eligibility

Go Catalog serves optional-auth `GET /api/v1/mart/recommendations/for-you?surface=...`, builds a bounded candidate set, invokes the Python intelligence scorer, then revalidates returned IDs against current public listing, store, region/shipping, and stock eligibility. Personalized recall is used only when the viewer's persisted preference permits it; guests and non-consenting viewers do not receive per-viewer history-based ranking. Verified-store status contributes a modest ranking preference, not a hard gate. Eligible non-verified sellers remain discoverable. If recall or ranking fails, Catalog falls back to eligible popular/recent candidates and deterministic ordering.

The pipeline is rule-based with a Python scoring service; this documentation does not claim a trained model, live feature-store quality, or measured recommendation lift. The three client surfaces are documented here; endpoint and pipeline details remain in [Recommendations and personalization](architecture/recommendations.md).

## Verification and limits

For the 2026-11-13 Clips parity change, the focused React Native Jest run passed 16 tests across 3 suites, covering pager insertion/index mapping, duplicate-only slot omission, duplicate filtering, carousel cap, feed recommendations, and loading/retry behavior. Web Clips recommendation utility tests passed 3/3. Webapp `tsc --noEmit` and mobile `tsc --noEmit` passed. Scoped ESLint exited successfully: mobile reported 7 warnings in the existing pager refs/effects; web reported 2 dependency-array warnings in the Clips page. The workspace also emitted its Node engine warning (requires Node `>=26.13.0 <27`; this host runs Node `24.19.0`). `git diff --check` and `git diff --cached --check` passed. These local checks do not replace browser/device interaction checks, backend integration tests, deployment verification, or recommendation-quality evaluation.

Known boundaries: a Clips shelf excludes products tagged to the immediately preceding clip (the clip that triggered that insertion), not every product tagged anywhere in the entire session. The shared insertion cadence is a presentation rule, not a backend ranking rule. Sponsored/ad policy and campaign selection remain separate from this product-recommendation shelf.
