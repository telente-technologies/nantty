# Chat Bubbles test and acceptance matrix

| Area | Verification in repository | Runtime evidence still required |
|---|---|---|
| Preference filtering, account-scoped drafts/positions and in-app bubble eligibility | Messenger unit tests | Process restart, account switch and accessibility on Android/iOS devices |
| Troubleshooting status formatting and Android app bubble preference | Messenger unit tests cover OS preference labels, channel state and blocked/importance descriptions | Rendered mobile UI, native query against real Android notification channels, OS permissions/settings and push-token registration on devices |
| Reply action policy and notification deep-link parsing | Messenger unit tests | Expo notification callbacks in foreground/background/cold launch |
| Recipient routing and no-plaintext push mapping | Notifications mapping/FCM tests | Provider delivery, duplicate tokens and cross-app behavior on devices |
| Same-conversation notification replacement | Notifications mapping and FCM provider tests (13) verify stable account/conversation tag reaches the Android data payload and delimiter-collision separation | FCM/OEM notification replacement and active-bubble updates on device |
| Android plugin configuration | Expo config evaluation; plugin syntax check | Fresh native generation review, Kotlin compilation, Android install |
| Android conversation shortcut/channel/BubbleMetadata | Source inspection only; account+conversation scoping implemented | Real Android 11+ bubble, system promotion, multiple conversations, settings overrides and OEM behavior |
| iOS actions and in-app bubbles | Source/unit coverage | Xcode build and installed-device notification action tests |
| Authorization/E2EE/revocation | Existing services are reused; source/unit tests cover selected utilities | Forged IDs, expired/revoked sessions, real secure replies and multi-device synchronization |
| Offline reply delivery | Existing sealed outbox path reused | Airplane mode, process kill/restart, duplicate delivery and manual retry on device |

## Commands run for the current troubleshooting-screen change

- Messenger: `npm run typecheck` passed; `npm test` over the configured 11 test files — 37 passed. Expo prebuild configuration evaluation and `node --check plugins/withAndroidChatBubbles.js` passed.
- Notifications: `vitest run tests/storeActivityMapping.test.ts tests/fcmPush.test.ts` — 13 passed; source and test TypeScript compilation passed for mapping/provider changes.
- Gradle/iOS builds and device acceptance were not performed in this increment; existing blockers are documented in `CHAT_BUBBLES_IMPLEMENTATION_STATUS.md`.

## Required device scenarios

Use the complete Android and iOS acceptance lists in the approved Chat Bubbles specification. At minimum, verify real inbound push over another app, correct authorized history, encrypted reply and recipient receipt, a second conversation, draft isolation, dismissal, system-setting changes, logout/revocation cleanup, iOS reply/deep-link behavior and lock-screen privacy. Capture screenshots only from actual installed builds; do not substitute mock screens.
