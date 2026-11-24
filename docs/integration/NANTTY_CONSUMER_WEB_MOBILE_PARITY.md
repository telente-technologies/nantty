# Nantty Consumer Web, Mobile, Messenger & Marketing Parity

**Apps Covered:** `apps/webapp`, `apps/mobile`, `apps/messenger`, `apps/web`.

## Cross-Platform Parity Summary

| Capability | `apps/webapp` | `apps/mobile` | Backend / Notes |
|---|---|---|---|
| Profile Clips (`PAR-001`) | `GET /api/v1/users/:userId/posts?kind=clip` | Already aligned | `ts/social` |
| Watch Video / Popular Feed (`PAR-002`) | `GET /api/v1/posts/:postId`, `GET /api/v1/feeds/popular` | Already aligned | `ts/social` |
| Suspension Appeal & Data Export (`PAR-003`) | `fetchMySuspensionNotice`, `submitSuspensionAppeal` | `POST /api/v1/users/me/suspension/appeal`, data exports unblocked | `go/users` + Gateway |
| Live Search Autocomplete (`PAR-004`) | `suggestSearch` in `ScopedSearchBar` | `suggestSearch` in `SearchScreen` | `ts/search` |
| Content Moderation Decisions & Appeals (`PAR-005`) | `AccountStatusPanel` (`copyrightAccount.service.ts`) | `AccountStatusScreen` (`accountHealth.service.ts`) | `go/moderation` |
| Edit Scheduled Post Content (`PAR-010`) | `/scheduled` (`scheduledPosts.service.ts`) | `ScheduledPostsSheet` (`scheduledPosts.service.ts`) | `ts/social` (`PATCH /posts/:id/schedule/content`) |
| Account Deletion Status & Cancellation (`PAR-011`) | `DeleteAccountSection` (`privacy.service.ts`) | `SettingsPrivacyDataScreen` (`consents.service.ts`) | `go/users` (`GET/POST .../deletion-request*`) |
| Store Team Invitations (`PAR-012`) | `StoreTeamRequestsSection` (`/settings/profiles`) | `StoreTeamRequestsSection` (`ManageProfilesScreen`) | `go/catalog` (`GET/POST /stores/team-requests*`) |
| Tagging Privacy & Self-Untag (`PAR-013`) | `TaggingPrivacySection` (`/settings/privacy`), `TaggedPeopleList` | `TaggingPrivacySection` (`SettingsPrivacyScreen`), `TaggedPeopleList` | `ts/social` (`GET/PUT /me/tagging-settings`, `DELETE /posts/:id/tags/me`) |
| Analytics Event Telemetry (`PAR-006`) | `trackAnalyticsEvent` (`discovery.service.ts`) | Verified | `go/analytics` |

## `apps/messenger` & `apps/web`
- **`apps/messenger`:** TypeScript checks and all 37 unit/contract tests pass (`conversations`, `messagePage`, `chatBubblePreferences`, `bubbleDrafts`, `messengerStories`, `messengerMediaUpload`, `notificationActions`, `sessionFailure`, `notificationNavigation`, `floatingConversationVisibility`, `chatBubblesTroubleshooting`). E2EE stays anchored on `@nantty/chat-crypto` (98/98 Vitest pass).
- **`apps/web`:** Static marketing, legal, and external waitlist surface; `tsc --noEmit` passes with 0 errors.
