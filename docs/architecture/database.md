# Database architecture

> **Dated design document.** The status labels below describe the repo when this was written; much that is marked PROPOSED or ABSENT has since been built. For the current system see [system.md](system.md); where the two disagree, the code wins.

> **Creator = personal account upgrade (owner, 2026-10-03).** A creator account is the user's personal account turned into a creator account, not a separate profile. Profile types are Personal, Business/Brand and Government; `creatorStatus` (`none|pending|approved|rejected`) lives on the Personal profile and is set to `approved` when the Creator Program application is approved. It unlocks Creator Studio, going live, monetisation and earnings. Blue applies to the Personal profile whether or not it is creator-enabled.

As of 2026-10-03. Labels: **EXISTING** · **MOCK-ONLY** · **PROPOSED** · **OPTIONAL FUTURE**. Facts: [inventory.md](inventory.md) section 3.

Fixed decisions: one Aurora PostgreSQL + PostGIS cluster, one schema per owning service, one `svc_<service>` login role per service, read-only grants to others through `nantty_readers` (granted per table in the owner's migration). Only the owner writes. Money is `int64` minor units + ISO currency; coins are integer `COIN`; points are never money. ent + Atlas for Go, Prisma for TS.

| Fact | Status | Evidence |
| --- | --- | --- |
| 21 schemas + roles, `nantty_readers`, `REVOKE CREATE ON SCHEMA public` | EXISTING (local) | `infra/local/postgres/create-databases.sh` |
| `auth` schema: account, session, refresh_token, one_time_code, signing_key, social_identity, outbox_event | EXISTING, serving | `services/go/modules/auth/src/databases/schema` |
| `users`, `admin`, `currency`, `ledger`, `live` ent schemas + Atlas migrations | EXISTING (serving) | `services/go/modules/<m>/src/{databases/schema,migrations}` |
| Everything else | PROPOSED; the old monolith's Prisma schema (124 models) is the reference spec | |

ERD conventions: PK, FK, UK markers; quoted text lists key indexes or constraints. Cross-schema FKs are **logical only** (no DB constraint across owners); they are drawn but labelled `ref`. Every table also has `created_at`; omitted.

## 1. Domain overview

```mermaid
erDiagram
  ACCOUNT ||--o{ PROFILE : "has (auth -> users)"
  PROFILE ||--o{ FOLLOW : "follower / followee"
  PROFILE ||--o{ POST : authors
  PROFILE ||--o| STORE : "business profile opens"
  STORE ||--o{ PRODUCT : lists
  PRODUCT ||--o{ VARIANT : has
  VARIANT ||--o{ STOCK_LEVEL : "per location"
  ACCOUNT ||--o{ CART_ITEM : owns
  CHECKOUT ||--|{ ORDER_GROUP : "one per seller"
  ORDER_GROUP ||--|{ ORDER_ITEM : contains
  ORDER_GROUP ||--o| ESCROW : "held in"
  CHECKOUT ||--o{ PAYMENT : "paid by"
  PAYMENT ||--o{ JOURNAL_ENTRY : posts
  ACCOUNT ||--o{ WALLET : owns
  WALLET ||--|{ LEDGER_ACCOUNT : "backed by"
  PROFILE ||--o{ LIVE_SESSION : hosts
  LIVE_SESSION ||--o{ GIFT_TRANSACTION : receives
  GIFT_TRANSACTION ||--|| JOURNAL_ENTRY : "posted as"
  ACCOUNT ||--o{ POINTS_ENTRY : earns
  AD_ACCOUNT ||--o{ CAMPAIGN : runs
  CAMPAIGN ||--o{ AD_IMPRESSION : records
  ACCOUNT ||--o{ USER_CONSENT : grants
```

## 2. Users, profiles, sessions, devices

```mermaid
erDiagram
  ACCOUNT ||--o{ SESSION : has
  SESSION ||--o{ REFRESH_TOKEN : rotates
  ACCOUNT ||--o{ SOCIAL_IDENTITY : links
  ACCOUNT ||--o{ ONE_TIME_CODE : "receives (by destination)"
  ACCOUNT ||--|{ PROFILE : owns
  ACCOUNT ||--o| ACTING_PROFILE : selects
  PROFILE ||--o{ USERNAME_CHANGE : history
  ACCOUNT ||--o{ DEVICE : registers
  DEVICE ||--o{ PUSH_TOKEN : has
  ACCOUNT ||--o{ ADDRESS : saves
  ACCOUNT {
    uuid id PK
    string email UK
    string username UK
    string password_hash "argon2id"
    string status
  }
  SESSION {
    uuid id PK
    uuid account_id FK "idx(account_id, revoked_at)"
    timestamptz revoked_at
  }
  REFRESH_TOKEN {
    uuid id PK
    uuid session_id FK
    string token_hash UK
    uuid replaced_by_id "reuse detection"
  }
  SOCIAL_IDENTITY {
    uuid id PK
    uuid account_id FK
    string provider "UK(provider, subject)"
    string subject
  }
  ONE_TIME_CODE {
    uuid id PK
    string destination "idx(destination, purpose, consumed_at)"
    string secret_hash UK
    int attempts
  }
  PROFILE {
    uuid id PK
    uuid account_id FK "partial UK one personal per account"
    string handle UK
    enum kind "personal|business"
    enum creator_status "none|pending|approved|rejected"
    bool is_private
  }
  ACTING_PROFILE {
    uuid id PK
    uuid account_id UK
    uuid profile_id FK
  }
  USERNAME_CHANGE {
    uuid id PK
    uuid account_id "idx(account_id, created_at)"
    enum reason
  }
  DEVICE {
    uuid id PK
    uuid account_id FK "idx(account_id)"
    string platform
    timestamptz last_seen_at
  }
  PUSH_TOKEN {
    uuid id PK
    uuid device_id FK
    string token UK
  }
  ADDRESS {
    uuid id PK
    uuid account_id FK
    char country_code
    uuid region_id "ref geo"
    uuid admin_area_id "ref geo"
  }
```

Status: ACCOUNT, SESSION, REFRESH_TOKEN, SOCIAL_IDENTITY, ONE_TIME_CODE EXISTING (`auth`); PROFILE, ACTING_PROFILE, USERNAME_CHANGE EXISTING WIP (`users`); DEVICE, PUSH_TOKEN, ADDRESS PROPOSED. Staff accounts/sessions/challenges are EXISTING WIP in `admin` (separate audience; not drawn).

## 3. Social graph

```mermaid
erDiagram
  PROFILE ||--o{ FOLLOW : "follower_id"
  PROFILE ||--o{ FOLLOW : "followee_profile_id"
  PROFILE ||--o{ BLOCK : blocks
  PROFILE ||--o{ POST : authors
  POST ||--o{ POST_MEDIA : attaches
  POST ||--o{ COMMENT : has
  COMMENT ||--o{ COMMENT : "replies (parent_id)"
  POST ||--o{ POST_LIKE : receives
  COMMENT ||--o{ COMMENT_LIKE : receives
  POST ||--o{ POST_SHARE : "shared / reposted"
  POST ||--o{ POST_SAVE : saved
  POST ||--o{ POST_PRODUCT_TAG : tags
  FOLLOW {
    uuid id PK
    uuid follower_id "UK(follower_id, followee_profile_id)"
    uuid followee_profile_id "idx(followee_profile_id, state, created_at)"
    enum state "none|requested|accepted|rejected|blocked"
    timestamptz decided_at
  }
  BLOCK {
    uuid blocker_id PK
    uuid blocked_id PK "idx(blocked_id)"
  }
  POST {
    uuid id PK
    uuid author_profile_id "idx(author_profile_id, created_at desc, id)"
    enum audience "everyone|followers"
    enum visibility "public|subscribers"
    uuid reshared_from_id FK
    bool is_ai_generated
    timestamptz deleted_at
  }
  POST_MEDIA {
    uuid post_id PK
    int position PK
    uuid media_id "ref media"
  }
  COMMENT {
    uuid id PK
    uuid post_id FK "idx(post_id, created_at, id)"
    uuid parent_id FK
    uuid author_profile_id
  }
  POST_LIKE {
    uuid post_id PK
    uuid profile_id PK "idx(profile_id, created_at)"
  }
  COMMENT_LIKE {
    uuid comment_id PK
    uuid profile_id PK
  }
  POST_SHARE {
    uuid id PK
    uuid post_id FK
    uuid profile_id
    string channel
  }
  POST_SAVE {
    uuid post_id PK
    uuid profile_id PK "idx(profile_id, created_at)"
  }
  POST_PRODUCT_TAG {
    uuid post_id PK
    uuid product_id PK "ref catalog"
  }
```

Status: PROPOSED (`social` schema, ts-social). Reference: the old monolith's Prisma schema `Follow`, `Post`, `PostLike`, `Comment`, `CommentLike`, `Block`. Counters (`like_count`, `follower_count`) are denormalised columns updated by event consumers, never `COUNT(*)` on read. Blocking overrides every follow state; `BLOCK` is owned by users and read by social via grant.

## 4. Marketplace

```mermaid
erDiagram
  STORE ||--o{ STORE_MEMBER : staff
  STORE ||--o{ PRODUCT : lists
  CATEGORY ||--o{ CATEGORY : "parent_id"
  CATEGORY ||--o{ PRODUCT : classifies
  PRODUCT ||--|{ VARIANT : has
  STORE ||--o{ STOCK_LOCATION : operates
  VARIANT ||--o{ STOCK_LEVEL : stocked
  STOCK_LOCATION ||--o{ STOCK_LEVEL : holds
  VARIANT ||--o{ STOCK_MOVEMENT : "append-only"
  VARIANT ||--o{ STOCK_RESERVATION : reserved
  CART ||--o{ CART_ITEM : contains
  VARIANT ||--o{ CART_ITEM : "chosen"
  CHECKOUT ||--|{ ORDER_GROUP : "one per store"
  ORDER_GROUP ||--|{ ORDER_ITEM : contains
  ORDER_GROUP ||--o{ ORDER_EVENT : timeline
  STORE {
    uuid id PK
    uuid owner_profile_id
    string slug UK
    char settlement_currency
  }
  STORE_MEMBER {
    uuid store_id PK
    uuid account_id PK "idx(account_id)"
    string role
  }
  CATEGORY {
    uuid id PK
    uuid parent_id FK
    string slug UK
  }
  PRODUCT {
    uuid id PK
    uuid store_id FK "idx(store_id, status, updated_at)"
    uuid category_id FK "idx(category_id, status)"
    enum status "draft|active|archived"
  }
  VARIANT {
    uuid id PK
    uuid product_id FK
    string sku "UK(store_id, sku)"
    bigint price_minor
    char currency
  }
  STOCK_LOCATION {
    uuid id PK
    uuid store_id FK
    enum kind "warehouse|shop|pickup|thirdParty"
  }
  STOCK_LEVEL {
    uuid variant_id PK
    uuid location_id PK
    int on_hand "CHECK on_hand >= reserved"
    int reserved
    bigint version
  }
  STOCK_MOVEMENT {
    uuid id PK
    uuid variant_id "idx(variant_id, created_at)"
    enum type
    int quantity
    string reference "UK(reference, variant_id, location_id)"
  }
  STOCK_RESERVATION {
    uuid id PK
    uuid checkout_id "idx(checkout_id)"
    timestamptz expires_at "idx(expires_at) where active"
  }
  CART {
    uuid id PK
    uuid account_id UK
  }
  CART_ITEM {
    uuid id PK
    uuid cart_id FK "UK(cart_id, variant_id)"
    uuid store_id "grouping key"
    int quantity
  }
  CHECKOUT {
    uuid id PK
    uuid buyer_account_id
    string idempotency_key "UK(buyer_account_id, idempotency_key)"
    bigint grand_total_minor
    char currency
    numeric locked_fx_rate
  }
  ORDER_GROUP {
    uuid id PK
    uuid checkout_id FK
    uuid store_id "idx(store_id, status, created_at)"
    enum status
    bigint total_minor
  }
  ORDER_ITEM {
    uuid id PK
    uuid order_group_id FK
    uuid variant_id "ref, price snapshot"
    bigint unit_price_minor
    int quantity
  }
  ORDER_EVENT {
    uuid id PK
    uuid order_group_id FK "idx(order_group_id, at)"
    string from_status
    string to_status
  }
```

Status: PROPOSED. Schemas: `catalog` (store, member, category, product, variant), `inventory` (location, level, movement, reservation; ABSENT even in the old monolith), `orders` (cart, checkout, order group, item, event). Cart rows key on `store_id` so the cart API groups by seller. Inventory and orders share the go-commerce deployable so reservation + order creation commit in one tx (one tx across two schemas owned by the same deployable; today each module has its own `svc_<module>` role, so go-commerce needs one connection role with write grants on both, or the reservation must become a sync call. Decide before orders is built).

## 5. Payments, ledger, escrow, wallets, payouts

```mermaid
erDiagram
  PAYMENT ||--o{ PAYMENT_ATTEMPT : tries
  PAYMENT ||--o{ REFUND : refunded
  WEBHOOK_EVENT }o--o| PAYMENT : confirms
  ESCROW ||--o{ ESCROW_MOVEMENT : "hold, release, refund"
  WALLET ||--|{ LEDGER_ACCOUNT : "available, pending, coins"
  LEDGER_ACCOUNT ||--o{ JOURNAL_LINE : posts
  JOURNAL_ENTRY ||--|{ JOURNAL_LINE : "balanced (sum dr = sum cr)"
  JOURNAL_ENTRY ||--o| JOURNAL_ENTRY : reverses
  PAYOUT_ACCOUNT ||--o{ PAYOUT : "paid to"
  PAYOUT ||--o{ JOURNAL_ENTRY : posts
  FEE_RULE ||--o{ JOURNAL_LINE : "computes fee lines"
  RECONCILIATION_RUN ||--o{ RECONCILIATION_BREAK : finds
  PAYMENT {
    uuid id PK
    uuid checkout_id "ref orders"
    string provider
    string provider_reference "UK(provider, provider_reference)"
    bigint amount_minor
    char currency
    enum status
  }
  PAYMENT_ATTEMPT {
    uuid id PK
    uuid payment_id FK
    string outcome
  }
  REFUND {
    uuid id PK
    uuid payment_id FK
    string idempotency_key UK
    bigint amount_minor
    enum status
  }
  WEBHOOK_EVENT {
    uuid id PK
    string provider "UK(provider, provider_event_id)"
    string provider_event_id
    timestamptz processed_at
  }
  ESCROW {
    uuid id PK
    uuid order_group_id UK
    enum state "held|released|refunded|disputed"
    timestamptz auto_release_at "idx(state, auto_release_at)"
  }
  ESCROW_MOVEMENT {
    uuid id PK
    uuid escrow_id FK
    uuid journal_entry_id FK
  }
  WALLET {
    uuid id PK
    string owner_type "UK(owner_type, owner_id, currency)"
    string owner_id
    char currency
  }
  LEDGER_ACCOUNT {
    uuid id PK
    string code "UK(code, currency)"
    char currency
    enum kind "asset|liability|equity|revenue|expense"
    bigint balance_minor "CHECK >= 0 unless allowed"
    bigint version
  }
  JOURNAL_ENTRY {
    uuid id PK
    string reference UK
    uuid reverses_entry_id UK
    string kind "idx(kind, posted_at)"
  }
  JOURNAL_LINE {
    uuid id PK
    uuid entry_id FK "UK(entry_id, line_number)"
    uuid account_id FK "idx(account_id, created_at)"
    enum direction "debit|credit"
    bigint amount_minor
  }
  PAYOUT_ACCOUNT {
    uuid id PK
    string owner_id
    bytea account_number_enc "encrypted, masked"
  }
  PAYOUT {
    uuid id PK
    uuid payout_account_id FK
    string idempotency_key UK
    enum status "requested|approved|processing|paid|failed"
  }
  FEE_RULE {
    uuid id PK
    string key "UK(key, effective_from)"
    int bps
  }
  RECONCILIATION_RUN {
    uuid id PK
    string provider "idx(provider, window_starts_at)"
  }
  RECONCILIATION_BREAK {
    uuid id PK
    uuid run_id FK
    enum kind
    timestamptz resolved_at
  }
```

Status: LEDGER_ACCOUNT, JOURNAL_ENTRY, JOURNAL_LINE, RECONCILIATION_RUN/BREAK EXISTING WIP (`services/go/modules/ledger/src/databases/schema`); the rest PROPOSED (`payments`, `wallet`, `escrow` schemas; reference the old monolith `Payment`, `WebhookEvent`, `Escrow`, `LedgerAccount`, `LedgerEntry`, `PayoutAccount`, `Withdrawal`). Balances change only by journal lines in the same tx, with `SELECT ... FOR UPDATE` on the affected ledger accounts in a fixed order (by id) to avoid deadlocks, plus `version` check. Detailed money flows: [payments.md](payments.md).

## 6. Livestream

```mermaid
erDiagram
  LIVE_SESSION ||--o{ LIVE_VIEWER : watched
  LIVE_SESSION ||--o{ GUEST_SLOT : stage
  LIVE_SESSION ||--o{ JOIN_REQUEST : requests
  LIVE_SESSION ||--o{ LIVE_PRODUCT : pins
  LIVE_SESSION ||--o{ BATTLE : hosts
  BATTLE ||--|{ BATTLE_PARTICIPANT : includes
  BATTLE ||--o| BATTLE_SETTLEMENT : "settled once"
  LIVE_SESSION {
    uuid id PK
    uuid host_id "idx(host_id, state)"
    enum state "idle|connecting|live|ended; idx(state, created_at)"
    string livekit_room
    jsonb live_ad_settings
  }
  LIVE_VIEWER {
    uuid id PK
    uuid live_id "UK(live_id, user_id)"
    uuid user_id
    timestamptz left_at "idx(live_id, left_at)"
  }
  GUEST_SLOT {
    uuid id PK
    uuid live_id "partial UK(live_id, user_id) where active state"
    uuid user_id
    enum state "invited|joining|onStage|reconnecting|left|..."
    timestamptz state_deadline_at "idx(state, state_deadline_at)"
  }
  JOIN_REQUEST {
    uuid id PK
    uuid live_id "partial UK(live_id, user_id) where pending"
    uuid user_id
  }
  LIVE_PRODUCT {
    uuid id PK
    uuid live_id "UK(live_id, product_id)"
    uuid product_id "ref catalog"
  }
  BATTLE {
    uuid id PK
    uuid live_id "partial UK one open battle per live; UK(live_id, idempotency_key)"
    enum state "pending|countdown|active|ended|settling|settled|cancelled"
    bool winner_takes_all
    timestamptz ends_at "idx(state, ends_at)"
  }
  BATTLE_PARTICIPANT {
    uuid id PK
    uuid battle_id FK "UK(battle_id, user_id)"
    uuid user_id "idx(user_id, state)"
    enum state "active|left|forfeited"
  }
  BATTLE_SETTLEMENT {
    uuid battle_id PK
    string rule
    uuid journal_entry_id "ref ledger"
  }
```

Status: all but BATTLE_SETTLEMENT EXISTING WIP (`services/go/modules/live/src/databases/schema/*`, migration `create_live_tables`); BATTLE_SETTLEMENT PROPOSED (belongs in go-money, keyed `battle-settle:{battleId}`). `state_deadline_at` / `ends_at` indexes support the Postgres due-time poller so timers survive restarts.

## 7. Gifts and Nantty Points

```mermaid
erDiagram
  GIFT ||--o{ GIFT_TRANSACTION : "charged at"
  GIFT_GOAL ||--o{ GIFT_TRANSACTION : "progressed by"
  GIFT_TRANSACTION ||--|| JOURNAL_ENTRY : "posted as (ref ledger)"
  POINTS_RULE ||--o{ POINTS_ENTRY : awards
  LIVE_LEADERBOARD_ENTRY }o--|| GIFT_GOAL : "same live (logical)"
  RANKING_SNAPSHOT ||--o{ RANKING_SNAPSHOT_ROW : contains
  GIFT {
    string id PK
    int price_coins
    enum display_level "micro|medium|large|global"
    string animation_asset_key
    bool is_active "idx(is_active, sort_order)"
  }
  GIFT_TRANSACTION {
    uuid id PK
    uuid sender_id "UK(sender_id, idempotency_key)"
    uuid receiver_id
    uuid live_id "idx(live_id, created_at)"
    uuid battle_id "idx(battle_id, receiver_id)"
    bigint total_coins
    bigint platform_fee_coins
    bigint creator_amount_coins
    string ledger_transaction_id
    enum status "committed|heldForReview|reversed"
  }
  GIFT_GOAL {
    uuid id PK
    uuid live_id "idx(live_id, status)"
    bigint target_coins
    bigint progress_coins
  }
  POINTS_RULE {
    uuid id PK
    string action UK
    int points
    int per_minute_cap
    int per_day_cap
  }
  POINTS_ENTRY {
    uuid id PK
    uuid user_id "idx(user_id, source_type, created_at)"
    enum type "engagement|support|stream|community|achievement"
    int amount
    string idempotency_key "UK(user_id, idempotency_key)"
  }
  LIVE_LEADERBOARD_ENTRY {
    uuid id PK
    uuid live_id "UK(live_id, user_id); idx(live_id, rank)"
    uuid user_id
    bigint coins
  }
  RANKING_SNAPSHOT {
    uuid id PK
    string board "UK(board, scope, scope_key, period, period_start)"
    string scope
    timestamptz period_start
  }
  RANKING_SNAPSHOT_ROW {
    uuid snapshot_id PK
    int rank PK
    uuid subject_id
    bigint score
  }
```

Status: GIFT, GIFT_TRANSACTION, GIFT_GOAL, POINTS_RULE, POINTS_ENTRY, LIVE_LEADERBOARD_ENTRY EXISTING WIP **in the `live` schema** (`gift.schema.go`, `gift_transaction.schema.go`, `points.schema.go`); RANKING_SNAPSHOT PROPOSED. Recommendation (P0, [backend.md](backend.md) F1): move GIFT, GIFT_TRANSACTION, GIFT_GOAL to go-money `creators` so the coin debit, gift row and ledger entry commit in one tx; move POINTS_* and ranking snapshots to `rewards`. `POINTS_ENTRY` currently has no idempotency unique constraint; add `UK(user_id, idempotency_key)` because points are awarded by at-least-once event consumers.

## 8. Ads

```mermaid
erDiagram
  AD_ACCOUNT ||--o{ AD_ACCOUNT_MEMBER : members
  AD_ACCOUNT ||--o{ CAMPAIGN : runs
  CAMPAIGN ||--|{ AD_SET : contains
  AD_SET ||--|{ AD : contains
  AD ||--o{ AD_IMPRESSION : served
  AD_IMPRESSION ||--o{ AD_CLICK : clicked
  AD_IMPRESSION ||--o{ AD_CONVERSION : "attributed (window)"
  MONETIZATION_POLICY ||--o{ CREATOR_AD_EARNING : "applied to"
  AD_IMPRESSION }o--o| CREATOR_AD_EARNING : "rolled up daily"
  AD_ACCOUNT {
    uuid id PK
    uuid owner_account_id
    char currency
  }
  AD_ACCOUNT_MEMBER {
    uuid ad_account_id PK
    uuid account_id PK
    string role
  }
  CAMPAIGN {
    uuid id PK
    uuid ad_account_id FK "idx(ad_account_id, status)"
    enum status
    bigint daily_budget_minor
  }
  AD_SET {
    uuid id PK
    uuid campaign_id FK
    jsonb targeting
  }
  AD {
    uuid id PK
    uuid ad_set_id FK
    enum review_status "idx(review_status, created_at)"
    uuid creative_media_id "ref media"
  }
  AD_IMPRESSION {
    uuid id PK "client event id, idempotent"
    uuid ad_id "idx(ad_id, created_at)"
    uuid creator_id "idx(creator_id, created_at)"
    string placement
    bool qualified
    enum fraud_status "pending|clean|invalid"
    bigint revenue_minor
    date day "partition key"
  }
  AD_CLICK {
    uuid id PK
    uuid impression_id FK
  }
  AD_CONVERSION {
    uuid id PK
    uuid impression_id FK
    string event_name
    string dedupe_key UK
  }
  MONETIZATION_POLICY {
    uuid id PK
    string key "UK(key, effective_from)"
    string revenue_source
    int creator_share_bps
    numeric multiplier
  }
  CREATOR_AD_EARNING {
    uuid id PK
    uuid creator_id "UK(creator_id, day, currency)"
    date day
    bigint amount_minor
    uuid journal_entry_id "ref ledger"
  }
```

Status: PROPOSED (`ads` schema; reference 22 `Ad*` Prisma models in the old monolith). `AD_IMPRESSION` is the highest-volume OLTP table: range-partition by `day` from the start (monthly partitions, drop/archive after attribution window + dispute window), and move raw events to ClickHouse when it lands.

## 9. Shipping and geo

```mermaid
erDiagram
  COUNTRY ||--o{ REGION : has
  REGION ||--o{ ADMIN_AREA : has
  ADMIN_AREA ||--o{ CITY : has
  ADDRESS }o--|| COUNTRY : in
  ADDRESS }o--o| ADMIN_AREA : in
  SHIPPING_PROFILE ||--o{ SHIPPING_ZONE : contains
  SHIPPING_ZONE ||--|{ SHIPPING_DESTINATION : covers
  SHIPPING_ZONE ||--|{ SHIPPING_RULE : prices
  SHIPPING_DESTINATION }o--|| COUNTRY : "ref geo"
  ORDER_GROUP ||--|| SHIPPING_CALCULATION : "immutable snapshot"
  COUNTRY {
    char code PK
    string address_format
    char default_currency
  }
  REGION {
    uuid id PK
    char country_code FK "UK(country_code, code)"
  }
  ADMIN_AREA {
    uuid id PK
    uuid region_id FK "UK(region_id, code)"
  }
  CITY {
    uuid id PK
    uuid admin_area_id FK
    geography location "GiST"
  }
  ADDRESS {
    uuid id PK
    uuid account_id "idx(account_id)"
    char country_code FK
    uuid region_id
    uuid admin_area_id
  }
  SHIPPING_PROFILE {
    uuid id PK
    uuid store_id "partial UK(store_id) where is_default"
  }
  SHIPPING_ZONE {
    uuid id PK
    uuid profile_id FK
  }
  SHIPPING_DESTINATION {
    uuid id PK
    uuid zone_id FK "idx(country_code, region_id, admin_area_id)"
    char country_code
    uuid region_id
    uuid admin_area_id
  }
  SHIPPING_RULE {
    uuid id PK
    uuid zone_id FK
    bigint fee_per_group_minor
    bigint free_threshold_minor
    char currency
  }
  ORDER_GROUP {
    uuid id PK
  }
  SHIPPING_CALCULATION {
    uuid id PK
    uuid order_group_id UK
    uuid rule_id "ref, snapshot"
    jsonb destination_snapshot
    bigint fee_minor
  }
```

Status: PROPOSED. Geo + addresses: `users` schema (go-identity); shipping profiles/zones/rules + calculation: `orders` schema (go-commerce). Most specific destination wins (admin area, then region, then country), resolved with one indexed query. Fees are per seller order group, never per item.

## 10. Privacy

```mermaid
erDiagram
  POLICY_VERSION ||--o{ USER_CONSENT : "granted under"
  POLICY_VERSION ||--o{ TERMS_ACCEPTANCE : accepted
  ACCOUNT ||--o{ USER_CONSENT : "append-only"
  ACCOUNT ||--o| PRIVACY_PREFERENCE : sets
  ACCOUNT ||--o{ DATA_EXPORT_REQUEST : requests
  ACCOUNT ||--o{ DELETION_REQUEST : requests
  DATA_CATEGORY ||--|| RETENTION_POLICY : "governed by"
  POLICY_VERSION {
    uuid id PK
    enum kind "terms|privacy|cookie|liveAdTerms|creatorTerms"
    string version "UK(kind, version)"
    timestamptz published_at
  }
  USER_CONSENT {
    uuid id PK
    uuid account_id "idx(account_id, type, created_at desc)"
    enum type "essential|analytics|personalization|advertising|marketing"
    bool granted
    uuid policy_version_id FK
  }
  TERMS_ACCEPTANCE {
    uuid id PK
    uuid account_id "UK(account_id, policy_version_id)"
    uuid policy_version_id FK
  }
  PRIVACY_PREFERENCE {
    uuid account_id PK
    string who_can_message
    bool private_profile
  }
  DATA_EXPORT_REQUEST {
    uuid id PK
    uuid account_id "idx(account_id, status)"
    enum status "queued|running|ready|expired|failed"
    string s3_key
  }
  DELETION_REQUEST {
    uuid id PK
    uuid account_id "partial UK(account_id) where status in pending,grace"
    timestamptz execute_after
    enum status
  }
  DATA_CATEGORY {
    string key PK
    string purpose
    string legal_basis
    string owner_service
  }
  RETENTION_POLICY {
    string category_key PK
    interval period "set by counsel"
    enum action "delete|anonymize|retain"
  }
```

Status: ABSENT/PROPOSED (`backendPlan.md` 4.7). Owner: users (go-identity). Consents are versioned and append-only; latest row wins (read through a `current_consents` view or cached projection). These tables support privacy obligations; they do not by themselves make the platform compliant, and retention periods are not set here.

## 11. Ownership matrix

| Schema | Owner (deployable) | Read access (grant) | Write | Events produced | Events consumed |
| --- | --- | --- | --- | --- | --- |
| `auth` | auth (go-identity) | users, admin (account directory) | auth | `account.registered`, `account.loggedIn`, `session.refreshTokenReuseDetected` | `account.deletionRequested` |
| `users` | users (go-identity) | all (profiles, addresses, consents, blocks) | users | `profile.updated`, `user.blocked`, `consent.updated`, `account.deletionRequested` | `account.registered` |
| `admin` | admin (go-identity) | none | admin | `platformConfig.changed` | audit-worthy events from all |
| `currency` | currency (go-identity) | commerce, money, ads | currency | `exchangeRate.updated` | - |
| `catalog` | catalog (go-commerce) | live, ads, social, search, orders | catalog | `product.published/updated/unpublished`, `store.created` | `moderation.actionTaken` |
| `inventory` | inventory (go-commerce) | orders, catalog | inventory | `stock.adjusted`, `stock.lowDetected` | `order.cancelled`, `refund.completed` (restock) |
| `orders` | orders (go-commerce) | money, analytics | orders | `order.placed/paid/shipped/delivered/completed/cancelled` | `payment.succeeded/failed`, `escrow.released` |
| `payments` | payments (go-money) | orders (status) | payments | `payment.succeeded/failed`, `refund.completed` | provider webhooks |
| `ledger` | ledger (go-money) | admin (read), analytics | ledger only | `journalEntry.posted`, `reconciliation.mismatchFound` | - (sync API only) |
| `wallet` | wallet (go-money) | admin | wallet | `coins.purchased`, `payout.requested/paid/failed` | `payment.succeeded` (coin packs) |
| `escrow` | escrow (go-money) | orders, admin | escrow | `escrow.held/released/refunded`, `dispute.opened/resolved` | `order.delivered`, `order.completed` |
| `creators` | creators (go-money) | live, studio analytics | creators | `gift.sent`, `gift.goalCompleted`, `creatorEarnings.credited` | `battle.ended` (settle) |
| `rewards` | rewards (go-money) | social, live | rewards | `points.awarded` | `gift.sent`, `post.liked`, `user.followed`, `order.completed` |
| `subscriptions` | subscriptions (go-money) | gateway, catalog | subscriptions | `subscription.started/cancelled`, `sellerPlan.changed` | `payment.succeeded` |
| `live` | live (go-live) | creators, social, search | live | `live.started/ended`, `guest.*`, `battle.*` | `gift.sent` (scores) |
| `ads` | ads (go-ads) | analytics | ads | `ad.impressionRecorded`, `ad.conversionRecorded`, `campaign.activated` | `consent.updated`, `post.created` |
| `moderation` | moderation (go-trust) | social, catalog, live | moderation | `content.reported`, `moderation.actionTaken` | `post.created`, `media.ready` |
| `social`, `feed` | ts-social | users, moderation, search | ts-social | `post.created/deleted`, `comment.created`, `post.liked`, `user.followed` | `moderation.actionTaken`, `user.blocked` |
| `media`, `notifications`, `search`, `support`, `integrations`, `campaigns` | ts-io | as needed | ts-io | `media.ready/failed`, `notification.delivered` | most domain events |
| `realtime` | ex-realtime | users (membership) | realtime | `message.created` | live/gift/battle/notification events |

## 12. Reliability

| Area | Recommendation | Stage | Priority |
| --- | --- | --- | --- |
| Backups / PITR | Aurora continuous backup, 35-day PITR; daily snapshot copied to a second region and a separate backup account (AWS Backup vault lock) | MVP | **P0** (ledger is the only financial truth) |
| Restore drills | Quarterly restore to a scratch cluster + trial-balance check; document RTO 1 h / RPO 5 min targets | MVP | P1 |
| Multi-AZ | Writer + 1 reader in another AZ (failover target, not for read traffic at first) | MVP | P0 |
| Connection pooling | RDS Proxy per cluster (Fargate scale-outs x `pgxpool` size would exhaust `max_connections`); pgbouncer only if RDS Proxy pinning hurts (session-level `SET`) | MVP | P1 |
| Pool sizing | Per task `max_conns` = 10 default; total across tasks < 70% of `max_connections` | MVP | P1 |
| Migrations | Atlas versioned (EXISTING: embedded and applied at service start via `postgres.ApplyPendingMigrationsFromEmbeddedDirectory`). Move apply to a one-off ECS task in the deploy pipeline with `atlas migrate lint` in CI (destructive-change and backward-compat analyzers) | MVP | **P1**: auto-apply at start races across N tasks and runs DDL under app credentials |
| Expand / contract | 1) add nullable column/table, 2) dual-write, 3) backfill in batches, 4) switch reads, 5) drop in a later release. Indexes `CREATE INDEX CONCURRENTLY` (Atlas `-- atlas:txmode none`). `lock_timeout = 5s` on migration sessions | MVP | P1 |
| Read replicas | Only when a trigger fires: analytics/report queries > 10% writer CPU, or replica lag-tolerant read RPS > writer capacity. Never for read-after-write paths (checkout, wallet) | Near term | P3 |
| Slow query monitoring | `pg_stat_statements`, Performance Insights, `log_min_duration_statement = 250ms`, `auto_explain` sampled; weekly top-20 review | MVP | P1 |
| Index hygiene | Alert on unused indexes (`pg_stat_user_indexes.idx_scan = 0` after 30 days) and seq scans on tables > 1M rows | Near term | P2 |
| Large tables | Partition `ad_impressions`, `points_entries`, `stock_movements`, `journal_lines` (by month) once > 50M rows or vacuum time hurts | Scale stage | P2 |
| Outbox growth | Delete published rows older than 7 days in batches (job); keep index `(published_at, created_at)` (EXISTING) | MVP | P1 |
| Sharding | Not planned. Trigger: writer at > 70% CPU sustained after tuning, vertical limit (largest Aurora class) within 6 months, or a single schema > 5 TB. First step is moving a hot schema (ads events, chat) to its own cluster, not sharding | Scale stage | P3 |
