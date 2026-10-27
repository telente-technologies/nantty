# Sharding strategy (FUTURE only)

As of 2026-10-03. **Decision: no physical sharding now.** Path: single Aurora cluster -> partitionable (`partitioning.md`) -> shard-ready (this doc's checklist) -> hot schema moved to its own cluster -> sharding only if a Phase 4 trigger fires. Labels: EXISTING (path), PLANNED, FUTURE. Volumes are scenario assumptions (`performance.md` s6).

## 1. Ladder before any sharding

| Step | Action | Reversibility |
| --- | --- | --- |
| 1 | Vertical scale (bigger Aurora class), pooling, caching, read replicas, query/index tuning | trivial |
| 2 | Partition large tables, move analytics to ClickHouse | moderate |
| 3 | Split a hot **schema** onto its own Aurora cluster (messages, ads, notifications, live). Schemas already have owning roles (EXISTING `infra/local/postgres/create-databases.sh`), so this is a connection-string change per module | moderate |
| 4 | Shard a single domain by key (this doc) | hard, per-domain, one-way |

## 2. Shard-key evaluation per domain

Evaluation criteria: data locality, query locality, cross-shard queries, transactions, FKs, unique ids, hotspots, rebalancing, ops complexity.

| Domain (schema) | Candidate keys | Recommendation | Rationale and risks |
| --- | --- | --- | --- |
| Identity: `auth`, `users`, `admin` (EXISTING) | `account_id` | **Do not shard.** Keep on the primary cluster. Row counts stay in the tens of millions in all scenarios; lookups by email/handle/token_hash need global uniqueness | Unique lookups (`token_hash`, email, handle) have no shard key. If forced: directory table `handle -> account_id -> shard` on an unsharded service. `refresh_tokens(token_hash)` is looked up without account id: needs the directory |
| Catalog / inventory (PLANNED) | `seller_id` | Shard-ready by `seller_id`, shard last | Query locality good (seller dashboards, storefront), but marketplace browse/search crosses all sellers (served by search service, not PG). Mega sellers hotspot: allow a dedicated shard per mega seller. Inventory writes are per variant: keep with product |
| Orders (PLANNED) | `buyer_id` or `seller_id`? | **Recommend `buyer_id`** for `orders`; seller views via a denormalized `seller_orders` projection keyed by `seller_id` fed by outbox | An order touches two actors; cross-shard transaction avoided because the order row is written once; seller read model is eventually consistent. Multi-seller carts: one order per seller (parent cart id) keeps single-shard writes |
| Payments / wallet / escrow / ledger / creators / subscriptions / rewards (EXISTING money schemas) | `account_id` (wallet), `reference` (ledger) | **Do not shard. Last candidate in the system.** Money has the strictest transactional needs: double-entry entries span two accounts (buyer, seller), so any shard-by-account split makes entries cross-shard | Exhaust vertical scaling and partitioning first. If ever needed: shard ledger by `ledger_account_id` with single-account entries plus a clearing account (two single-shard postings joined by saga), accept eventual consistency, **after** a dedicated design review. Idempotency `reference` uniqueness needs a directory or `hash(reference)` routing |
| Social graph: follows, likes, posts (PLANNED) | `user_id` (follower) / `creator_id` | Follows: edge table twice (by follower, by followee) via outbox, each keyed on its owner. Posts: `creator_id` | Celebrity creators make a hot partition: counters via Valkey/CH, not per-row updates; fan-out on read for celebrities (`social-graph-feed-delivery` pattern) |
| Messages (PLANNED) | `conversation_id` vs `user_id` | **`conversation_id`** | Locality for the dominant query (timeline); membership table separate. Inbox list needs per-user index: keep `conversation_members(user_id, conversation_id, last_read)` in a user-keyed store, joined by app. Group chats with huge membership = hotspot on one shard; cap size or fan-out channels as a separate type |
| Notifications (PLANNED) | `user_id` | `user_id` | Pure per-user inbox, no cross-user queries: the easiest to shard. Retention via partition drop inside each shard |
| Live: `live_sessions`, gifts, battles (EXISTING `modules/live`) | `live_id` | `live_id` for session-scoped state (gift combos, goals, battle contributions all carry `live_id`) | Natural locality; a mega live is a single-shard hotspot: absorb with Valkey counters and batched flush (see 3.10 of partitioning). Sender-centric queries (`gift_*` index `(sender_id, created_at)`, EXISTING) cross shards: serve from ClickHouse |
| Ads (PLANNED) | `campaign_id` (budget), events by `ad_id` | Budget/spend: not sharded (strict counters). Events: ClickHouse sharding (its own concern) | Budget pacing needs single-writer semantics per campaign: keep PG with `campaign_id` as the future key |
| Analytics events | n/a | ClickHouse sharding/replication (native), `user_id` or `event_id` hash | Not a Postgres concern |
| Moderation / trust (EXISTING goTrust skeleton) | `subject_id` | Do not shard | Low volume |
| Creators / rewards / points (EXISTING partially) | `account_id` | Do not shard; ledger-backed | Points are ledger-backed and inherit the ledger decision |

## 3. Cross-cutting concerns

| Concern | Position |
| --- | --- |
| Unique ids | UUIDv7 everywhere (EXISTING): no central sequence needed, no collisions across shards, time-sortable. The mixin silently falls back to UUIDv4 (EXISTING in `timeOrderedIdentifier.mixin.go`); v4 still works for sharding but breaks time ordering assumptions: fail loudly instead |
| Routing | Consistent hash ring or directory table (`shard_map(key_range -> cluster)`), versioned, cached in the app. Prefer a directory (allows moving single hot tenants) over pure modulo hashing |
| Global secondary lookups | Directory services or projections (e.g. `handle -> account_id`) in an unsharded store |
| Cross-shard queries | Forbidden in OLTP paths; reporting goes to ClickHouse; admin cross-shard search goes through the search index |
| Transactions | Single shard only. Cross-domain flows already use outbox + saga (EXISTING outbox; escrow/saga skills): they are the model for cross-shard too |
| FKs | Already mostly absent across domains by design (database-per-schema, EXISTING: only 6 migration files contain `FOREIGN KEY`, all intra-schema). Cross-schema reads happen through column-level `GRANT SELECT` to `nantty_readers` (EXISTING, e.g. users `profiles` columns): **this is a hidden cross-domain join seam**: it must be replaced by a service call or projection before moving schemas to separate clusters |
| Hotspots | Celebrity creators, mega sellers, mega lives: solve by caching, counters outside PG, dedicated shard for a tenant, never by hash alone |
| Rebalancing | Directory-based: dual-write a tenant range to the target shard, backfill, verify checksums, flip routing entry, drain. Online logical replication (`pglogical` / native logical replication) per schema is the mechanism; test in staging first |
| Ops complexity | Each shard adds backup/PITR, failover, migrations, monitoring x N: migrations must be driven by a tool that targets all shards (extension of the pre-deploy migration task, `migrations.md`) |
| Tooling options | Citus (not available on Aurora), application-level routing (recommended), Vitess-style proxies (MySQL, not applicable). Aurora Limitless Database (Aurora PostgreSQL) exists; **verify** current availability, PostGIS support and limitations before considering |

## 4. Sharding-readiness checklist (do NOW)

| # | Check | Current state (static findings) | Action | Priority |
| --- | --- | --- | --- | --- |
| 1 | UUIDv7 primary keys | EXISTING: all ent schemas mix in `TimeOrderedIdentifierMixin` using `uuid.NewV7()`. Two caveats: silent fallback to `uuid.New()`; reference tables (`live/gift.schema.go` uses string ids) and `dispute_id` fields are separate ids | Fail on v7 error; add a CI test asserting all entity ids are v7 (version nibble); document string-id reference tables as unsharded config data | P2 |
| 2 | No sequential-id assumptions | No `serial/identity` found in ent schemas; ordering uses `created_at` and uuid | Keep it: lint for `field.Int("id")` in schemas | P3 |
| 3 | No cross-domain joins in code | Each module opens its own schema-scoped `sql.DB` (`postgres.ScopeDatabaseUrlToSchema`, 8 call sites); but `nantty_readers` column grants exist and `goMoney` shares one pool across 7 schemas | Inventory every cross-schema SQL read (grep for fully-qualified schema names and grants); replace with ports (`platform/identityports` EXISTING pattern) | P1 |
| 4 | Repository abstraction / routing seam | Modules call ent clients directly through a container; `platform/postgres` is the single opener (`OpenDatabaseAndVerifyConnection`) | Introduce `Router.For(domainKey)` returning `*ent.Client`; for now always returns the same client. All new repositories take the key explicitly (`account_id`, `conversation_id`, `live_id`, `seller_id`) | P2 |
| 5 | Every table has a tenant key column | Mostly yes (`account_id`, `live_id`, `sender_id`); some tables are keyed only by a surrogate id (outbox, webhook) | Add the owning key to new tables by default; document the shard key per table in schema comments/README | P2 |
| 6 | Idempotency not tied to a global table | Ledger uses `reference` unique + advisory lock; money tables hold per-schema `idempotent_requests (scope,key)`; HTTP idempotency in Valkey (EXISTING `platform/idempotency`). Idempotency in Valkey is not shard-aware either | Scope keys with the owning entity key (`account_id:key`) so they route with the data | P2 |
| 7 | Cursor pagination independent of global order | Not verified for all lists (static review only); ids are UUIDv7 so `(created_at, id)` cursors work per key | Standard: `WHERE key = $1 AND (created_at, id) < ($2, $3)`; never `OFFSET`; never a global feed query | P1 |
| 8 | No cross-schema transactions | Outbox pattern used; go-live commits gifts via go-money gRPC then its own outbox (EXISTING pattern) | Keep: forbid new cross-schema transactions in review | P1 |
| 9 | Outbox per schema, not one global | EXISTING per schema | Keeps outbox relay shardable | done |
| 10 | Directory lookups for global unique attributes (email, handle) behind a service interface | `auth`/`users` own them (EXISTING `identityports`) | Keep access through ports | P3 |
| 11 | Background jobs can run per shard | Relay and sweeps are single-process loops | Parameterize by schema + shard id | P3 |
| 12 | Connection config per schema | Schema scoped URL per module already (settings.DatabaseUrl + DatabaseSchema) | Allow a per-module database URL override (already structurally supported) | P2 |
| 13 | Reads for projections can go to a different store | Gift read models are projections (EXISTING) | Mark projection tables as rebuildable from events | P3 |

## 5. Phase 4 triggers (measurable)

Sharding is considered only if **all** of: (a) after tuning, caching, partitioning, replicas and a schema split already done, and (b) at least one of the following is measured over 14 consecutive days:

| Trigger | Threshold | Source |
| --- | --- | --- |
| Writer CPU | > 70% p95 at the largest practical instance class for the workload | CloudWatch `CPUUtilization` writer |
| Single-schema size | > 3-5 TB (restore time vs RTO is the real limit: restore test exceeds the RTO by > 50%) | restore drill, `pg_database_size` |
| Write throughput | commit rate or WAL throughput within 20% of the instance class limit; Aurora `VolumeWriteIOPs` growth projects to the limit within 6 months | CloudWatch, Performance Insights |
| Lock/hot row | single-row or single-key contention: lock wait > 5% of DB time on one table for a business-critical path, not fixable by batching | Performance Insights wait events |
| Vacuum | autovacuum cannot finish the largest table within 24 h or xid age > 1B on any table | `pg_stat_progress_vacuum`, `age(relfrozenxid)` |
| Connections | max connections used > 80% after RDS Proxy | `DatabaseConnections` |
| Vertical limit | Largest instance class within 6 months of projected need | capacity model |

If a trigger fires for one schema: split that schema to its own cluster first (step 3), re-measure, and only then shard that domain using section 2's key. Never shard money before every other domain.

## 6. Open questions

| Item | Note |
| --- | --- |
| Aurora Limitless Database fit | Verify availability, PostGIS, extension and feature gaps at the time |
| Cross-schema read grants | Decide per grant: keep as a single-cluster optimization vs replace by projection now |
| Messages store | PG vs a purpose-built store (Scylla/DynamoDB) once Base Y3 volume is validated; separate decision, not a sharding step |
