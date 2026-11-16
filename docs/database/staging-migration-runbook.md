# Staging database migrations

## Recommendation

Use one staging migration entry point, but do not concatenate the service migration files into one SQL file. A single SQL dump would bypass each service's migration ledger, mix schema-owner permissions, and make future migrations appear unapplied or drifted.

The current repository has 21 independently versioned migration owners:

| Migration owner | Engine | Migration files |
| --- | --- | ---: |
| Go: admin, ads, auth, catalog, creators, currency, escrow, inventory, ledger, live, moderation, orders, payments, subscriptions, users, wallet | embedded golang-migrate SQL; one schema and history per module | 338 |
| TypeScript: media, notifications, search, social, support | Prisma Migrate; one history per Prisma owner | 40 |
| **Total** | | **378** |

The Go migrations are owned by 16 modules but deployed in six Go services. The TypeScript gateway and Elixir realtime service do not own SQL migrations. Local PostgreSQL is one database with service schemas; the migration owners and histories still remain separate.

## Commands and current deployment behavior

- `pnpm backend:up` is the existing one-command local stack bootstrap. It starts local dependencies, applies the five Prisma owners, and starts Go services that apply their own migrations. It is for local development, not AWS staging; it may also seed demo data. It does **not** invoke the dedicated `go-money --migrate-money` task, so it must not be described as applying all 21 owners.
- `pnpm backend:reset` removes local Compose volumes and is destructive. Do not use it to prepare staging or to test against existing developer data.
- The staging deployment workflow takes a pre-migration Aurora snapshot and runs the dedicated `go-money --migrate-money` task before service rollout. The other Go modules currently apply migrations during service startup. The five Prisma packages expose `db:migrate:deploy`, but the staging workflow does not currently run a consolidated Prisma migration phase before rollout.
- Therefore neither the local bootstrap nor staging currently has one controlled migration operation covering all 21 owners before application startup/rollout. Do not treat the existing money-only task as an all-database migration gate.

## Safe staging shape

Add a single orchestrator command/job (for example, `pnpm backend:migrate` locally and one dedicated pre-rollout task in staging) that runs the existing native migration engine for every owner in a deterministic dependency order. The command is the grouping: **do not concatenate or squash the SQL histories into a single file**. Keep each owner's migration directory, checksum/history table, and least-privilege migration identity separate. For local development, require an explicit invocation and never run this command implicitly as part of a plain status/check operation. For staging, require a successful pre-migration snapshot, fail the release before application rollout if any owner fails, and record per-owner version and duration. Run cross-schema grants only after the referenced owner migration has completed.

For a new staging environment, a clean per-owner baseline can be considered after each current migration history has replayed successfully from empty databases and the generated schema has been checked for drift. Keep the source histories available for audit/rollback and continue using native migration metadata. Do not produce or apply a monolithic SQL file as a substitute for this validation.

## Staging readiness checklist

- [ ] Provision a dedicated, empty staging database/cluster and service schemas; never point staging initialization at a developer database.
- [ ] Configure a separate migration credential for each schema owner and keep it out of application runtime tasks.
- [ ] Include all 16 Go modules and all five Prisma owners in the pre-rollout orchestrator.
- [ ] Ensure the orchestrator includes the six money schemas through the dedicated `svc_migrator` path; do not reuse the `svc_money` runtime credential.
- [ ] Verify dependency/grant ordering and set lock and statement timeouts.
- [ ] Run every migration from an empty disposable PostgreSQL instance; verify migration history and schema drift.
- [ ] Capture and verify the staging snapshot before applying migrations.
- [ ] Test application rollout and rollback against that staging database before any production planning.

No database, migration history, AWS resource, or deployment was changed while preparing this runbook.
