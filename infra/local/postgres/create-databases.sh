#!/usr/bin/env bash
set -euo pipefail
run_sql() { psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$1" -c "$2"; }

for database in nantty_test atlas_dev; do
  run_sql "$POSTGRES_DB" "CREATE DATABASE $database"
done

run_sql "$POSTGRES_DB" "CREATE ROLE nantty_readers NOLOGIN"
run_sql "$POSTGRES_DB" "CREATE ROLE svc_migrator LOGIN PASSWORD 'svc_migrator_local_only'"
for database in "$POSTGRES_DB" nantty_test; do
  run_sql "$database" "CREATE EXTENSION IF NOT EXISTS postgis"
done

owning_services="auth users catalog inventory orders payments wallet ledger escrow subscriptions ads creators moderation live currency admin social notifications media search support"
for service in $owning_services; do
  role="svc_${service}"
  if [[ " payments wallet ledger escrow subscriptions creators " == *" ${service} "* ]]; then
    run_sql "$POSTGRES_DB" "CREATE SCHEMA ${service} AUTHORIZATION svc_migrator"
    run_sql "$POSTGRES_DB" "REVOKE ALL ON SCHEMA ${service} FROM PUBLIC"
    run_sql nantty_test "CREATE SCHEMA ${service} AUTHORIZATION svc_migrator"
    run_sql nantty_test "REVOKE ALL ON SCHEMA ${service} FROM PUBLIC"
    continue
  else
    run_sql "$POSTGRES_DB" "CREATE ROLE ${role} LOGIN PASSWORD '${role}_local_only' IN ROLE nantty_readers"
  fi
  run_sql "$POSTGRES_DB" "CREATE SCHEMA ${service} AUTHORIZATION ${role}"
  run_sql "$POSTGRES_DB" "REVOKE ALL ON SCHEMA ${service} FROM PUBLIC"
done
run_sql "$POSTGRES_DB" "REVOKE CREATE ON SCHEMA public FROM PUBLIC"

run_sql "$POSTGRES_DB" "CREATE ROLE svc_money LOGIN PASSWORD 'svc_money_local_only' IN ROLE nantty_readers"
money_schemas="payments wallet ledger escrow subscriptions creators"
for database in "$POSTGRES_DB" nantty_test; do
  for schema in $money_schemas; do
    run_sql "$database" "GRANT USAGE ON SCHEMA ${schema} TO svc_money"
    run_sql "$database" "ALTER DEFAULT PRIVILEGES FOR ROLE svc_migrator IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE ON TABLES TO svc_money"
    run_sql "$database" "ALTER DEFAULT PRIVILEGES FOR ROLE svc_migrator IN SCHEMA ${schema} GRANT USAGE, SELECT ON SEQUENCES TO svc_money"
  done
done
run_sql "$POSTGRES_DB" "CREATE ROLE svc_commerce LOGIN PASSWORD 'svc_commerce_local_only' IN ROLE nantty_readers"
run_sql "$POSTGRES_DB" "GRANT svc_catalog, svc_inventory, svc_orders TO svc_commerce"
run_sql "$POSTGRES_DB" "CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA search"
