# LiveKit live video: 2026-10-11

Nothing was committed. Everything in the livestream report still holds: the Expo Go gate, heartbeat, reconnecting banner, mock mode and the double-tap lock.

## Packages (supply-chain policy unchanged)
- **Mobile:** installed with `npx expo install`:
  - `@livekit/react-native@3.0.0`
  - `@livekit/react-native-webrtc@144.2.0`
  - `@livekit/react-native-expo-plugin@1.0.3`
  - `@config-plugins/react-native-webrtc@15.0.2` (peer `expo>=56`)
  - `livekit-client@2.22.4`
  - `expo-keep-awake@~57.0.2`. It is an Expo SDK package that was already in the tree under `expo`, added as a direct dependency for keep-awake.
  - All of them are older than 24 h, passed the trust policy, and need no build script.
  - `@livekit/react-native@3` pulls in `@livekit/components-react` itself.
  - The SDK supports the New Architecture (`newArchEnabled=true` in prebuild).
- **Webapp:** `livekit-client@2.22.4` only, no components library.
- **Install side effect (not mine):** the webapp `pnpm add` stopped with `ERR_PNPM_IGNORED_BUILDS: protobufjs@7.6.6`, which has a `postinstall` script.
  - It comes from another agent's in-progress gateway change: `@opentelemetry/*` in `services/typescript/gateway/package.json` → `@grpc/proto-loader` → protobufjs. It does not come from LiveKit.
  - I did not add an allowBuilds exception. The owner or that agent needs to decide on it.
  - `pnpm install --frozen-lockfile --lockfile-only` reports the lockfile is up to date.

## Backend verification (go-live)
- **Token endpoint:**
  - `POST /api/v1/lives/{id}/media-token` (authenticated) returns `{url, token, canPublish, role}`.
  - Accepting a stage invitation also returns a token.
- **Grants:**
  - Only the host, or a guest seated on stage, gets `canPublish`. A safety hold revokes it.
  - **New:** the publish sources are limited to camera, mic and screen share.
  - Viewers get subscribe only, with no data publishing, no `canUpdateOwnMetadata`, and no room admin or room create.
  - Test: `TestMediaGrantsKeepViewersFromPublishing`. A host also gets no publish rights in someone else's live.
- **Room names:**
  - Rooms are named `live-<UUIDv7>`, which has 74 random bits.
  - Each JWT is bound to its own room. Access is checked with `requireLiveAccess`, so guessing a room name gives you nothing.
- **TTL:**
  - `LIVE_MEDIA_TOKEN_TTL` defaults to 10 min.
  - LiveKit refreshes tokens for connected clients.
  - The app fetches a new token on every full reconnect.
- **New: rooms are explicit:**
  - The host's token call ensures the room exists (`CreateRoom`, empty timeout 120 s, departure timeout 20 s). Without this, a self-hosted server with `auto_create: false` would refuse the host.
  - Ending a live now deletes the room, so viewers get `ROOM_DELETED` and see "Live ended" straight away.
- **New: webhooks** (`POST /api/v1/live/webhooks/livekit`, already routed by the gateway with the raw body and signature verification):
  - `participant_left` (host) shortens the host's heartbeat lease to 20 s.
  - `room_finished` shortens it to now.
  - The heartbeat stays the authority: a host that still heartbeats keeps its live. Encoder lives have no lease, so a webhook never ends them.
  - A forged signature gets 401.
  - Tests: `liveMediaRoom.integration_test.go`.
  - LiveKit signs webhooks with the API key and secret. There is no separate webhook secret.
- **Config:**
  - `services/go/.env.example` gained `LIVE_LIVEKIT_WEBHOOK_ENABLED` and `LIVE_MEDIA_TOKEN_TTL`.
  - Terraform: the self-hosted LiveKit config now posts webhooks to `https://api.<domain>/api/v1/live/webhooks/livekit` (new `webhook_url` variable).
  - Secrets Manager wiring for URL, key and secret was already in place.
  - **Note:** the secret has `ignore_changes`. For existing environments, run `terraform apply -replace=module.platform.module.livekit.aws_secretsmanager_secret_version.credentials` or edit the secret.
  - The Terraform image is `livekit-server:v1.8.0`, while local uses `v1.13.7`. I left it alone; consider bumping it.

## Mobile
New files are in `src/components/live/media/` and `src/services/live/` (`liveKitRuntime.service.ts`, `liveMedia.service.ts`, `liveMediaPolicy.util.ts`).

- **Lazy loading:**
  - The LiveKit modules are `require`d only after the build is known to contain WebRTC and mocks are off.
  - Expo Go and mock mode never load them (tested).
- **Host:**
  - The host gets a token after creating the live, then publishes the front camera and mic.
  - Controls: flip camera, mute mic, camera off (viewers see the cover), and a connection-quality pill.
  - Video settings: simulcast at 720p/24fps capped at 1.2 Mbps, plus 360p (450 kbps) and 180p (150 kbps) layers, dynacast, adaptive stream, DTX/RED audio at 32 kbps.
  - The screen stays awake while live.
  - Audio route preference is Bluetooth, then headset, then speaker. `BLUETOOTH_CONNECT` is requested on Android 12+.
  - In the background, video pauses and audio keeps going where the OS allows (iOS has the `audio` background mode). On return, a banner says the video was paused.
  - LiveKit reconnect events drive the existing "Reconnecting…" banner, and the heartbeat is unchanged.
- **Viewer:**
  - The host's video plays full-screen, muted, with a "Tap to unmute" pill.
  - It falls back to the ingress participant for OBS lives.
  - While connecting it shows the BrandLoader. Other states are "Waiting for the host's video…", "Camera is off", and "Video unavailable. Tap to retry".
  - When the room is closed, the session refetches and the app moves to "Live ended".
- **Mock mode:** the host keeps the camera preview, with a "Preview only: mock mode doesn't stream…" pill.
- **Co-hosts and battles:**
  - Battles happen on the shared stage, and guests already get publish grants.
  - When you are seated (`myRole === "guest"`), the app reconnects with a publish token and publishes.
  - Stage tiles render each streamer's LiveKit track.
  - Cross-live battles don't exist in the backend.
- **Native config:**
  - Plugins were added: the LiveKit Expo plugin, and the WebRTC plugin with our own camera and mic prompts.
  - `BLUETOOTH_CONNECT` was added.
  - The plugin's `SYSTEM_ALERT_WINDOW` is blocked.
  - Prebuild was run in a scratch copy and the copy was deleted. It confirmed CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, BLUETOOTH(_CONNECT) and WAKE_LOCK; SYSTEM_ALERT_WINDOW is `tools:node="remove"`; iOS has NSCamera and NSMicrophone strings and UIBackgroundModes `audio`; LiveKit setup runs through the Expo module's AppDelegate subscriber and Application lifecycle listener.
  - No Android foreground service is used.
- **Icons:** three new icons (CameraRotate, VideoCameraSlash, SpeakerSlash). The icon barrel test count is now 184.

## Webapp
- `components/live/liveVideoPlayer.tsx` dynamically imports livekit-client, plays the video muted on autoplay, and has an unmute button that calls `startAudio`.
- It handles these states:
  - signed out: "Sign in to watch"
  - your own live: video stays off so it doesn't kick your phone off with the same identity
  - mock preview
  - WebRTC missing or blocked
  - reconnecting
  - ended (refetches the session)
- Follow and Pinned are unchanged.
- The CSP `connect-src` now includes the LiveKit origin from the new build-time env `WEBAPP_LIVEKIT_URL`, plus `*.livekit.cloud` for Cloud. This must be set wherever the webapp is built.
- The mock `POST /lives/:id/media-token` returns `LIVE_VIDEO_MOCK_PREVIEW`.

## Infra and docs
- `infra/local/docker-compose.yml`: LiveKit is pinned to `v1.13.7@sha256:6fd3b708…`. `LIVEKIT_BIND_ADDRESS` and `LIVEKIT_NODE_IP` (default 127.0.0.1) allow LAN testing.
- `docs/runningLocally.md`: appended the section "Live video with LiveKit (dev build only)".

## QA results
- Go live module: `go test ./...` passes, 43 s.
  - `-race` passes on services, integrations, studio and the LiveKit and heartbeat tests.
  - The `-vet=off` workaround from the earlier report still applies.
  - The `goLive` deployable builds.
  - `TestLiveKitRoomController` passed against the real pinned LiveKit container. I started it and removed it afterwards.
- Mobile: `tsc` is clean. Jest: 85 suites, 431 tests pass. New tests:
  - `liveMediaPolicy`
  - `liveKitRuntime` (Expo Go and mocks never load the SDK)
  - `liveRoomConnection` (token, reconnect with a fresh token, room deleted becomes ended, retry cap, ended live)
  - `liveKitStage`
  - Lint on the new files: 0 warnings.
- Webapp: `tsc` is clean. 201 units and 81 contract tests pass. Stylelint passes.
  - `next build` in mock mode passes when `WEBAPP_API_URL` is set, and the no-mocks check passes.
  - Without `WEBAPP_API_URL`, the build fails at `/sitemap.xml` (`publicContent.service.ts`). That is not related to this work, but CI's build step sets no env, so check it.
- Terraform `validate` and `fmt` pass for the LiveKit module.
- Gateway and Elixir were not touched.

## Follow-ups
- Signed-out web viewers can't watch, because media-token requires auth. Anonymous viewer tokens are a policy decision.
- Viewer identity is the userId, so the same account on two devices kicks one of them.
- `--lan` doesn't set `LIVEKIT_PUBLIC_URL` automatically. For now it's a manual edit, which is documented.
- Local LiveKit sends no webhooks, because the gateway is on loopback. The heartbeat covers this.

## Addendum: build-time env follow-ups
- **Sitemap:** `src/app/sitemap.xml/route.ts` now calls `await connection()` (Next 16 docs). It renders at request time, so a missing `WEBAPP_API_URL` no longer breaks `next build`. In production the real sitemap is built at runtime (a test `next start` returned 200).
- **Webapp CSP is built at runtime:**
  - The policy moved from `next.config.ts` into `src/server/contentSecurityPolicy.service.ts`, applied in `src/proxy.ts` on every request.
  - It reads env through computed names, so `next build` can't inline them.
  - This covers LiveKit, upload and S3 origins, and the Smile ID variant on `/settings/verification`.
  - `/bff/*` gets a static `default-src 'none'` policy.
  - Fail-safe: if `WEBAPP_LIVEKIT_URL` is unset, LiveKit is not allowed. The player listens for `securitypolicyviolation`, stops retrying and shows "Live video isn't available right now".
  - Checked with a single build: `next start` with the LiveKit URL included it in connect-src, and without it the origin was absent. There is only one CSP header.
- **Seller and ads:** their CSPs were also baked at build time (`SELLER_*` / `ADS_*`), so they moved to the same runtime pattern. A seller test start confirmed `SELLER_MEDIA_URL` is picked up at runtime.
  - Admin already did this.
  - Studio and web only read `NEXT_PUBLIC_*`, which is build-time by design, so they are unchanged.
- **Builds with no env (as in CI):**
  - webapp, seller, ads, admin and web: pass.
  - studio: fails on a syntax error in `apps/studio/src/app/(studio)/subscribers/page.tsx:37`. That file is another agent's work in progress.
  - webapp with env set: passes, and nothing is baked in.
- **Tests:** webapp `tsc`, 206 unit tests and lint pass, including the new CSP tests. Seller and ads `tsc` and lint pass.
  - Seller and ads each fail one contract test file, `src/contracts/errorScreens.test.ts`, which won't parse. In seller it is another agent's untracked file.
