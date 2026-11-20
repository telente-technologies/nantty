# Nantty Webhook Security Assessment (Inbound & Outbound)

- **Scope**: All inbound provider webhook/callback receivers (`Flutterwave`, `Apple App Store`, `Google Play`, `Smile ID`, `Kwikpik`, `LiveKit`) and outbound customer/developer/seller/social HTTP fetchers (`Developer/Sandbox Webhooks`, `Seller Webhooks`, `Social Link Preview Unfurler`).

---

## 1. Inbound Webhook Security Matrix

| Provider / Endpoint | Authentication & Integrity Check | Replay / Size / Flood Controls | Status |
| --- | --- | --- | --- |
| **Flutterwave** (`POST /api/v1/webhooks/payments/flutterwave`) | Constant-time `Verif-Hash` / `flutterwave-signature` check (`webhookProcessing.service.go`). | `1 MiB` `MaxBytesReader`; SHA-256 digest + unique `(provider, event_key)` in `webhook_events`; card secrets redacted prior to raw payload storage. | **Verified in Source** *(live sandbox blocked)* |
| **Apple / Google Play Refunds** (`POST /api/v1/webhooks/stores/{store}`) | Apple JWS certificate chain + OID + ES256; Google Play constant-time push token / RS256 OIDC JWT (`webhooks.controller.go`). | `1 MiB` `MaxBytesReader`; transaction binding (`SEC-2026-002`). | **Verified in Source** *(live sandbox blocked)* |
| **Smile ID KYC** (`POST /api/v1/webhooks/smile-id{,/web-sdk,/hosted-link}`) | HMAC-SHA256 (`VerifySmileIdSignature`) + callback timestamp freshness (`SmileCallbackTimestampIsFresh`) + case/user/product/captureAttempt binding (`applySmileResult.handler.go`); Terraform restricts callback SG/WAF rules to Smile ID documented IPv4 `/32` CIDRs. | `256 KiB` `MaxBytesReader`; `25s` processing timeout; idempotent replay counter on completed cases. | **Verified in Source** *(live sandbox blocked)* |
| **Kwikpik Logistics** (`POST /api/v1/logistics/webhooks/kwikpik`) | HMAC-SHA256 (`X-Kwikpik-Signature` `t=...,v1=...`) verified with secret (`kwikpik.webhook.go`); Gateway configured with `exactPathOnly: true, rawBodyPassthrough: true`. | `1 MiB` `io.LimitReader`; deterministic `ProviderEventId` fallback hash for deduplication. | **Verified in Source** *(live sandbox blocked)* |

---

## 2. Outbound Webhook & Link-Fetch SSRF Hardening

| Subsystem | Location | SSRF / Signing / Redirect Controls | Verification |
| --- | --- | --- | --- |
| **Sandbox Webhooks** | `services/typescript/sandbox/src/webhookSecurity.ts` | Rejects non-HTTPS (except local dev), credentials in URL, non-standard ports, private/reserved IPv4 & IPv6 **including Teredo `2001::/32` (`SEC-005`)**, DNS rebinding via pinned address, and redirects. | **PASS** (`webhookSecurity.test.ts` 14/14) |
| **Seller Webhooks** | `services/go/modules/orders/src/modules/sellerDevelopers/{sellerDevelopers.webhooks.go,sellerDevelopers.safeClient.go}` | `IsSafePublicWebhookUrl` + `ValidateWebhookDNS` at create/update/dispatch; `NewSafeWebhookClient()` enforces `net.Dialer.Control` socket-time IP check (`netip.ParseAddr` unmapped, rejecting private/loopback/link-local/CGNAT/RFC5737/2001:db8) and disables redirects (`http.ErrUseLastResponse`); signs payloads with `whsec_` (`crypto/rand`) `Nantty-Signature`. | **Verified in Source** *(Go CI pending)* |
| **Social Link Previews & oEmbed** | `services/typescript/social/src/integrations/safeHttpFetcher.integration.ts` & `utils/ssrfGuard.util.ts` | Blocks non-canonical numeric/hex IPs, internal suffixes, private/CGNAT/NAT64/6to4/Teredo (`0x2001` & `second === 0`)/ULA/link-local IPv6, pins TCP `lookup` to validated IP, bounds response bytes (512 KiB HTML / 64 KiB oEmbed / 5 MiB image), and caps redirects with re-validation per hop. | **Verified in Source** *(Prisma CI pending)* |
