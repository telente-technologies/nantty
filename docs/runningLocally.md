# Running locally: mocks or the real backend

Every app can run against its built-in mocks (no backend needed) or against the real services on your machine. One command switches all of them.

## The commands

Run these from the repo root.

| Command | What it does |
| --- | --- |
| `pnpm mode:backend` | Points every app at the local gateway (`http://localhost:8080`) and turns its mocks off |
| `pnpm mode:mock` | Turns every app's mocks back on (pure mocks, no backend needed) |
| `pnpm mode:status` | Shows each app's mode and API URL, and whether the gateway answers |
| `pnpm backend:up` | Starts the infra, applies migrations, starts every service on 127.0.0.1, waits for `/healthz`, seeds demo data |
| `pnpm backend:check` | Signs in as the demo buyer and checks health, profile, feeds, clips, products, lives, wallet and a realtime socket sign-in through the gateway |
| `pnpm backend:down` | Stops only what `backend:up` started: its services, and the infra containers that were not already running before (data volumes are kept) |
| `pnpm backend:seed` | Re-runs only the demo seed (it is idempotent) |
| `pnpm check:no-mocks` | Fails if a production `next build` (or, with `-- mobile --mobile-export <dir>`, an `expo export`) contains mock code, or if an EAS profile other than `demo` turns mocks on |

Options (pass them after `--`, for example `pnpm mode:backend -- --app webapp`):

- `--app <name>`: switch one app only (`webapp`, `seller`, `studio`, `ads`, `admin`, `web`, `mobile`). Repeat it for several.
- `--api-url <url>`: point at another backend, such as staging. Media keys are only written for local URLs; pass `--media-url <origin>` for others.
- `--mobile-api-url <url>`: override the mobile URL (by default it is your LAN address, see below).
- `backend:up -- --lan`: also forward your LAN address (ports 8080 and 18333) to the loopback-only stack, so a phone can reach it.
- `backend:up -- --full`: start every infra container (OpenSearch, ClickHouse, LiveKit, Jaeger...). The default starts only Postgres, Valkey, RabbitMQ, LocalStack and object storage, which is what the services need. The machine has 15 GB of RAM.
- `backend:up -- --no-seed`, `backend:down -- --keep-infra`, `backend:down -- --force` (also stops listeners that someone else started on the stack ports).

### Isolated Postgres for integration tests

If port `15432` or the existing Postgres volume belongs to an older project, do not reset or remove that volume. Start only Postgres under a separate Compose project name and port; the new project gets its own volume and runs the checked-in role/database initialization script on first start:

```bash
NANTTY_LOCAL_POSTGRES_PORT=15433 docker compose -p nantty-identity-tests -f infra/local/docker-compose.yml up -d --wait postgres
```

Point the test process at `127.0.0.1:15433` (for example, set its database URL to `postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable`). Stop only this isolated service with:

```bash
NANTTY_LOCAL_POSTGRES_PORT=15433 docker compose -p nantty-identity-tests -f infra/local/docker-compose.yml down
```

The `down` command preserves this test volume; do not add `-v` unless you explicitly intend to discard the isolated test database.

## What the switch writes

The switch writes only the mode keys in each app's local env file. Every other line, comment and secret in that file stays as it was. A backup of the previous file goes to `.data/modeBackups/<app>/`, which keeps the last five. All of these files are gitignored.

| App | File | Keys |
| --- | --- | --- |
| webapp, seller, studio, ads, admin | `apps/<app>/.env.local` | `<APP>_USE_MOCKS`, `<APP>_REAL_API_PREFIXES`, `<APP>_API_URL`, media/upload origin keys |
| web (marketing, no mocks) | `apps/web/.env.local` | `NEXT_PUBLIC_API_URL` |
| mobile (Expo) | `apps/mobile/.env` | `EXPO_PUBLIC_USE_MOCKS`, `EXPO_PUBLIC_REAL_API_PREFIXES`, `EXPO_PUBLIC_API_URL` |

Restart the dev servers after switching. Next reads env files when it starts. Expo bakes `EXPO_PUBLIC_*` into the bundle, so start it with a clean cache: `pnpm --filter @nantty/mobile exec expo start -c`.

## A typical session

```bash
pnpm backend:up          # first run builds the Go binaries, a few minutes
pnpm mode:backend
pnpm mode:status         # every app "backend", gateway "reachable"
pnpm backend:check       # all PASS
pnpm --filter @nantty/webapp dev     # http://localhost:3500, sign in as a demo account
# ...
pnpm mode:mock           # back to mocks
pnpm backend:down
```

The services, logs and PID files live in `.data/localStack/` (`logs/goIdentity.log` holds the one-time codes, since `AUTH_OTP_DELIVERY=log`). If the stack is already running, for example because someone else started `security/regression/startSandboxStack.sh`, `backend:up` reuses it instead of starting a second copy, and `backend:down` leaves it alone.

Realtime (chat and live sockets) runs natively with `mix phx.server` on 127.0.0.1:4000 when Elixir is installed, with the same internal tokens and JWKS as the Go services. Without a local `ffmpeg`, `backend:up` builds a small `nantty-local-ffmpeg` Docker image (`scripts/localStack/ffmpeg/`) and puts its `ffmpeg`/`ffprobe` wrappers on the media service's PATH, so video clips process like in production.

Payments: go-money uses Flutterwave, the only payment provider (`PAYMENTS_PROVIDER=flutterwave`). The sandbox stack points it at the fake Flutterwave on 127.0.0.1:18998; never put live `FLWSECK-` keys in a local env file.

## Demo accounts (local stack only)

The seed (`scripts/localStack/seedDemo.mts`) creates these through the real API. Clips use the 4-second synthetic fixture `scripts/localStack/fixtures/demoClip.mp4` (test pattern and tone, 308 KB). It checks what already exists, so running it again only fills in what is missing.

| Who | Sign in with | Password | What it has |
| --- | --- | --- | --- |
| Buyer | `demo.buyer@nantty.test` | `Lagos-Market-Demo-2026!` | Lagos address; follows the creator and the seller. Deliberately not payout-verified, to test the verification prompts |
| Seller | `demo.seller@nantty.test` | `Lagos-Market-Demo-2026!` | Store "Ife Lifestyle (demo)" with 3 products and nationwide shipping |
| Creator | `demo.creator@nantty.test` | `Lagos-Market-Demo-2026!` | Approved creator, payout-verified (level 1, through payout onboarding and BVN consent on the fake Flutterwave) with a wallet: 2 image posts, 3 video clips, 1 live |
| Staff admin | `admin.demo@nantty.com` | `Quartz-Harbour-Lantern-Velvet-2026!` | Superadmin for the admin console; enrol MFA at the first sign-in |

These passwords only exist in your local database. The mock-mode demo accounts are different: they are listed on each app's sign-in page in mock mode.

## Testing on a real phone with the real backend

All services listen on 127.0.0.1 only, which a phone cannot reach. Pick one of these:

1. **Same Wi-Fi (Expo Go or a dev build):** `pnpm backend:up -- --lan` forwards `<your LAN IP>:8080` and `:18333` to the loopback stack. `pnpm mode:backend` already writes `EXPO_PUBLIC_API_URL=http://<your LAN IP>:8080` for mobile, because it detects your LAN address. Start Expo with `-c`. Limitation: the media service still returns `http://localhost:18333/...` image URLs, so pictures may not load on the phone. Use option 2 if you need them.
2. **Android over USB:** `adb reverse tcp:8080 tcp:8080 && adb reverse tcp:18333 tcp:18333`, then `pnpm mode:backend -- --app mobile --mobile-api-url http://localhost:8080`. Images load too, because localhost on the phone now reaches your machine.
3. **Emulator or simulator:** the iOS simulator can use `http://localhost:8080`; the Android emulator uses `--mobile-api-url http://10.0.2.2:8080`.

Your firewall must allow inbound connections on 8080 and 18333 for option 1. The forward stops with `pnpm backend:down`.

## Switching back

`pnpm mode:mock` turns every mock back on (or `-- --app <name>` for one app). Your other env keys stay. To undo a switch completely, copy the file back from `.data/modeBackups/<app>/`.

## Production builds never ship mocks

- **Next apps (webapp, seller, studio, ads, admin):** the mock backend is loaded with a dynamic `import()` that only exists when `NODE_ENV` is not `production`. `next build` folds that condition, so the mock modules and seed data are not in `.next/server` or `.next/static`. At runtime, `isMockBackendEnabled()` is always false in production, whatever `*_USE_MOCKS` says. The seller sign-in and password-reset demo hints use the same pattern.
- **CI:** the Frontend workflow runs `node scripts/checkNoMocksInBuild.mjs <app> --require-build` after every `next build`. It searches the output for a marker that every mock backend sets (`nantty-mock-backend-bundled`), the mock error text, and the seed ids that only exist under `src/mocks`, and fails if it finds any.
- **Mobile (EAS):** `development`, `preview` and `production` set `EXPO_PUBLIC_USE_MOCKS=false`. The mock demo APK the owner shares is now its own profile: `eas build --profile demo --platform android` (`EXPO_PUBLIC_USE_MOCKS=true`). `preview` is a real-backend APK. Set `EXPO_PUBLIC_API_URL` for preview and production in the EAS environment variables. Without it they fall back to `app.json` `extra.apiUrl`, which is localhost. If `EXPO_PUBLIC_USE_MOCKS` is missing, a build now uses mocks only in development (`__DEV__`). The CI mobile job checks all of this. The GitHub `androidApk.yml` workflow still builds the mock demo APK (`EXPO_PUBLIC_USE_MOCKS: "true"`).
- **Mobile bundle:** when `EXPO_PUBLIC_USE_MOCKS` is `false` (or unset in a production export), `apps/mobile/metro.config.js` resolves every import of `src/mocks` from outside it to `src/config/mocksDisabled.stub.js`, so Metro never bundles the mock modules. The `demo` profile (`true`) keeps them. Prove it with `pnpm check:no-mocks:mobile` (exports the Android bundle with mocks off and searches it for the mock seed ids; CI runs it in the mobile job). On 2026-10-11 the production export had 0 of 84 markers, and a demo export with mocks on was flagged with all 84.

## Live video with LiveKit (dev build only)

Going live streams through LiveKit. Expo Go can't load WebRTC, so it shows the "needs the Nantty app build" screen, and mock mode only shows a camera preview with a "Preview only" pill. To test real video you need the local backend, the LiveKit container and a dev build on each phone.

1. **Start LiveKit.** It is only in the full infra set: `pnpm backend:up -- --full`, or add it to a running stack with `docker compose -f infra/local/docker-compose.yml up -d livekit`. The image is pinned by digest (`livekit/livekit-server:v1.13.7`). The dev keys (`devkey` / the secret in `infra/local/livekit/livekit.yaml`) already match `security/regression/sandboxSecrets.env`.
2. **Make it reachable from phones.** By default LiveKit listens on 127.0.0.1 only. For two phones on the same Wi-Fi, recreate it on the LAN:
   ```sh
   LIVEKIT_BIND_ADDRESS=0.0.0.0 LIVEKIT_NODE_IP=<your LAN IP> docker compose -f infra/local/docker-compose.yml up -d --force-recreate livekit
   ```
   Then set `LIVEKIT_PUBLIC_URL=ws://<your LAN IP>:7880` in `services/go/.env.example` (local edit, don't commit it) and restart the stack with `pnpm backend:down -- --keep-infra && pnpm backend:up -- --lan`. go-live puts that URL in every media token. Open TCP 7880-7881 and UDP 7882 in your firewall.
3. **Build and run the dev client** on both phones: `cd apps/mobile && eas build --profile development --platform android` (or `ios`), install it, then `pnpm mode:backend` and `npx expo start --dev-client -c`.
4. **Test a live between two devices.** Phone A (a creator account): Create, Live, Camera, Go live. You should see yourself, the connection dot, and the flip, mic and camera buttons. Phone B (another account): open the live from Explore. The video starts muted with a "Tap to unmute" pill. Then try:
   - Flip the camera, mute the mic, turn the camera off (B sees the cover photo).
   - Put A in the background for a few seconds (B sees the cover). Back on A, a banner says the video was paused.
   - Turn on airplane mode on A: A shows "Reconnecting… your live stays on". If A stays offline for more than about 60 s, the heartbeat ends the live and B sees "Live ended".
   - End the live on A: B moves to the summary straight away, because ending the live closes the LiveKit room.
5. **Webhooks.** Local LiveKit doesn't send webhooks (the gateway only listens on loopback). The heartbeat ends lives on its own. In AWS the self-hosted config posts `room_finished` and `participant_left` to `https://api.<domain>/api/v1/live/webhooks/livekit`. These are signed with the LiveKit API key and secret, so there is no separate webhook secret. With LiveKit Cloud, add that URL in the project's webhook settings.
