# Push delivery reliability slice

This slice makes Expo's **push-ticket response** actionable and adds an opt-in provider-aware FCM path without introducing a new delivery scheduler. See [`push-provider-configuration.md`](./push-provider-configuration.md) for configuration and provider contracts.

## Implemented

- Expo batches remain capped at 100 messages. The sender maps each ticket to its input token and returns accepted count plus structured failures.
- Device registrations now include a provider; omitted provider values remain Expo for backward compatibility. Normal and widget push fan-out group registrations by provider.
- FCM HTTP v1 is available only when explicitly enabled with `PUSH_PROVIDER=fcm` or `multi`; service-account credentials are loaded from environment/secret injection and are not logged or persisted.
- `PUSH_PROVIDER=log` remains the default. It makes no external provider call and records push attempts as skipped/simulated, not delivered.
- FCM prunes only `UNREGISTERED` tokens; Expo prunes only `DeviceNotRegistered`. Other provider failures are classified and retained as bounded provider/code/count diagnostics.
- HTTP 429 and 5xx responses, network failures, malformed ticket payloads, and unknown ticket errors are classified as retryable. HTTP 4xx request failures and known permanent Expo ticket errors are classified as permanent.
- `DeviceNotRegistered` tokens are removed from that account's device-token records. Other permanent errors do not delete a device token.
- Notification dispatch continues to check account-level and category-level push preferences before sending. A disabled preference creates no push attempt. React Native requests permission only after explicit opt-in and registers its Expo token independently from widget synchronization. Android gates FCM registration on the account preference and OS notification permission.
- Failed push delivery rows store normalized provider codes/counts only. The staff endpoint `GET /api/v1/admin/support/notifications/push/deliveries/failed` requires the existing `support:email` permission and returns at most 50 rows (repository cap: 100). It omits recipient IDs, device tokens, push contents, and provider response bodies. Legacy push failure text is redacted to `legacy_provider_failure`.
- Widget-refresh push failures use the same ticket parsing and permanent-token pruning; diagnostics contain only widget type, counts, and normalized codes.
- Group-invitation created/accepted/declined outbox events now produce social-category in-app and push intents. New invitations route to the group-invitation inbox; acceptance wording explicitly states secure key setup is still required before membership begins. These are user-triggered transactional social notifications, not inactivity/random campaigns. They do not send email.
- Social's scheduled `streak.reminderDue` and `streak.milestoneReached` events produce per-conversation inbox/push notifications through the ordinary social preference and device-token path. Expiry scheduling is recipient-local-day and per-chat opt-out aware; milestone pushes are created by the Social streak engine. These are not inactivity or suggested-content campaigns and do not send email. See the Social streak job and `docs/parity-android-messaging.md` for eligibility and idempotency.

## Deliberate limits

The service's durable jobs currently cover email delivery and widget-refresh fanout; there is no durable per-notification push job that stores the notification payload/category and re-checks opt-out immediately before a retry. Therefore this slice does **not** schedule automatic push retries. Retryable failures are classified and observable for future queue-backed work, while this delivery attempt is recorded failed. Device-token provider support requires applying the migration at `prisma/migrations/20261106190000_device_token_provider/` before deployment.

Expo tickets indicate provider acceptance, not final device delivery. The existing service does not persist ticket IDs or poll Expo receipts; receipt polling and its scheduling/state are outside this bounded change. Consequently, `DeviceNotRegistered` pruning is available when Expo reports it in a ticket; delayed receipt-only errors are not yet consumed.

No random/inactivity reminders or recommendation campaign scheduler was added. Future re-engagement work must be separately consented, category-controlled, frequency-capped, and quiet-hours aware.

## Verification

See `pnpm --filter @nantty/notifications test`, `pnpm --filter @nantty/notifications typecheck`, and `pnpm --filter @nantty/notifications lint` results in the implementation handoff. Expo's current ticket/receipt behavior is documented at [Send notifications with the Expo Push Service](https://docs.expo.dev/push-notifications/sending-notifications/).

Group- and channel-invitation event mappings are covered by `tests/groupInvitationMapping.test.ts` and `tests/channelInvitationMapping.test.ts`. Push preferences still follow the existing social category. This does not add a durable push retry queue, Expo receipt polling, or a notification-surface deep-link audit across every client.

## 2026-11-06 client wiring update

- React Native now handles push permission/token registration from account notification settings, not widget synchronization. Sign-out unregisters the device token.
- Native Android now has an FCM service, token persistence/sync worker, permission-gated registration, account-preference checks, and notification-tap routing to the existing inbox. It revokes a previously registered token when Firebase configuration is removed, where the token is still locally available.
- Android taps now route recognized payloads to native destinations that exist (including order detail and tokenized group/channel invitation previews); unsupported destinations safely fall back to the activity inbox. Only allowlisted same-app HTTPS or relative paths are parsed, and URLs are not opened externally.
- Android requires Firebase app/project configuration supplied through local build configuration and backend service-account secrets supplied at deployment. No Firebase secrets or `google-services.json` are committed. No emulator/device was attached for runtime verification.
- Verification: notification package **378 passed, 4 skipped**; React Native focused push tests **10/10** and TypeScript check passed; Android Kotlin agent verified debug compile, JVM suite **554/554**, and Android-test-source compile. The Android test suite is JVM-only here; device delivery and provider acceptance remain unverified. The provider default remains `log`, so production delivery requires migration, deployment configuration, and real-device checks.
- No inactivity/random push campaign was added. Re-engagement needs explicit consent, category controls, quiet hours, and frequency caps before scheduling.
