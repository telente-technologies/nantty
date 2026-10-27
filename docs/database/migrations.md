# Migration practice

As of 2026-10-03. Labels: EXISTING (path), PLANNED, FUTURE.

## 1. Current state (audit)

| Area | Finding | Evidence | Severity |
| --- | --- | --- | --- |
| Generation | Per-module `cmd/generateMigration` uses ent's Go API `entmigrate.NamedDiff` in replay mode against `atlas_dev`, golang-migrate file format (`.up.sql`/`.down.sql`) plus `atlas.sum`; `WithDropColumn(false)`, `WithDropIndex(true)` | `services/go/modules/*/cmd/generateMigration/main.go` | EXISTING |
| Apply | **Services run migrations on boot**: each module's `Start...Module` calls `postgres.ApplyPendingMigrationsFromEmbeddedDirectory` (golang-migrate `Up()`) before opening its pool. Files embedded via `migrations.Files` | `platform/postgres/migrations.runner.go`; e.g. `modules/users/src/app.go:56`; same in auth, admin, currency, live, money loaders | **P1** |
| Credentials | The app role that serves traffic is also the **schema owner** (`CREATE SCHEMA x AUTHORIZATION svc_x`), so the running service can run any DDL, including `DROP` | `infra/local/postgres/create-databases.sh` | **P1** |
| Concurrency | N tasks start together: golang-migrate takes a Postgres advisory lock, so migrations serialize, but every replica blocks at boot waiting on the lock, and a long DDL keeps all new tasks unready (rolling deploy stalls, health-check failures) | `migrations.runner.go` | P1 |
| Lint | No `atlas migrate lint` step; CI only starts compose Postgres | `.github/workflows/backend.yml`; no `atlas.hcl` in repo | **P1** |
| Rollback | `.down.sql` files exist; `migrate.Down` is never called by code; rollbacks are untested | migrations folders | P2 |
| Index builds | Generated SQL uses plain `CREATE INDEX` (blocks writes); fine on empty tables, unsafe once tables hold data | e.g. `ledger/src/migrations/*_create_ledger_tables.up.sql` | P1 once data exists |
| Grants in migrations | Cross-schema `GRANT SELECT` to `nantty_readers` live in migrations and need the owner role | `users/src/migrations/*_grant_read_access_*.up.sql` | note |
| Per-schema history | golang-migrate tracks `schema_migrations` per schema because URLs set `search_path` | `platform/postgres/schema.scope.go` | ok |
| Mixed concern | `docs/architecture/database.md` line 807 and `devops.md` line 73 already propose pre-deploy task + lint (PROPOSED) | those docs | aligned |

## 2. Target pipeline (PLANNED)

```mermaid
flowchart LR
  A[Edit ent schema] --> B[generateMigration -> versioned .sql + atlas.sum]
  B --> C[PR review: SQL diff is the artifact]
  C --> D[CI: atlas migrate lint + validate + replay on shadow DB]
  D --> E[CI: integration tests on migrated DB]
  E --> F[merge]
  F --> G[Deploy: one-off ECS migration task per schema, migrator role]
  G --> H[Deploy services (no DDL, app role)]
```

| Stage | Requirement |
| --- | --- |
| Versioned | One migration = one reviewed `.sql` file, timestamp prefix, `atlas.sum` committed; hand edits require `-rehash` (EXISTING) |
| Reviewable | PRs show SQL; a migration that adds an index to a table > 1M rows or alters types needs a second reviewer and a "table size" note |
| Linted | `atlas migrate lint --dir file://... --dev-url docker://postgres/16/dev --latest N` with analyzers: destructive (DROP TABLE/COLUMN), data-dependent (add NOT NULL without default, unique on existing data), concurrent-index, naming. Needs an `atlas.hcl` per module with `lint { destructive { error = true } }`. Note the repo runs ent's Go API rather than the Atlas CLI: lint works on the SQL directory either way (golang-migrate format via `dir: "file://migrations?format=golang-migrate"`) |
| Shadow DB test | CI replays all migrations from zero on a clean shadow DB (EXISTING pattern: `atlas_dev`, `nantty_test`; `moneyTesting.CreateFreshSchemaWithMigrations`) then runs ent diff and asserts **no drift** (generated diff is empty) |
| Upgrade test | Optional: restore a masked recent snapshot into CI and run pending migrations to measure lock time and duration on realistic size |
| Reversible where practical | `.down.sql` for additive changes; contract-phase (drops) are not reversible: rely on PITR plus expand/contract discipline. Restore point: take a manual cluster snapshot before any contract migration |
| Pre-deploy task | One ECS RunTask per deployable and schema list, before the service update; fails the pipeline on error; services read a `MIGRATE_ON_START=false` flag (**default false in prod**, true only for local dev/tests) |
| Migrator role | Separate login role per schema (`svc_x_migrator`, owner of objects), app role `svc_x` gets only DML grants. Default privileges: `ALTER DEFAULT PRIVILEGES FOR ROLE svc_x_migrator IN SCHEMA x GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO svc_x` (a grant statement: within the "no hand SQL except grants" rule). Credentials only in the pipeline's task role / Secrets Manager |
| Ordering across services | Schemas are independent; cross-schema `nantty_readers` grants create ordering coupling: apply the owner's migration (column added) before consumers' code reads it |

## 3. Safe DDL cookbook

| Operation | Safe form | Unsafe form |
| --- | --- | --- |
| Session guards (every migration session) | `SET lock_timeout='5s'; SET statement_timeout='15min' (index builds) or '30s' (DDL); SET idle_in_transaction_session_timeout='60s'` | none |
| Add nullable column | `ALTER TABLE t ADD COLUMN c type NULL` (metadata only) | n/a |
| Add column with default | PG11+: constant default is metadata-only; **volatile** default (`now()`, `gen_random_uuid()`) rewrites the table: add nullable, backfill in batches, then set default and NOT NULL |
| Add NOT NULL | `ALTER TABLE t ADD CONSTRAINT c CHECK (col IS NOT NULL) NOT VALID; ALTER TABLE t VALIDATE CONSTRAINT c;` then `SET NOT NULL` (PG12+ uses the validated check, no scan) | direct `SET NOT NULL` on a big table scans under ACCESS EXCLUSIVE |
| Add CHECK / FK | `... NOT VALID` then `VALIDATE CONSTRAINT` (SHARE UPDATE EXCLUSIVE) | validating inline |
| Add index | `CREATE INDEX CONCURRENTLY`; migration file must not be in a transaction (golang-migrate: single statement file or `x-multi-statement`; Atlas: `-- atlas:txmode none`); check for `INVALID` index after failure and drop it | plain `CREATE INDEX` on a loaded table |
| Add unique constraint | build `CREATE UNIQUE INDEX CONCURRENTLY`, then `ADD CONSTRAINT ... UNIQUE USING INDEX` | direct |
| Drop index | `DROP INDEX CONCURRENTLY` | plain drop (brief lock but queues behind long queries) |
| Change type | expand/contract: new column, dual-write, backfill, switch, drop. int->bigint always this path | `ALTER COLUMN TYPE` (rewrite) |
| Rename column/table | expand/contract with a view or dual columns for a release | direct rename (breaks running old code) |
| Drop column/table | only in a later release after code stopped using it; ent: `WithDropColumn(false)` (EXISTING default) forces explicit decision | in the same release |
| Enum values | ent enums are `character varying` + app validation in generated migrations (EXISTING); prefer text + CHECK `NOT VALID`; no PG enum types | `ALTER TYPE ... ADD VALUE` in tx |
| Backfill | batches of 1-5k rows by PK range, `pg_sleep` between, monitored replication lag, resumable cursor stored in a table; run as a job, not in the migration tx | single `UPDATE` |
| Lock queue danger | any DDL needing ACCESS EXCLUSIVE queues behind a long query and blocks all later queries: `lock_timeout` plus retry loop with jitter | no timeout |
| Partition DDL | `ATTACH PARTITION` after a validated CHECK; `DETACH ... CONCURRENTLY` (see `partitioning.md`) | direct attach of unchecked table |

## 4. Expand / migrate / contract

| Release | Schema | Code | Notes |
| --- | --- | --- | --- |
| N (expand) | add new column/table/index (compatible with N-1 code) | writes old and new (dual-write), reads old | migration deployed **before** code (pre-deploy task) |
| N (migrate) | backfill job (batched, throttled, resumable) | dual-write continues | verify counts/checksums; feature flag the read switch |
| N+1 (switch) | none | reads new, still writes both | watch error rate; instant rollback via flag |
| N+2 (contract) | drop old column/table/index | stop old writes | requires a manual snapshot first; ent `WithDropColumn(true)` for this migration only; lint override annotated in the PR |

Rule of thumb: every migration must be safe with **both** the previous and next app version running at once (rolling deploys).

## 5. Large-table rules (> 10M rows or > 5 GB)

| Rule | Detail |
| --- | --- |
| Pre-flight | Record `pg_total_relation_size`, `reltuples`, peak write rate for the table in the PR |
| Window | Ask whether the operation holds a lock for O(rows); if yes, redesign |
| Replica lag | Aurora replicas share storage so lag is small; logical consumers (DMS/CDC to ClickHouse) can lag: monitor |
| Autovacuum | After a large backfill, run `VACUUM (ANALYZE)` explicitly |
| Abort plan | Every migration PR states how to abort and the state left behind |

## 6. Environment matrix

| Env | Who applies | How |
| --- | --- | --- |
| Local | developer | `MIGRATE_ON_START=true` (current behaviour retained) |
| CI | pipeline | replay on shadow DB, lint, drift check |
| Staging | pipeline | pre-deploy task with migrator role; production-like data volume job monthly |
| Production | pipeline with approval gate | same task, maintenance guard: refuse if `pg_stat_activity` shows a long-running transaction > 5 min on the target table |

## 7. Action list

| # | Action | Priority |
| --- | --- | --- |
| 1 | Add `MIGRATE_ON_START` flag; stop migrating at boot in prod; one-off ECS migration task | **P1** |
| 2 | Split owner/migrator vs app roles (`create-databases.sh`, prod Terraform) | **P1** |
| 3 | Add `atlas.hcl` + `atlas migrate lint` + drift check to `backend.yml` | **P1** |
| 4 | Concurrent-index convention for tables with data (txmode none) | P1 |
| 5 | Down-migration smoke test in CI (up, down, up) for additive migrations | P2 |
| 6 | Snapshot-before-contract runbook | P2 |
| 7 | Migration timing test against a large synthetic dataset before first loaded-table migration | P2 |
