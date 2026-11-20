# Nantty Mobile & Messenger Security Assessment (OWASP MASVS)

- **Scope**: `apps/mobile` (`@nantty/mobile`), `apps/messenger` (`@nantty/messenger`), and `packages/chatCrypto` (`@nantty/chat-crypto`).
- **Verification Basis**: Static source & manifest inspection + Jest/tsx unit & contract test suites. **Native iOS (`.ipa`) and Android (`.apk`) binary builds and physical-device dynamic instrumentation were NOT executed in this sandbox.**

---

## 1. OWASP MASVS Control Matrix

| MASVS Domain | Control | Implementation Verified in Source | Status |
| --- | --- | --- | --- |
| **MASVS-STORAGE** | Sensitive tokens & E2EE keys stored in hardware-backed/OS keystore | `apps/mobile` (`mobileKeyStore.ts` + `widgetNativeBridge.service.ts`) and `apps/messenger` (`AuthProvider.tsx`, `messengerChat.service.ts`, `messengerNotifications.service.ts`) store refresh tokens, trusted device tokens, and X3DH/Ratchet/Sender keys in `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY` / `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` for widget secret scope). | **PASS (Static + Unit)** |
| **MASVS-STORAGE** | Plaintext `AsyncStorage` exclusion of E2EE chats & secrets | `apps/mobile/src/cache/queryClient.config.ts` explicitly excludes `decryptedChatQueryKeyPrefixes = new Set(["conversations", "conversation", "messages"])` from `AsyncStorage` dehydration. `apps/messenger` keeps chat drafts/preferences in `SecureStore`. | **PASS (Static)** |
| **MASVS-STORAGE** | Android backup exclusion (`allowBackup`) | `apps/messenger/app.json` (`configureAndroidBackup: false`) & `AndroidManifest.xml` (`android:allowBackup="false"`, `android:fullBackupContent="false"`). Cleartext traffic restricted to `debug`/`debugOptimized` manifests only. (`apps/mobile/android` is not pre-generated; managed via Expo prebuild.) | **PASS (`messenger` Manifest) / PREBUILD-PENDING (`mobile`)** |
| **MASVS-CRYPTO** | Client-side E2EE cryptography | `packages/chatCrypto` uses `@noble/curves`, `@noble/ciphers`, `@noble/hashes` (X3DH, Double Ratchet, Sender Keys, AES-GCM/ChaCha20-Poly1305). Store team key rotation revokes history access for removed members. | **PASS (`98/98` tests)** |
| **MASVS-NETWORK** | TLS / ATS enforcement | `apps/messenger/ios/NanttyMessenger/Info.plist` sets `NSAllowsArbitraryLoads=false` (`NSAllowsLocalNetworking` only). `apps/mobile/app.json` points `extra.apiUrl` to `https://api.nantty.com` (`SEC-0031`). | **PASS (Static)** |
| **MASVS-PLATFORM** | Deep linking & scheme hygiene | `apps/mobile/app.json` duplicate `"nantty"` scheme fixed (`SEC-0007`). `apps/mobile/src/navigation/linking.config.ts` maps explicit screen allowlist (`NotFound: "*"`) and sanitizes parameters; `apps/messenger` tests validate bubble deep-link confinement (`notificationActions.util.test.ts`). | **PASS (Static + Unit)** |
| **MASVS-AUTH** | Session expiry & sensitive state cleanup | `apps/messenger` tests verify expired/revoked sessions purge local sensitive state (`auth` / `SecureStore`) while transient 5xx/network errors preserve session state. | **PASS (`37/37` tests)** |
| **MASVS-CODE / RESILIENCE** | Native binary hardening, ProGuard/R8, SSL pinning, jailbreak/root telemetry | Cannot be verified from JS/TS unit tests alone; requires `.github/workflows/androidApk.yml` & Xcode/EAS release builds. | **NOT TESTED (Env)** |

---

## 2. Executed Mobile & Crypto Verification

- `@nantty/chat-crypto` (`vitest run`): **14/14 files, 98/98 tests passed** (includes X3DH/Double Ratchet/Sender Key test vectors, store team member removal key rotation, large-group mailbox distribution).
- `@nantty/mobile` (`jest src/services/ src/contracts/ --runInBand`): **69/69 suites, 307/307 tests passed** (includes `decryptedMediaAtRest.test.ts`, `encryptedChatSends.test.ts`, `nativeStoreBilling.service.test.ts`, `humanVerification.service.test.ts`, `realtimeSocketToken.test.ts`, `parityExtensions.service.test.ts`).
- `@nantty/messenger` (`tsx --test src/**/*.test.ts`): **37/37 tests passed** (includes `encrypted message page response contract`, multipart upload abort on tampered chunk plans, Story reply ciphertext-only invariant, bubble deep-link validation).

> **Honesty Guardrail**: Passing TypeScript (`tsc --noEmit`), Jest, and `tsx` suites does **not** prove native iOS/Android runtime security, Keychain entitlements, or ProGuard behavior. Native CI/device verification remains mandatory prior to store release.
