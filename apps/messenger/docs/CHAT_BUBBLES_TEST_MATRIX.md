# Chat Bubbles test matrix

| Scenario | Automated/source check | Device verification |
| --- | --- | --- |
| Bubble-eligible Android FCM has no `notification` payload | Notifications FCM unit test | Not run |
| Generic title/body and conversation/channel metadata retained | Notifications FCM unit test | Not run |
| Bubble deep link parses encoded conversation ID and compact surface | Messenger navigation unit test | Not run |
| Invalid links do not become conversation routes | Messenger navigation unit test | Not run |
| Regular non-bubble FCM still uses notification payload | Existing FCM test | Not run |
| In-app multi-conversation rendering and interactions | TypeScript compilation only | Not run |
| None/all/selected preference evaluation and exclusion toggling | Unit tests | Not run |
| In-app active conversation selection is independent from Android system selection | Unit test plus settings/shell source inspection | Not run on device |
| Draft isolation while switching between in-app conversations | Unit test for conversation-keyed draft updates and account-scoped record keys | React Native component/SQLite lifecycle not run on device |
| Draft persistence across process recreation | AEAD-sealed SQLite adapter tests verify persistence semantics, account/conversation isolation, deletion and write ordering | Process-kill/relaunch against Expo SQLite not run on device |
| Accessible dismissal without dragging | React Native accessibility action in source | Not run with TalkBack/VoiceOver |
| Terminal session failure clears sensitive state; transient failures preserve session | Unit test for 401/403 vs 5xx/network classification; AuthProvider cleanup path in source | Not run against a revoked trusted device |
| Logout removes/invalidates conversation shortcuts and notifications | Kotlin cleanup path inspected; Android ShortcutManager API verified against official API reference | Not compiled or run on Android |
| First-use Android setup, OS notification permission, and system-settings recovery | Source/typecheck only | Not run |
| Searchable selection of authorized conversations | Existing authenticated conversation-list API + UI typecheck | Not run |
| Local notification test distinguishes local alert from remote delivery | Source/typecheck only | Not run |
| Android shortcut/bubble metadata and fallback | Source inspection only | Not run; Android Gradle blocked by incomplete NDK and no emulator/device |
| Conversation channel association and Android channel settings deep link | Source inspection only | Not run |
| Android RemoteInput, cold-start and duplicate reply handling | Source inspection only | Not run |
| iOS reply, mark-read, grouping and deep links | Source inspection only | Not run; no Xcode/Simulator |
| Revocation, E2EE, offline, mute/block and cross-client sync | Existing infrastructure source inspection | Not run end-to-end |
| Cross-app notification behavior with main Nantty app installed | Provider routing tests verify intentional delivery to both app provider groups per user's choice | Actual dual-install delivery and duplicate behavior not run on device; stale/same-provider token correlation remains unimplemented |

Before release, execute the Android and iOS acceptance lists in the product requirement on installed builds. Capture settings, collapsed/expanded/multiple bubbles and a real encrypted reply; do not substitute mock conversations or compilation results.
