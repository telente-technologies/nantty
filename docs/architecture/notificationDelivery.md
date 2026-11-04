# Notification and webhook delivery operations

> **Source review:** 2026-11-03. This describes repository behavior, not proof of deployed queue configuration, migrations, SES configuration, or staff alert delivery.

## Transactional email

For normal event-driven template email, the notifications dispatcher now publishes an `email.deliverTemplate` job instead of waiting for SES inside domain-event handling. In-app notification creation and push dispatch remain independent of the email provider. The email worker records a deduplicated `Delivery` row and increments `attemptCount` on each failed-send retry.

The worker makes at most four sends (one initial attempt and three retries) with explicit delays of 30 seconds, 2 minutes, and 10 minutes. After the fourth failure it leaves a durable failed row, logs a redacted bounded provider error, and queues an alert to `SUPPORT_NOTIFICATION_EMAILS` (default `support@nantty.com`). If alert enqueueing fails, the worker fails the job so broker redelivery can retry alert enqueueing without sending the exhausted customer email again. Alert emails use the same delivery ledger and dedupe key and are processed by the job worker; transient queue/send failures rely on the configured broker retry/redrive policy rather than blocking the original operation. Admin staff with support-email permission can inspect failed records at `/admin/support/email/deliveries/failed`; the response intentionally omits recipient addresses and provider payloads. If the alert itself exhausts delivery, its failed ledger row remains visible but an email notification cannot be guaranteed; an independently monitored operational alert path is still required. The deployed queue's retry/redrive policy and alert receipt still require environment verification.

Email sends are **at least once**, not exactly once: a provider may accept a message immediately before the worker loses its connection or fails to persist success. Dedupe prevents ordinary repeated event handling, but cannot eliminate that provider/database ambiguity unless the provider supports an idempotency key. OTP/address-verification overrides remain a direct flow because they target an address not yet verified; confirm that flow's latency/failure contract separately before changing it.

SES bounce/complaint feedback continues through the configured feedback queue and suppression processing. Queue declarations and retry topology in the repository do not prove that the deployed broker has those settings; deployment/runbook evidence is required.

## Payment webhooks

The payment webhook inbox persists the verified event identity and payload digest, claims due rows under a five-minute lease and a database transaction, deduplicates provider events by `(provider, eventKey)`, retries with exponential backoff (30 seconds doubling to at most one hour), and dead-letters after 12 attempts or an explicit finance-review condition. Provider errors are redacted before persistence/logging. Both finance-review dead letters and exhausted retry dead letters emit the `webhookDeadLettered` payment alert metric/log. Admin routes list and inspect dead letters with sensitive payload fields redacted; replay requires staff authorization and a reason and records a `replay_requested` audit event before performing the replay. If the audit recorder is missing or fails, the replay is not performed. Current limitation: the webhook row retains the latest attempt/error rather than a separate immutable record for every retry. This is source-verified; live provider signature configuration, schedules, alert/metric delivery, and deployed role grants still require environment verification.

## Logistics boundary

Notification email is sent by Nantty's notification service to a verified account address. Customer email addresses are not fields in the Kwikpik logistics request contract. The provider adapter and use of `LOGISTICS_CONTACT_EMAIL` are not implemented; do not represent the setting as an active integration. Seller-country eligibility, seller delivery capability capture, required buyer/seller phone values, and the international-creator exception are documented in [logisticsV1.md](logisticsV1.md). Logistics phone-sharing consent and provider payload constraints remain server-side prerequisites before any future provider call.

When a shipped-order event is processed, the queued buyer email displays the carrier and tracking number when present and always links to the buyer-scoped Nantty order page. It does not include or link to the courier's URL. Web and mobile order detail surfaces also keep tracking inside Nantty and show the recorded status/number; live carrier tracking events still depend on a future provider integration and must not be implied when only seller-entered shipment data exists. Staff with `logistics:read` can inspect the validated tracking number and HTTPS carrier URL in the admin logistics queue to investigate an exception; the endpoint excludes recipient contact/address fields and raw provider payloads. Admin access is auditable through the existing staff request/audit path, but the tracking URL should be treated as sensitive operational data and must not be copied into logs or public notifications.

## Verification and operational checklist

- Apply the notifications Prisma migration before deploying this code; do not apply it to production as part of this source change.
- Verify the jobs queue is durable, has bounded delivery/redelivery behavior, and accepts the explicit 30/120/600-second delays in the target broker.
- Configure and monitor `SUPPORT_NOTIFICATION_EMAILS`; test its mail route with a non-production mailbox.
- Add an independently monitored path for failed support-alert delivery; do not assume the one-shot alert can report its own failure.
- Verify the admin service account permissions and failed-delivery route through the BFF.
- Confirm the webhook worker/scheduler runs, alert on dead-letter growth/terminal exhaustion, and exercise replay plus audit-failure behavior in a sandbox with synthetic provider events.
- Review ambiguous SES acceptance/worker-crash outcomes before treating sends as exactly once.
