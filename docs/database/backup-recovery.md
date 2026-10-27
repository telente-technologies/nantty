# Backup and recovery (database view)

As of 2026-10-03. Labels: EXISTING (path), PLANNED, FUTURE. Nothing below exists in code: no Terraform for Aurora was found (`infra/` has `aws/README.md` and `local/` only). This doc refines `docs/architecture/disaster-recovery.md` (tiers, region-loss plan) for the data layer. All RPO/RTO values are **targets to prove with restore drills**, not guarantees. Retention periods marked **LEGAL REVIEW**.

## 1. Baseline facts

| Fact | Evidence |
| --- | --- |
| One Aurora PostgreSQL + PostGIS cluster, schema per service (fixed owner decision) | `infra/local/postgres/create-databases.sh` (local model) |
| Money truth lives in `ledger` (a mirror of provider-held funds; Nantty holds no money, `docs/integrations/flutterwaveMigration.md` Appendix C) plus `payments`, `wallet`, `escrow` | `docs/architecture/payments.md` |
| Domain events leave through per-schema outbox to RabbitMQ (RabbitMQ adopted, owner, 2026-10-03); broker messages have no backup, so **unpublished outbox rows are the replay source** | `platform/events/outbox.relay.go`, `events.md` |
| Idempotency for HTTP lives in Valkey (cache, rebuildable) and in per-schema tables for money | `platform/idempotency`, `modules/*/idempotentRequest.schema.go` |
| Signing keys are stored in `auth.signing_keys` (encrypted) | `modules/auth/.../signingKey.schema.go` |

## 2. Controls

| Control | Setting (PLANNED) | Notes |
| --- | --- | --- |
| Automated backups | Aurora continuous backup, retention 35 days (prod), 7 days (staging) | Max Aurora retention is 35 days (AWS limit; verify) |
| PITR | Enabled by default with automated backups; restore creates a **new cluster** (not in place) | Restore time grows with cluster size and is a capacity-planning input |
| Snapshots | Daily automated snapshot via AWS Backup with vault lock; monthly snapshot kept 12 months; manual snapshot **before every contract migration** (`migrations.md`) | Retention **LEGAL REVIEW** |
| Cross-region copy | Daily snapshot copied to the DR region under a DR KMS key (multi-region key); also copy to a separate backup account | Cross-account/region copy lag included in RPO of region-loss |
| Aurora Global Database | FUTURE pilot-light option (`disaster-recovery.md` line 123) when contractual RTO < 1 h | Costs about 2x, trigger by contract or revenue |
| Multi-AZ | Writer + at least 1 reader in another AZ (failover target); storage is 6-way across 3 AZs | PLANNED P0 |
| Deletion protection | On; `skip_final_snapshot=false`; IAM/SCP deny for `DeleteDBCluster` outside break-glass | PLANNED |
| Encryption | KMS CMK; backups inherit; key deletion protection and multi-region replica key | PLANNED |
| Logical exports | Weekly `pg_dump --schema=ledger,payments,wallet,escrow` (or table exports) to S3 with Object Lock (compliance mode) | Independent of Aurora snapshot format; protects against logical corruption detected after 35 days. Retention **LEGAL REVIEW** |
| Backup verification | Automated: snapshot status, copy completion, vault lock; alarm on failure or age > 26 h | PLANNED |
| Restore tests | Scheduled drills (section 4) with automated checks | PLANNED |
| Point-in-time safety | After accidental delete: PITR to a new cluster, export affected rows, re-insert; never swap the cluster without a diff | runbook |

## 3. RPO / RTO targets by tier

Aligned with `disaster-recovery.md` section 2 and extended with the data classes asked for. **TARGETS.**

| Tier / asset | RPO target | RTO target | Mechanism | Validation |
| --- | --- | --- | --- | --- |
| DB Tier 0 (`ledger`, `payments`, `wallet`, `escrow`, `auth`, `users`) | <= 5 min via PITR; 0 on AZ failure (Multi-AZ storage) | < 5 min instance/AZ failover (automatic); <= 4 h region loss | Aurora Multi-AZ, PITR, cross-region snapshot restore | quarterly drill, failover game day |
| DB Tier 1 (`catalog`, `inventory`, `orders`, ...) | <= 15 min | <= 4 h | same cluster | same |
| DB Tier 2 (social, messages, notifications, live state) | <= 1 h | <= 8 h | same cluster; live sessions are ephemeral and end | same |
| Large-schema caveat | RTO for restore-from-snapshot grows with size: record minutes per TB each drill; trigger schema split if restore exceeds 50% of RTO (`performance.md` 6.4) | | | drill log |
| Object storage: critical (KYB docs, user uploads, exports, ledger exports) | <= 15 min (CRR lag) | 4 h (origin failover to replica bucket) | versioning, Object Lock (governance for KYB, compliance for ledger exports), CRR | replication metrics, quarterly read test |
| Object storage: regenerable (processed media, Parquet derived) | no RPO (rebuild) | 24 h | versioning only; regenerate | rebuild test |
| Config (Terraform, platform settings, feature flags) | 0 (git) for IaC; platform settings are in `admin.platform_settings` so they ride with the DB | 1 h for IaC re-apply | git + versioned state bucket replicated; `platform_settings` in DB backups | `terraform plan` clean in DR region monthly |
| Secrets (Secrets Manager, KMS keys, JWT signing keys) | 0 for static secrets (replica secrets); signing keys: as DB Tier 0 | 30 min (replica secrets), keys restored with auth schema | multi-region secrets and keys | DR drill: services start in DR with replica secrets |
| Critical event data: unpublished outbox | covered by DB RPO (rows are in the same cluster) | replay after restore, no manual work | outbox rows with `published_at IS NULL` replay automatically; for already-published events replay by id range (`published_at = NULL` reset, `events.md` line 63) | drill: restore at T, verify consumers dedupe |
| Critical event data: RabbitMQ (Amazon MQ) | none (not a store; quorum queues replicated across 3 AZs, topology in `definitions.json`) | move `<queue>.dlq` back after fix; outbox replay by id range | idempotent consumers | drill |
| Critical event data: analytics events (ClickHouse) | rebuildable: S3 raw Parquet + outbox replay | 24 h to rebuild | S3 raw retained with versioning; CH backups optional (`clickhouse-backup` to S3) | rebuild test |
| Valkey | none | warm-up | rebuildable; nothing money-critical only here (EXISTING idempotency in PG for money tables) | cold-start test |

Note on "RPO 5 min": Aurora PITR is continuous (typically seconds of lag; verify `LatestRestorableTime` against now, alarm if lag > 5 min).

## 4. Restore verification and drills

| Drill | Frequency | Procedure | Automated checks | Pass criteria |
| --- | --- | --- | --- | --- |
| Snapshot restore to scratch cluster | Monthly (automated), quarterly full (human) | restore latest snapshot to isolated VPC/account, run schema health checks | all schemas present, `schema_migrations` versions match code, row count deltas vs production within expected, **ledger trial balance = 0** (sum debit = sum credit per currency), `journal_lines.balance_after` consistency spot checks, auth login test, outbox pending replay count | all checks pass; record achieved RPO and RTO |
| PITR to a random timestamp | Quarterly | pick a time within 35 d | same checks plus target row exists/absent | pass |
| Cross-region restore | Twice a year | restore the copied snapshot in the DR region with the DR key | same | RTO <= 4 h |
| Failover game day | Twice a year | `FailoverDBCluster` under k6 load | pool recovery time, error budget, relay resumes, no duplicate postings | recovery < 2 min, zero double charges (idempotency) |
| Logical export restore | Yearly | restore ledger export into scratch | row counts and checksums | pass |
| Deletion replay | Each drill | replay the deletion ledger `(account_id, erased_at)` after restore (`privacy.md`) | erased accounts absent | **LEGAL REVIEW** of the process |

Restore drills run with masked data outside the production account when possible; a restored copy contains PII and follows production access rules (`performance.md` s8).

## 5. Runbook outlines (to expand into `docs/runbooks/`)

| # | Scenario | Steps (outline) |
| --- | --- | --- |
| R1 | Instance or AZ failure | Confirm automatic failover (cluster events); verify the writer endpoint resolves; check app pools recovered (`WaitCount`, errors); confirm outbox relay lag returns < 60 s; confirm replica lag; post-incident: replace instance |
| R2 | Accidental data deletion or bad migration | Stop writers for affected schema (feature flag / scale tasks to 0); note the incident timestamp; PITR to new cluster at T-1 min; diff affected tables; copy rows back or promote after full diff; reconcile ledger trial balance; replay outbox; document |
| R3 | Logical corruption found late (> 35 d) | Use monthly snapshot or weekly logical export; reconstruct rows into a scratch cluster; ledger reconciled against provider statements (provider is the money authority) |
| R4 | Region loss | Declare incident; `terraform apply` DR env; restore latest cross-region snapshot (Tier 0 first); restore secrets replicas; deploy images from replicated ECR; re-point DNS; verify Tier 0 checks (trial balance, login); open traffic order: auth, read paths, checkout, money; replay outbox; redrive DLQs; reconcile payments against provider webhooks and statements (missed-webhook backfill job) |
| R5 | Cluster exhaustion (connections / storage / CPU) | Identify top sessions (`pg_stat_activity`), terminate runaway queries, scale pools down, enable load shedding, add RDS Proxy capacity, scale instance class; postmortem |
| R6 | Credential compromise | Rotate secrets (multi-user rotation), revoke sessions, invalidate JWT signing key via the key-rotation procedure, review `pgaudit` and CloudTrail, restore if tampering found |
| R7 | Backup failure alarm | Check AWS Backup job, KMS permissions, vault lock; take manual snapshot; escalate if > 26 h without a valid snapshot |
| R8 | Failed migration | Abort per PR plan; if schema changed partially, restore from the pre-migration manual snapshot **only** if data was altered; otherwise fix forward; `migrations.md` s3 |
| R9 | Outbox/event pipeline stuck | Check relay logs, RabbitMQ user permissions (`write` on `nantty.events`), broker memory/disk alarms, publish confirm timeouts; do not delete unpublished rows; replay after fix; move DLQ messages back |

## 6. Gaps and actions

| # | Gap | Priority |
| --- | --- | --- |
| 1 | No IaC or settings for Aurora backups/Multi-AZ exist yet: define in Terraform with the settings above | **P0** before first real user data (`database.md` line 810 also P0) |
| 2 | No restore has ever been performed or measured; schedule the first drill before launch and record minutes per GB | **P1** |
| 3 | Ledger trial-balance and consistency query as an automated check (the `reconciliation` schema exists, EXISTING `ledger/.../reconciliation.schema.go`) wired into drills | P1 |
| 4 | Outbox replay tooling by id range (documented in events.md as PROPOSED) | P1 |
| 5 | Deletion-ledger replay after restore (privacy requirement) | P1, **LEGAL REVIEW** |
| 6 | Legal retention of backups vs erasure requests (backups cannot be selectively erased): policy that backups expire within a bounded window and deletion ledger replays after restore | **LEGAL REVIEW** |
| 7 | Decide logical weekly export of money schemas and its retention | P2, **LEGAL REVIEW** |
| 8 | Document achieved RPO/RTO per drill in a log | P2 |
