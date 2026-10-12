# Events and background jobs

> **Dated design document.** The status labels below describe the repo when this was written; much that is marked PROPOSED or ABSENT has since been built. For the current system see [system.md](system.md); where the two disagree, the code wins.

As of 2026-10-03. **RabbitMQ adopted (owner, 2026-10-03)**: the event bus and job queues moved from SNS/SQS (LocalStack locally) to RabbitMQ (Docker locally, Amazon MQ for RabbitMQ in production). Labels: **EXISTING** · **MOCK-ONLY** · **PROPOSED** · **OPTIONAL FUTURE**. Facts: [inventory.md](inventory.md) section 4.

## 1. What exists

| Piece | Status | Evidence |
| --- | --- | --- |
| Outbox table per module schema `(id, event_type, subject, payload jsonb, published_at)`, index `(published_at, created_at)` | EXISTING in `auth` (serving) and `users`, `admin`, `currency`, `ledger`, `live` (WIP) | `services/go/modules/*/internal/ent/schema/outbox_event.schema.go` |
| Outbox write in the same tx as the business change | EXISTING (auth) | `modules/auth/internal/application/outbox.events.go` |
| Relay: poll 500 ms, batch 100, `FOR UPDATE SKIP LOCKED`, mark published after publish | EXISTING | `platform/events/outbox.relay.go`, `EntOutboxStore` in each module |
| RabbitMQ publisher: confirm channel, `mandatory`, persistent, routing key = `eventType`, `message_id` = envelope id, `type` = event type, `traceparent` + `x-zudomart-subject` headers; batch fails on any nack/return so outbox rows stay unpublished | EXISTING | `platform/events/rabbitmq.publisher.go`, social `rabbitMqDomainEventPublisher.integration.ts` |
| Bus selection `EVENT_BUS=rabbitmq` (default) or `sqs` (old SNS/SQS adapters kept for rollback), `RABBITMQ_URL` per service user | EXISTING | `platform/events/messageBus.factory.go` |
| Envelope `{id,type,source,subject,version,occurredAt,data}` (unchanged, envelope.v1) | EXISTING | `platform/events/event.envelope.go`, `services/contracts/events/schemas/envelope.v1.json` |
| JSON schemas: `account.registered`, `account.loggedIn`, `session.refreshTokenReuseDetected`, `exchangeRate.updated` | EXISTING | `services/contracts/events/schemas` |
| Topology: topic exchange `zudomart.events` (alternate exchange `zudomart.unrouted` → `unrouted-events`, 24 h), direct `zudomart.jobs`, topic `zudomart.retry`, direct `zudomart.dlx`; one durable quorum queue per consumer and per job type, 4 retry queues + `.dlq` each | EXISTING (local definitions) | `infra/local/rabbitmq/topology.json` → `generateDefinitions.mjs` → `definitions.json` |
| Consumers: realtime (Elixir `AmqpConsumer`, 10k-id in-memory dedupe), notifications (TS), intelligence (aio-pika, Redis claim dedupe), orders (`processed_events`), goTrust advisory, goAds report jobs | EXISTING | `realtime/events/amqp.consumer.ex`, `notifications/src/integrations/rabbitMq*.integration.ts`, `services/python/intelligence/.../amqp_domain_event_queue_repository.py`, `platform/events/rabbitmq.consumer.go` |
| DLQ replay tool (shovel from `<queue>.dlq` back to the queue), alarms in Terraform | ABSENT (runbook uses the management UI "Move messages" / dynamic shovel) | |

## 2. Event flow

```mermaid
flowchart LR
  classDef existing fill:#d8f3dc,stroke:#2d6a4f,color:#081c15
  classDef proposed fill:#dbe4ff,stroke:#364fc7,color:#10194d

  api["API handler"]:::existing
  tx["One Postgres tx<br/>business rows + outbox row"]:::existing
  outbox[("schema.outbox_events")]:::existing
  relay["Relay per deployable<br/>SKIP LOCKED batch"]:::existing
  ex["topic exchange zudomart.events<br/>routing key = event type"]:::existing
  qRt["realtime-domain-events"]:::existing
  qNotif["notifications-domain-events"]:::existing
  qIntel["intelligence-domain-events"]:::existing
  qCommerce["commerce-domain-events"]:::existing
  qRewards["rewards / search / webhooks queues"]:::proposed
  retry["queue.retry.30s/2m/10m/30m<br/>TTL then back to the queue"]:::existing
  dlq["queue.dlq<br/>alarm on depth > 0"]:::existing
  consumers["Consumers<br/>manual ack, prefetch, idempotent on event id"]:::existing

  api --> tx --> outbox --> relay -- "confirm + mandatory" --> ex
  ex -- "live.*, gift.sent, battle.*, guest.*, message.created" --> qRt
  ex -- "bindings per consumer" --> qNotif & qIntel & qCommerce & qRewards
  qRt & qNotif & qIntel & qCommerce --> consumers
  consumers -. "failure: republish with attempt+1" .-> retry
  retry -. "x-message-ttl expiry" .-> consumers
  consumers -. "attempt 5 or poison: reject" .-> dlq
```

Rules:

- Topic naming `<entity>.<pastTense>`, camelCase entity, versioned by schema file `<name>.v<N>.json`. Breaking change = new version published side by side until consumers move.
- Delivery is at least once. Every consumer stores processed event ids (`processed_events(consumer, event_id) PK` in its own schema, in the same tx as its side effect) or makes the write naturally idempotent (unique key).
- Ordering is **not** guaranteed end to end (a quorum queue is FIFO, but retries, redeliveries and several consumers reorder). Events that need order carry `aggregateVersion` (per subject, monotonically increasing); consumers drop stale versions. Live UI ordering uses `seq` per topic set by Phoenix.
- Payloads carry ids and the fields consumers need to act; no PII beyond ids (Python receives opaque ids only).

### 2.1 Financial events are never lost

| Layer | Guarantee | Status |
| --- | --- | --- |
| Producer | Money change and outbox row commit together, or neither | EXISTING pattern (auth); PROPOSED for go-money |
| Relay | Row stays unpublished until the broker confirms (and does not return) every message of the batch; retried every tick | EXISTING. Gaps: no attempt counter, a poison row blocks at the head of the queue; partial batch failure republishes already-sent rows (OK under at-least-once) |
| Transport | Persistent messages on replicated quorum queues (`x-dead-letter-strategy: at-least-once`, `x-overflow: reject-publish`); unrouted events kept 24 h on `unrouted-events`; 5 attempts then `.dlq` | EXISTING locally |
| Consumer | Dedupe on event id in the consumer's tx | PROPOSED (only Phoenix dedupes, in memory) |
| Recovery | DLQ alarm, move messages from `<queue>.dlq` back to `<queue>` (management UI or shovel), outbox replay by id range (`published_at = NULL` reset) | PROPOSED |
| Truth | Ledger is the truth; events are notifications. Nightly trial balance and provider reconciliation catch anything events missed | PROPOSED (`reconciliation` schema EXISTING WIP in `modules/ledger`) |

Required relay changes (**P1**): add `attempts`, `last_error`, `next_attempt_at` columns; move rows over N attempts to `outbox_dead` with an alarm; publish in `created_at` order but skip rows whose `next_attempt_at` is in the future; emit relay lag metric (`now - min(created_at) where published_at is null`), alarm at 60 s.

## 3. Event catalog

Durability: **F** financial (outbox + DLQ + replay + reconciliation, never dropped) · **D** durable domain (outbox + DLQ) · **B** best effort (high volume, loss tolerated, may bypass outbox via batched direct ingest). Ordering: **none**, **subject** (per aggregate, via `aggregateVersion`), **room** (per live, via Phoenix `seq`).

| Event | Producer | Consumers | Dur. | Order | Key payload fields | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `account.registered` | auth | users (create personal profile), notifications (welcome), analytics | D | none | accountId, username, countryCode | EXISTING |
| `account.loggedIn` | auth | trust (risk), analytics | B | none | accountId, sessionId, ipHash, deviceId | EXISTING |
| `session.refreshTokenReuseDetected` | auth | notifications (security alert), trust | D | none | accountId, sessionId | EXISTING |
| `account.deletionRequested` | users | every owner of personal data, notifications | D | subject | accountId, requestId, executeAfter | PROPOSED |
| `account.deleted` | users | all (erase/anonymize done), search, analytics | D | subject | accountId, requestId | PROPOSED |
| `profile.updated` | users | search, social (denormalised names) | D | subject | profileId, changedFields, aggregateVersion | PROPOSED |
| `consent.updated` | users | analytics, ads, intelligence, notifications | D | subject | accountId, type, granted, policyVersionId, aggregateVersion | PROPOSED |
| `product.published` / `product.updated` / `product.unpublished` | catalog | search, intelligence, live (pins), seller webhooks | D | subject | productId, storeId, status, aggregateVersion | PROPOSED |
| `product.viewed` / `clicked` / `liked` / `saved` / `shared` / `addedToCart` / `removedFromCart` / `searched` | gateway/catalog (batched ingest) | analytics, intelligence, rewards (liked, shared) | B | none | actorId?, productId, sessionId, surface, occurredAt | PROPOSED |
| `cart.checkedOut` | orders | analytics, intelligence | D | none | checkoutId, buyerId, groupCount | PROPOSED |
| `order.placed` | orders | notifications (seller), analytics, seller webhooks | D | subject | orderGroupId, checkoutId, storeId, totalMinor, currency | PROPOSED |
| `order.paid` | orders (on payment.succeeded) | escrow, inventory (commit), notifications, webhooks | F | subject | orderGroupId, paymentId, totalMinor, currency | PROPOSED |
| `order.shipped` / `order.delivered` / `order.completed` / `order.cancelled` | orders | escrow (release timer), inventory (release on cancel), rewards (completed), notifications, webhooks | F (completed, cancelled) / D | subject | orderGroupId, fromStatus, toStatus, actor, aggregateVersion | PROPOSED |
| `payment.succeeded` / `payment.failed` | payments | orders, wallet (coin packs), subscriptions, notifications | F | subject | paymentId, purpose, referenceId, amountMinor, currency, provider | PROPOSED |
| `refund.requested` / `refund.completed` | payments | orders, escrow, inventory (restock), notifications | F | subject | refundId, paymentId, orderGroupId?, amountMinor, currency | PROPOSED |
| `escrow.held` / `escrow.released` / `escrow.refunded` | escrow | orders, wallet, store-rewards (earn or reverse seller-funded store credit), notifications | F | subject | escrowId, orderGroupId, amountMinor, currency, journalEntryId | PROPOSED |
| `payout.requested` / `payout.paid` / `payout.failed` | wallet | notifications, admin queue, webhooks | F | subject | payoutId, ownerId, amountMinor, currency, providerReference? | PROPOSED |
| `journalEntry.posted` | ledger | analytics, reconciliation | F | none | entryId, reference, kind, lines[{accountCode, direction, amountMinor, currency}] | PROPOSED |
| `coins.purchased` | wallet | rewards, analytics | F | subject | purchaseId, accountId, coins, paymentId | PROPOSED |
| `gift.sent` | live (go-live outbox, after go-money commits the charge) | realtime (room fan-out), live (battle score), rewards, analytics, intelligence (risk) | F | room | giftTransactionId, liveId, battleId?, senderId, receiverId, giftId, quantity, totalCoins, comboId, comboCount | EXISTING (go-live producer, Phoenix router EXISTING) |
| `giftTransaction.committed` | creators (go-money outbox, same tx as the ledger entry) | analytics, rewards, reconciliation | F | subject | giftTransactionId, liveId, battleId?, senderId, creditedUserId, totalCoins, platformFeeCoins, creatorAmountCoins, journalEntryId | EXISTING (money-side fact; go-live publishes the realtime `gift.sent`, never the other way round) |
| `gift.goalProgressed` / `gift.goalCompleted` | creators | realtime | D | room | goalId, liveId, progressCoins, targetCoins | PROPOSED |
| `live.started` / `live.ended` | live | realtime, social (feed card), notifications (followers), search, rewards (leaderboard snapshot) | D | subject | liveId, hostId, category, startedAt/endedAt | PROPOSED |
| `guest.invited` / `guest.joined` / `guest.left` / `guest.removed` / `guest.muted` | live | realtime | D | room | liveId, slotId, userId, state | PROPOSED (router EXISTING) |
| `battle.started` / `battle.scoreUpdated` / `battle.ended` | live | realtime; creators (settle on ended) | D (ended: F) | room | battleId, liveId, scores[], winnerUserIds, endReason | PROPOSED |
| `battle.settled` | live (go-live outbox, after go-money settles) | realtime, notifications, analytics | F | subject | battleId, rule, transfers[], journalEntryId | EXISTING (go-live producer) |
| `battleSettlement.completed` | creators (go-money outbox, same tx as the settlement entry) | analytics, reconciliation | F | subject | battleId, ruleApplied, winnerUserId, payouts[], transfers[], journalEntryId | EXISTING (money-side fact; keep both events) |
| `post.created` / `post.deleted` | ts-social | feed fan-out, moderation, search, notifications (mentions), intelligence | D | subject | postId, authorProfileId, audience, mediaIds, isAiGenerated | PROPOSED |
| `comment.created` / `post.liked` / `post.shared` / `post.saved` | ts-social | notifications, rewards, intelligence, counters | B (liked/saved) / D | none | postId, actorProfileId | PROPOSED |
| `user.followed` / `user.unfollowed` / `follow.requested` / `follow.accepted` | ts-social | feed, notifications, rewards, intelligence | D | subject | followerId, followeeProfileId, state, aggregateVersion | PROPOSED |
| `user.blocked` | users | social, realtime (membership), feed | D | subject | blockerId, blockedId | PROPOSED |
| `content.reported` | moderation | moderation queue, intelligence (classify) | D | none | reportId, subjectType, subjectId, reason | PROPOSED |
| `moderation.actionTaken` | moderation | social, catalog, live, ads, notifications | D | subject | caseId, subjectType, subjectId, action, aggregateVersion | PROPOSED |
| `media.uploaded` / `media.ready` / `media.failed` | ts-io media | social, catalog, moderation (scan), ads | D | subject | mediaId, ownerId, purpose, variants[] | PROPOSED |
| `message.created` | ex-realtime | realtime fan-out, notifications (offline push) | D | subject (conversation) | messageId, conversationId, senderId, clientMessageId | PROPOSED (router EXISTING) |
| `notification.created` | ts-io notifications | realtime (`user:*`) | B | none | notificationId, accountId, kind | PROPOSED (router EXISTING) |
| `ad.impressionRecorded` / `ad.clicked` | go-ads (batched ingest) | analytics, intelligence (fraud), ads attribution | B raw, F once qualified and charged | none | impressionId, adId, campaignId, creatorId?, placement, qualified | PROPOSED |
| `ad.conversionRecorded` | go-ads | analytics, campaign reports | D | none | conversionId, impressionId, eventName, dedupeKey | PROPOSED |
| `exchangeRate.updated` | currency | commerce, money, ads | D | none | base, quote, rate, effectiveAt | EXISTING schema |

Webhook-to-seller events (`order.*`, `inventory.lowStock`, `product.updated`, `payout.paid`, `review.created`) are re-shaped by ts-io integrations from the domain events above; they are a public contract and versioned separately.

## 4. Queue technology comparison

Assumed launch traffic: < 500 domain events/s peak, gift bursts of a few thousand/s in a hot room, team of a few backend engineers.

| Option | Traffic fit | Ordering | Durability | Replay | Ops burden | Cost at launch | Team fit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **RabbitMQ (Amazon MQ, chosen)** | Tens of thousands msg/s on a 3-node cluster, far above launch | FIFO per queue (retries reorder) | Quorum queues (Raft, 3 replicas), publisher confirms, at-least-once dead-lettering | No log replay (streams possible later); replay from outbox or DLQ move | Medium: managed brokers, patching by AWS; we own topology and alarms | 3 x mq.m7g.large about the price of a small RDS; no per-request cost | Same broker locally (Docker) and in AWS, no LocalStack; topic routing, per-queue retries/DLQ, delays and priorities without AWS-specific glue; mature clients for Go, TS, Elixir, Python |
| SNS + SQS (previous) | Effectively unlimited | None (standard) | Multi-AZ, DLQ redrive | No log replay | Lowest (serverless) | Lowest, pay per request | AWS-only; LocalStack drift; 15 min max delay; filter policies per subscription |
| EventBridge | ~10k events/s soft quota per region | None | Multi-AZ, DLQ per target | Archive + replay built in | Low | ~2x SNS per event | Good for cross-account/SaaS routing |
| Kafka / MSK | Very high | Per partition | Replicated log | Full replay by offset | High | Highest fixed cost | Needs Kafka experience |
| Redis Streams | High, memory-bound | Per stream | Weak (memory, AOF) | Limited by memory | Medium | Uses existing ElastiCache | Ephemeral fan-out only, not money |

**Decision (owner, 2026-10-03): RabbitMQ.** One durable topic exchange `zudomart.events` (routing key = event name), one durable quorum queue per consumer service bound to the keys it needs (replaces SNS→SQS fan-out and filter policies), and a direct exchange `zudomart.jobs` with one quorum queue per job type. All behind the unchanged `DomainEventPublisher` / `JobQueue` / `QueueConsumer` interfaces; the SNS/SQS adapters stay behind `EVENT_BUS=sqs` until the cut-over is proven, then get deleted. The outbox remains the replay source.

### 4.1 Topology (single definitions file)

| Element | Definition |
| --- | --- |
| Source of truth | `infra/local/rabbitmq/topology.json` (queues, bindings, service grants) → `pnpm backend:rabbitmq:definitions` → `definitions.json`, loaded by the local broker at boot and imported into Amazon MQ through the management API (`POST /api/definitions`) by the deploy pipeline with real password hashes from Secrets Manager |
| Exchanges | `zudomart.events` topic (alternate exchange `zudomart.unrouted` fanout → `unrouted-events`, TTL 24 h, max 100k, drop-head), `zudomart.jobs` direct, `zudomart.retry` topic, `zudomart.dlx` direct |
| Work queue `<q>` | quorum, `x-dead-letter-exchange=zudomart.dlx`, `x-dead-letter-routing-key=<q>.dlq`, `x-dead-letter-strategy=at-least-once`, `x-overflow=reject-publish`; bound to `zudomart.retry` with key `<q>` (return path) |
| Retry queues | `<q>.retry.30s`, `.2m`, `.10m`, `.30m`: quorum, `x-message-ttl`, dead-letter back to `zudomart.retry` with key `<q>`; bound with their own name. Per-tier queues avoid head-of-line blocking of per-message TTL; no delayed-message plugin |
| Dead-letter queue | `<q>.dlq` quorum, bound to `zudomart.dlx` |
| Consumer contract | manual ack, prefetch (`RABBITMQ_PREFETCH`, default 20; realtime 50), idempotent on event id. On failure the consumer republishes a copy to `<q>.retry.<tier>` with `x-zudomart-attempt` + 1 (confirmed) and then acks; failure 5, or a poison message (unparseable, invalid envelope, unknown job type), is rejected without requeue → `.dlq`; if the retry publish fails the message is requeued |
| Delayed jobs | `JobQueue` delay = publish to the largest retry tier ≤ delay (handlers that need exact timing re-defer, e.g. `email.sendIfUnread`) |
| Least privilege | one user per service; `configure=^$` (no service declares or deletes anything), `write` only on the exchanges it publishes to, `read` only on its own queues, topic permission on `zudomart.retry` limited to `^(<its queues>)\.retry\.` |
| Outside the bus | SES bounce/complaint feedback stays AWS-native (SES → SNS → SQS `notifications-ses-feedback`, optional `SQS_SES_FEEDBACK_QUEUE_URL`) because SES cannot publish to RabbitMQ; it carries no domain events |
| Connections | one connection per process, named after the service; channel per consumer/goroutine plus one confirm channel for publishing; reconnect with exponential backoff and jitter (0.5 s → 30 s); graceful shutdown cancels consumers, finishes the in-flight message, closes channels |

| Field | Value |
| --- | --- |
| Problem | Plan wanted FIFO with `MessageGroupId = liveId` for gift ordering (`backendPlan.md` 4.1.0) |
| Current | Quorum queues are FIFO per queue but retries, redeliveries and competing consumers reorder |
| Recommendation | Do not depend on transport order. Producer sets `comboCount` and `aggregateVersion`; Phoenix stamps `seq` per topic on push; scores are absolute values, not deltas. Use single-active-consumer on a dedicated queue only if a consumer truly needs order |
| Priority | P1 (before the gift path is built) |

## 5. Background jobs

```mermaid
flowchart LR
  classDef existing fill:#d8f3dc,stroke:#2d6a4f,color:#081c15
  classDef proposed fill:#dbe4ff,stroke:#364fc7,color:#10194d

  api["API commands"]:::existing
  sched["Schedulers<br/>Postgres due_at pollers,<br/>EventBridge Scheduler cron"]:::proposed
  events["Domain event queues"]:::existing
  jEmail["jobs-email / jobs-sms / jobs-push"]:::proposed
  jMedia["jobs-media"]:::existing
  jReports["jobs-reports / jobs-exports"]:::existing
  jPayouts["jobs-payouts"]:::existing
  jSearch["jobs-search-indexing"]:::existing
  jAi["jobs-ai"]:::proposed
  wTs["ts-io workers"]:::proposed
  wGo["Go workers in owning deployable"]:::proposed
  wPy["Python workers"]:::proposed
  sfn["Step Functions<br/>payout runs, deletion"]:::proposed

  api --> jEmail & jMedia & jReports & jPayouts
  events --> jSearch & jAi
  sched --> jPayouts & jReports
  jEmail & jMedia & jSearch --> wTs
  jPayouts --> sfn --> wGo
  jReports & jAi --> wPy
```

Job queues (`zudomart.jobs`, routing key = queue name) EXISTING locally: `jobs-email` (notifications: unread emails, throttled bulk batches, digests), `jobs-ads-reports` (goAds), `intelligence-trust-advisory` (intelligence → goTrust), `jobs-payouts` (goMoney), and `jobs-media`, `jobs-reports`, `jobs-search-indexing` (no workers yet). Everything else PROPOSED.

Defaults for all jobs unless the row says otherwise: quorum queue, manual ack, prefetch 20; 5 attempts with backoff 30 s, 2 m, 10 m, 30 m through the retry queues, then `<queue>.dlq`; DLQ alarm at depth > 0; job id (`message_id`) = idempotency key; long jobs extend nothing (no visibility timeout) but must finish within the consumer timeout (30 min default, `consumer_timeout`).

| Job | Producer | Queue | Worker | Retry / backoff | DLQ | Idempotency | Failure handling |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Email | auth (OTP), notifications, exports | `jobs-email` | ts-io (SES) | default; SES throttling -> backoff | `jobs-email.dlq` | `(template, recipientHash, dedupeKey)` 24 h | Bounce/complaint webhooks suppress address |
| OTP SMS | auth | `jobs-sms` | ts-io (SMS provider) | 2 tries within 60 s only (code expires 5 min) | yes | OTP id | Fall back to email if allowed; never retry after expiry |
| Push | notifications | `jobs-push` | ts-io (FCM/APNs) | default | yes | notification id | Invalid token -> delete device token |
| Media processing (images to AVIF/WebP, video HLS transcode, poster/thumbnails, metadata strip) | media `media.uploaded` | `jobs-media` | ts-io dispatch -> AWS Elemental MediaConvert (video) / sharp worker (images) | 3 tries, 15 min consumer timeout | yes | `mediaId + variant` (overwrite same S3 key) | `media.failed` event, user sees retry; poison files quarantined |
| AI processing (moderation classify, product attributes, AI-content flag) | `media.ready`, `post.created` | `jobs-ai` | Python | default | yes | `subjectId + modelVersion` | Missing score -> deterministic policy "review" queue, never auto-approve on failure |
| Recommendations / feature building | analytics events | `intelligence-domain-events` | Python | default | yes | event id | Stale features acceptable; ranking falls back to deterministic |
| Search indexing | `product.*`, `post.*`, `profile.updated`, `live.*` | `jobs-search-indexing` | ts-io | default | yes | `entityId + aggregateVersion` (skip older) | Nightly full reindex from Postgres reconciles drift |
| Analytics ingest | all D/B events | `analytics-domain-events` | Python -> Postgres read model, ClickHouse later | default | yes | event id (ClickHouse `ReplacingMergeTree`) | Drop events without analytics consent at ingest |
| Fraud scoring | gift, coin purchase/transfer, payout, order | event queues | Python `/v1/risk/score` via caller | 2 tries | yes | `subjectType + subjectId` | High score -> hold (`heldForReview`) by Go policy; score unavailable -> payouts hold, gifts proceed |
| Moderation | `content.reported`, AI flags | `moderation-domain-events` | go-trust | default | yes | report id | SLA alarm on queue age |
| Payouts | wallet (approved withdrawals), scheduled runs | `jobs-payouts` | go-money via Step Functions | provider-aware: retry only on network/5xx; never on "pending" without a status query | yes | payout id = provider reference | Query provider before any retry; failed -> reverse journal entry, notify; manual queue in admin |
| Escrow auto-release, stock reservation expiry, battle timers, subscription renewals | owning Go module | Postgres `due_at` poller with `SKIP LOCKED` (leader-free) | owning deployable | poller retries next tick | `attempts` column + alert | entity id + target state | Reconcile on startup; alarm if overdue > 5 min |
| Seller reports / exports | seller BFF | `jobs-reports` | Python (pandas/openpyxl) -> S3 | 3 tries | yes | export id | Status `failed` with reason; signed URL 15 min |
| Ads (attribution rollups, creator earnings, budget pacing reset) | cron hourly/daily | `jobs-ads` | go-ads | default | yes | `(creatorId, day)` | Re-run day is safe (upsert); earnings posted once by unique ledger reference |
| Leaderboards / rankings | cron hourly; `live.ended` | `jobs-rankings` | go-money rewards | default | yes | `(board, scope, period)` snapshot upsert | Redis rebuilt from Postgres on miss |
| Data exports (privacy) | users `POST /privacy/exports` | `jobs-exports` | Step Functions fan-out to each owner, assembled by Python | per step 3 tries | yes | request id | Partial failure -> status `failed`, user notified, retry allowed |
| Account deletion | users after grace period | Step Functions | each owner erases/anonymizes, emits ack | per step 5 tries | yes | request id + service | Ledger/tax/KYB rows anonymized per retention policy, not deleted; incomplete after 7 d -> alarm |
| Reconciliation, trial balance | cron nightly | `jobs-payouts` (or own) | go-money | default | yes | `(provider, window)` | Mismatch -> `reconciliation.mismatchFound`, page finance on-call |
| Outbox cleanup | cron daily | in-process | each deployable | next run | n/a | delete by `published_at < now() - 7d` | batch 5k rows |

## 6. Priorities

| # | Item | Priority | Reason |
| --- | --- | --- | --- |
| 1 | Consumer-side durable dedupe (`processed_events`) before any money consumer ships | P0 | At-least-once delivery would double-credit points, store credit, escrow transitions |
| 2 | Relay attempts/dead-letter + lag alarm | P1 | One bad row stalls every event from that deployable, including financial ones |
| 3 | Do not rely on transport ordering for gifts/battles | P1 | Retries and redeliveries reorder; build gift path on versions/seq |
| 4 | Event JSON Schemas for the 21 live/gift/battle types Phoenix already routes | P1 | Router consumes types that no contract defines (`domain_event_router.ex`) |
| 5 | DLQ redrive runbook + Amazon MQ alarms in Terraform (see observability.md) | P1 | DLQs exist but nobody looks at them |
| 6 | Money modules on the RabbitMQ interface, `money-domain-events` queue + bindings in `topology.json` | P1 | goMoney still builds its SNS publisher in `modules/ledger` |
