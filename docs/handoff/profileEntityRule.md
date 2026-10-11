# Profile entity rule: handoff (2026-10-11)

Rule: a personal account owns at most one Store or one Business page (never both), plus at most one Brand. Nothing is committed.

## Done

### Backend: users (goIdentity)
- Registry schema: `services/go/modules/users/src/databases/schema/linkedProfile.schema.go`.
  - Columns: `account_id`, `kind` (store, business or brand), `profile_id`, `store_id`, `status` (active, held or retired), `hold_reason`.
  - Partial unique indexes enforce the rule at the database level:
    - `(account_id, kind) WHERE active`
    - `(account_id) WHERE active AND kind IN (store, business)`, so a store and a business can't coexist
    - `(kind, profile_id)`
- New column `profiles.publishing_held` in `profile.schema.go`. Ent code is regenerated.
- Core logic: `src/services/linkedProfileRegistry.service.go`.
  - Claim and release run under a per-account advisory lock, backed by the unique indexes.
  - A store claim reattaches to a reservation that has no store yet.
- Views: `src/services/linkedProfileViews.service.go`. The switcher lists Personal plus the registered linked profiles, including a catalog brand. Each profile has `kind`, `showsMart` and `onHold`.
- Errors in `src/errors/users.error.go`: `PROFILE_LIMIT_STORE_OR_BUSINESS`, `PROFILE_LIMIT_ONE_BRAND`, `PROFILE_ON_HOLD`.
- New module `src/modules/linkedProfiles/` (routes, controllers, commands, queries, backfill service):
  - `GET /api/v1/users/me/linked-profiles`
  - `POST /api/v1/users/me/linked-profiles/choose` (user step-up)
  - Internal (`X-Internal-Token`), under `/api/v1/internal/accounts/{id}/linked-profiles`: `GET`, `/claim`, `/release`, `/transfer-brand`
  - Admin: `GET /api/v1/admin/linked-profiles/conflicts` and `GET /api/v1/admin/users/{id}/linked-profiles`
  - Admin with step-up, permission `users:moderate`, a reason and an audit entry: `POST .../convert` and `POST .../resolve`
- Backfill and grandfathering run at startup from `src/app.go` via `linkedprofiles.BackfillRegistry`. The run is idempotent.
  - It registers unregistered business profiles plus catalog stores and brands.
  - Extras become `held` with `publishing_held=true`.
- Business profile creation:
  - New `purpose` field (`store` or `business`).
  - It claims inside the creation transaction.
  - The old limit of 10 business profiles is removed.
- The acting-profile switch only allows owned linked profiles; this lives in `actingProfiles/*`.
- `ownedStores.integration.go` now has catalog brand and store readers. `storeId` ignores brand-channel stores.

### Backend: catalog (goCommerce)
- Schema changes:
  - `brands.selling_enabled` (default false).
  - `stores.channel` (`store` or `brand`).
  - New statuses `paused` and `closed` in `enums`.
- Registry client: `src/interfaces/linkedProfiles.interface.go` and `src/integrations/linkedProfiles.integration.go`.
  - It calls users at `ADMIN_INTERNAL_URL` with `USERS_INTERNAL_API_TOKEN`.
  - It fails closed in production and is permissive in local dev when no URL is set.
- Claims in creation flows:
  - `createStore` claims with a pre-generated store id and releases on failure. It also has a catalog-local "one store per account" guard.
  - `createBrand` claims and has a local one-brand guard.
  - `submitApplication` reserves the store slot, and a rejected `decideApplication` releases it.
- New brand endpoints:
  - `PATCH /api/v1/brands/{id} {sellingEnabled}`: owner only, user step-up. It pauses or resumes brand-channel storefronts.
  - `POST /api/v1/brands/{id}/storefront`: a brand sales channel that does not count as the Store slot.
- Brand detail and summary now include `sellingEnabled`, `showsMart` and `storefront`. Brand products hide the storefront's items when selling is off.
- New listings are blocked for held or retired profiles and for brands with selling off: `src/services/listingHold.service.go`, called in `productWriter.service.go`.
- Admin `POST /api/v1/admin/brands/{id}/reassign`: `brands:revoke`, step-up, reason, audit `brand.reassigned`.

### Social
- Posting as a held profile is refused (`publishingHeld` filter, purpose `"publish"`).
- Files:
  - `prisma/identityRead/schema.prisma` (generated client updated)
  - `src/integrations/identityDirectory.integration.ts`
  - `src/interfaces/identityDirectory.interface.ts`
  - `createPost.handler.ts`
- Test: `tests/posts/heldProfilePublishing.test.ts`.

### Platform
- `identitytest.FakeTokenService.SignAccountTokensWithStepUpForTest` (test helper).

### Apps

**Mobile**
- New files:
  - `screens/brand/manageProfiles.screen.tsx`: the Store-or-Business choice and the "Choose which to keep" task.
  - `components/profile/profileLimitGate.tsx`: guards the create flows and deep links with the centred `profileLimit` error.
  - `components/brand/brandSellingSwitch.tsx`: confirmation plus step-up.
  - `hooks/useLinkedProfiles.hook.ts`
  - `utils/linkedProfiles.util.ts`
  - `mocks/linkedProfiles.mock.ts`
  - Tests: `contracts/linkedProfilesMocks.test.ts` and `components/profile/__tests__/profileRule.test.ts`.
- Edited:
  - Settings, profile switcher, create business/brand screens, seller application screen.
  - `myProfile`: no Mart tab for business pages.
  - `brandProfile`
  - Navigation: types, navigator, deep links `settings/profiles`, `settings/profiles/business/new`, `settings/profiles/brand/new`, `seller/apply`.
  - Error kinds, catalog, mapper, actions.
  - Mocks, `identity.contract.ts`, `apiClient` (`patch` options).

**webKit**
- New error kind `profileLimit` and action `manageProfiles` ("Manage profiles") in `errorKinds`, `errorMapper`, `errorCatalog.content` and the mapper test.

**Webapp**
- Page `/settings/profiles`: `app/(app)/settings/profiles/page.tsx` and `components/settings/linkedProfilesSection.tsx`.
- Service, util, types, mock, contract.
- Settings link added; provider maps `manageProfiles`.

**Seller**
- `components/brand/brandSellingSwitch.tsx`, shown in `brandProfileView`.
- BFF allows `PATCH /brands/{id}`.
- Mock route, type, `contracts/brandSelling.test.ts`.
- Provider maps `manageProfiles` to `/brand`.

**Studio**
- Provider maps `manageProfiles` to the webapp `/settings/profiles`.

**Admin**
- New files: `components/people/userLinkedProfilesPanel.tsx` (new user tab "Store, Business, Brand"), `components/brands/brandReassignAction.tsx`, `services/linkedProfilesApi.service.ts`, `types/linkedProfiles.type.ts`, `mocks/handlers/people/peopleLinkedProfiles.mock.ts`.
- Edited: brand reassign mock, `apiRoutes.config.ts` rows, `apiContract.md`.

### Help Centre and Terms
- New article: `services/typescript/support/content/help/business-and-brands/stores-business-pages-and-brands.md`. Mobile and webapp mock copies are added under the selling category.
- Updated the "up to 10 business profiles" claims in `business-profiles`, `switch-profiles`, `business-and-brands-faq`, `profile-types` and `profiles-faq`.
- Seller terms: new section `stores-business-pages-and-brands` in `apps/web/src/content/sellerTerms.content.ts`.

### Backend tests added
- Users: `users.linkedProfiles.integration_test.go` and `users.linkedProfilesGrandfather.integration_test.go`. They cover:
  - every row of the combinations table
  - store reservation, attach and release
  - 8 parallel store/business creates and 8 parallel brand claims, with exactly one winner each time
  - grandfathering and backfill, the choose step, admin resolve with audit
  - admin convert, including `STORE_STILL_OPEN`
- Catalog:
  - `catalog.profileRule_integration_test.go` and `catalog.profileRuleFakes_integration_test.go`: store claim, API bypass, team member acting on the owner's behalf, double tap and parallel brand creates, seller application reservation and release, held profile blocks listings.
  - `catalog.brandSelling_integration_test.go`: toggle with step-up and owner-only; storefront pause and resume; existing listings and seller access kept; held brand; admin reassign.
  - `src/integrations/linkedProfiles.integration_test.go`: client contract test.

## Migrations
- `services/go/modules/users/src/migrations/20261011145154_add_linked_profiles.{up,down}.sql`: table, partial unique indexes, `profiles.publishing_held`, grant to `zudomart_readers`.
- `services/go/modules/catalog/src/migrations/20261011145157_add_brand_selling_and_store_channel.{up,down}.sql`.
  - Adds `brands.selling_enabled` and `stores.channel`.
  - Sets `selling_enabled = true` for brands that already have an official store.
  - Grants `channel` to readers.
- Both were generated with `cmd/generateMigration`. Unrelated drift lines (`legal_versions` index, `topics.updated_at` default) were removed by hand, and `atlas.sum` was rehashed.
- They have only been applied to the throwaway per-test schemas in the local test Postgres (port 15432). The dev or prod database has not been touched.

## Test and build state (real results from the last runs)
- Go users: `go test ./...` passes. The new rule tests also pass under `-race`.
- Go catalog: `go test ./...` passes. The new tests also pass under `-race`, and `go vet` on the changed packages is clean.
- Social: `tsc` passes. `vitest tests/posts` passes (92), and the held-profile test passes.
- tsc passes for mobile, webapp, seller, admin and web.
- Studio tsc **fails** on `src/contracts/creatorNextActions.test.ts` (`LiveSession.scheduledAt`). This is not from this work; it comes from another agent's in-progress live types (`studioLive.type.ts` is untracked).
- Contract tests:
  - webapp, seller and admin pass. The admin run was repeated after a fix.
  - Studio **fails** with "PATCH /api/v1/lives/:liveId has no mock". Also not from this work (live area).
- webKit tests pass. Support content tests pass after removing the provider name from the article.
- Mobile jest:
  - The new `profileRule.test.ts` passes (7/7).
  - A subset (`src/contracts`, `src/errors`, `src/navigation`) passes (176).
  - The **full** mobile jest run has NOT been run since these changes.
- Next builds (webapp, seller, studio, admin, web) have NOT been run.

## Partial / not started
- Adversarial e2e against the real backend stack is not done: double tap, parallel store vs business, deep link, API bypass, team member, toggle with open orders, grandfathered posting. These are covered only by the integration and unit tests above.
- Brand-toggle "open orders" coverage:
  - It is shown by keeping existing listings and seller access for a paused storefront.
  - No real order flows through the orders module in a test.
- Webapp has no business-page or brand creation UI (there never was). The `/settings/profiles` page points to the app for those.
- Profiles viewed by other users (`userProfile.screen`) still use `isSeller`. Business-page detection there needs a profile kind on the public user payload.
- The mobile `postAsIdentityRow` still labels `business` as "Business"; it was left alone because another agent is editing that file.
- Accounts with a seller application pending at deploy time are not backfilled into the registry (the backfill reads profiles, stores and brands only).

## Next steps to resume
1. Run the full mobile jest suite: `cd apps/mobile && flock <lock> npx jest`.
2. Run the Next builds one at a time: webapp, seller, studio, admin, web.
3. Re-check the studio tsc and contract failures once the live agent finishes. They should not be fixed here.
4. Run the adversarial e2e checks against the local backend:
   - parallel `POST /api/v1/users/me/business-profiles` plus `POST /api/v1/seller/applications`
   - a deep link to `zudomart://settings/profiles/business/new` when a store exists
   - `PATCH /api/v1/brands/{id}` without step-up
   - a grandfathered account posting with `asProfileId` of a held page
5. Optional: add a profile kind to the public user view so the other-user profile screen can hide the Mart tab for business pages.
