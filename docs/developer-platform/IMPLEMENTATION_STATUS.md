# Implementation Status & Production Readiness Checklist

Branch: `arena/8e0ba5aa-nantty`

## Honest Status Summary
- **Implemented (Unverified at Runtime — `IMPLEMENTED_UNVERIFIED`)**:
  - Developer Portal public website, OpenAPI 3.1 contract, PKCE S256 SSO (`auth` + `apps/developer`), approval-gated production credential create/rotate/revoke, verified HMAC webhooks, SSRF-safe delivery worker, organization billing status/read endpoints, Onboarding, Products, Connected Businesses, Audit Logs, and Sandbox bridge.
  - Sandbox control plane (`apps/sandbox` + `services/typescript/sandbox`).
  - Admin Developer Ops console (`apps/admin/src/app/(console)/developers` + `auth/src/modules/adminDeveloperOps`).
  - Seller Developer API (`orders/src/modules/sellerDevelopers` + Gateway routes).
  - Messenger (`apps/messenger`) screens using `@nantty/design-tokens/native`, E2EE `@nantty/chat-crypto`, Stories, Android chat bubbles & notification actions (see `apps/messenger/docs/CHAT_BUBBLES_IMPLEMENTATION_STATUS.md` for detailed capability/Android NDK/iOS Xcode status), plus newly added business conversation disclosures (`ConversationScreen.tsx`) and inbox filter tabs (`InboxScreen.tsx`).
- **Blocked / External & Toolchain Gates (`UNVERIFIED`)**:
  1. **CI / Local Build & Tests**: Run `pnpm install`, `tsc --noEmit`, `next build`, `vitest`, and `go test ./...` in a fully equipped environment (`go`, `pnpm`, `tsc`, `eslint`, and `node_modules` were absent in the workspace container).
  2. **Database Migrations**: Apply `auth` migrations `20261116160000`, `20261116170000`, `20261116190000`, `analytics` `20261116150000`, and `orders` `20261116180000` (plus regenerate Atlas checksums if required by CI).
  3. **Visual & Device QA**: Capture desktop/tablet/mobile light & dark browser screenshots for `apps/developer`, `apps/sandbox`, and `apps/admin`, and test `apps/messenger` on real Android & iOS devices.
  4. **Commercial PSP & Legal Sign-off**: Wire external payment settlement provider for Developer subscription checkout and publish counsel-approved Developer Terms & Acceptable Use Policy.
  5. **Business Messaging core integration**: Public send/conversation routes deliberately return `503 BUSINESS_MESSAGING_UNAVAILABLE`; the repository has no canonical recipient-consent owner, internal message-dispatch receiver, message-history/status synchronization, template/media/interactive-message contract, read/delivery receipt integration, or human-handover workflow. Do not enable the API until these are implemented and end-to-end tested.
  6. **Developer commercial billing lifecycle**: Paid checkout remains fail-closed; verified payment activation, payment-reference replay protection, renewals, cancellation, proration, invoices, reconciliation, and lifecycle notifications are not implemented. Do not represent plan tiers as purchasable.
  7. **Admin Developer Ops scope**: Current Admin routes cover application review and organization quota edits with transactional audit only. Developer organizations/applications, billing and regional pricing, webhook/Sandbox operations, subscription/usage adjustments, and broader audit workflows remain incomplete.
