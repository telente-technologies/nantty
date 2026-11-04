# Logistics seller workflow and event notifications (V1)

**Status:** product/integration specification. A seller-reported failed-attempt event now has a buyer-only in-app/push mapping. Kwikpik provider event mappings, the adapter, partner shipment persistence, and logistics-specific email templates are not implemented yet. Existing order email and notification infrastructure is implemented; it must be extended and verified for provider events before launch.

**Decision recorded:** sellers have two planned delivery modes: **Manual delivery** and **Nantty Partner delivery (Kwikpik)**. Kwikpik is the sole logistics partner in this V1 scope. Sellers may use manual delivery and are not forced to opt into the partner service. The seller application captures an explicit logistics-capability choice, but it is not yet an active store-level booking switch. Buyers and sellers are intended to track shipments inside Nantty; Nantty sends its own push and transactional email updates. Buyer/seller phone numbers are required for provider booking when the approved provider contract needs them and are shared only after clear consent. Required shipment names and physical addresses may also be shared where the contract requires them. Never send customer or seller email addresses to Kwikpik; if the provider requires an email, use only Nantty's company-controlled `LOGISTICS_CONTACT_EMAIL`. No provider adapter or booking path is live today.

Related implementation and provider mapping: [logisticsV1.md](./logisticsV1.md), [events.md](./events.md), and the [email template registry](../../packages/emailTemplates/src/templates/templateRegistry.ts).

Normal event-template emails, including future logistics notifications, are queued after the domain event is consumed and are not sent inside the order/shipment transaction. The notifications worker retries three times after the initial attempt, persists exhausted failures, and exposes them to support staff; see [notificationDelivery.md](./notificationDelivery.md). The Kwikpik adapter, provider event mapping, and logistics-specific email templates remain unimplemented, and deployment of the queue/migration is not verified.

## 1. What exists today

| Area | Verified state | Source evidence |
| --- | --- | --- |
| Seller order-delivery overview | Existing order-bound table, status filters, summary tiles, and shipment dialog. It uses seller API query paths `/seller/delivery/summary` and `/seller/delivery/shipments`. | `apps/seller/src/components/delivery/deliveryPipelineView.tsx`; `apps/seller/src/types/delivery.type.ts` |
| Manual fulfillment | Seller order fulfillment captures courier, tracking number/URL, and fulfillment location. | `apps/seller/src/components/orders/orderFulfilmentForm.tsx` |
| Seller delivery preferences | Existing seller settings page has notification toggles, including order and payout emails. | `apps/seller/src/components/settings/notificationSettingsForm.tsx` |
| Seller delivery API behavior | Mock handlers exist for delivery and shipping settings. They are not evidence of a connected provider integration. | `apps/seller/src/mocks/handlers/deliveryHandlers.mock.ts`; `apps/seller/src/mocks/handlers/shippingHandlers.mock.ts` |
| Seller market and capability gate | Seller applications require the account country to be `NG`, and the application requires an explicit yes/no logistics-capability choice. This is application eligibility/capability capture, not active provider booking authorization. | `services/go/modules/catalog/src/services/sellerMarketEligibility.service.go`; `services/go/modules/catalog/src/modules/sellerApplications/validators/sellerApplications.validator.go`; `.../commands/submitApplication/submitApplication.handler.go` |
| Admin undelivered-order review | A permission-gated queue shows held funds, order parties, and shipment details; staff decisions require a reason, step-up, idempotency, and audit logging. The queue now exposes only safe HTTPS carrier tracking links for investigation. | `apps/admin/src/components/money/undeliveredReviewWorkspace.tsx`; `services/go/modules/escrow/src/modules/escrows/routes/escrows.routes.go`; `services/go/modules/escrow/src/modules/escrows/services/escrowViews.service.go` |
| Admin logistics shipment queue | A read-only shipment queue is exposed behind the `logistics:read` staff permission. Database-backed filtering and live environment access still require integration verification. | `services/go/modules/orders/src/modules/adminOrders/routes/adminOrders.routes.go`; `.../queries/listAdminLogisticsShipments/` |
| Order notification events | Notifications service maps order-group shipped/delivered events and existing order shipped/delivered events to in-app/push and email intents where required data is present. | `services/typescript/notifications/src/modules/eventIngestion/mappings/eventMappingRegistry.ts`; `.../mappings/orders.mapping.ts` |
| Seller-reported failed delivery attempt | The seller fulfillment action emits `orderGroup.deliveryAttemptFailed`; notifications send the buyer a neutral in-app/push update with the order ID and attempt count. Seller-entered note text is not forwarded, and no email is sent for this event. | `services/go/modules/orders/src/services/deliveryOperations.service.go`; `services/typescript/notifications/src/modules/eventIngestion/mappings/orders.mapping.ts`; `services/typescript/notifications/tests/orderGroupMapping.test.ts` |
| Email rendering and delivery | Typed templates render HTML and plain text. Delivery checks verification, suppression, preference, and dedupe state. | `packages/emailTemplates/src/templates/templateRegistry.ts`; `services/typescript/notifications/src/modules/delivery/services/emailDelivery.service.ts`; `notificationDispatcher.service.ts` |
| Admin template screen | The screen lists and previews the registered catalogue (including sample HTML/plain text). Its API is read/preview only; it does not author or publish templates. | `apps/admin/src/components/emailTemplates/emailTemplatesWorkspace.tsx`; `services/typescript/notifications/src/modules/emailTemplates/controllers/emailTemplates.controller.ts`; `.../routes/emailTemplates.routes.ts` |
| Generic admin email drafts | `account-update`, `support-follow-up`, and `product-news` are static generic entries, not logistics templates and not the typed template registry used for event mail. | `services/typescript/notifications/src/constants/adminEmailTemplates.constant.ts` |
| Kwikpik lifecycle emails | No logistics-specific provider event mapping or registered Kwikpik shipment email template was found in the notifications event registry/template package. | Registry and template package search; add implementation and tests before claiming support. |

The existing order emails (`orderShipped`, `orderDelivered`) may be reusable for a single order-level shipment transition. They do not by themselves cover partner booking, pickup, in-transit milestones, provider exceptions, failed bookings, or seller-created bulk jobs. The seller-reported `orderGroup.deliveryAttemptFailed` mapping is a separate, non-provider event and intentionally does not send email. Avoid sending both an order-level delivery email and a partner-specific duplicate for the same state transition.

## 2. Seller frontend information architecture

### Delivery settings

Present two explicit, independent modes:

1. **Manual delivery** — seller manages their courier/rider and enters tracking/progress in Natty. Keep the existing fulfillment flow available.
2. **Natty Partner delivery (Kwikpik)** — opt-in service for eligible sellers. Explain the data sharing and service terms before activation.

Partner setup should collect and validate pickup address, pickup contact name/phone, service availability, and other fields the confirmed Kwikpik request schema requires. Do not collect package dimensions. Use weight and the confirmed provider mapping; never let the browser choose the quoted fee or mark a booking paid.

Consent record should include the legal text/version, seller/store account, accepting actor, timestamp, and scope. The disclosure must say that required delivery contact names, addresses, and phone numbers are shared with Kwikpik to arrange and track delivery. It must state that Natty sends the customer email updates and that email addresses are not sent to Kwikpik. Do not enable booking until consent and eligibility checks pass server-side. Define the effect of opting out on already booked shipments before implementation; do not silently cancel active deliveries.

### Delivery workspace

Keep one seller workspace with clear filters or tabs for **All**, **Manual**, and **Natty Partner**. Each row should identify the delivery mode and display shipment state separately from delivery-fee/payment state. Preserve order-bound shipments in the existing order delivery list. Give seller-created/bulk delivery jobs a distinct list and resource identity; do not fabricate an `orderId` for a job that has no customer order.

Partner detail panel should include Natty tracking timeline, selected service, quoted/charged amount and currency, booking reference, latest provider update time, contact/support action, and any seller action required. Do not send users to a Kwikpik app or third-party tracking page as the primary experience. A provider-supplied tracking URL may be retained internally for support, but the Natty UI uses its own tracking route.

Manual detail panel should retain seller-entered courier/rider/tracking fields and record who changed each status and when. Manual and partner status vocabularies should map to a common display timeline without pretending that manual events have provider verification.

### Seller-created and bulk deliveries

Treat independent merchant jobs as a separate paid/entitled workflow only after the plan gate and seller eligibility are confirmed. Show row-level validation, quote expiration, partial provider acceptance, and a final confirmation containing the exact charge and payer. Bulk partial success must report each accepted/rejected row; never tell the seller the entire batch succeeded based only on an HTTP 2xx response.

## 3. Canonical logistics event contract

The logistics domain should publish durable events after its state transition commits. Webhook ingestion must verify the provider signature, persist the event, deduplicate by provider event identity, and update the shipment state idempotently. The notification consumer must not trust free-form provider text as email HTML or as an action URL.

Proposed event names (subject to repository event naming/schema review):

| Event | Recipient(s) | In-app / push | Email decision | Notes |
| --- | --- | --- | --- | --- |
| `delivery.partnerBookingRequested` | Seller | In-app pending state | No email by default | Internal intent; wait for provider result. |
| `delivery.partnerBookingConfirmed` | Seller and buyer | Both; buyer gets tracking link | Yes, one confirmation per shipment to each account | Only after provider confirms booking and any required payment is confirmed. |
| `delivery.partnerBookingFailed` | Seller; buyer only if order impact/action is relevant | Seller receives actionable error; buyer gets neutral order update if delayed | Seller email; buyer email only for material delay/cancellation | Never include credentials or raw provider error payload. |
| `delivery.pickupScheduled` / `delivery.pickedUp` | Seller and buyer | Timeline update; push for material transitions | Email on confirmed pickup; avoid duplicate scheduled/picked-up messages if same milestone | Use provider-confirmed timestamp. |
| `delivery.inTransit` | Buyer; seller dashboard event | Timeline and push, subject to rate/dedupe policy | Email for first in-transit event; intermediate scans are grouped or in-app only | Do not email for every scan. |
| `delivery.exception` | Seller and buyer as appropriate | Immediate actionable alert and tracking timeline | Yes when a party must act or delivery is materially delayed | Tailor action to responsible party; suppress repetitive duplicate exceptions. |
| `delivery.attemptFailed` | Buyer and seller | Notify both with next step | Yes, usually buyer plus seller | Include redelivery/contact instructions only if actually supported. |
| `delivery.delivered` | Buyer and seller | Timeline update; buyer confirmation action if applicable | One buyer delivery email; seller email only if useful and not redundant | Coordinate with `orderGroup.delivered` to prevent duplicate mail. |
| `delivery.cancelled` | Seller and buyer | Explain cancellation and order consequences | Yes when a booking/order is cancelled or a refund/next action is needed | Separate carrier cancellation from order cancellation. |
| `delivery.refundRequested` / `delivery.refundResolved` | Seller; buyer when charge/order affected | Payment state update | Email when money is charged, refunded, or action is required | Use confirmed ledger/provider state, not a request alone. |
| `delivery.bulkBatchCompleted` / `delivery.bulkBatchPartiallyFailed` | Seller/job creator | Summary with counts and links to row results | One summary email per batch, especially partial failure | No per-row email storm. |
| `delivery.manualStatusChanged` | Buyer; seller actor sees confirmation | Buyer timeline and push for shipped/delivered | Reuse existing order email only for meaningful milestones | Record actor and evidence; no carrier webhook assertions. |

Use a stable event ID and shipment/job ID, aggregate version, occurred-at timestamp, source (`manual` or `kwikpik`), and minimal opaque account/store IDs. Keep phone, email, full address, payment credentials, and unredacted provider payload out of broad event fan-out where consumers do not need them. Contact details required by Kwikpik belong only in the provider request path and appropriately restricted shipment record.

## 4. Email event map across the application

This is a product notification policy map, not a claim that every row is already wired. Current mappings are discoverable in `eventMappingRegistry.ts`; actual email intent is defined per mapping and must be checked rather than inferred from the existence of a domain event.

| App event family | Email policy | Current source state |
| --- | --- | --- |
| Registration, OTP, password change, new device, session reuse/security | Send security/verification messages when the event requires it. Never include a reusable credential except a short-lived, single-use verification token delivered through the intended flow. | Event mappings exist for account/security events; verify exact email coverage and message kind in `identity.mapping.ts` before expanding. |
| Order placed/awaiting payment, payment confirmed, seller accepted/rejected, shipped, delivered, cancelled/completed | Email only for meaningful lifecycle transitions; preserve buyer/seller role separation and per-store order grouping. | Existing templates and mappings include order/payment/shipped/delivered flows; inspect `orders.mapping.ts` and `buyerOrders.template.tsx`/`sellerOrders.template.tsx`. |
| Kwikpik booking, pickup, transit, exception, failed attempt, delivery, cancellation | Use the logistics event matrix above; do not mail on every tracking scan. | Not yet mapped as provider-specific logistics events. |
| Payment, wallet, escrow, refunds, disputes, payout/withdrawal | Email confirmed financial state changes and actionable failures; do not claim funds moved until ledger/provider confirmation. | Existing mappings/templates exist in `escrowMoney.mapping.ts` and payment/escrow templates; reconcile against authoritative ledger events. |
| Subscription trial, renewal, payment failure, grace period, downgrade, price change/card expiry | Email action-required and legally/contractually significant changes; include plan, amount/currency, renewal date, and manage link from authoritative subscription data. | Existing mapping module and templates present; individual statuses are enumerated in `eventMappingRegistry.ts`. |
| Verification, seller/creator applications, checkmark changes | Email submitted/approved/rejected/revoked decisions and required actions; do not expose sensitive review evidence. | Existing verification mappings and templates present. |
| Support ticket created/replied/resolved and legal/privacy notices | Email confirmations/replies/resolutions or required notices. | Existing support mappings and notice/email delivery flows present. |
| Social activity (likes, follows, comments, mentions, messages, gifts, live) | Prefer in-app/push and configurable digests; avoid noisy per-event email unless the product explicitly enables a meaningful digest or user-selected alert. | Many event mappings exist; not all event types should emit email. Notification intent is explicitly optional per event. |
| Seller operational alerts (low stock, daily/weekly reports) | Separate optional operational/report preferences from essential order/delivery messages; batch summaries and enforce frequency limits. | Seller settings UI contains mock-backed toggles; typed seller email templates include low-stock and payout examples. Validate persistence and backend enforcement before claiming effective controls. |

## 5. Email template catalogue and draft readiness

There are two different concepts in the repository:

- **Typed production template catalogue:** `packages/emailTemplates/src/templates/*` and `templateRegistry.ts`; templates have audience, kind, trigger, typed props, sample data, and render to HTML and plain text. The admin page retrieves and previews this catalogue through `/admin/email-templates` and `/admin/email-templates/:key/preview`.
- **Static generic admin draft list:** `adminEmailTemplates.constant.ts` contains three generic examples (`account-update`, `support-follow-up`, `product-news`). This is not the logistics template source, and it is not a create/edit/publish workflow.

Therefore, the current admin “Email templates” screen makes registered templates visible and previewable, but does not make logistics drafts available for editing or event activation. New event emails should be added to the typed package, registered in `templateRegistry.ts`, mapped from a domain event in the notifications service, and covered by rendering/mapping tests. The admin catalogue should then expose them automatically if its backend catalogue uses that registry. Do not add a template to the generic draft constant and assume the notification dispatcher can send it.

### Proposed logistics template set

Prefer a compact, reusable set, with `deliveryMethod`, `trackingUrl`, `orderNumber`/`batchReference`, `serviceName`, `estimatedDelivery`, `fee` and `actionRequired` as typed optional/contextual props where appropriate:

1. `deliveryBooked` — booking confirmed, tracking button to Natty, service/estimate and contact expectation.
2. `deliveryException` — concise issue, who must act, deadline/next step, Natty tracking link.
3. `deliveryAttemptFailed` — attempt time and verified next-step instructions.
4. `deliveryCompleted` — completion, Natty order/tracking link, buyer confirmation or support action only if applicable.
5. `deliveryCancelledOrBookingFailed` — cancellation/failure reason in safe human language; state refund/charge only from confirmed payment outcome.
6. `sellerBulkDeliverySummary` — accepted/failed counts, job link, and downloadable results if that capability exists.

The current `orderShipped` and `orderDelivered` templates may be reused for manual order milestones after verifying their payloads and avoiding duplicate provider emails. A partner booking should not be announced as “shipped” until Kwikpik confirms the corresponding state.

Every template should provide: clear subject and preheader; one primary action linking to Natty; order/job reference; localized date/time and currency; minimal personal data; accessible responsive HTML; equivalent plain text; safe escaping of all user/provider fields; no raw phone/address unless operationally necessary; and a support path. Never include third-party tracking/app deep links as the primary CTA.

## 6. Email dispatch rules and reliability

1. **Commit then notify:** shipment state and an outbox event commit atomically. A relay publishes only after commit. Never send email inside the shipment transaction.
2. **Provider truth:** validate webhook signature and schema, persist/dedupe the provider event, transition shipment state once, then publish the Natty domain event. A provider API response may also confirm a state; both paths use the same idempotent transition logic.
3. **Dedupe:** one notification intent per `(domainEventId, recipientAccountId, channel, template/variant)`. Duplicate webhook deliveries must not duplicate email or push. Repeated tracking scans mapping to the same normalized state should not send another message.
4. **Ordering:** include shipment aggregate version and reject stale updates. Do not send a “delivered” message after a later valid correction/reopen state without an explicit correction event/policy.
5. **Retry:** retry transient sender failures with bounded exponential backoff and jitter; persist delivery attempts and provider message ID; terminal failures go to monitored DLQ/manual replay. Replays must preserve the original idempotency key.
6. **Eligibility/preferences:** check verified email, hard-bounce/manual suppression, preference category, account status, and mail kind at dispatch. Marketing consent/unsubscribe is not applicable to transactional shipment notices, but existing preference policy still applies to transactional categories unless the product formally defines a mandatory service notice. Security/legal mail follows its locked-category rules. Keep in-app tracking available even if email is unavailable or disabled.
7. **No address leakage:** send only to the account’s verified address. Never use an email address supplied by a seller or a Kwikpik webhook as a recipient override.
8. **Rate/noise:** immediate emails for booking confirmation, material exception/action required, failed attempt, and delivery completion; first in-transit milestone may email; routine scan updates stay in-app/push or are grouped. Bulk jobs receive one batch summary, not one email per parcel.
9. **Privacy and logs:** redact phone, email, full addresses, tracking secrets, tokens, and provider payloads from logs/analytics. Retain only necessary audit and delivery metadata under retention policy.
10. **Send separation:** provider communications use the integration credential and provider request; customer-facing emails use Natty’s notification service/provider. Do not pass Natty email addresses to Kwikpik.

## 7. Notification preferences

Add explicit seller and buyer **delivery updates** preferences only after deciding product policy. Recommended UI grouping:

- Essential account/security and legal notices (locked where currently required).
- Order and delivery updates (transactional; keep in-app timeline regardless of email setting; explain effect of disabling email).
- Seller operations reports (optional and frequency-controlled).
- Marketing (separate consent and unsubscribe).

The seller settings form currently displays `newOrderEmail`, `payoutEmail`, and other store preference fields; its use of `useSettingsPatch` must be verified against persistent backend settings before treating these controls as authoritative. Do not gate safety-critical delivery/order access behind a paid tier.

## 8. Acceptance criteria before launch

- Seller can select Manual or Natty Partner for each eligible order; no other provider appears.
- Partner opt-in is explicit, versioned, auditable, and server-enforced.
- The consent screen states exactly which pickup/destination contact data (including phone) goes to Kwikpik and that Natty sends email updates.
- Buyer and seller can view the same normalized partner tracking history in Natty, with role-appropriate detail.
- Provider webhook and synchronous response converge through idempotent shipment transitions; duplicate/out-of-order events are covered by tests.
- Every email-producing event has a registered template, schema-validated props, recipient rules, preference behavior, stable dedupe key, preview, plain-text render, and tests.
- Tests prove duplicate webhook delivery yields one state transition and at most one email per recipient/event; failed email does not roll back delivery state.
- Tests prove email addresses are never included in provider request payloads and phone is sent only after seller/buyer contact-sharing consent required by policy.
- Admin can preview every logistics template with synthetic data; sending real test messages remains disabled in automated tests.
- User-facing tracking does not require a Kwikpik account or app.

## 9. Open decisions and blockers

- Confirm exact Kwikpik fields for pickup/recipient contact names and phone, allowed phone formats, service enums (including Same-day), webhook event schema/signature, and whether the quote is binding.
- Decide whether buyer must separately consent to sharing their phone at checkout, in addition to the seller’s partner opt-in. Recommended: explicit checkout disclosure and confirmation before partner booking.
- Define policy when a seller opts out after a booking, when a provider booking fails after payment, and how/when fees are refunded.
- Confirm which transactional email preference semantics apply to shipment updates and whether seller operational alerts are optional.
- Build and test the event producer, durable outbox path for the orders module, provider adapter/webhook route, persisted delivery model, email templates/mappings, and seller/buyer UI. Documentation alone does not establish any of these as implemented.

## 10. Source references

- Seller delivery: `apps/seller/src/components/delivery/deliveryPipelineView.tsx`, `apps/seller/src/components/orders/orderFulfilmentForm.tsx`, `apps/seller/src/types/delivery.type.ts`.
- Seller preferences: `apps/seller/src/components/settings/notificationSettingsForm.tsx`.
- Existing order events/mappings: `services/typescript/notifications/src/modules/eventIngestion/mappings/eventMappingRegistry.ts`, `orders.mapping.ts`.
- Dispatcher and delivery guarantees: `services/typescript/notifications/src/modules/delivery/services/notificationDispatcher.service.ts`, `emailDelivery.service.ts`, `emailEligibility.service.ts`, and `delivery.prisma.repository.ts`.
- Template registry/rendering: `packages/emailTemplates/src/templates/templateRegistry.ts`, `buyerOrders.template.tsx`, `sellerOrders.template.tsx`, and `packages/emailTemplates/tests`.
- Admin preview: `apps/admin/src/components/emailTemplates/emailTemplatesWorkspace.tsx`, `services/typescript/notifications/src/modules/emailTemplates/controllers/emailTemplates.controller.ts`.
- Generic draft examples: `services/typescript/notifications/src/constants/adminEmailTemplates.constant.ts`.
- Event transport design: `docs/architecture/events.md` (dated design; verify status against code before relying on its broad inventory).
