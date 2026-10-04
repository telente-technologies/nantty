#!/usr/bin/env bash
set -euo pipefail
run_sql() { psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$1" -c "$2"; }

for database in zudomart_test atlas_dev; do
  run_sql "$POSTGRES_DB" "CREATE DATABASE $database"
done

run_sql "$POSTGRES_DB" "CREATE ROLE zudomart_readers NOLOGIN"
for database in "$POSTGRES_DB" zudomart_test; do
  run_sql "$database" "CREATE EXTENSION IF NOT EXISTS postgis"
done

owning_services="auth users catalog inventory orders payments wallet ledger escrow subscriptions ads creators rewards moderation live currency admin analytics social feed notifications media search support integrations campaigns realtime intelligence"
for service in $owning_services; do
  role="svc_${service}"
  run_sql "$POSTGRES_DB" "CREATE ROLE ${role} LOGIN PASSWORD '${role}_local_only' IN ROLE zudomart_readers"
  run_sql "$POSTGRES_DB" "CREATE SCHEMA ${service} AUTHORIZATION ${role}"
  run_sql "$POSTGRES_DB" "REVOKE ALL ON SCHEMA ${service} FROM PUBLIC"
done
run_sql "$POSTGRES_DB" "REVOKE CREATE ON SCHEMA public FROM PUBLIC"

run_sql "$POSTGRES_DB" "CREATE ROLE svc_money LOGIN PASSWORD 'svc_money_local_only' IN ROLE zudomart_readers"
run_sql "$POSTGRES_DB" "GRANT svc_payments, svc_wallet, svc_ledger, svc_escrow, svc_subscriptions, svc_creators, svc_rewards TO svc_money"
run_sql "$POSTGRES_DB" "CREATE ROLE svc_commerce LOGIN PASSWORD 'svc_commerce_local_only' IN ROLE zudomart_readers"
run_sql "$POSTGRES_DB" "GRANT svc_catalog, svc_inventory, svc_orders TO svc_commerce"
run_sql "$POSTGRES_DB" "CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA search"
