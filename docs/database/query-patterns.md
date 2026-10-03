# Query patterns

As of 2026-10-03. Endpoints are the real routes in `services/go/modules/*/src/modules/*/routes` (prefix `/api/v1` omitted) unless marked PLANNED. Sizes use the classes in [domains.md](domains.md#3-size-classes-assumption-scenarios-no-user-counts) (rows returned / rows touched). Index names refer to [indexes.md](indexes.md).

Consistency: **strong** = must read the writer (read-after-write, money, locks). **eventual** = replica or cache acceptable (seconds of lag).

## 1. Query inventory: highest-traffic and most critical APIs

### 1.1 EXISTING

| Endpoint | Domain | Tables | Type | Filters | Joins / eager loads | Sort | Pagination | Size | Index used | Tx | R/W | Consistency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /auth/login` | Identity | `auth.accounts`, `sessions`, `refresh_tokens`, `outbox_events` | point read + inserts | email or username | – | – | – | 1 | `account_email` / `account_username` UQ | short tx | W | strong |
| `POST /auth/refresh` | Identity | `refresh_tokens`, `sessions` | point read + rotate | `token_hash` | session | – | – | 1 | `refreshtoken_token_hash` | tx (reuse detection) | W | strong |
| `GET /auth/sessions` | Identity | `sessions` | list | `account_id, revoked_at IS NULL` | – | `last_used_at` | none (S) | S | `session_account_id_revoked_at` | – | R | strong (own sessions) |
| `GET /users/me`, `/users/me/profiles` | Profiles | `users.profiles`, `acting_profiles` | point / small list | `account_id` | – | – | none | S | `profile_account_id` | – | R | strong (own) |
| `GET /users/username/{username}`, `/users/{userId}` | Profiles | `profiles` | point | `handle` / `id` | – | – | – | 1 | `profile_handle` UQ | – | R | eventual |
| `GET /users/me/addresses` | Shipping | `shipping_addresses` + geo by `IN` batches | list | `account_id` | 4 batched `IN` lookups (`addressView.service.go`) | `is_default DESC, id DESC` | none | S | `shippingaddress_account_id_created_at` | – | R | strong (own) |
| `GET /geo/...` | Shipping | `geo_*` | list | parent id | – | `name` | none | XS–S | geo UQs | – | R | eventual (cache) |
| `GET /coins/balance` | Wallet | `ledger.ledger_accounts` | point (2 rows) | `code IN (spendable, earned)` | – | – | – | 2 | `ledgeraccount_code_currency` prefix | – | R | strong |
| `GET /coins/transactions` | Wallet | `ledger.ledger_accounts`, `journal_lines` + `journal_entries` | keyset list | account by code, `account_id IN`, `id < cursor` | eager `WithEntry` (1 extra `IN` query) | `id DESC` | id cursor, limit ≤100 | 20 | **sort today** (I1) | – | R | strong (just-spent coins) |
| `GET /wallets/me`, `/wallets/me/transactions` | Wallet | ledger accounts + lines; `withdrawals` by `IN` | point + keyset | seller account codes | statuses via one `IN` query | `id DESC` | id cursor | 20 | I1 | – | R | strong |
| `GET /wallets/me/withdrawals`, `GET /admin/withdrawals` | Payouts | `wallet.withdrawals` | keyset | `user_id` / `status`, `id < cursor` | – | `id DESC` | id cursor | 20 | sort today (I4) | – | R | strong |
| `POST /wallets/me/withdrawals` | Payouts | `idempotent_requests`, `payout_accounts`, `withdrawals`, ledger (2 accounts, 1 entry, 2 lines), `outbox_events` | command | user | – | – | – | ~8 rows | UQs | money-tx | W | strong |
| `GET /wallets/me/escrow-holds` | Escrow | `escrow.escrows` | keyset | `seller_user_id, status IN (held, disputed)` | – | `id DESC` | id cursor | 20 | sort today (I5) | – | R | strong |
| `GET /orders/{orderId}/escrow` | Escrow | `escrows`, `escrow_events` | point + list | `order_id` | events by `escrow_id` | `created_at, id` | none | ≤ 10 | `escrow_order_id`, `escrowevent_escrow_id_created_at` | – | R | strong |
| `GET /disputes`, `/admin/disputes` | Trust | `disputes` | keyset | `opened_by_user_id` / `status` | – | `id DESC` | id cursor | 20 | sort today (I6) | – | R | eventual for admin |
| `POST /payments/initialize` | Payments | `order_payables`, `payment_intents`, `connected_accounts` (ent), provider HTTP | command | `purpose, subject_id` | – | – | – | ~5 | `paymentintent_purpose_subject_id` | money-tx **with provider call inside** (see [transactions.md](transactions.md#6-deviations-in-go-money-found-in-code)) | W | strong |
| `POST /payments/webhooks/{provider}` | Payments | `webhook_events`; then settlement: `payment_intents`, ledger, `escrows`, `escrow_events`, `seller_credit_maturities`, `outbox_events` | command | `provider, event_key`; `reference` | payables by `checkout_id` | – | – | 10–30 rows per checkout | UQs | claim tx, provider verify (no tx), settle money-tx | W | strong |
| `POST /payments/orders/{orderId}/verify` | Payments | `payment_intents` | list + settle | `purpose, subject_id` | – | `created_at DESC` limit 10 | – | ≤10 | `paymentintent_purpose_subject_id` | money-tx | W | strong |
| `POST /live/gifts`, `POST /lives/{liveId}/gifts` | Gifts | Valkey idempotency → gRPC creators: `gift_transactions`, ledger (3 accounts incl. platform revenue), `outbox_events`; then live: `processed_gifts`, `gift_combos`, `gift_contributions`, `live_sessions` counters | command | sender, key | creator program member lookup | – | – | ~12 rows | UQs | money-tx (creators) + separate live tx | W | strong |
| `GET /lives/{liveId}` / `/stage` | Live | `live_sessions`, `guest_slots`, `join_requests`, `battles`, `battle_participants`, `gift_contributions`, `battle_gift_events` | multi-read | `live_id` | 5–7 small queries | various | limits 10–50 | S | live indexes; **seq scan on `gift_contributions`** (I3) | – | R | eventual (but host actions need strong) |
| `GET /lives/suggested` | Live | `live_sessions` + participant lookup | top-N | `state='live', visibility='public', host_id <> viewer` | batched user summaries | `viewers DESC, created_at DESC` | limit 20 | 20 | `livesession_state_created_at` + sort | – | R | eventual (cache) |
| `POST /lives/{liveId}/join` / `leave` | Live | `live_viewers` upsert, `COUNT` viewers, `live_sessions.viewers` update | upsert + count + update | `live_id, user_id` | – | – | – | 1 + count | `liveviewer_*` | tx | W | eventual for count |
| `GET /lives/{liveId}/viewers` | Live | `live_viewers` | top-N | `live_id, left_at IS NULL` | – | `last_seen_at DESC` | limit 200 | ≤200 | `liveviewer_live_id_left_at` + sort | – | R | eventual |
| `GET /lives/{liveId}/leaderboard`, `GET /rankings` | Points | `live_leaderboard_entries`; rankings aggregate `points_entries` | list / aggregate | `live_id`; `type, created_at` window, category/country | – | `rank` / SUM DESC | limit | S / aggregate over XL | `liveleaderboardentry_live_id_rank`; points aggregate indexes | – | R | eventual (cache) |
| `POST /lives/{liveId}/engagement` | Points | `live_sessions`, `points_entries` | read + capped insert | user, action, window | – | – | – | 1–3 | `pointsentry_user_id_source_type_created_at` | tx + advisory lock per user+action | W | strong |
| `GET /admin/audit` | Audit | `admin.audit_events` | keyset | actor / action / subject | – | `id DESC` | id cursor | 50 | sort today (I6) | – | R | eventual |
| `GET /admin/ledger/integrity` | Ledger | all `journal_lines` (GROUP BY), all `ledger_accounts` | full aggregate | none | – | – | – | **whole ledger** | none possible | read tx | R | strong snapshot (run on replica, see §4) |
| `POST /admin/payments/reconciliations` | Ledger | provider API + all debit lines of provider account | full scan | account code, `external_reference <> ''` | `WithEntry` | – | – | **all history** | none (no window) | tx | R/W | strong |

### 1.2 PLANNED (highest traffic once built)

| Endpoint (PLANNED) | Domain | Tables | Type | Filters | Sort | Pagination (cursor cols) | Size | Index | Tx | R/W | Consistency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /products/{id}` | Products | `products`, `variants`, `stock_levels` (sum), store summary | point + children | id | – | – | 1 + variants | PK, `variants(product_id)` | – | R | eventual (cache), price re-checked at checkout |
| `GET /stores/{slug}/products` | Products | `products` | keyset | `store_id, status='active'` | `published_at DESC, id DESC` | `(published_at, id)` | 20 | `(store_id, status, published_at DESC, id DESC)` | – | R | eventual |
| `GET /categories/{id}/products` | Products | `products` | keyset | `category_id, status='active'` | `published_at DESC, id DESC` | `(published_at, id)` | 20 | partial category index | – | R | eventual |
| `GET /search?q=` | Search | OpenSearch (PLANNED); PG fallback `products.search_vector` | relevance | text + filters | `score DESC, id` | `search_after [score, id]` (no SQL keyset) | 20 | GIN fallback | – | R | eventual |
| `GET /cart`, `PUT /cart/items` | Cart | `carts`, `cart_items`, variant/price snapshot | list / upsert | `account_id` | `store_id, created_at` | none (S) | S | `UNIQUE (cart_id, variant_id)` | short tx | R/W | strong (own) |
| `POST /checkout` | Orders | `checkouts`, `stock_levels`, `stock_reservations`, `order_groups`, `order_items`, `outbox_events`; gRPC `RegisterCheckoutPayables` + `payments/initialize` | command | buyer, idempotency key | – | – | 10–50 rows | UQs | checkout tx (one schema owner pair), money calls after commit | W | strong |
| `GET /orders` (buyer) | Orders | `order_groups` (+ items for first page) | keyset | `buyer_account_id` | `id DESC` | `id` | 20 | `(buyer_account_id, id DESC)` | – | R | strong for the just-placed order, else eventual |
| `GET /seller/orders?status=` | Orders | `order_groups` | keyset | `store_id, status` | `id DESC` | `id` | 20–50 | `(store_id, status, id DESC)` | – | R | strong (seller acts on it) |
| `GET /products/{id}/reviews` | Reviews | `reviews` | keyset | `product_id` | `id DESC` (or `helpful_count DESC, id DESC`) | `id` or `(helpful_count, id)` | 20 | `(product_id, id DESC)` | – | R | eventual |
| `GET /feed` | Feed | `feed_items` → `posts` batch | keyset | `owner_profile_id` | `score DESC, item_id` | `(score, item_id)` | 20 | feed PK | – | R | eventual |
| `GET /conversations`, `/conversations/{id}/messages` | Messaging | `conversation_members`, `messages` | keyset | `account_id`; `conversation_id` | `last_message_at DESC, conversation_id`; `id DESC` | tuple; `id` | 20–50 | see indexes §5 | – | R | strong for own sent message (read-your-writes), else eventual |
| `GET /notifications` | Notifications | `notifications` | keyset | `recipient_account_id` | `id DESC` | `id` | 20 | `(recipient_account_id, id DESC)` | – | R | eventual |
| `GET /profiles/{id}/followers` | Social | `follows` | keyset | `followee_id` | `created_at DESC, follower_id` | `(created_at, follower_id)` | 20 | reverse follow index | – | R | eventual |

## 2. Repository audit (EXISTING Go code)

| # | Pattern | Where | Impact | Fix | Priority |
| --- | --- | --- | --- | --- | --- |
| Q1 | **Full scan, recurring**: integrity check aggregates every `journal_lines` row and loads every `ledger_accounts` row | `ledger/src/modules/journal/services/ledgerIntegrity.service.go` (`LedgerAccount.Query().All`), `ledger/src/jobs/ledgerIntegrity.job.go`, `GET /admin/ledger/integrity` | O(ledger) per run; runs on the writer; grows with every gift and order | Incremental check: per-account `checked_through_line_id` checkpoint, verify only new lines; full check monthly on a replica or restored snapshot | **P1** |
| Q2 | **Full scan, unbounded window**: provider reconciliation loads every historical debit line of the provider balance account | `ledger/.../providerReconciliation.service.go` `collectPlatformProviderBalanceDebitsByExternalReference` | O(all payments ever) per run | Filter by `journal_lines.created_at` within the run window (± settlement lag); index I7 | **P1** |
| Q3 | Seq scan (missing leading column) | `live/src/services/battlePresenter.service.go` `GiftContribution ... ScopeKey(...)` | Runs on every battle state render | Add `giftcontribution.LiveID(battle.LiveID)` to the predicate | **P1** |
| Q4 | Seq scan (LIKE prefix, non-C collation) | `ledger/.../accountBalances.service.go` `CodeHasPrefix`; `creators/.../battleSettlement.service.go` `readBattleHoldings` | Scans all ledger accounts (one per escrow) | I2 | **P1** |
| Q5 | In-memory sort before LIMIT (index/order mismatch) | statement, withdrawals, seller escrow holds, disputes, audit (I1, I4–I6) | Reads all matching rows per page; user with long history = slow page | Index changes in [indexes.md](indexes.md#4-bad-column-order-or-sort-mismatch) | P1–P2 |
| Q6 | N+1 (bounded) | `ListStatementLinesNewestFirst` resolves each requested account with its own `Only()` before the line query | 1–3 extra queries per page | One `code IN (...) AND currency IN (...)` query | P3 |
| Q7 | N+1 (bounded) | battle settlement `CreditableUserResolver` per participant; gift charge `ResolveCreditedCreator` (receiver, then host) | ≤ participants (small) | Batch membership lookup with `user_id IN (...)` | P3 |
| Q8 | SELECT * (ent default) on wide rows in lists | statement `WithEntry` loads `journal_entries.metadata` jsonb per line; audit search loads `before/after` jsonb for 50 rows; suggested lives loads full `live_sessions` rows (incl. `live_ad_settings`) | Extra I/O and TOAST reads | `Select(...)` the needed fields in list queries; keep full rows for detail views | P2 |
| Q9 | Count on hot path | `viewerPresence.service.go`: COUNT active viewers then `UPDATE live_sessions SET viewers` on every join/leave | Hot row + count per event in big lives | Valkey `SCARD`/HyperLogLog for live viewer count, flush to Postgres every N seconds | P2 |
| Q10 | Unbounded growth, no purge | every `outbox_events`, `idempotent_requests`, `webhook_events`, `processed_gifts`, `one_time_codes`, `refresh_tokens`, `live_viewers` | Index and vacuum cost grow forever | Batch purge jobs (`DELETE ... WHERE id IN (SELECT id ... LIMIT 1000)`) with retention per table; webhook/idempotency retention = LEGAL REVIEW | P1 (outbox), P2 others |
| Q11 | Relay holds a tx open across network publishes | `ledger/src/events/outbox.event.go` `PublishPendingOutboxEventsInTransaction` publishes up to 100 events to the broker inside the locking tx | Long tx: row locks + xmin horizon held until RabbitMQ confirms | Claim batch (`UPDATE ... SET claimed_until`), commit, publish, mark published in a second short tx | P2 |
| Q12 | Loads whole table per check | `users/src/services/usernameJudge.service.go` reads all `reserved_username_rules` per username check | XS table, fine | Cache in process with TTL | P3 |
| Q13 | OFFSET | none found | – | keep it that way | – |
| Q14 | Unbounded lists | `GET /users/me/terms-acceptances`, `GET /admin/admins`, geo lists, `GET /lives/{id}/products`, gift goals | All XS–S per parent | Add a hard cap (`Limit(200)`) as a guard | P3 |

## 3. Keyset (cursor) pagination spec

Rules:

1. Cursor = opaque base64 of the last row's sort tuple; the server validates it (type, length) and never trusts it for authorisation (filters like `user_id` come from the token).
2. The tuple always ends with a unique tiebreaker (`id`). UUIDv7 ids are unique and roughly time-ordered, so for "newest first" lists the cursor can be `id` alone (EXISTING code does this: `IDLT(cursor) ORDER BY id DESC LIMIT n+1`).
3. Predicate form: `WHERE (sort_col, id) < ($1, $2)` (row comparison, uses the composite index), fetch `limit + 1` to compute `nextCursor`.
4. Index = equality filters first, then the sort tuple in the same direction.
5. Mutable sort keys (score, price, rating) can skip or repeat rows when values change between pages; acceptable for feeds and search, not for money history (which sorts by immutable `id`).

| List | Status | Filter (equality) | Sort tuple | Cursor columns | Index |
| --- | --- | --- | --- | --- | --- |
| Products (store) | PLANNED | `store_id, status` | `published_at DESC, id DESC` | `(published_at, id)` | `(store_id, status, published_at DESC, id DESC)` |
| Products (category) | PLANNED | `category_id` (`status='active'` partial) | `published_at DESC, id DESC` | `(published_at, id)` | partial category index |
| Products (price sort) | PLANNED | `category_id` | `price_minor ASC, id ASC` | `(price_minor, id)` | `(category_id, price_minor, id) WHERE status='active'` (only if the UI sorts by price) |
| Orders (buyer) | PLANNED | `buyer_account_id` | `id DESC` | `id` | `(buyer_account_id, id DESC)` |
| Orders (seller) | PLANNED | `store_id, status` | `id DESC` | `id` | `(store_id, status, id DESC)` |
| Messages | PLANNED | `conversation_id` | `id DESC` (load older) | `id` | `(conversation_id, id DESC)` |
| Conversations (inbox) | PLANNED | `account_id` | `last_message_at DESC, conversation_id DESC` | `(last_message_at, conversation_id)` | `(account_id, last_message_at DESC, conversation_id DESC)` |
| Notifications | PLANNED | `recipient_account_id` | `id DESC` | `id` | `(recipient_account_id, id DESC)` |
| Feed | PLANNED | `owner_profile_id` | `score DESC, item_id DESC` | `(score, item_id)` | feed PK |
| Transactions (coins, wallet, statement) | EXISTING | `account_id IN (…)` | `id DESC` | `id` (journal line id) | **add** `(account_id, id DESC)` (I1) |
| Withdrawals | EXISTING | `user_id` or `status` | `id DESC` | `id` | **fix** (I4) |
| Escrow holds | EXISTING | `seller_user_id, status IN` | `id DESC` | `id` | **fix** (I5) |
| Disputes, audit | EXISTING | `status` / `opened_by` / `actor_id` / `action` | `id DESC` | `id` | **fix** (I6) |
| Reviews | PLANNED | `product_id` | `id DESC` (default) or `helpful_count DESC, id DESC` | `id` or `(helpful_count, id)` | `(product_id, id DESC)`; second index only if "most helpful" ships |
| Search | PLANNED | query + filters | `score DESC, id ASC` | engine `search_after [score, id]` with a point-in-time | OpenSearch; PG fallback caps at N pages |

For lists with an IN filter (`account_id IN (a, b)`), Postgres merges per-value index scans only partly; keep IN-lists to ≤ 3 accounts (coins: spendable only; wallet: available + reserved + pending) or paginate per account.

## 4. Read-replica eligibility

Today there is one writer and no replica routing in code (`services/go/platform/postgres/database.connector.go` opens one pool). Replica use is FUTURE (trigger: [performance.md](performance.md)). When added, route by query class:

| Query | Replica? | Why |
| --- | --- | --- |
| Anything inside `RunInMoneyTransaction` or with `FOR UPDATE` | **never** | locks and balance checks |
| Coin balance, wallet summary, statement right after a send/withdraw | **no** (strong) | user sees stale balance → retries → support load; balances are ledger truth |
| `GET /orders/{id}/escrow`, payment verify | no | read-after-write by the same user |
| Webhook processing, payout run, auto-release sweep, maturity sweep | no | writers |
| Auth login/refresh/session lists | no | token rotation is write-dependent |
| Own profile/addresses right after edit | no (or sticky-writer for N seconds after a write) | read-your-writes |
| Public profiles, `GET /users/username/{u}` | yes | eventual |
| Geo, policies, business categories, gift catalog, coin packages, exchange-rate history | yes (and cached) | reference data |
| Suggested lives, viewers list, leaderboard, rankings | yes | display data, already approximate |
| Admin lists (audit, disputes, withdrawals) | yes, with a "data as of" note; actions re-read on the writer | admin decisions re-validate under lock |
| Ledger integrity full check, reconciliation report pre-pass, analytics exports | yes (preferred; or restored snapshot) | heavy scans off the writer; replica lag acceptable for a point-in-time check if run with the replica's `pg_last_xact_replay_timestamp()` recorded |
| PLANNED: product pages, store pages, category lists, reviews, followers, feed hydration, notifications list | yes | eventual |
| PLANNED: cart, checkout, stock, seller order actions | no | strong |

## 5. Valkey cache candidates

Never cache financial truth: balances, ledger lines, escrow status, payment status and stock are always read from Postgres for decisions. Caches below are display-only or reference data, always with a DB fallback.

| Key | Value | TTL | Invalidation | Fallback | Consistency |
| --- | --- | --- | --- | --- | --- |
| `geo:countries`, `geo:regions:{countryId}`, `geo:cities:{regionId}` | lists | 24 h | on geo seed change (version key) | DB | eventual |
| `policy:current:{kind}` | current policy version | 5 min | `POST /admin/policy-versions` deletes key | DB | eventual (acceptance writes re-validate version) |
| `platformcfg:{key}` | setting + version | 30 s | `platformConfig.changed` event | DB (`platformSettings.loader.go`) | eventual; money rules re-read inside tx when they change amounts |
| `gifts:catalog:v{n}` | active gifts | 10 min | admin gift change bumps `n` | DB | eventual; **price is re-read inside the charge tx** (`unit_price_coins` validated by creators) |
| `coins:packages:{channel}` | packages | 10 min | admin change | DB | eventual; purchase re-reads package |
| `fx:rate:{currency}` | latest rate | 60 s | `exchangeRate.updated` | DB | eventual; checkout locks the rate it used |
| `profile:handle:{handle}` → summary | public profile card | 5 min | `profile.updated` event | DB | eventual |
| `usersum:{accountId}` | name/avatar for live lists | 5 min | `profile.updated` | DB batch | eventual |
| `live:suggested:{country}` | top 20 live ids | 5–10 s | time-based | DB query (§1) | eventual |
| `live:{id}:viewers` (set / HLL) | presence | per heartbeat, key TTL 2× heartbeat | join/leave | Postgres `live_viewers` (flushed) | eventual (replaces Q9 hot row) |
| `live:{id}:leaderboard` (sorted set) | gifter scores | live duration + 1 h | gift recorded | `live_leaderboard_entries` | eventual |
| `rankings:{type}:{window}:{scope}` | rankings page | 60 s | time-based | aggregate query | eventual |
| `live:idempotency:{key}` (EXISTING) | in-flight/completed response | `MoneyMovingTimeToLive` | completion | **DB unique keys are the guard** (`gift_transactions` UQ, journal `reference` UQ) | Valkey only short-circuits duplicates |
| `ratelimit:*` | counters | window | – | allow-and-log | – |
| PLANNED `product:{id}` | product card without stock | 60 s | `product.updated` | DB | eventual; checkout re-reads price and stock under lock |
| PLANNED `store:{slug}` | store header | 5 min | `store.updated` | DB | eventual |
| PLANNED `feed:{profileId}` | first page ids | 60 s | fan-out writes | `feed_items` | eventual |
| PLANNED `unread:{accountId}` | notification badge | 5 min | on read/new | partial index count | eventual |

Not cache candidates: `GET /coins/balance`, `GET /wallets/me`, escrow/payment status, stock levels, withdrawal status, idempotency outcomes (DB is truth).
