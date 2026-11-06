# Push delivery retries: current blocker and safe design

## Decision

Do not schedule automatic push retries with the current persistence and queue
contracts. The service can persist a failed push delivery, but it cannot safely
reconstruct and retry only the failed portion of that delivery. Retrying the
whole source event or placing the full push payload in a generic queue message
would introduce side effects or data-retention risks that the current design
does not address.

## Current implementation evidence

- `src/modules/delivery/services/notificationDispatcher.service.ts` creates a
  channel-specific `Delivery` claim, checks the push preference and account
  push setting, reads registered tokens, calls `PushSender.send`, prunes
  `DeviceNotRegistered` tokens, and stores a bounded failure summary. The
  `Delivery` row does not store the push content or per-token outcomes.
- `prisma/schema.prisma` stores delivery metadata and status, but no retry
  payload, token references, scheduled-attempt state, or push attempt lease.
- `src/modules/delivery/repositories/delivery.prisma.repository.ts` reclaims
  failed deliveries through the general `claim` method. The special maximum
  attempt guard currently applies to email only; push is not capped there.
- `src/jobs/messageRouting.job.ts` routes email, digest, fanout, and widget
  jobs. There is no push retry job type or handler.
- `src/interfaces/jobQueue.interface.ts` exposes `send(queueUrl, body,
  delaySeconds)`. It does not provide a transaction with the delivery store,
  nor a push-specific idempotent enqueue/claim contract.
- The domain event queue handler re-runs `HandleDomainEventHandler` for a
  redelivered event. That handler performs notification fanout, in-app
  insertion, and channel dispatch; it is not a push-only retry operation.

## Why the apparent shortcuts are unsafe

1. Requeueing the original domain event repeats unrelated processing, not just
   push. Dedupe guards cover some writes but do not make all external effects
   safe to repeat.
2. A queue message containing `{userId, eventId, title, body, data}` would
   duplicate arbitrary event-derived content into a broker whose retention and
   encryption guarantees are not expressed by `JobQueue`.
3. Retrying all device tokens after a partial provider result can deliver
   duplicates to tokens already accepted by the provider. The current sender
   result does not provide a persisted, non-secret retry target set.
4. Enqueueing and updating the delivery row are not atomic. A crash between
   those operations can lose or duplicate a retry unless the retry intent is
   represented by a durable outbox and claimed with compare-and-set semantics.
5. The existing generic claim can reclaim a failed push without an expected
   attempt number. Duplicate delayed jobs could therefore consume attempts or
   send more than once unless retry claims are made idempotent per attempt.

## Minimal safe implementation design

1. Add a push-retry record/outbox tied to the unique delivery key. Persist only
   a bounded, validated push representation and non-secret device-token
   references (never raw device tokens); define retention/expiry and data
   protection for any user-facing content. If the product requires zero
   persistence of rendered content, the source event must instead be durably
   retained and safely replayable by event ID.
2. On the first failed attempt, transactionally persist the failed outcome and
   retry intent. Use a unique `(deliveryId, attemptNumber)` key and a worker
   claim with compare-and-set/lease semantics. Cap at three retries (four total
   attempts including the initial send), with bounded backoff.
3. The retry worker loads the persisted intent by ID, rechecks the current
   preference, account-level push setting, and active token set immediately
   before sending, and only addresses tokens known to have failed retryably.
   Permanent token failures continue to be pruned. Keep Expo request/response
   behavior unchanged.
4. Mark terminal failures in delivery/audit state and expose bounded
   operational metadata without recipient IDs, raw tokens, full payloads, or
   provider response bodies. Alerting can be added through the existing
   operations path after retry exhaustion.
5. Add repository concurrency tests (duplicate jobs, concurrent claims,
   exhaustion), dispatcher/worker tests (preference disabled after enqueue,
   token removal, partial provider acceptance, permanent vs retryable failure),
   migration validation, and queue-routing tests before enabling the worker.

This design requires an explicit decision on persisted push-content protection
and token-reference semantics before implementation. Until then, automatic
push retry remains intentionally disabled; failed pushes remain visible in the
existing bounded failed-deliveries query.
