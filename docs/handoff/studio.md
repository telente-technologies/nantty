# Creator Studio rebuild: handoff (2026-10-11)

Work stopped mid-task because the machine was shut down. Nothing is committed.

A pre-change backup of studio, live and gateway sources is at
`/tmp/claude-1000/-home-oyinlola-Desktop-zudomart/2de9a368-cb79-4f3f-8721-930271160239/scratchpad/backup/studio-live-before.tgz`. It is in /tmp, so it may not survive a reboot.

**No tsc, test or build has been run on the studio changes.** The current state is unverified and probably has some type errors.

## Status per section

| Section | Status | Notes |
|---|---|---|
| Sidebar + account menu | PARTIAL | Done: `components/shell/studioShell.tsx`, `studioShell.module.css` and `accountMenu.tsx`. The left sidebar becomes an icon rail on tablet and a drawer on phones. It has skip link, Help Centre and account menu (profile, account settings, theme, sign out). Missing: three of its links (`/analytics`, `/comments`, `/settings`) point at pages that don't exist yet, so they 404. |
| Redirects for old routes | NOT STARTED | Plan: add `redirects()` to `apps/studio/next.config.ts` for `/audience`→`/analytics`, `/account`→`/settings/account` and `/embed`→`/settings/embed`, then delete the old `audience`, `account` and `embed` pages after moving their content. Also update the `/account` hrefs in `utils/creatorNextActions.util.ts` and check `contracts/creatorNextActions.test.ts`. |
| 1. Go live in the browser | PARTIAL | See the details below. **Blocker:** `next.config.ts` still sends `Permissions-Policy: camera=(), microphone=()` and `connect-src 'self'`, so the browser will block the camera and the WHIP POST. |
| 2. Stream health | PARTIAL | Done: `components/golive/streamHealthPanel.tsx`, used in the control room. It polls `GET /lives/:id/stream-health` (4 s) and merges local WebRTC stats. It shows on-air state, watching/peak, connection quality, bitrate, resolution/fps and ingest status. Missing: the depends-on backend endpoint (see the backend section). |
| 3. Scheduled lives | PARTIAL | Done: `app/(studio)/lives/(hub)/scheduled/page.tsx` with create, list, inline edit (title and time) and cancel with confirm. Past times are validated on the client (`utils/schedule.util.ts`, 5 min lead, 90 days max) and server errors are mapped (`utils/liveStoreErrors.util.ts`). The services are in `services/studioLive.service.ts`. The backend side is still pending. |
| 4. Replays | NOT STARTED (page) | Needed: `app/(studio)/lives/(hub)/replays/page.tsx`, which the hub tabs and control room already link to. Plan: list ended lives with `startedAt`, newest first. Expanding a row loads `studioLiveService.listRecordings` and shows a `<video controls>` per completed recording, plus delete via `deleteRecording` with confirm. CSS classes are ready in `hub.module.css` (`rowStack`, `rowExtra`, `player`, `recordingList`, `recording`, `recordingHead`). Mocks are ready (`live_2` has recordings). The backend has no clip or highlight support, so the page is list, watch and delete only. |
| 5. Moderation defaults | PARTIAL | Done: shared form `components/golive/moderationFields.tsx` and its CSS (who can comment, slow mode, blocked-word chips with client validation in `utils/blockedWords.util.ts`); per-live `components/golive/liveChatSettingsCard.tsx`, shown in the control room; and the services `fetchHostDefaults` and `saveHostDefaults`. Missing: the `/settings/live` page, which needs a moderators picker drawn from followers (`contentService.listFollowers`). |
| 6. Comments hub | NOT STARTED (page) | Done: service `services/comments.service.ts`, types `types/studioSocial.type.ts` and mocks `mocks/studioSocial.mock.ts`. Missing: the `app/(studio)/comments/page.tsx` page. Plan: list my posts (`contentService.listMyPosts`), then `useQueries` to fetch comments per post. Show filters (All / Needs reply / Pinned / per post / search) and the actions reply, pin/unpin and delete. **The backend has no inbox endpoint and no hide/unhide.** Hide is not possible without a social-service change. |
| 7. Analytics | NOT STARTED | Missing: the `app/(studio)/analytics/page.tsx` page. **There is no timeseries API** (the analytics module has no routes). Plan: date range presets (7/30/90 days, custom). Build trends on the client by bucketing `/creators/earnings`, `/lives` and the posts list, and take totals from `/creators/dashboard`. Use simple accessible SVG bars with a data table. Move the audience page's leaderboard and followers here. |
| 8. Settings | NOT STARTED (pages) | Done: services `services/settings.service.ts` (notification preferences, mention and message privacy) and their mocks. Missing: `app/(studio)/settings/layout.tsx` with sub-nav and the pages for General (notifications, privacy), Live defaults, Embed (move `StudioEmbedCodeBuilder`) and Account (move the account page content). |

### Go live in the browser: detail

**Done:**
- `live/whipPublisher.ts`: WHIP publish over plain `RTCPeerConnection`. There is no livekit-client dependency, because studio's package.json can't be touched.
  - It uses the existing `POST /lives/:id/stream-key?protocol=whip`.
  - When the mock ingest URL `mock://whip` is used, it simulates a session.
  - It computes stats and connection quality.
- `live/useBroadcastMedia.hook.ts`: device picker, preview, mute and camera toggles, screen share, unplug detection, and friendly messages when permission is denied or no device is found.
- `components/golive/browserBroadcaster.tsx`:
  - It guards Go live with a ref, so double-clicking is safe.
  - It warns when an RTMP encoder is already publishing.
  - Ending asks for confirmation, and leaving the tab triggers a beforeunload warning.
- Control room `app/(studio)/lives/[liveId]/page.tsx` has been rewritten:
  - It switches between browser and encoder mode (`?mode=` from the hub).
  - A non-owner gets a "belongs to another creator" screen.
  - The rest is split into `encoderSetupCard.tsx`, `liveControlColumns.tsx` and `copyField.tsx` (moved from the route folder), all in `components/golive`.
- Go live hub: `app/(studio)/lives/(hub)/layout.tsx` (tabs) and `page.tsx` (create, then pick browser or encoder). The old `lives/page.tsx` and its CSS were removed.

**Missing:**
- In `next.config.ts`:
  - Set `Permissions-Policy` to `camera=(self), microphone=(self), display-capture=(self)`.
  - Add the WHIP ingest origin to `connect-src` (from an env var such as `STUDIO_WHIP_CONNECT_ORIGINS`, with `http://localhost:*` in dev).
- Not yet tested in a real browser against LiveKit.

## Supporting changes (frontend)

- **Types:**
  - `types/index.ts` adds `scheduledAt` and `hostId`.
  - New `types/studioLive.type.ts` and `types/studioSocial.type.ts`.
- **Services:** `services/lives.service.ts` takes a protocol parameter and maps schedule and host. New `studioLive.service.ts`, `comments.service.ts` and `settings.service.ts`.
- **Allow-list:** `config/studioApiAccess.config.ts` adds 20 routes: live patch, cancel, stream-health, recordings, room-settings and host-defaults; post comments, reply, delete and pin; notification preferences; mention and message privacy.
- **Mocks:**
  - `mocks/lives.mock.ts` adds `scheduledAt`, `hostId` and a WHIP key, enforces host checks, validates schedules, seeds a scheduled live (`live_4`) and another host's live (`live_other_host`), and the list only returns my lives.
  - New `mocks/studioLive.mock.ts` and `mocks/studioSocial.mock.ts`, registered in `mocks/index.ts`.
- **Contract schemas:** `contracts/studio.contract.ts` has not been updated for the new endpoints yet.
- **Icons:** `components/ui/icons.tsx` adds new Phosphor icons.
- **Not mine:** `components/errors/errorExperience.provider.tsx` and `config/webappLinks.config.ts` show as modified, but another agent changed them.

## Backend (live module)

A background agent was implementing the following in `services/go/modules/live`. See the "Backend agent report" section below for what actually landed.

| Item | Endpoint / change |
|---|---|
| A | `GET /api/v1/lives/{id}/stream-health` |
| B | `scheduledAt` on create; `PATCH /api/v1/lives/{id}`; `POST /api/v1/lives/{id}/cancel`; events `live.scheduled`, `live.scheduleCancelled` and `live.reminderDue` (reminder job); possibly a `live.reminderDue` mapping in the notifications service |
| C | `GET`/`PUT /api/v1/live/host-defaults`; `commentAudience` on room settings with enforcement; defaults applied when a live is created |
| D | `DELETE /api/v1/lives/{id}/recordings/{recordingId}` |
| E | Blocked words: emoji-only words and fullwidth characters (`commentPolicy.service.go`) |

## Next steps

1. Read the backend agent report below. Run `go build`, `go vet` and `go test` for the live module under the flock lock.
2. Fix `next.config.ts` (Permissions-Policy, connect-src, redirects).
3. Write the missing pages: replays, comments, analytics, settings (with layout and sub-pages, including live defaults), plus the moved account and embed pages.
4. Add contract entries for the new endpoints in `contracts/studio.contract.ts`.
5. Run studio checks under the lock: `pnpm --filter @zudomart/studio typecheck`, `test:contracts`, then `next build` in mock mode and in the default mode.
6. Run the adversarial QA in the original brief: camera denied, unplug mid-live, double-click Start, end while OBS is sending, schedule in the past, blocked-word variants, a non-owner URL, and a logged-out deep link.

## Backend agent report

Status: items A–E are written. In `services/go/modules/live`, `go build ./...` exits 0, `go vet ./...` exits 0 and gofmt is clean. **`go test` has not been run.** There are no integration tests for A–D yet. The new blocked-word unit tests are written but have not been run.

**Ent and migration:**
- `go generate` was run. It added `LiveHostDefault` plus new columns, touching 24 generated files.
- New migration `src/migrations/20261011160000_add_scheduled_lives_and_host_defaults.{up,down}.sql`:
  - adds `live_sessions.scheduled_at` and `reminder_sent_at`, plus an index;
  - adds `live_room_settings.comment_audience`;
  - creates the table `live_host_defaults`.
- `atlas.sum` was regenerated with the ariga atlas library. Existing hashes reproduced exactly. The tool is at `scratchpad/atlassum/main.go`, which is in /tmp.

**Endpoints:**
- `GET /api/v1/lives/{id}/stream-health`: host only, no-store. Returns ingress status `unknown` when LiveKit fails.
- `POST /api/v1/lives` with `scheduledAt`: returns 422 `SCHEDULE_IN_PAST`, `SCHEDULE_TOO_FAR` or `SCHEDULE_WITH_START_NOW`.
  - Deviation: if `scheduledAt` is set and `startNow` is omitted, `startNow` defaults to false.
- `PATCH /api/v1/lives/{id}` with `{title, category, scheduledAt|null}`: host only, idle only, otherwise 409 `LIVE_NOT_EDITABLE`.
- `POST /api/v1/lives/{id}/cancel`: host only, idle only, otherwise 409. Returns 204 and revokes ingresses.
  - Caveat: `live.scheduleCancelled` is written in a second transaction, so it can be lost.
- `scheduledAt` was added to `LiveSessionView` and `StudioLiveView`.
- Outbox events `live.scheduled`, `live.scheduleCancelled` and `live.reminderDue`. The reminder fires once, 15 minutes before the start, from a sweep in the existing timer loop.
- `GET`/`PUT /api/v1/live/host-defaults`. Errors: `MODERATOR_SELF`, `MODERATOR_LIMIT` (more than 20), `USER_NOT_FOUND`.
- `commentAudience` on room settings `GET`/`PUT`, enforced on comment posting: 403 `COMMENTS_FOLLOWERS_ONLY` or `COMMENTS_SUBSCRIBERS_ONLY`. The host and moderators are exempt.
- Defaults are copied into a new live at creation.
- `DELETE /api/v1/lives/{id}/recordings/{recordingId}`: 404 `RECORDING_NOT_FOUND`, 409 `RECORDING_IN_PROGRESS`, 503 `RECORDING_UNAVAILABLE` if the S3 delete fails, otherwise 204.
- Blocked words: fullwidth characters are folded; emoji- or symbol-only words match as raw substrings; a single emoji is now allowed.
  - **Frontend follow-up:** `utils/blockedWords.util.ts` and the mock still require 2+ characters. Relax that for emoji.

**Not done on the backend:**
- Integration tests.
- The `live.reminderDue` mapping in the notifications service (`services/typescript/notifications/src/modules/eventIngestion/mappings`, modelled on `liveStarted`). **Until it exists, reminders reach nobody.**
- A gateway route check (they should resolve via `/api/v1/lives` and `/api/v1/live/`).

**Files:**
- Added: `src/databases/schema/liveHostDefault.schema.go`.
- Added services: `src/services/{liveHostDefaults,liveSchedule,streamHealth}.service.go`.
- Added in sessions: `sessions/controllers/sessionSchedule.controller.go` and `sessions/commands/{cancelLiveSession,updateLiveDetails}`.
- Added in studio: `studio/controllers/studioTools.controller.go`, `studio/commands/{deleteLiveRecording,updateHostDefaults}` and `studio/queries/{getHostDefaults,getStreamHealth}`.
- Modified: schemas, errors, events, integrations (`DescribeIngress`, `DeleteObject`), the comments/sessions/studio module dtos, routes and validators, several services, the types and `validation.util.go`.

**Backend next steps:**
1. Run `go test` under the lock, `-race` on the changed packages, and the full live integration suite. Postgres is at `localhost:15432`.
2. Write the A–D integration tests.
3. Add the notifications mapping.
