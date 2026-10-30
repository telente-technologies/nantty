# Attack surface inventory

## Public and user-facing surfaces

- Next.js/Expo authentication, registration, OTP, social sign-in, password recovery and session refresh/revocation.
- Gateway API route table (current static tool count: 241 route entries), including profile/social graph, private accounts/follow requests, comments/messages, media, marketplace, orders/escrow, wallet/payouts, creator subscriptions/affiliates, ads, support, staff/admin and webhooks.
- Phoenix WebSocket ingress and room/event authorization.
- Upload intent/chunk completion, media processing/moderation, signed CDN downloads and private KYC document access.
- Static marketing waitlist and Google Apps Script integration (external endpoint; not probed in this repository-only audit).

## Backend and internal surfaces

- Go route inventory across identity, catalog/commerce, money, live, ads and trust deployables.
- TypeScript APIs for gateway/social/media/notifications/search/support.
- Internal Python intelligence HTTP routes protected by signed requests; they are intentionally not public gateway routes.
- RabbitMQ event consumers/outbox relays, Valkey session/rate state, AWS SQS/SES feedback, service health/ready routes, migration jobs and internal mTLS endpoints.
- Staff authorization: admin/staff route classification, staff-specific IP policy, permission checks, step-up actions, maker/checker and audit log records.

## High-value assets

Account credentials and tokens; PII, age/guardian and KYC records; private profile/follow state; private chat and live room membership; order address and delivery details; wallet balances, coins, ads credits and append-only ledger; escrow/refund/withdrawal state; seller inventory and business access; moderation reports and child-safety material; private uploads and signing keys; service tokens, DB credentials and Terraform state.

## Principal attacker paths considered

- Anonymous user abuses auth/recovery/OTP and enumeration endpoints.
- Authenticated user changes object IDs or roles to read/write another account’s resources.
- Suspended/private user or blocked relationship bypasses visibility constraints through alternate API/feeds.
- Seller/creator manipulates checkout, escrow, inventory, affiliate attribution, ads credit or payout state.
- Attacker replays/forges webhook, queue message, upload completion or signed URL.
- Compromised low-privilege service pivots through shared DB grants, service network, cache or queue.
- Malicious media/document consumes storage/CPU or bypasses malware/moderation inspection.
- Client exhausts expensive search/media/AI endpoints or amplifies retries during dependency outage.
- CI identity or infrastructure misconfiguration exposes secrets, public storage or privileged cloud APIs.

## Route inventory caveats

The current read-only run of `security/authorization/routeInventory.py` reported 1,247 backend route definitions and 241 gateway entries. Its heuristic classified 1,068 as routed, 127 as hidden internal routes, 35 as unrouted, 10 as optional-auth mutations without a recognized route-level guard, 6 as operations endpoints, and 1 as an upstream mismatch. These are triage counts, not vulnerabilities: the regex classifier cannot follow controller guards, distinguish all intentionally internal routes, or prove runtime gateway behavior.

Manual source review of the 10 optional-auth candidates found the eight `/api/v1/auth/*` calls are public authentication flows protected by auth rate limiting; `PUT /api/v1/consents` is the anonymous/device-consent endpoint, distinct from authenticated `/api/v1/users/me/consents`. The affiliate click endpoint is an intentional public attribution target and is separately routed through the gateway; this source review does not establish abuse resistance under dynamic testing. The reported `/api/v1/reports` mismatch is a duplicate route definition: the gateway forwards the endpoint to the TypeScript social service, which registers that route; the Go moderation deployable also registers it. This indicates an architectural overlap/legacy route, not a demonstrated exposure or bypass. The 35 unrouted results include intentionally hidden intelligence APIs and widget/operations routes; each requires service-specific review before treating it as a gap.

The earlier Space route gap is closed in source and unit-tested, but no live gateway-to-Go request was run. Static contract tests were rerun on 2026-10-29: 5/5 passed. The route inventory is source-only and should be regenerated after meaningful API or gateway route changes.

## Local test environment boundary (2026-10-29 refresh)

- A single harmless request to `http://127.0.0.1:8081/status` returned `200` with `packager-status:running` and `X-React-Native-Project-Root: /home/oyinlola/Desktop/zudomart/apps/mobile`. Process metadata identifies the listener on `*:8081` as this repository's Expo mobile development server. The wildcard bind is a local developer-workstation exposure to assess against host firewall/LAN policy; this request did not test remote reachability, and no exploit is claimed.
- Listeners on ports 80 and 9876 could not be attributed to this application from available process metadata and were not probed. Existing containers include a persistent Nantty Postgres database on `127.0.0.1:15432` and unrelated BetNG Postgres/Redis ports; none were contacted. No full backend stack or disposable complete stack was started.
- Consequently, this refresh does not add dynamic evidence for backend authentication, BOLA/IDOR, file storage, payment-provider ingress, WebSocket room authorization, brokers, AWS, Cloudflare/WAF, or service capacity. Those remain explicitly unverified in `TEST_COVERAGE.md` and `REMAINING_RISKS.md`.
