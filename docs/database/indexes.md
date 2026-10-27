# Index registry and audit

As of 2026-10-03. Static audit: every `CREATE INDEX` in `services/go/modules/*/src/migrations/*.up.sql` was matched against the queries in the Go code (`queries/`, `commands/`, `services/`). Plans were **not** validated with EXPLAIN (compose Postgres not running); see section 7.

Legend. Type: `BT` B-tree, `UQ` unique B-tree, `P` partial. Write cost: **L** (table rarely written), **M** (one write per business action), **H** (hot or append-heavy table: every extra index costs on each insert). Verdict: **keep** · **fix** (change columns/order/predicate) · **drop?** (candidate, confirm with `pg_stat_user_indexes.idx_scan` after 30 days in prod) · **add** (missing).

Rules used:

1. Every index must serve a query found in code, a uniqueness rule, or an FK used for deletes/joins.
2. Keyset lists must have an index whose trailing columns equal the `ORDER BY` (incl. the `id` tiebreaker). Most code paginates with `ORDER BY id DESC` (UUIDv7 = time-ordered and unique), while most indexes end in `created_at`. Postgres cannot use `(x, created_at)` to satisfy `ORDER BY id`, so those lists sort in memory after reading every matching row.
3. Partial indexes for hot subsets (`WHERE status = 'pending'`, `WHERE published_at IS NULL`) on tables where the subset is small and the rest is history.
4. GIN/GiST only with a concrete operator (`@@`, `@>`, `&&`, `<->`). No GIN exists today and none is needed for EXISTING queries.

## 1. Findings summary (priority order)

| # | Priority | Table | Finding | Action |
| --- | --- | --- | --- | --- |
| I1 | **P1** | `ledger.journal_lines` | Statement / coin activity / wallet transactions page with `WHERE account_id IN (...) ORDER BY id DESC LIMIT n` (`accountBalances.service.go` `ListStatementLinesNewestFirst`); index is `(account_id, created_at)` → sort of all of an account's lines per page | add `(account_id, id DESC)`; drop `(account_id, created_at)` once no query uses it |
| I2 | **P1** | `ledger.ledger_accounts` | `code LIKE 'prefix%'` (`CodeHasPrefix` in `SumBalancesOfAccountsWithCodePrefix`, `ListBalancesOfAccountsWithCodePrefix`, battle settlement holdings). With a non-C collation the B-tree `(code, currency)` cannot serve `LIKE` → seq scan over all ledger accounts (one row per escrow, so it grows with orders) | add `(code varchar_pattern_ops, currency)` or declare `code` `COLLATE "C"` (preferred: codes are ASCII) |
| I3 | **P1** | `live.gift_contributions` | Battle presenter queries `WHERE scope_key = $1` only (`battlePresenter.service.go` `totalGiftsByReceiverAndSender`); both indexes lead with `live_id` → seq scan on every battle render | pass `live_id` in the query (preferred, no new index) or add `(scope_key)` |
| I4 | P1 | `wallet.withdrawals` | `ListWithdrawals` (user and admin): `WHERE user_id = ? [AND status = ?] ORDER BY id DESC`; indexes are `(user_id, created_at)`, `(status, created_at)` | fix to `(user_id, id DESC)`, `(status, id DESC)` (claim query `status='queued' ORDER BY created_at` → partial `(created_at) WHERE status = 'queued'`) |
| I5 | P1 | `escrow.escrows` | Seller holds: `WHERE seller_user_id = ? AND status IN ('held','disputed') ORDER BY id DESC`; index `(seller_user_id, status)` forces a sort | fix to `(seller_user_id, status, id DESC)` |
| I6 | P2 | `escrow.disputes`, `admin.audit_events` | Lists order by `id DESC` with filters; indexes end in `created_at` | fix to `(status, id DESC)`, `(opened_by_user_id, id DESC)`; audit `(actor_id, id DESC)`, `(action, id DESC)` |
| I7 | P2 | `ledger.journal_entries` | `external_reference` index holds mostly `''` (only payment/withdrawal entries set it) | partial `WHERE external_reference <> ''` |
| I8 | P2 | `creators.gift_transactions` | `(battle_id, receiver_user_id)`: most gifts have `battle_id = ''` → index bloat on a hot table | partial `WHERE battle_id <> ''` |
| I9 | P2 | `live.points_entries` | 6 indexes on an XL insert table; 3 serve only ranking aggregates (`(type, created_at)`, `(category_id, type, created_at)`, `(country_code, type, created_at)`) | move rankings to rollup tables / Valkey sorted sets, then drop? the 3 aggregate indexes |
| I10 | P2 | all `outbox_events` | Index covers published history forever; relay needs only the unpublished head; no purge job exists | partial `(created_at) WHERE published_at IS NULL AND dead_lettered_at IS NULL` + purge job; see [query-patterns.md](query-patterns.md) |
| I11 | P2 | `ledger.seller_credit_maturities` | Sweep `WHERE matured_at IS NULL AND available_at <= now() ORDER BY available_at` works on `(matured_at, available_at)` but keeps matured history in the index | partial `(available_at) WHERE matured_at IS NULL` |
| I12 | P2 | `auth.refresh_tokens` | No index on `session_id` (FK) → revoking a session's tokens or deleting a session scans | add `(session_id)` |
| I13 | P3 | `wallet.withdrawals`, `wallet.coin_purchases` | FK-like columns `payout_account_id`, `payment_intent_id` unindexed | add when a query needs them (payout account delete check) |
| I14 | P3 | `users.shipping_addresses`, `wallet.payout_accounts` | Missing partial uniques (one default address; one active bank account per fingerprint) | add partial UQ |
| I16 | **P1** | `escrow.escrows` | Chargeback webhook locks `WHERE payment_intent_id = ? FOR UPDATE` (`escrowChargebacks.service.go`) with no index on `payment_intent_id` → seq scan inside a money tx | add `(payment_intent_id)` |
| I15 | P3 | `users.data_export_requests` | Expiry sweep `status='ready' AND expires_at <= now()` uses `(status, created_at)` | fine at size S; fix to `(status, expires_at)` if it grows |

No OFFSET pagination exists in Go code (grep for `.Offset(` / `OFFSET` returns nothing), so no index needs to support deep offsets.

## 2. Registry: EXISTING indexes

PK indexes are omitted (one per table on `id`). Table names are unqualified within each schema section.

### 2.1 auth

| Table | Index | Columns (order) | Type | Purpose / queries supported | Write | Benefit | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| accounts | account_email | email | UQ | login by email, uniqueness (NULLs allowed for social-only) | M | high | keep |
| accounts | account_username | username | UQ | login, `GET /users/username/{username}`, availability | M | high | keep |
| one_time_codes | onetimecode_destination_purpose_consumed_at | destination, purpose, consumed_at | BT | latest open code for a destination | M | high | keep (consider partial `WHERE consumed_at IS NULL`) |
| one_time_codes | onetimecode_secret_hash | secret_hash | UQ | verify by hash | M | high | keep |
| signing_keys | signingkey_published_until | published_until | BT | JWKS (`published_until > now()`) | L | low (XS table) | drop? |
| signing_keys | signingkey_retired_at | retired_at | BT | current key | L | low | drop? |
| sessions | session_account_id_revoked_at | account_id, revoked_at | BT | `GET /auth/sessions`, revoke-all | M | high | keep |
| refresh_tokens | refreshtoken_token_hash | token_hash | UQ | refresh rotation, reuse detection | H | high | keep |
| social_identities | socialidentity_account_id | account_id | BT | linked identities | L | med | keep |
| social_identities | socialidentity_provider_subject | provider, subject | UQ | social sign-in lookup | L | high | keep |
| outbox_events | outboxevent_published_at_created_at | published_at, created_at | BT | relay head | H | high | fix (I10) |

### 2.2 users

| Table | Index | Columns | Type | Purpose | Write | Benefit | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| acting_profiles | actingprofile_account_id | account_id | UQ | one acting profile per account | L | high | keep |
| business_categories | businesscategory_parent_id | parent_id | BT | category tree | L | low | keep |
| business_categories | businesscategory_slug | slug | UQ | lookup by slug | L | high | keep |
| reserved_username_rules | reservedusernamerule_term_match_kind | term, match_kind | UQ | uniqueness | L | med | keep |
| username_changes | usernamechange_account_id_created_at | account_id, created_at | BT | change-window check (`ORDER BY created_at DESC LIMIT 50`), export | L | high | keep |
| username_holds | usernamehold_username | username | UQ | availability check | L | high | keep |
| profiles | profile_account_id | account_id | BT | `GET /users/me/profiles` | M | high | keep |
| profiles | profile_handle | handle | UQ | profile by handle | M | high | keep |
| profiles | profile_one_creator_per_account | account_id WHERE kind='creator' | UQ P | business rule | M | high | keep |
| profiles | profile_one_personal_per_account | account_id WHERE kind='personal' | UQ P | business rule | M | high | keep |
| data_export_requests | dataexportrequest_account_id_idempotency_key | account_id, idempotency_key | UQ | idempotent request (NULL keys allowed) | L | high | keep |
| data_export_requests | dataexportrequest_status_created_at | status, created_at | BT | worker claim | L | med | keep (I15) |
| deletion_requests | deletionrequest_account_id_status | account_id, status | BT | current request | L | high | keep |
| deletion_requests | deletionrequest_status_scheduled_for | status, scheduled_for | BT | executor sweep | L | high | keep |
| geo_admin_areas | geoadminarea_region_id_name | region_id, name | UQ | list by region ordered by name | L | high | keep |
| geo_cities | geocity_admin_area_id | admin_area_id | BT | cities by admin area | L | med | keep |
| geo_cities | geocity_region_id_name | region_id, name | UQ | cities by region | L | high | keep |
| geo_countries | geocountry_code | code | UQ | lookup | L | high | keep |
| geo_regions | georegion_country_code_name | country_code, name | UQ | uniqueness | L | med | keep |
| geo_regions | georegion_country_id | country_id | BT | regions by country (query filters `country_id`, orders `name`) | L | med | fix? `(country_id, name)` (XS, optional) |
| policy_versions | policyversion_kind_effective_at | kind, effective_at | BT | current policy | L | med | keep |
| policy_versions | policyversion_kind_version | kind, version | UQ | uniqueness | L | high | keep |
| privacy_settings | privacysetting_account_id | account_id | UQ | one row per account | M | high | keep |
| retention_policies | retentionpolicy_category | category | UQ | lookup | L | high | keep |
| shipping_addresses | shippingaddress_account_id_created_at | account_id, created_at | BT | list (`ORDER BY is_default DESC, id DESC`) | L | med | keep (size S, sort is trivial); add partial UQ default (I14) |
| terms_acceptances | termsacceptance_account_id_terms_version | account_id, terms_version | UQ | accept once per version | L | high | keep |
| user_consents | userconsent_account_id_consent_type_created_at | account_id, consent_type, created_at | BT | latest consent per type | M | high | keep |
| user_consents | userconsent_device_id_consent_type_created_at | device_id, consent_type, created_at | BT | pre-login consent, merge on login | M | high | keep |
| outbox_events | outboxevent_published_at_created_at | published_at, created_at | BT | relay | H | high | fix (I10) |

### 2.3 admin, currency

| Table | Index | Columns | Type | Purpose | Write | Benefit | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| audit_events | auditevent_action_created_at | action, created_at | BT | audit search by action | M | med | fix to `(action, id DESC)` (I6) |
| audit_events | auditevent_actor_id_created_at | actor_id, created_at | BT | audit by actor | M | med | fix to `(actor_id, id DESC)` (I6) |
| audit_events | auditevent_subject_type_subject_id | subject_type, subject_id | BT | history of a subject | M | high | fix to `(subject_type, subject_id, id DESC)` |
| platform_settings | platformsetting_key | key | UQ | lookup | L | high | keep |
| platform_setting_revisions | platformsettingrevision_key_version | key, version | UQ | append-only history | L | high | keep |
| staff_accounts | staffaccount_email | email | UQ | login | L | high | keep |
| staff_invitations | staffinvitation_token_hash | token_hash | UQ | accept invitation | L | high | keep |
| staff_login_challenges | staffloginchallenge_token_hash | token_hash | UQ | MFA challenge | L | high | keep |
| staff_sessions | staffsession_previous_refresh_hash | previous_refresh_hash | BT | reuse detection | L | high | keep |
| staff_sessions | staffsession_refresh_hash | refresh_hash | UQ | refresh | L | high | keep |
| staff_sessions | staffsession_staff_id_revoked_at | staff_id, revoked_at | BT | revoke all | L | high | keep |
| exchange_rate_revisions | exchangeraterevision_currency_created_at | currency, created_at | BT | latest rate, history | L | high | keep |

### 2.4 ledger

| Table | Index | Columns | Type | Purpose | Write | Benefit | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| journal_entries | journalentry_reference | reference | UQ | **idempotency of every posting**; replay lookup | H | critical | keep |
| journal_entries | journalentry_reverses_entry_id | reverses_entry_id | UQ | an entry can be reversed once | H | high | keep (could be partial `WHERE reverses_entry_id IS NOT NULL`) |
| journal_entries | journalentry_external_reference | external_reference | BT | reconciliation join by provider reference | H | med | fix to partial (I7) |
| journal_entries | journalentry_kind_posted_at | kind, posted_at | BT | admin/integrity by kind | H | low (no hot query found) | drop? after prod stats |
| journal_lines | journalline_entry_id_line_number | entry_id, line_number | UQ | lines of an entry (eager load) | H | critical | keep |
| journal_lines | journalline_account_id_created_at | account_id, created_at | BT | account statement | H | low today (query orders by id) | fix (I1) |
| ledger_accounts | ledgeraccount_code_currency | code, currency | UQ | account lookup + `FOR UPDATE`; upsert `ON CONFLICT (code, currency)` | H (updated per posting) | critical | keep; add pattern index (I2) |
| ledger_accounts | ledgeraccount_owner_type_owner_id | owner_type, owner_id | BT | accounts of an owner (admin) | H | med | keep |
| seller_credit_maturities | sellercreditmaturity_source_reference | source_reference | UQ | idempotent scheduling (`ON CONFLICT DO NOTHING`) | M | critical | keep |
| seller_credit_maturities | sellercreditmaturity_seller_user_id_currency_matured_at | seller_user_id, currency, matured_at | BT | refund takes from unmatured credits | M | high | keep |
| seller_credit_maturities | sellercreditmaturity_matured_at_available_at | matured_at, available_at | BT | 24h lock sweep | M | high | fix (I11) |
| reconciliation_runs | reconciliationrun_provider_window_starts_at | provider, window_starts_at | BT | run history | L | med | keep |
| reconciliation_breaks | reconciliationbreak_provider_reference | provider_reference | BT | lookup break | L | med | keep |
| reconciliation_breaks | reconciliationbreak_resolved_at | resolved_at | BT | open breaks (`IS NULL`) | L | med | fix? partial `WHERE resolved_at IS NULL` |
| outbox_events | outboxevent_published_at_dead_lettered_at_created_at | published_at, dead_lettered_at, created_at | BT | relay head `published_at IS NULL AND dead_lettered_at IS NULL ORDER BY created_at` | H | high | fix to partial (I10) |

### 2.5 payments (migrated)

| Table | Index | Columns | Type | Purpose | Write | Benefit | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| idempotent_requests | idempotentrequest_scope_key | scope, key | UQ | `INSERT ... ON CONFLICT (scope, key) DO NOTHING` | M | critical | keep |
| order_payables | orderpayable_checkout_id | checkout_id | BT | payables of a checkout (settlement, verify) | M | high | keep |
| order_payables | orderpayable_order_id | order_id | UQ | one payable per order | M | critical | keep |
| payment_intents | paymentintent_reference | reference | UQ | webhook / verify lookup + `FOR UPDATE` | M | critical | keep |
| payment_intents | paymentintent_purpose_subject_id | purpose, subject_id | BT | "already paid" / supersede pending / duplicate detection | M | high | keep (could add `status` as 3rd column) |
| payment_intents | paymentintent_owner_user_id_created_at | owner_user_id, created_at | BT | buyer's payments | M | med | keep |
| payment_intents | paymentintent_status_created_at | status, created_at | BT | pending sweeps | M | med | fix? partial `WHERE status = 'pending'` |
| payment_refunds | paymentrefund_payment_intent_id | payment_intent_id | BT | refunds of a payment | M | high | keep |
| payment_refunds | paymentrefund_reference | reference | UQ | idempotent refund | M | critical | keep |
| payment_refunds | paymentrefund_status_created_at | status, created_at | BT | retry pending refunds | M | med | keep |
| payout_transfers | payouttransfer_reference | reference | UQ | idempotent transfer | M | critical | keep |
| payout_transfers | payouttransfer_purpose_subject_id | purpose, subject_id | BT | transfer of a withdrawal | M | high | keep |
| payout_transfers | payouttransfer_status_created_at | status, created_at | BT | finalize processing | M | med | keep |
| store_purchases | storepurchase_store_store_transaction_id | store, store_transaction_id | UQ | IAP receipt replay protection | M | critical | keep |
| store_purchases | storepurchase_user_id_created_at | user_id, created_at | BT | user history | M | med | keep |
| webhook_events | webhookevent_provider_event_key | provider, event_key | UQ | **webhook dedupe** | M | critical | keep |
| webhook_events | webhookevent_processed_at_created_at | processed_at, created_at | BT | retry unprocessed | M | med | fix? partial `WHERE processed_at IS NULL` |
| outbox_events | (money shape) | published_at, dead_lettered_at, created_at | BT | relay | H | high | fix (I10) |

ent-only (pending migration, G1 in [schema.md](schema.md#11-gaps-between-ent-schemas-migrations-and-plans)): `paymentintent_provider_checkout_id`, `paymentintent_provider_transaction_id` (both mostly `''` → make partial), `paymentrefund_provider_refund_id` (refund webhook lookup, keep), `payouttransfer_connected_account_id_status`, `payouttransfer_provider_transfer_code`, `connectedaccount_user_id_provider` UQ, `connectedaccount_provider_account_id` UQ, `providerpayoutdestination_connected_account_id_account_fingerprint_currency` UQ, `providerdispute_provider_provider_dispute_id` UQ, `providerdispute_status`, `billingsubscription_reference` UQ, `billingsubscription_provider_subscription_id`, `billingsubscription_owner_user_id_plan_code`.

### 2.6 escrow

| Table | Index | Columns | Type | Purpose | Write | Benefit | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| escrows | escrow_order_id | order_id | UQ | one escrow per order; `LockEscrowForOrder` `FOR UPDATE` | M | critical | keep |
| escrows | escrow_checkout_id | checkout_id | BT | escrows of a checkout | M | med | keep |
| escrows | (missing) | payment_intent_id | BT | chargeback lookup + `FOR UPDATE` | M | high | **add** (I16) |
| escrows | escrow_buyer_user_id_created_at | buyer_user_id, created_at | BT | buyer view | M | med | fix? `(buyer_user_id, id DESC)` when a buyer list exists |
| escrows | escrow_seller_user_id_status | seller_user_id, status | BT | seller holds | M | med | fix (I5) |
| escrows | escrow_status_auto_release_at | status, auto_release_at | BT | auto-release sweep `status='held' AND auto_release_at <= now() ORDER BY auto_release_at` with `SKIP LOCKED` | M | high | fix? partial `(auto_release_at) WHERE status = 'held'` |
| escrow_events | escrowevent_escrow_id_created_at | escrow_id, created_at | BT | timeline (`ORDER BY created_at, id`) | M | high | keep |
| disputes | dispute_escrow_id | escrow_id | BT | FK / disputes of an escrow | L | high | keep |
| disputes | dispute_opened_by_user_id_created_at | opened_by_user_id, created_at | BT | my disputes | L | med | fix (I6) |
| disputes | dispute_order_id | order_id | BT | dispute by order | L | high | keep |
| disputes | dispute_status_created_at | status, created_at | BT | admin queue | L | med | fix (I6) |
| dispute_messages | disputemessage_dispute_id_created_at | dispute_id, created_at | BT | thread | L | high | keep |
| dispute_status_events | disputestatusevent_dispute_id_created_at | dispute_id, created_at | BT | timeline | L | high | keep |
| idempotent_requests | idempotentrequest_scope_key | scope, key | UQ | idempotent commands | M | critical | keep |

### 2.7 wallet

| Table | Index | Columns | Type | Purpose | Write | Benefit | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coin_conversions | coinconversion_user_id_created_at | user_id, created_at | BT | history | L | low | keep |
| coin_packages | coinpackage_purchase_channel_active_sort_order | purchase_channel, active, sort_order | BT | catalog list | L | low (XS) | keep |
| coin_packages | coinpackage_store_product_id | store_product_id | BT | IAP product lookup | L | low (XS) | keep |
| coin_purchases | coinpurchase_reference | reference | UQ | verify by reference | M | critical | keep |
| coin_purchases | coinpurchase_user_id_created_at | user_id, created_at | BT | history | M | med | keep |
| coin_transfers | cointransfer_recipient_user_id_created_at | recipient_user_id, created_at | BT | received transfers | M | med | keep |
| coin_transfers | cointransfer_sender_user_id_created_at | sender_user_id, created_at | BT | sent transfers | M | med | keep |
| payout_accounts | payoutaccount_user_id_account_number_fingerprint_bank_code | user_id, fingerprint, bank_code | BT | duplicate check | L | med | fix to partial UQ (I14) |
| payout_accounts | payoutaccount_user_id_deleted_at | user_id, deleted_at | BT | list active accounts | L | high | keep (shares prefix with the one above; both small) |
| wallet_risk_flags | walletriskflag_user_id_resolved_at | user_id, resolved_at | BT | open flags for a user (payout gate) | L | high | keep |
| withdrawals | withdrawal_reference | reference | UQ | provider reference | M | critical | keep |
| withdrawals | withdrawal_status_created_at | status, created_at | BT | queued claim, admin list | M | med | fix (I4) |
| withdrawals | withdrawal_user_id_created_at | user_id, created_at | BT | my withdrawals | M | med | fix (I4) |

### 2.8 creators

| Table | Index | Columns | Type | Purpose | Write | Benefit | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| battle_settlements | battlesettlement_battle_id | battle_id | UQ | settle once | L | critical | keep |
| creator_program_members | creatorprogrammember_user_id | user_id | UQ | membership lookup on every gift | L | high | keep |
| gift_transactions | gifttransaction_sender_user_id_idempotency_key | sender_user_id, idempotency_key | UQ | **gift idempotency** | H | critical | keep |
| gift_transactions | gifttransaction_credited_user_id_created_at | credited_user_id, created_at | BT | monthly creator total (`SUM ... created_at >= monthStart`), earnings | H | high | keep (INCLUDE `total_coins, status` for index-only SUM, optional) |
| gift_transactions | gifttransaction_live_id_created_at | live_id, created_at | BT | per-stream analytics `GET /creators/me/analytics/gifts/streams/{liveId}` | H | high | keep |
| gift_transactions | gifttransaction_battle_id_receiver_user_id | battle_id, receiver_user_id | BT | battle totals | H | med | fix (I8) |

### 2.9 live

| Table | Index | Columns | Type | Purpose | Write | Benefit | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| battles | battle_live_id | live_id WHERE state IN (pending,countdown,active,ended) | UQ P | one open battle per live | M | critical | keep |
| battles | battle_live_id_idempotency_key | live_id, idempotency_key | UQ | idempotent create | M | high | keep |
| battles | battle_state_ends_at | state, ends_at | BT | timer job (active → ended) | M | high | keep (could be partial per state) |
| battles | battle_state_proposal_expires_at | state, proposal_expires_at | BT | timer job | M | high | keep |
| battles | battle_state_starts_at | state, starts_at | BT | timer job | M | med | keep |
| battle_gift_events | battlegiftevent_battle_id_created_at | battle_id, created_at | BT | recent gifts in battle | H | high | keep |
| battle_participants | battleparticipant_battle_id_user_id | battle_id, user_id | UQ | participants | M | high | keep |
| battle_participants | battleparticipant_user_id_state | user_id, state | BT | "is user in a battle" | M | med | keep |
| gifts | gift_is_active_sort_order | is_active, sort_order | BT | catalog | L | low (XS) | keep |
| gift_combos | giftcombo_sender_id_live_id_combo_id | sender_id, live_id, combo_id | UQ | combo upsert `FOR UPDATE` | H | high | keep |
| gift_contributions | giftcontribution_live_id_scope_key_receiver_id_sender_id | live_id, scope_key, receiver_id, sender_id | UQ | upsert per (scope, receiver, sender) | H | high | keep |
| gift_contributions | giftcontribution_live_id_scope_key_sender_id | live_id, scope_key, sender_id | BT | top gifters in scope | H | med | keep; fix query (I3) |
| gift_goals | giftgoal_live_id_status | live_id, status | BT | goals of a live | L | high | keep |
| goal_contributions | goalcontribution_goal_id_sender_id | goal_id, sender_id | UQ | upsert; top 3 query orders by `coins DESC` | M | med | add? `(goal_id, coins DESC)` if goals get many senders |
| guest_slots | guestslot_live_id_state | live_id, state | BT | stage presenter | M | high | keep |
| guest_slots | guestslot_live_id_user_id | live_id, user_id WHERE state IN (active states) | UQ P | one active slot per user | M | critical | keep |
| guest_slots | guestslot_state_expires_at | state, expires_at | BT | timer job | M | high | keep |
| guest_slots | guestslot_state_state_deadline_at | state, state_deadline_at | BT | timer job | M | high | keep |
| join_requests | joinrequest_live_id_state | live_id, state | BT | pending requests | M | high | keep |
| join_requests | joinrequest_live_id_user_id | live_id, user_id WHERE state='pending' | UQ P | one pending request | M | high | keep |
| live_leaderboard_entries | liveleaderboardentry_live_id_rank | live_id, rank | BT | leaderboard | M | high | keep |
| live_leaderboard_entries | liveleaderboardentry_live_id_user_id | live_id, user_id | UQ | upsert | M | high | keep |
| live_products | liveproduct_live_id_product_id | live_id, product_id | UQ | products of a live | L | high | keep |
| live_sessions | livesession_host_id_state | host_id, state | BT | host's current live | M | high | keep |
| live_sessions | livesession_state_created_at | state, created_at | BT | suggested lives (`state='live' AND visibility='public' ORDER BY viewers DESC`) | M | med | fix? partial `(viewers DESC, created_at DESC) WHERE state = 'live'` when concurrent lives grow; better served from Valkey |
| live_viewers | liveviewer_live_id_left_at | live_id, left_at | BT | viewer count / list (`left_at IS NULL ORDER BY last_seen_at DESC LIMIT 200`) | H | high | fix? `(live_id, last_seen_at DESC) WHERE left_at IS NULL`; move presence to Valkey (FUTURE) |
| live_viewers | liveviewer_live_id_user_id | live_id, user_id | UQ | presence upsert | H | critical | keep |
| points_entries | points_entries_idempotency_key_key | idempotency_key | UQ | idempotent award | H | critical | keep |
| points_entries | pointsentry_user_id_source_type_created_at | user_id, source_type, created_at | BT | caps per user/action/window | H | high | keep |
| points_entries | pointsentry_live_id_user_id | live_id, user_id | BT | `GET /lives/{id}/points/me`, per-live caps | H | high | keep |
| points_entries | pointsentry_type_created_at | type, created_at | BT | rankings | H | med | drop? (I9) |
| points_entries | pointsentry_category_id_type_created_at | category_id, type, created_at | BT | rankings by category | H | med | drop? (I9) |
| points_entries | pointsentry_country_code_type_created_at | country_code, type, created_at | BT | rankings by country | H | med | drop? (I9) |
| processed_gifts | processedgift_sender_id_created_at | sender_id, created_at | BT | none found in code (dedupe uses PK) | H | low | drop? |
| outbox_events | outboxevent_published_at_created_at | published_at, created_at | BT | relay | H | high | fix (I10) |

## 3. Redundant or low-value indexes

| Index | Why | Action |
| --- | --- | --- |
| `signingkey_published_until`, `signingkey_retired_at` | Table has a handful of rows | drop? (harmless) |
| `journalentry_kind_posted_at` | No query filters `kind` + `posted_at` in code | drop? after 30 days of `idx_scan = 0` |
| `processedgift_sender_id_created_at` | No query uses it; dedupe is by PK | drop? |
| `journalline_account_id_created_at` | Replaced by `(account_id, id DESC)` (I1) | drop after I1 ships |
| `pointsentry_type_created_at` and 2 siblings | Aggregates belong in rollups | drop? after I9 |
| `outboxevent_*` (full) | Superseded by partial relay index | replace (I10) |

No exact duplicates (same leading columns, same uniqueness) were found.

## 4. Bad column order or sort mismatch

| Index | Query | Problem | Fix |
| --- | --- | --- | --- |
| `journalline_account_id_created_at` | `account_id IN (..) ORDER BY id DESC` | sort column differs | `(account_id, id DESC)` |
| `withdrawal_user_id_created_at`, `withdrawal_status_created_at` | `user_id = ? / status = ? ORDER BY id DESC` | same | `(user_id, id DESC)`, `(status, id DESC)` |
| `escrow_seller_user_id_status` | `seller = ? AND status IN (..) ORDER BY id DESC` | no sort column | `(seller_user_id, status, id DESC)` |
| `dispute_status_created_at`, `dispute_opened_by_user_id_created_at` | `ORDER BY id DESC` | same | swap `created_at` → `id DESC` |
| `auditevent_*_created_at` | `ORDER BY id DESC` | same | swap → `id DESC` |
| `giftcontribution_live_id_scope_key_*` | `scope_key = ?` (no `live_id`) | leading column not filtered | add `live_id` to the query |
| `geo_regions.georegion_country_id` | `country_id = ? ORDER BY name` | sort not covered | `(country_id, name)` (XS, optional) |

Alternative to changing indexes: change the queries to `ORDER BY created_at DESC, id DESC` with a tuple cursor. Prefer the index change: ids are UUIDv7 (time-ordered) and every cursor in code is already the id.

## 5. Planned indexes for PLANNED tables (justified)

| Table | Index | Type | Query supported | Why this type |
| --- | --- | --- | --- | --- |
| products | `(store_id, status, published_at DESC, id DESC)` | BT | store page, seller catalog | keyset |
| products | `(category_id, published_at DESC, id DESC) WHERE status = 'active'` | BT P | category browse | hot subset |
| products | `UNIQUE (store_id, slug)` | UQ | product URL | |
| products | `search_vector` GIN (`to_tsvector('simple', title || ' ' || description)`) | GIN | Postgres fallback search only until OpenSearch (`docs/architecture/search.md`) | `@@` operator; `'simple'` config because listings mix English, Pidgin, Yoruba, Hausa, Igbo |
| products | `title gin_trgm_ops` | GIN | admin/seller fuzzy lookup | `%`/`ILIKE '%x%'`; only if admin search needs it |
| variants | `UNIQUE (store_id, sku)`, `(product_id)` | UQ, BT | SKU lookup, variant list | FK |
| stock_levels | PK `(variant_id, location_id)` | UQ | reservation `UPDATE ... WHERE on_hand - reserved >= qty` | conditional update, no extra index |
| stock_reservations | `(expires_at) WHERE status = 'active'` | BT P | expiry sweep | hot subset |
| stock_movements | `(variant_id, id DESC)`; `UNIQUE (reference, variant_id, location_id)` | BT, UQ | history, idempotent movement | |
| checkouts | `UNIQUE (buyer_account_id, idempotency_key)` | UQ | idempotent checkout | |
| order_groups | `(buyer_account_id, id DESC)`, `(store_id, status, id DESC)`, `(checkout_id)` | BT | buyer orders, seller orders by status, settlement | keyset |
| order_items | `(order_group_id)`; `(variant_id)` only if analytics needs it in OLTP | BT | order detail | FK |
| cart_items | `UNIQUE (cart_id, variant_id)` | UQ | add/update item | |
| reviews | `(product_id, id DESC)`, `UNIQUE (author_account_id, order_item_id)` | BT, UQ | product reviews, one review per purchase | keyset |
| stores | `UNIQUE (slug)`; `location geography` GiST | UQ, GiST | store page; "stores near me" (`ST_DWithin`) | PostGIS operator; only if the nearby feature ships |
| follows | PK `(follower_id, followee_id)`; `(followee_id, created_at DESC, follower_id)` | UQ, BT | following list, followers list | keyset both directions |
| posts | `(author_profile_id, id DESC) WHERE deleted_at IS NULL` | BT P | profile grid | |
| comments | `(post_id, id)` | BT | thread | |
| messages | `(conversation_id, id DESC)`; `UNIQUE (conversation_id, sender_id, client_message_id)` | BT, UQ | chat history, client retry dedupe | |
| conversation_members | `(account_id, last_message_at DESC, conversation_id)` | BT | inbox | keyset |
| notifications | `(recipient_account_id, id DESC)`; `(recipient_account_id) WHERE read_at IS NULL` | BT, BT P | inbox, unread badge | |
| feed_items | PK `(owner_profile_id, score DESC, item_id)` | UQ | home feed | precomputed |
| ad_impressions | per partition `(ad_id, created_at)`, `(creator_id, created_at)`; PK `(day, id)` | BT | billing, revenue share | partition key must be in PK |
| campaigns / ads | `(ad_account_id, status)`, `(review_status, id) WHERE review_status = 'pending'` | BT, BT P | ads manager, review queue | |

JSONB GIN: none planned. Current jsonb columns (`metadata`, `settlement`, `payouts`, `prices`, `live_ad_settings`, `permissions`, `roles`, `capability_statuses`) are read whole by primary key, never filtered with `@>`.

## 6. Write overhead notes for hot tables

| Table | Indexes (incl. PK) | Concern |
| --- | --- | --- |
| `live.points_entries` | 7 | Highest index count on an XL table; I9 removes 3 |
| `ledger.journal_lines` | 3 | Fine; UUIDv7 PK keeps inserts right-appended |
| `ledger.ledger_accounts` | 3 | Updated on every posting; `balance_minor`/`version` are not indexed so HOT updates are possible: set `fillfactor = 80` |
| `live.live_sessions` | 3 | Counter updates (`viewers`, `gift_count`, `total_coins`) are non-indexed → HOT-eligible; `fillfactor = 80` |
| `live.live_viewers` | 3 | Upsert per join/leave; `last_seen_at` unindexed (HOT ok) |
| `creators.gift_transactions` | 5 | One row per gift; I8 shrinks one index |
| all `outbox_events` | 2 | Insert + update(published_at) per event; partial index avoids indexing published rows |

## 7. Validation follow-ups

When the compose Postgres is up (`docker ps | grep nantty-backend-postgres`), run against seeded schemas and record plans here:

1. `EXPLAIN (ANALYZE, BUFFERS)` the statement query: `SELECT ... FROM ledger.journal_lines WHERE account_id = $1 ORDER BY id DESC LIMIT 21` (expect Sort today; Index Scan Backward after I1).
2. `EXPLAIN SELECT ... FROM ledger.ledger_accounts WHERE code LIKE 'battle:%' AND currency = 'COIN'` and `SHOW lc_collate` (expect Seq Scan unless collation is C).
3. `EXPLAIN SELECT ... FROM live.gift_contributions WHERE scope_key = $1` (expect Seq Scan).
4. `EXPLAIN` the withdrawals, seller escrow holds, disputes and audit list queries with their `ORDER BY id DESC LIMIT`.
5. In prod, after 30 days: `SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes WHERE idx_scan = 0` to confirm the drop? list.
