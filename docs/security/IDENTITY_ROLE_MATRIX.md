# Nantty Identity, Role, Tenancy & Privilege Matrix (Phase 1.1)

## 1. Identity & Token Classes

| Identity Class | Issuer / Verifier | Audience / Scope | Storage / Transport | Revocation Mechanism |
| --- | --- | --- | --- | --- |
| **Consumer User Session** | `goIdentity` (`auth`) / Gateway + `realtime` + Go modules | `aud: nantty-api`, `scope: api` or `realtime` | Web: `HttpOnly; Secure; SameSite=Lax` BFF cookies; Mobile/API: Bearer JWT + refresh token | Valkey session/account denylist (`AccessTokenVerifier`), ETS `RevocationList` (`realtime`), DB `sessions` |
| **Admin Staff Session** | `goIdentity` (`auth`) / Gateway `adminStaffGate` + Go staff middlewares | Staff audience + `roles`/`permissions` + `mfaVerified` | `apps/admin` BFF `HttpOnly` cookie + `x-step-up-token` | Session revocation + single-use step-up JTI consumption + IP allowlist (`adminNetwork`) |
| **Widget Token** | `goIdentity` / Gateway `WidgetTokenVerifier` | Scoped widget endpoints (`acceptsWidgetToken: true`) | Mobile SecureStore | Valkey widget-token denylist; rejected with `401 WIDGET_TOKEN_SCOPE` on all non-widget routes |
| **Developer Portal Local Session** | `goIdentity` (`developerPortal`) | Portal orgs / sandbox credentials | `apps/developer` `HttpOnly` cookie | Explicit logout session revocation + cookie clear |
| **Developer SSO Session** | `goIdentity` (`developerSso`) | Production business/developer APIs | PKCE S256 (`code_challenge`) -> `HttpOnly` SSO cookie | Atomic code consumption + active session validation at exchange |
| **Sandbox / Business API Key** | `sandbox` / `goIdentity` (`developerProduction`) | `sandbox-api` or scoped `business:*` endpoints | Bearer token (`nt_sbx_*` / `nt_live_*`) hashed at rest | Instant credential revocation + environment isolation (`SANDBOX_CONTROL_TOKEN`) |
| **Service-to-Service Internal** | Internal callers -> Target service | `/internal/*`, `/v1/*` (`intelligence`) | `X-Internal-Token` (constant-time) or `intelligence` HMAC-SHA256 + timestamp + nonce | Gateway `isInternalOnlyPath` blocks external ingress (3x decode + segment check) |

---

## 2. Multi-Tenant & Acting-Profile Authorization Model

| Surface | Tenant / Ownership Key | Verification Source | Critical Invariants |
| --- | --- | --- | --- |
| **Acting Profile (`asProfileId`)** | `ownerUserId` / `accountId` | `directory.findOwnedPostableProfile(accountId, profileId, "publish")` | User cannot post, schedule, subscribe, or manage verification for a profile they do not own or lack publish rights on. |
| **Seller Store (`X-Seller-Store` / `:storeId`)** | `storeId` + `accountId` membership + store RBAC | `goCommerce` `stores` membership + `apps/seller` BFF policy | Store staff restricted by role (`orders`, `products`, `finance`, `messages`, `settings`); destructive/money actions require owner or step-up; `checkoutCart` blocks self-buying (`store.OwnerAccountId == buyerId`). |
| **Store Inbox (`storeInbox`)** | `storeId` + `storeTeamUserIds` | `social/storeInbox` (`sendStoreMessage`, `openStoreConversation`) | Internal callers must supply a `senderAccountId` verified inside `resolveEncryptionRecipients(...).storeTeamUserIds` (`NOT_STORE_INBOX_MEMBER`) with registered `deviceId`. |
| **Ad Account (`accountId`)** | `adAccountId` + `myRole` | `goAds` membership (`owner`/`admin`/`advertiser`/`analyst`) + `apps/ads` BFF | Cross-account campaign/creative/balance access denied; `/accounts?denied=` shown on membership mismatch. |
| **Developer Organization & App** | `organizationId` + `applicationId` + capability | `goIdentity` `capabilities/me` -> `apps/developer` BFF | `apps/developer` enforces `credentials.manage` / `webhooks.manage` and exact application ownership **before** minting `SANDBOX_CONTROL_TOKEN` calls to `sandbox`. |
| **Black Government Organization** | `profileId` (`profileType == "government"`) + `ownerUserId` + `BlackApplication` | `goIdentity` (`BlackVerificationReader`) + `goMoney` (`subscriptions`) | Only owner of `government` profile with `status == "approved"`, `institutionalEmailVerified == true`, and unexpired `privateCheckoutEnabled` may view pricing or check out; revocation terminates entitlement and settlement fails closed. |
| **E2EE Messaging & Devices** | `accountId` + `deviceId` + `conversationId` membership | `social` `conversationMember` + `deviceKeyRepository` | Non-members cannot list messages, recipients, or send; sender must register `deviceId`; `storeInbox` and `messages` forbid plaintext fields. |
| **Creator Program & creator cash-out** | Account + canonical `creators.creator_program_members` membership | Users adult-age/eligibility policy; Wallet reads the Creators entitlement via `WALLET_CREATOR_PROGRAM_SCHEMA` | Seller/business status is not Creator Program membership. Coin conversion and scheduled creator-earnings payout require approved Creator Program membership, payout verification, eligible creator-earned ledger funds and standing/hold checks; missing membership or entitlement-store read failure denies/skips the operation. Existing Creators migration grants required columns to `nantty_readers`. |
| **Live Stream & Co-Host / Stage** | `liveId` + `hostAccountId` / stage invite | `goLive` `WithActorAndLive` | Only stream owner/authorized staff can mutate overlays, scenes, studio controls, or end stream. |

---

## 3. Privilege Escalation & Step-Up Controls

1. **Suspended Account Guard (`gateway/suspendedAccountGuard`)**: Blocks all mutations (`POST`/`PUT`/`PATCH`/`DELETE`) for suspended principals except explicit appeals/logout/delete-account routes.
2. **Policy Acceptance Gate (`gateway/policyAcceptanceGate`)**: Returns `428 POLICY_ACCEPTANCE_REQUIRED` when legal policy re-acceptance is pending; fails closed `503` if lookup fails.
3. **Human Verification Gate (`gateway/humanVerificationGate`)**: Escalates repeated rate-limit abuse (`>=3` strikes in 300s) or risk signals to `428` Turnstile challenge; validates token server-side.
4. **Admin MFA & Single-Use Step-Up**: Sensitive staff endpoints (`escrow/refund`, `escrow/release`, `government-black/*/cancel|retry|reconcile`, `admin/withdrawals`, `admin/ad-credit`, `bulk-email`) require `RequireStaffPermissionWithSingleUseStepUp` + audit reason (`400` if blank).
5. **IAP Subscription Binding (`SEC-2026-002` Hardened)**: `RedeemStoreSubscription` now binds existing `StoreOriginalTransactionID` rows strictly to `OwnerUserID == request.UserId` and `ProfileID == profile.ProfileId`, preventing cross-account renewal hijacking and cross-profile rebinding.
