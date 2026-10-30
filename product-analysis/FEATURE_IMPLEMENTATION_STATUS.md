# Feature implementation status

Audit date: 2026-10-29. “Implemented” indicates repository code exists, not production deployment or complete QA.

| Area | Status | Notes / evidence |
|---|---|---|
| Accounts, sign-in, recovery, privacy | Implemented | Go auth/users and gateway; webapp/mobile screens and services. Recovery and baseline privacy should remain free. |
| Profiles, business links, private follow requests | Implemented / verify runtime | Profile types and linked-profile entitlement service exist. Premium profile cap is server-enforced; one owned store remains a separate invariant. |
| Feed, posts, replies, reactions, repost/quote | Implemented | TypeScript social service owns post routes/models and frontend feed clients. |
| Stories/clips/media | Implemented, provider/UX-dependent | Media service and mobile/web clients exist; processing and UI cross-platform testing remains needed. |
| Chat/notifications/realtime | Implemented, integration-sensitive | Gateway, notifications and Elixir realtime components exist; authorization and delivery need runtime QA. |
| Creator program/affiliate/fan subscriptions | Partially implemented | Creator approval is independent from paid plans; related backend modules and Studio UI exist. Verify payout/settlement flows before describing as production-ready. |
| Video live | Implemented, gated | Live module and clients exist; default host requirement is Creator Program approval. |
| Audio Spaces | Partially implemented | UI and backend/gateway/realtime paths exist; exact integrated behavior requires end-to-end verification. |
| Store/catalog/inventory/orders | Implemented | Go catalog/inventory/orders plus seller UI; seller plan resolver has server gates and capacity limits. |
| Checkout/escrow/wallet | Implemented, financial-critical | Payments/escrow/ledger/wallet modules exist. Fresh-install escrow commission defaults now align with the founder's 0% sales-commission policy; previously persisted platform revenue settings were not queried and must be audited before staging. No live or sandbox payment test was part of this audit. |
| Ads and ad credits | Partially implemented | Ads campaign service/app and tier ad-load defaults exist; each credit/eligibility behavior needs separate runtime verification. |
| Analytics | Partially implemented | Analytics service and UIs exist; feature range gates are incomplete/inconsistent across plan catalogues. |
| Verification and commercial checkmarks | Implemented with taxonomy inconsistency | Three colors exist, but multiple Blue/Gold tiers plus a Gold bundle and seller plan codes exceed the requested simple model. Black is non-self-serve. |
| Subscription price/billing lifecycle | Implemented | Regional defaults seed `plan_prices` when missing; staff can update persisted prices. Current active DB values unavailable. |
| Post scheduling | Implemented, paid entitlement enforced | Create and reschedule check an active paid Blue/Gold entitlement server-side, with a 90-day horizon and no tier queue cap. The worker and cursor-paginated list exist; content/media editing, transient-failure backoff and full publication-time moderation remain gaps. See `POST_SCHEDULING_ARCHITECTURE.md`. |
| Public developer API | Missing or unverified | `api_webhooks` entitlement exists, but no public developer credential/API surface was found. |
| Admin controls | Implemented, reconciliation needed | Admin UI/config and backend plan catalogue exist; mock seed, support copy, seller-plan enforcement and subscription plan perks diverge. |

## Items that are planned or unverified

- Paid post scheduling is now server-gated on creation and rescheduling; entitlement lifecycle, publication retries and full end-to-end QA remain to be verified.
- Public developer API/webhook access is referenced by entitlements/help but not confirmed as a working end-to-end feature.
- Production active plan prices, runtime subscription cache/expiry transitions and cross-service entitlement behavior require a connected isolated runtime/database to verify.
- Creator and Space integrations require full gateway-to-service/mobile/web end-to-end checks before launch claims.
