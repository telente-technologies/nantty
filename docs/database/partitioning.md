# Partitioning strategy

As of 2026-10-03. Labels: **EXISTING** (cite path), **PLANNED** (designed in `docs/architecture/*`, no code), **FUTURE**. No production traffic exists; every volume below is an **assumption scenario**, not a measurement. Static analysis only: no EXPLAIN was run (compose Postgres not running); validation of every plan claim is a follow-up (section 9).

## 1. Principles

| Rule | Reason |
| --- | --- |
| Partition only when a trigger fires: > 100M rows, or > 50 GB table+indexes, or autovacuum cannot keep up, or a retention job must drop data cheaply | Partitioning adds planning cost, DDL surface and PK constraints; it does not speed up queries that do not filter on the key |
| Prefer **drop-a-partition retention** over `DELETE` | O(1), no bloat, no vacuum debt |
| Anything high-volume, append-only, read in aggregates -> **ClickHouse**, not Postgres partitions | OLAP shape; analytics.md already separates the two |
| Never partition tables whose correctness depends on a global UNIQUE (idempotency keys, ledger `reference`) until redesigned | Postgres unique indexes on partitioned tables must include the partition key |
| Keep PKs shard-ready: UUIDv7 `id` (EXISTING, below) | Allows `RANGE (id)` partitioning that keeps global PK uniqueness |

**ID facts (EXISTING).** Every ent schema mixes in `TimeOrderedIdentifierMixin` (`services/go/modules/*/src/databases/schema/timeOrderedIdentifier.mixin.go`): `uuid.NewV7()` with silent fallback to `uuid.New()` (v4) on error. Outbox rows reuse the envelope event id (`SetID(uuid.MustParse(event.Id))`, e.g. `modules/admin/src/events/outbox.event.go`). Consequence: `RANGE (id)` on UUIDv7 boundaries is viable and keeps the single-column PK valid; `created_at` is application-supplied (outbox `SetCreatedAt(occurredAt)`), so it correlates with but is not identical to the id timestamp. Decide per table which is authoritative.

**Tooling constraint (decision needed).** The owner rule is "ent + Atlas, no hand-written SQL except grants". ent has no first-class partition model. Options: (a) Atlas schema-as-code/composite schema with partition support (verify it is in the Atlas edition in use), (b) a small hand-written migration for partition DDL treated as a documented exception, (c) pg_partman managed outside ent. Recommendation: (b) for the few tables below, with `atlas migrate lint` and ent tables declared in ent as plain tables so codegen keeps working; partitions are invisible to ent queries. **OPEN QUESTION for owner**, because it breaks the "no hand-written SQL" rule.

## 2. Candidate triage

| Table (status) | Postgres partition? | Where it lives | Why / why not |
| --- | --- | --- | --- |
| `outbox_events` per schema (EXISTING: auth, users, admin, currency, ledger, live, wallet, escrow, payments, creators) | No at first (batch delete); daily range later | PG | Hot, short-lived, churn not size. See 3.1 |
| Admin `audit_events` (EXISTING `modules/admin/.../auditEvent.schema.go`) | Not yet; monthly range at > 50M rows | PG + S3 archive | Low volume; legal immutability. See 3.2 |
| Security / auth events (login, refresh reuse, OTP) (PLANNED; no table, `sessions` and `refresh_tokens` EXISTING) | Monthly range by `created_at` | PG, archive to S3 | Retention-driven. 3.3 |
| `journal_lines` / `journal_entries` (EXISTING ledger) | **Not now.** Re-evaluate at 100M lines | PG | `journal_entries.reference` UNIQUE + `reverses_entry_id` UNIQUE are idempotency guards; PK is `id` only. 3.4 |
| `orders`, `order_items` (PLANNED, `database.md` s4) | **No** | PG | Orders per year are small in every scenario below. 3.5 |
| `messages` (PLANNED, realtime/social) | Hash by `conversation_id` | PG, or dedicated cluster/store later | Read pattern is per conversation, retention long. 3.6 |
| `notifications` (PLANNED) | Monthly range by `created_at`, 90-day drop | PG | Pure retention case. 3.7 |
| `product_interactions` (views, saves, add-to-cart) (PLANNED) | No | **ClickHouse** raw; PG keeps counters | 3.8 |
| `ad_impressions`, `ad_clicks` (PLANNED, `database.md` s8) | No raw in PG | **ClickHouse** raw; PG keeps budget counters, conversions, billed rollups | Conflicts with `database.md` line 635 ("range-partition by day from the start"): see 3.9 |
| `video_views` (PLANNED) | No | **ClickHouse** | 3.8 |
| `livestream_events` (chat, joins, reactions) (PLANNED) | No | Phoenix memory + **ClickHouse** | Ephemeral, high rate. PG keeps `live_sessions`, gift rows |
| `gift_*` read models (EXISTING `modules/live/.../giftReadModel.schema.go`: combo state, leaderboard, goal and battle contributions) | Not yet | PG | Upsert-heavy (see hot-row note 3.10) |
| `analytics events` (generic) | No | **ClickHouse** | Pipeline design in `docs/architecture/analytics.md` |
| `webhook_events`, `idempotent_requests` (EXISTING payments, wallet, escrow) | Range or TTL job | PG | Retention-driven. 3.11 |
| `points_entries`, `stock_movements` (PLANNED, `database.md` line 812) | Monthly range once > 50M | PG | Append-only ledger-like |

## 3. Per-candidate detail

Scenario names and drivers are defined in `performance.md` section 6 (Base and High, year 1 and year 3). Row-size figures are **estimates** (heap row + indexes), to be replaced by `pg_total_relation_size / reltuples` once data exists.

### 3.1 Outbox (EXISTING)

| Item | Detail |
| --- | --- |
| Schema (EXISTING) | `id uuid PK, event_type, subject, payload jsonb, published_at NULL, created_at`; index `(published_at, created_at)`; per owning schema |
| Relay (EXISTING `platform/events/outbox.relay.go`) | poll 500 ms, batch 100, `FOR UPDATE SKIP LOCKED`, then `UPDATE ... SET published_at` in the same tx as the publish call |
| Cleanup (ABSENT) | `grep` finds no delete/prune of published rows in `modules/` or `platform/`. `docs/architecture/database.md` line 813 asks for a 7-day batch delete: **not implemented** |
| Problem | Each event is INSERT then UPDATE (dead tuple per row) then eventual DELETE. The `(published_at, created_at)` index is heavily churned; the pending scan `published_at IS NULL ORDER BY created_at` degrades if bloat or a backlog accumulates. Open question: full-index scan cost with millions of published rows |
| Growth (assumption) | events/day = business actions x 1-3. Base Y3 about 100M rows/yr produced; retained set (7 d) about 2M |
| Phase A (do now, **P1**) | Cleanup job per schema: `DELETE FROM outbox_events WHERE id IN (SELECT id FROM outbox_events WHERE published_at < now() - interval '7 days' ORDER BY published_at LIMIT 5000)` loop with sleep, off-peak, `lock_timeout 2s`. Replace the 2-column index with partial `(created_at) WHERE published_at IS NULL` so the pending scan never sees published rows. Set per-table autovacuum: `autovacuum_vacuum_scale_factor=0.02, autovacuum_vacuum_cost_limit=2000`, `fillfactor=85`. 7 days is itself an ops assumption (replay window); **LEGAL REVIEW** only if payloads contain personal data (they may; payload is raw JSON) |
| Phase B (trigger) | Daily `RANGE (created_at)` partitions, drop partitions older than 7 d; trigger = sustained > 200 inserts/s per schema, or autovacuum on the table running > 30% of wall time, or relay p99 poll > 100 ms. PK becomes `(id, created_at)`; ent keeps `id` as logical key (no FK points at outbox, so safe) |
| Pruning | Relay query filters `published_at IS NULL`; with daily partitions add `AND created_at > now() - interval '8 days'` (guard bound) so pruning excludes old partitions; an unbounded backlog older than the bound needs an alarm anyway |
| Migration | Create `outbox_events_new` partitioned, swap names in a short lock window with relay stopped (rows are re-derivable: unpublished ones are copied). Dual-write not needed |
| Reset path | `published_at = NULL` replay by id range (events.md line 63) must stay possible: partition retention must exceed the replay window |

### 3.2 Admin audit log (EXISTING)

| Item | Detail |
| --- | --- |
| Schema (EXISTING) | `audit_events`: actor_id, action, subject_type/id, before/after jsonb, ip, user agent, request id; indexes `(action,created_at)`, `(actor_id,created_at)`, `(subject_type,subject_id)`. Immutable fields; ent hooks |
| Growth | Staff-only actions: far below 100M in any scenario. Do **not** partition now |
| Trigger | > 50M rows or > 50 GB. Then monthly `RANGE (created_at)`, PK `(id, created_at)` |
| Retention | **LEGAL REVIEW** (financial-regulatory and dispute windows differ by jurisdiction). Technical default proposal: online 13 months in PG, then Parquet to S3 with Object Lock; never hard-delete before legal sign-off |
| Index strategy | Keep the three composites local to each partition; add BRIN on `created_at` only if a table scan by date range becomes common |
| Pruning | Admin UI queries always carry a date range (filter UI default 30 days): require it in the API so pruning works; queries by `actor_id` alone touch all partitions |
| Migration | New partitioned parent + attach existing table as the oldest partition (`ATTACH PARTITION` with a CHECK constraint `created_at < X` added `NOT VALID` then `VALIDATE` to avoid a long lock) |

### 3.3 Security and auth events (PLANNED)

`sessions` and `refresh_tokens` (EXISTING `modules/auth/.../session.schema.go`, `refreshToken.schema.go`) are state tables, not logs: they need an expiry sweep (`expires_at < now() - 30 d` batch delete; **no sweep exists**: P2). A separate append-only `security_events` table (PLANNED) would hold logins, MFA, refresh-reuse, password changes.

| Item | Detail |
| --- | --- |
| Key / strategy | `RANGE (created_at)` monthly |
| Growth | Base Y3 about 10 events per MAU per year = 4M/yr: small; Hot-case (credential stuffing) can spike 100x: partitioning for retention, not size |
| Retention | Online 90-180 days; archive 2 years: **LEGAL REVIEW** |
| Indexes | `(account_id, created_at DESC)` local; `(ip, created_at)` only if abuse queries need it |
| Pruning | Per-account timeline always bounded by time window |

### 3.4 Ledger (EXISTING) - do not partition early

| Fact (EXISTING `modules/ledger/.../journalEntry.schema.go`, `journalLine.schema.go`) | Consequence |
| --- | --- |
| `journal_entries`: unique `reference`, unique `reverses_entry_id`, index `external_reference`, `(kind, posted_at)` | Global uniqueness on non-key columns cannot be enforced across partitions |
| `journal_lines`: FK `entry_id`, FK `account_id`, indexes `(account_id, created_at)`, unique `(entry_id, line_number)`, `balance_after_minor` running balance | `balance_after` chain depends on per-account serial order; FKs referencing a partitioned parent need the partition key in the referenced PK |
| `ledgerPosting.service.go:52` takes `pg_advisory_xact_lock(hashtextextended('ledger-reference:'||ref,0))` | Idempotency is lock + unique index; moving idempotency to a separate unpartitioned `ledger_references(reference PK)` table would unlock partitioning later |
| Immutable rows (hooks reject update/delete) | Ideal for partitioning technically (never rewritten) |

Growth (assumption, Base Y3): about 29M gifts/yr x about 4 lines + orders = about 120M lines/yr, about 35 GB/yr at about 300 B per line incl. indexes. High Y3 is about 5x.

Plan: **FUTURE trigger** = `journal_lines` > 100M rows or > 100 GB, or per-account balance read p99 above target. Design then: (1) `ledger_references` unpartitioned table holding the unique reference; (2) `journal_lines` partitioned `RANGE (posted_at)` quarterly, PK `(id, posted_at)`, FK to entries dropped and replaced by a deferred constraint trigger or a periodic reconciliation check (ledger already has `reconciliation`); (3) account balances read from a `ledger_account_balances` snapshot (not by scanning lines). Retention: **never delete**; cold partitions move to cheaper storage or are exported to S3 Object Lock. **LEGAL REVIEW** for statutory financial-record retention. Note: Zudomart holds no money; ledger mirrors provider-held funds (`docs/integrations/flutterwaveMigration.md` Appendix C), so it is a reconciliation record, but treat it as financial truth for disputes.

### 3.5 Orders (PLANNED)

Base Y3 about 480k orders/yr x about 3 KB = about 1.5 GB/yr; High about 7 GB/yr. No partition. Indexes: `(buyer_id, created_at DESC)`, `(seller_id, status, created_at DESC)`, unique `(idempotency scope)`. Revisit only if > 100M rows (unreachable in modeled scenarios). Archive instead: cold orders (> 2 years, terminal status) can move to `orders_archive` if hot-set size matters. Retention **LEGAL REVIEW** (tax records).

### 3.6 Messages (PLANNED)

| Item | Detail |
| --- | --- |
| Access pattern | `WHERE conversation_id = ? AND id < cursor ORDER BY id DESC LIMIT 50`, plus per-user unread counts |
| Strategy | `HASH (conversation_id)`, 32 partitions at creation (cheap; avoids repartitioning), PK `(conversation_id, id)` (UUIDv7 `id`, time-ordered inside a conversation) |
| Why not time range | Reads are by conversation across all time; time partitions would force every history load to scan N partitions; retention is user-controlled deletion not drop-partition |
| Growth | Base Y1 about 73M/yr (20k MAU x 10 msg/day), Base Y3 about 1.5B/yr: **the largest PG table in the system** by far. Trigger to move off PG: > 1B rows or > 500 GB; candidate = dedicated cluster (hot schema first, per `database.md` line 814) |
| Index | PK only plus `(sender_id, created_at)` if moderation needs; avoid per-message GIN search indexes; search goes to the search service |
| Pruning | `conversation_id = $1` prunes to exactly 1 of 32 partitions (static value from bind parameter: runtime pruning at execution; verify with `EXPLAIN (ANALYZE)` showing `Subplans Removed`) |
| Retention | User deletion and account-erasure semantics: **LEGAL REVIEW** and `privacy.md`; E2E vs server-side moderation is a product decision |
| Migration | Create partitioned from day one when the module is built (no existing table): this is the cheapest moment. If introduced late: new parent, dual-write by conversation, backfill in conversation-id batches, flip reads, drop old |

### 3.7 Notifications (PLANNED)

`RANGE (created_at)` monthly; retention 90 days (product decision) = drop partition. PK `(id, created_at)`; index `(user_id, created_at DESC)` plus partial `(user_id) WHERE read_at IS NULL`. Base Y1 about 36M/yr (20k MAU x 5/day), Y3 about 730M/yr -> with 90 d retention steady about 180M rows: partition justified at Y3, optional at Y1 (create partitioned from the start: no cost). Read-state updates are the bloat risk: keep `read_at` on the row with `fillfactor=85` or move read watermark per user to a separate row ("read everything before X") to avoid per-row updates. Pruning: inbox query bounded to `created_at > now() - 90 d`.

### 3.8 Product interactions and video views -> ClickHouse

| Table | Why not PG | CH design (PLANNED) | PG keeps |
| --- | --- | --- | --- |
| `product_interactions` | Base Y3 about 400k MAU x 50/day = 7.3B/yr; read as aggregates | `MergeTree`, `PARTITION BY toYYYYMM(ts)`, `ORDER BY (product_id, ts)`, TTL per retention | denormalized counters on product (updated by batch job, not per event) |
| `video_views` | Base Y3 about 4.4B/yr | `ORDER BY (video_id, ts)`; `AggregatingMergeTree` rollups per hour | `view_count` columns on video, updated every N seconds from stream |
Ingestion: events -> RabbitMQ queue (or Kinesis/Firehose for raw clickstream) -> ClickHouse (see `performance.md` s5). Consent-withdrawal deletion in CH uses lightweight deletes or partition drop keyed by consent class: **LEGAL REVIEW**.

### 3.9 Ads (PLANNED)

`database.md` line 635 proposes range-partitioned `ad_impressions` in PG from the start. **Recommendation change (P1):** raw impression/click log goes to ClickHouse; PG holds only what needs transactional correctness: campaign budget counters, spend ledger entries, conversions with `dedupeKey`, billed daily rollups, creator ad earnings. Reason: Base Y3 about 2.9B impressions/yr; billing reconciliation is done on rollups. If the owner still wants a PG staging buffer: daily `RANGE (served_at)` partitions, 7-14 day retention (attribution + dispute window: **LEGAL REVIEW**), BRIN on `served_at`, unique `(impression_id, served_at)` for dedupe, PK `(impression_id, served_at)`; the rollup job reads yesterday's partition only (pruned).

### 3.10 Live gifts

Gift charges commit in go-money (`creators` `giftCharging.service.go` uses row locks) and the read models in go-live are upsert targets: `gift_combos` unique `(sender_id, live_id, combo_id)`, goal and leaderboard contribution rows unique `(live_id, scope_key, receiver_id, sender_id)`. These are hot-row upserts (celebrity live). Not a partition problem: fix with fillfactor 70-80, HOT-friendly updates (do not update indexed columns), and batching score updates through Valkey with periodic flush. `gift_transactions` (PLANNED events) grow with gifts: Base Y3 about 29M/yr: below partition threshold; partition at > 100M by month on `created_at`.

### 3.11 Idempotency and webhook rows (EXISTING)

| Table | Status | Strategy |
| --- | --- | --- |
| `idempotent_requests` (payments, wallet, escrow; unique `(scope,key)`) | EXISTING | Keep unique index (global); batch-delete rows older than 24-72 h (API retry window; assumption); no partitioning. If volume demands: `RANGE (created_at)` daily with key including `created_at` is **unsafe** (breaks uniqueness): use Valkey for the short window instead (platform idempotency store is already Redis, `platform/idempotency/idempotency.store.go`) |
| `webhook_events` (payments; unique `(provider,event_key)`, index `(processed_at, created_at)`) | EXISTING | Same: uniqueness must stay global; delete processed rows after 90 d (**LEGAL REVIEW**, provider dispute windows) via batch job |

## 4. Partition key and strategy summary

| Table | Key | Strategy | Partition size | Retention action | PK shape |
| --- | --- | --- | --- | --- | --- |
| outbox_events (phase B) | `created_at` | range daily | ~1 day | drop > 7 d | `(id, created_at)` |
| audit_events (trigger) | `created_at` | range monthly | 1 month | archive then detach | `(id, created_at)` |
| security_events | `created_at` | range monthly | 1 month | drop/archive | `(id, created_at)` |
| notifications | `created_at` | range monthly | 1 month | drop > 90 d | `(id, created_at)` |
| messages | `conversation_id` | hash 32 | n/a | user deletion | `(conversation_id, id)` |
| journal_lines (future) | `posted_at` | range quarterly | 3 months | never | `(id, posted_at)` |
| ad staging (optional) | `served_at` | range daily | 1 day | drop > 14 d | `(impression_id, served_at)` |

Alternative for UUIDv7 tables: `RANGE (id)` with boundaries from `uuidv7` timestamps keeps PK `(id)` intact. Pros: no PK change, no FK breakage. Cons: boundary generation tooling, `created_at` filters do not prune, risk if a v4 fallback id appears (EXISTING mixin falls back silently: a v4 id lands in a random partition or errors). Recommendation: remove the silent fallback (fail loudly) before relying on id-based partitioning.

## 5. Index strategy on partitioned tables

| Rule | Detail |
| --- | --- |
| Local indexes only | Declared on the parent, created per partition; every unique index must contain the partition key |
| Create concurrently | `CREATE INDEX CONCURRENTLY` is not allowed on the parent. Pattern: `CREATE INDEX ON ONLY parent`, `CREATE INDEX CONCURRENTLY` on each partition, `ALTER INDEX parent ATTACH PARTITION child` |
| Fewer indexes | Each index multiplies by partition count in planner and vacuum work; keep 2-3 per table |
| BRIN | Only for append-only time-ordered cold partitions and large scans |
| FKs | FKs from a partitioned table to a regular table are supported (PG12+); FKs referencing a partitioned table need the full unique key; plan cross-partition integrity as app checks plus reconciliation |

## 6. Partition pruning, in practice

1. Static pruning needs the key in `WHERE` with an immutable expression (`created_at >= '2026-10-01'`).
2. With prepared statements and bind parameters Postgres prunes at execution time (initial pruning), visible as `Subplans Removed: N` in `EXPLAIN (ANALYZE)`. The pgx `database/sql` stdlib uses prepared statements by default (EXISTING: `platform/postgres/database.connector.go` uses `pgx/v5/stdlib`), which is fine here, but custom plans (first 5 executions) versus generic plans can defeat pruning: verify with `plan_cache_mode`.
3. `now() - interval` is stable, not immutable: pruned at execution time, not planning time: fine.
4. Queries lacking the key scan every partition: add lint in code review ("every list query on a partitioned table carries the key") and monitor `pg_stat_statements` for partition-wide scans.
5. ORDER BY + LIMIT across partitions use Merge Append (needs per-partition index on the sort key).
6. Keep partition count under about 500 per table (planning time grows with count): range monthly x 5 years = 60 (fine), daily x 14 (fine), daily x 365 (avoid unless planning time measured).

## 7. Automation

| Task | Tool | Status |
| --- | --- | --- |
| Create future partitions 3 periods ahead; drop old | `pg_partman` (supported on Aurora PostgreSQL) driven by `pg_cron` (supported) or an ECS scheduled task | FUTURE |
| Alarm if the "default partition" receives rows or the next partition is missing < 7 days ahead | custom metric | FUTURE |
| Always create a DEFAULT partition | prevents insert failure; alarm if non-empty | FUTURE |
| Detach with `DETACH PARTITION ... CONCURRENTLY` (PG14+) before archive | avoids ACCESS EXCLUSIVE | FUTURE |

## 8. Migration strategies (existing table -> partitioned)

| Strategy | When | Steps | Risk |
| --- | --- | --- | --- |
| A. Create partitioned parent and attach the old table as a partition | Table is append-only and time-ordered (audit, security events) | 1) create parent with same columns; 2) `ALTER TABLE old ADD CONSTRAINT ... CHECK (created_at < 'X') NOT VALID`; `VALIDATE`; 3) in one short tx rename old to `t_legacy`, create parent as `t`, `ATTACH PARTITION t_legacy FOR VALUES FROM (MINVALUE) TO ('X')`; 4) create new partitions from X | PK must contain key: add `(id, created_at)` unique index concurrently first; ent-generated names must be preserved |
| B. New table, dual-write, backfill, cutover | Table is mutated (messages, notifications with read state), or PK/UNIQUE changes | 1) create `t_new` partitioned; 2) dual-write in the repository/command (outbox-style or in the same tx); 3) batched backfill by id range with throttle; 4) compare counts and checksums; 5) flip reads behind a flag; 6) stop old writes; 7) drop old after one release | Longest path; needs feature flag; none of these tables exist yet in code, so for PLANNED tables choose "create partitioned from day one" |
| C. No migration (day-one partition) | PLANNED tables (messages, notifications, security_events) | Create partitioned in the module's first migration | Needs the tooling decision in section 1 |

## 9. Follow-ups and open questions

| # | Item | Priority |
| --- | --- | --- |
| 1 | Implement outbox cleanup + partial pending index (none exists) | **P1** |
| 2 | Decide how partition DDL is expressed under "ent + Atlas, no hand SQL" | P1 |
| 3 | Remove silent UUIDv4 fallback in the id mixin before id-based partitioning | P2 |
| 4 | Update `database.md` line 635 ads decision (raw impressions to ClickHouse) | P1 |
| 5 | Sweep jobs for `sessions`, `refresh_tokens`, `idempotent_requests`, `webhook_events` | P2 |
| 6 | Validate pruning and plans with `EXPLAIN (ANALYZE, BUFFERS)` on seeded data (1M, 10M rows) when compose Postgres is available | P2 |
| 7 | LEGAL REVIEW for audit, security events, messages, ledger, webhook, order retention | P1 |
