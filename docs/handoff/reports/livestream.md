# Livestream error sweep — 2026-10-11

Scope: mobile go-live (host) and viewer, webapp viewer, the go-live Go module, mocks, and the contracts. Nothing was committed, and no package.json, lockfile or env/config loader was touched.

## Headline finding (not fixable inside my rules)
The mobile app has **no LiveKit/WebRTC SDK installed** (`@livekit/react-native` and `@livekit/react-native-webrtc` are absent from `apps/mobile/package.json`). The host screen only shows a local `expo-camera` preview. Nothing is published, and the backend only sets `playbackUrl` for recordings. So viewers in real-backend mode see the cover photo, not video. Real streaming needs those two packages plus their Expo config plugin, then a dev build. That is a package.json change, which I'm not allowed to make. The app now detects this honestly (see 1 and 4).

## Errors found, causes, fixes

### Mobile — host journey
1. **Expo Go: going live silently does nothing.** In Expo Go no video can stream, but the flow still created a live on the backend.
   - Fix: new `services/live/liveHostingSupport.service.ts` detects Expo Go (`ExecutionEnvironment.StoreClient`), web, and whether the WebRTC/LiveKit native module is linked. It checks `NativeModules`/`TurboModuleRegistry` and never requires a missing package.
   - New `components/live/liveHostingGate.tsx` shows the screen "Going live needs the Zudomart app build", with a dev-build note (`eas build --profile development`). It appears when Go live is tapped for a camera or screen live, **before** `POST /lives`, so no live is created.
   - Encoder (OBS) lives still work in Expo Go.
   - In mock mode the gate offers "Try the live screens with mock data", which continues the full simulated flow.
2. **Double-tap Go live could create two lives.**
   - Client: `startGoingLive` has a ref guard, so the button disables only after the state update.
   - Backend: the existence check and insert raced at READ COMMITTED. A per-host `pg_advisory_xact_lock` now serialises them (`createLiveSession.service.go`).
   - A repeat tap now gets `409 LIVE_ALREADY_RUNNING` with `details.liveId`, and the app opens that live instead of showing a toast (`readRunningLiveId`).
3. **Camera/mic denial was a dead end.** The camera backdrop showed text with no action, and the mic was never requested.
   - New `services/live/liveMediaPermissions.service.ts` requests camera and mic before going live. If either is denied, a neutral dialog says "Turn on your camera and microphone" and offers "Open Settings".
   - `cameraBackdrop.tsx` gained an "Open Settings" button.
   - A failing permission API resolves as "denied" instead of throwing.
4. **A dev build without the video engine gave no explanation.** The host now sees an info pill: "Video streaming isn't in this build yet, so viewers see your cover photo." (`liveHostStatusBanner.tsx`).
5. **App killed or network lost: the live stayed "live" forever.** There was no host heartbeat at all.
   - Backend: new `POST /api/v1/lives/{id}/heartbeat`, host only. It returns `{liveId,status,leaseExpiresAt,timeoutSeconds:60}`.
   - The lease is stored on the host's guest-slot `state_deadline_at`, so there is no migration.
   - A new timer sweep (`sweepSilentHosts`) ends the live through the normal end path 60 s after the last heartbeat. It re-checks under the row lock, so a heartbeat that races the sweep wins.
   - Lives that never heartbeat, such as OBS/encoder lives, are never auto-ended.
   - Mobile: `useLiveHostConnection` sends a heartbeat every 15 s, on app foreground and on reconnect. Network loss or 5xx shows a "Reconnecting… your live stays on" pill, not an error. A late heartbeat that reports `ended` goes to the summary.
6. **Ending twice / end failures.**
   - Backend: ending an already-ended live re-ran recording-stop, stream-key revoke and media removal. These now run only on the real transition (`endLive`), and `live.ended` is published once.
   - Mobile: end has a ref guard, and a failed end shows "Couldn't end your live. Check your connection…" instead of silently doing nothing.
   - Navigation to the summary is de-duplicated, because the session poll and the heartbeat could both `replace` it.
7. **Gift sent during or after the end.** The backend already refuses before charging (`LIVE_NOT_ACTIVE`). A gift charged just before the end is still recorded. On mobile the raw "This live is not active." is now "This live has ended, so gifts are off. You weren't charged.", and the live refetches so the viewer moves to the summary.

### Mobile — viewer journey
8. **Joining an ended live showed the toast "Couldn't join this live".** `LIVE_NOT_ACTIVE`/`LIVE_NOT_FOUND` on join now refetches the session, which routes to the Live ended screen.

### Mobile — mock mode
9. **The mock `POST /lives` allowed unlimited concurrent lives.** It now returns `409 LIVE_ALREADY_RUNNING` with `details.liveId`, like the backend.
10. **The mock `POST /lives/:id/end` didn't end the live,** so the summary still read "live". It now marks it ended.
11. **Missing mock route: `POST /lives/:id/heartbeat`.** Added. The full flow was audited (create, stream-key, get, join/leave, comments, reactions, share, stage/guests, battles, safety, gifts/leaderboard/goals, points, pins, tips, reports): every call has a mock.
    - The mock `POST /battles/:id/gifts` has no backend route. It is only used when mocks are on (guarded in `sendBattleGift.adapter.ts`).

### Contracts (real backend)
All mobile live calls match the go-live routes and the gateway prefixes (`/api/v1/lives/**`, `/battles/`, `/live/`, `/gifts` → live; `/live-safety` → trust; `/tips` → money; `/auth/realtime-token` → identity). The realtime client sends `auth`/`subscribe`/`ping`, expects `auth.ok`/`pong`, and only accepts a token with `scope=realtime`. That matches the Elixir socket.
- **Note:** the gateway has no `/ws` route. In AWS the ALB sends `/ws*` to realtime (`infra/aws/modules/platform/services.tf`). Locally, when `EXPO_PUBLIC_API_URL` points at the gateway, the socket can't connect. That fails silently, with backoff; gifts and safety fall back to polling where it exists.
- `docs/verification/apiContractCheck.md` gained the heartbeat row.

### Webapp viewer
12. **One failed 10 s poll replaced the whole room with ErrorState** (React Query keeps `data` on refetch errors). The error now shows only when there is no data at all.
13. **"upcoming" lives showed "Ended",** and ended lives kept polling. New `utils/liveRoom.util.ts` maps statuses ("Starting soon"/"LIVE"/"Ended") and stops polling once ended.
14. **HLS check:** `.m3u8?token=…` URLs were passed to `<video>`. They now fall back to the cover.
15. **No follow button in the room, and the pinned product wasn't surfaced.** A Follow button was added (hidden on your own live). The pinned product sorts first with a "Pinned" tag, and `products` is null-safe.
- Not changed: the webapp never calls join/leave (calling them signed-out would trigger the sign-in prompt), and it has no realtime.

## Tests added
- Go (`liveHostLifecycle.integration_test.go`), all pass with `-race`:
  - double-tap creates exactly one live, and the 409s carry its id
  - ending twice is idempotent, with one `live.ended` event
  - heartbeat timeout auto-ends
  - reconnect within grace keeps the live
  - no-heartbeat lives are never auto-ended
  - a gift after the end is refused without a charge
  - Store/product ownership fail-closed was already covered (`liveContractGaps`: NOT_STORE_MEMBER, CATALOG_UNAVAILABLE).
- Mobile (jest, 20 pass):
  - `contracts/liveGoLiveFlowMocks.test.ts`: the full mock go-live flow
  - `liveHostingSupport.test.ts`: Expo Go gate, dev build, web, mock preview
  - `liveMediaPermissions.test.ts`
  - `liveHostConnection.test.ts`: reconnecting vs ended vs stop
  - `liveStoreMocks.test.ts` was updated to end its first live before starting another.
- Webapp: `utils/liveRoom.util.test.ts` (node:test, 4 pass).

## Results
- Go: the full suite `go test ./...` for the live module passes (root 39.6 s, plus services, jobs, integrations and middlewares). The new tests also pass with `-race`.
  - `go vet` on the platform currently fails in `platform/servicemodule/deployable.runner.go:61` (`httpMetrics.AddCounter` undefined). Another agent is editing that file, so I ran with `-vet=off`.
- Mobile: `tsc --noEmit` is clean.
- Webapp: `tsc` reports one error in `src/utils/amountInput.util.ts:6`, a file I didn't touch (another agent's work).
- Elixir: not touched, so `mix test` was not needed.
- A `go clean -cache` was blocked by a safety check. The cache was already 2.5 GB, so it wasn't needed.

## Owner test steps
**Expo Go (iPhone):**
1. Create, Live, tap Go live with the Camera source.
2. You'll see "Going live needs the Zudomart app build" with the dev-build note. No live is created.
3. With mocks on, tap "Try the live screens with mock data". iOS asks for the camera and microphone. Deny and you get "Turn on your camera and microphone" with Open Settings. Allow and you land on the host screen with your camera preview and an info pill saying video streaming isn't in this build.
4. Chat, gifts and battles run on mock data. ⋯ → End live → the summary.
5. Turn on airplane mode mid-live: "Reconnecting… your live stays on" appears and clears when you're back online.

**Dev build:**
1. `eas build --profile development`, install it, then `npx expo start --dev-client`.
2. There's no gate. Going live shows the camera preview and, until LiveKit is installed, the "viewers see your cover photo" pill.
3. Kill the app while live: viewers see the live end about 60 s later.
4. Double-tapping Go live opens one live.
