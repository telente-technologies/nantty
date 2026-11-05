# React Native ↔ Android content parity audit

Scope: feed, content creation, post detail/replies, clips, stories, live, and Spaces. This audit compares the RN navigation/screen/service surface with the current Kotlin Compose navigation and data/UI surface. It does not cover messaging or seller/creator/brand/ads workspaces.

## Route and flow comparison

| RN route / flow | RN implementation evidence | Kotlin Android equivalent | Difference / follow-up |
|---|---|---|---|
| `Tabs.Home` feed | `screens/home/home.screen.tsx`, `services/feeds.service.ts`; For You/Following, topic selection, feed modules, post actions | `Destination.Feed`, `FeedRepository`, `MainContent`, `FeedCard` | Core feed, pagination, topic filtering, and common post interactions exist. Audit more parity for feed modules, report/mute, media/link previews, and empty/error states. |
| `CreatePost` → post compose/settings → publish → `PostDetail` | `screens/create/createPost.screen.tsx`, `components/create/postComposerPanel.tsx`, settings steps, upload/draft/publish hooks | `PostComposerScreen`, `PostComposerRepository`; reachable from feed create action | Android only publishes plain text. Missing RN media capture/library + upload, mentions, acting profile, quote, advanced post settings, drafts/scheduled posts, and multi-step composer. This audit implements audience selection only. |
| `PostDetail` | `screens/posts/postDetail.screen.tsx`; post actions, thread/comments, sorting, quotes, analytics links and author actions | `PostDetailScreen`, `PostDetailRepository` | Core detail and paginated/sortable replies, profile acting, post interactions exist. Verify remaining action parity (quotes, edit/delete/analytics/report/follow, media/link presentation) individually. |
| `CommentThread` / nested reply | `screens/posts/commentThread.screen.tsx`, `services/postThread.service.ts` | Thread tree and reply-to-comment state in `PostDetailScreen` | Basic nested reply is represented; confirm depth/navigation, comment media/quotes, moderation, and failure recovery parity. |
| `Tabs.Clips`, suggested clips, clip comments | `screens/clips/clips.screen.tsx`, `suggestedVideos.screen.tsx`, `components/clips/*`, `services/clips/*` | No `Destination` or Kotlin clip pager/player destination | Entire clip browsing, playback/watch tracking, comments, creator actions, and clip creation/video reply flows are missing. |
| Story tray/view/publish/analytics | `screens/story/story.screen.tsx`, `services/clips/stories.service.ts`, create screen story mode | No Kotlin story route/repository/screen | Story tray, viewer, capture/publish, interactions, and analytics are missing. |
| Live create/host/view/end | `screens/live/*`, `components/create/liveSetupPanel.tsx`, `services/live/*` | No Kotlin live routes/repository/screen | Eligibility gates, permissions, host setup, media/live transport, audience interactions, and ended-state flow are missing. Do not substitute mock stream data. |
| Spaces browse/create/schedule/join | `screens/spaces/spaces.screen.tsx`, `services/spaces.service.ts` | No Kotlin Spaces route/repository/screen | Entire audio-room browse/create/schedule/join, participation, moderation, and announcements are missing. |

RN navigation evidence: `apps/mobile/src/navigation/mainTabs.navigator.tsx` and `apps/mobile/src/navigation/main.navigator.tsx`. Android route evidence: `apps/native/android/app/src/main/java/com/nantty/android/ui/NanttyApp.kt`; content implementations are under `ui/{MainContent,PostComposerScreen,PostDetailScreen}.kt` and `data/{FeedRepository,PostComposerRepository,PostDetailRepository}.kt`.

## Implemented parity fix: post audience privacy

RN `PostToolbar` (`components/create/postToolbar.tsx`) toggles the audience between `everyone` and `followers`, and `CreatePostScreen` passes that value to the create-post mutation. Android previously hardcoded `audience: "everyone"` in `PostComposerRepository`, leaving no way to publish followers-only text.

Android now exposes the same two options in the Compose composer, submits the selected wire value to the existing `POST /api/v1/posts` body, keeps `everyone` as the backward-compatible repository default, and rotates the idempotency key when audience changes so a retry key is not reused for a different payload. No API, auth, or server policy was changed.

Coverage added to `PostComposerRepositoryTest` and `PostComposerScreenTest` for followers-only serialization and the UI-to-request flow.

## Verification status

- Integrated serialized run after auth, Explore, commerce, content and business-workspace changes: `:app:compileDebugKotlin :app:testDebugUnitTest :app:compileDebugAndroidTestKotlin --rerun-tasks --no-daemon --no-parallel --max-workers=1` passed; XML reports **263 JVM tests, 0 failures, 0 errors**.
- Kotlin production and Android instrumentation-test sources compiled, including the composer audience and payment-return tests.
- Compose instrumentation was not executed: `adb devices -l` reports no attached emulator/device.
- `git diff --check` and `git diff --cached --check` passed.

## Android design/architecture references

- [Get started with Android](https://developer.android.com/get-started/overview): modular, testable app structure and support for Android form factors.
- [Android UI design](https://developer.android.com/design/ui): adaptive mobile UI and interaction patterns across phones, foldables, and tablets.
