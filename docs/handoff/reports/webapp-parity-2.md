# Webapp ↔ mobile parity, round 2 (2026-10-11)

Mobile is the reference. Nothing is committed. The only staged change is the `git rm` of the four admin payout re-export files. Chats were not touched; the chat agent owns them.

## What I built

### 1. Creation
- **Mode tabs** (Post · Clip · Story · Live) on `/post/new` and the new `/create/*` pages.
- **`/create/clip`**, a port of mobile's ClipComposer:
  - One video or up to 10 photos, added by picker or drag-drop. Uploads use purpose `clip`, show progress, and support retry, reorder, remove and resume when the browser comes back online.
  - **Video:** trim with start and end sliders, clamped with mobile's `clampTrim` (1 s minimum, 3 min maximum). The preview loops only the trimmed range.
  - **Photos:** 1–10 s per photo and a transition, sent as `slideshow`.
  - Colour look, caption with @mentions (2200 characters), sound picker, location, and every post setting.
  - **Cover:** mobile has no cover picker; it uses the first frame. The web does the same.
  - `?soundId=` pre-selects a sound, and sound pages now have a "Use this sound" button.
- **`/create/story`:** one photo or video (up to 60 s), look, and sound. It calls `POST /stories {mediaId, soundId?, look?}`. The `/stories` tray gained "Your story", and the mobile-only notice was removed.
- **`/create/live`:** a "Go live from the Zudomart app" screen with store badges for approved creators, and a link to the Creator Program for everyone else. Mobile hosts natively only.
- **Location tagging** (`PlacePicker`) is now in the post and clip composers.
### 2. Disputes and escrow
- **`/orders/[id]/escrow`:** payment protection screen with the summary, timeline, explainer, confirm receipt (dialog plus idempotency key), view or open dispute, mark as shipped (seller), and contact the other party.
- **`/orders/[id]/dispute`:** reasons, a description of at least 20 characters, and photo evidence.
  - Evidence uploads use purpose `dispute_evidence` and wait for processing to get an https URL. Each photo has retry and remove.
  - Photos are required for the damaged, not-as-described and wrong-item reasons.
  - The form blocks a second dispute and blocks disputes on non-escrow orders.
- **`/disputes/[id]`:** status history, evidence, support thread and composer.
  - A seller sees "Respond by … or support will decide without your input" and replies through `/disputes/:id/messages`, as on mobile.
  - 404/403 shows its own "isn't available" state.
- **Order pages:**
  - The order detail page links to payment protection, and to the dispute or "Open a dispute".
  - Seller order detail shows the escrow summary, the held-funds notice, the timeline and "View dispute".
- **Escrow copy now matches the Terms and the Refund and Escrow Policy:**
  - "Your payment is locked in your own wallet, held by our licensed payment partner…"
  - The note "Escrow and buyer protection apply in Nigeria only. Outside Nigeria you pay sellers directly at your own risk."
  - Direct orders show the outside-Nigeria rule.
  - **Mobile's explainer is fixed too.** It said "Your money goes to Zudomart", which contradicts the Terms.
### 3. Payment methods
`/settings/payment-methods`, plus a row on the settings home:
- Cards: no card is stored, and the copy doesn't name a provider.
- Subscriptions.
- Payout for sellers.

The checkout payment step and payment backend were not touched.

### 4. Creator subscriptions
- **`/subscriptions`:** status pill, price and interval, Renews or Ended, cancel (with confirm) and resume. App Store and Google Play subscriptions link to the store instead.
- The profile's "Subscribed" button opens this page.
- The creator dashboard gained a **Subscription plans** section: create a plan with price tiers and the app-store gross-up note, pause or resume a plan, and see recent subscribers.
- The subscription-state call moved to `/creator-subscriptions/:id`, the same as mobile.
### 5. Seller product images
**Finding:** both clients' product forms were mis-contracted. Catalog takes a `ProductUpsertRequest` (`imageMediaIds`, `variants[]`, `options`, `openingStock`). The clients sent `{price, stock, sizes, colors, imageUrls}`, and lists read fields that don't exist.

The webapp is rebuilt on the real contract:
- **Photos:** up to 10, uploaded with purpose `product` and waited on until `ready`. You can reorder them ("Cover"), remove them and retry failed ones.
- **Options:** sizes and colours become options and variants. Existing variant ids and SKUs are kept.
- **Stock:** opening stock goes to the default location. Stock can't be edited when editing a product, because PATCH never changes stock.
- **Delete:** archives the product, after a confirm.
- **Mobile is not fixed yet;** see the findings.
### 6. Wallet extras
- Payout-setup card using mobile's copy and states. Finishing setup is in the app only, because the steps are identity and payment-partner specific.
- "Buy coins" opens the existing coin dialog.
- The balances note.
- Withdraw is disabled when nothing is available.
- Escrow holds link to the seller order.

### 7. Bugs
- **Places search:**
  - Social has a new `places` module behind a `PlacesProvider` interface.
  - The default provider uses a bundled dataset: about 180 cities and areas across NG, GH, KE and ZA. There are no coordinates and no external calls.
  - The typed text is added as a free-text place (`text:<slug>`).
  - Gateway route: `GET /api/v1/places/search`, sign-in required, exact path.
  - Tests: 7 in social and 1 for the gateway route. The mobile mock and contract test are updated too.
- **Saved reply `postId`:**
  - Social now sends `postId` on saved comment items, and the href is `/post/:p/comment/:c`. The product href is fixed (`/product/`).
  - Tests: 2.
  - Mobile reads `postId ?? comment.postId`, and the webapp reads it too.
- **Mobile clip trim (found this round):** the trim was computed but never sent. Fixed: video clips now send `media[{trim}]`.
### 8. Cleanup
`git rm` of `payoutsWorkspace`, `payoutDetailPanel`, `payoutDecisionDialog` and `payouts.mock` in admin. Nothing imported them.

**Other changes:**
- Mocks updated to match the backend: dispute list as a page, `VALIDATION_FAILED`/`DISPUTE_CLOSED`/`ORDER_NOT_DISPUTABLE`, subscription cancel/resume, places, payout onboarding, the catalog-shaped seller products with `MEDIA_NOT_READY`, story publish by media id, slideshow clips, and ready media variants.
- The seller ship mock path was fixed from `/ship` to `/fulfilment`.
- `disputes` is reserved as a web route and a Go username term.

## QA
| Check | Result |
|---|---|
| webapp tsc | 0 |
| units | 169/169 (new tests: escrowStage, sellerProductForm, clipDraft, payoutSetupCard) |
| contracts | 75/75 (new `parityRoundTwoMocks` plus 3 contract entries) |
| `next build` (`WEBAPP_USE_MOCKS=true`) | exit 0, 73/73 pages |
| eslint (new files) | clean |
| mobile tsc | 0 |
| mobile jest | 334/337. The 3 failures are all in `chat/messageReactions.hook.test.ts`, the chat agent's work in progress. |
| social vitest (places, saves) | pass. Social `tsc` errors are only in `messages`/`storeInbox` (chat). |
| gateway route tests | 342/342 |
| Go usernames | ok |

### Adversarial checks
| Check | Result |
|---|---|
| Double submit | In-flight refs, busy buttons and stable Idempotency-Keys on dispute open, dispute messages, confirm receipt, product create, plan create, clip and story. The mock replays the same dispute and product. |
| Upload fails and is retried | Evidence, product photos and clip/story tiles show the error and Retry. Submit is blocked while an upload is in progress or has failed. An unprocessed photo gets `MEDIA_NOT_READY` (tested). |
| Refresh mid-flow | A `beforeunload` warning on the dispute, product, clip and story forms. The post draft now keeps the location; corrupt stored data is sanitised. |
| Deep link to deleted or private item | Dispute, escrow and product show separate "not available" states, with no retry. Mocks return the backend codes. |
| Signed-out user on an auth page | All new routes are outside guest browsing (tested), and the create pages also have a page guard. |
| Back button | Results use `router.replace`. Back buttons fall back to the order or the orders list when there is no history. Mode tabs use `replace`. |
| Offline | Submits are disabled with mobile's offline copy. `ErrorState` shows the offline state. Composer uploads resume when the browser is back online. |

## Parity matrix (changes since round 1; other rows unchanged)
| Area | Webapp | Status | Gaps |
|---|---|---|---|
| CreatePost: post | /post/new | ✅ | Location now added. Post-as identity is still missing. |
| CreatePost: clip | /create/clip **(new)** | ✅ | Video reply; drafts sheet (the web has an autosaved post draft only) |
| CreatePost: story | /create/story **(new)** | ✅ | Camera capture (uses a file picker) |
| CreatePost: live (host) | /create/live **(new)** | 🟡 | Hosting stays in the app, by design |
| Story view and tray | /stories (+ "Your story") | 🟡 | The tray belongs in chats on mobile (chat agent); no reply or report |
| Sound | /sounds/[id] "Use this sound" | ✅ | – |
| OpenDispute / DisputeDetail / EscrowStatus | /orders/[id]/dispute, /disputes/[id], /orders/[id]/escrow **(new)** | ✅ | No dispute list (mobile has none either) |
| Orders / OrderDetail | escrow and dispute links | ✅ | Dedicated OrderSuccess screen |
| SettingsPaymentMethods | /settings/payment-methods **(new)** | ✅ | – |
| MySubscriptions | /subscriptions **(new)** | ✅ | – |
| Creator plans | /creator plans section **(new)** | ✅ | Affiliations, earnings ledger |
| Seller products and images | /seller/products/* **(rebuilt)** | ✅ | Brand and category pickers, post-as-store |
| Wallet | payout card, buy coins, notes **(this pass)** | 🟡 | PayoutSetup onboarding steps are app-only |
| Saved replies | postId from social | ✅ | – |

## Findings for the owner and other agents
1. **Mobile seller ProductForm and seller product list don't match catalog's contract.** They send `price/stock/sizes/colors/imageUrls`, while catalog takes `imageMediaIds` and `variants`. They will fail against the real backend.
   - `apps/webapp/src/utils/sellerProductForm.util.ts` can be ported.
2. **Mobile `publishStory` sends an extra `media` field.** Social's `publishStoryBodySchema` takes `{mediaId, soundId?, look?}`. Check whether the schema is strict.
3. **The mobile story tray is in Chats.** The chat agent should add the web tray to `/chats`.
4. **The payout onboarding flow** (identity, business, bank, document link) is provider-shaped and lives in `/payments`. It is left app-only for the Flutterwave agent to decide.
5. **Still open from round 1:** presigned upload parts larger than 8 MB need a CSP `connect-src` entry (widgets agent).

## Follow-up (coordinator request): both open items closed

### 1. Mobile seller product form now uses catalog's contract
- **Types and utility:**
  - New `types/sellerCatalog.type.ts`.
  - New `utils/sellerProductForm.util.ts`. Sizes, colours and custom variant groups become `options` (at most 3, with a clear error message beyond that), and the request carries `variants[]` and `imageMediaIds`.
  - When editing, existing variant ids and SKUs are kept. Opening stock is set only on create, at the default `/seller/locations` location.
  - The brand is sent as `{brandId, relationship}`. An existing relationship is kept; otherwise `genuine_resale` is sent.
- **Services and media:**
  - `seller.service` (both copies) now uses `CatalogProduct`, `listMyStoreLocations`, create with an Idempotency-Key, and `archiveStoreProduct`.
  - `mediaService.uploadLocalImageAndReturnMediaImage` returns `{mediaId, url}` after processing.
- **Screens:**
  - **ProductForm:** media-id photos with a remove button, an upload error message, and a validation hint. Stock is read-only when editing, because PATCH never changes stock.
  - **SellerProducts:** maps catalog products for `InventoryCard` and hides archived products.
- **Mocks:** a new mobile `sellerCatalog.mock.ts` in catalog's shape. It returns `MEDIA_NOT_READY` and `PRODUCT_NOT_FOUND`, archives on delete, and **rejects the old flat body**. The legacy product routes are removed from `seller.mock`.
- **Tests:** `utils/__tests__/sellerProductForm.util.test.ts` (4) and `contracts/sellerCatalogMocks.test.ts` (3, contract check against catalog's ProductUpsertRequest rules).
- **Webapp, found while checking:** its "Mark as shipped" call sent `{courierName, trackingNumber}`, but orders' `FulfilmentRequest` takes `{courier, trackingNumber, fromLocationId}`.
  - It now resolves the default location first, as mobile does, and keeps a stable Idempotency-Key.
  - The mock requires the real body, and a new contract test covers it.

### 2. Story publish shape
- Social's `@zudojs/schema` objects default to `unknownKeys: "strip"`, and `publishStoryBodySchema` is not strict. So the extra `media` field **was not rejected**; it was silently dropped.
- Mobile now sends the contract shape `{mediaId, soundId?, look?}`, the same as the webapp:
  - `NewStoryInput.media` is removed.
  - The mock builds the media from the upload and returns `MEDIA_NOT_FOUND` when the upload doesn't exist.
- **Tests:**
  - Social `tests/posts/publishStoryBody.test.ts` (3): the schema accepts the contract shape, strips unknown fields, and requires a uuid `mediaId`.
  - Mobile `contracts/storyPublishMocks.test.ts` (2).

### Story tray
Mobile renders `StoryTray` only in Chats (and in the story screen), not on Home, so it stays with the chat agent.

### QA re-run
| Check | Result |
|---|---|
| mobile tsc | 0 |
| mobile jest | 65/65 suites, 346/346 tests |
| webapp tsc | 0 |
| webapp units | 169/169 |
| webapp contracts | 76/76 |
| social vitest (story body, places, saves) | 19/19 |
