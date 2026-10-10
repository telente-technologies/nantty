# Flutterwave API reference (v3 and v4)

Read on 2026-10-10 from every page linked from https://developer.flutterwave.com/reference/ (the v3 reference), the v4 reference (https://developer.flutterwave.com/v4.0.0/reference/…), the v2 legacy reference reachable from the version switcher, and the core-concept docs that the reference pages depend on (auth, headers, idempotency, webhooks, errors, encryption, rate limits). This is a reading aid for building go-money. The design decisions live in [`flutterwaveMigration.md`](flutterwaveMigration.md).

## 0. How the docs were read

- Every page is a ReadMe page. Appending `.md` returns raw Markdown with the page's OpenAPI 3.1 definition. For 37 v3 pages and 10 v2 pages, `.md` returned only the HTML shell (both attempts). Those pages were read from the `ssr-props` JSON embedded in the HTML, which holds the same method, path, params and sample responses.
- Indexes: [v3 `llms.txt`](https://developer.flutterwave.com/llms.txt) (122 reference pages), [v4 `llms.txt`](https://developer.flutterwave.com/v4.0.0/llms.txt) (58), [v2 `llms.txt`](https://developer.flutterwave.com/v2.0.0/llms.txt) (109). The sidebar of `/reference/` lists the same 122 v3 slugs as the v3 index (diffed: no extras either side). `sitemap.xml`, `sitemap_index.xml` and `v4.0.0/sitemap.xml` return 404.
- `/v3.0.0/reference/x` and `/v3.0/reference/x` serve the same pages as `/reference/x`.
- Source keys used below: **V3R:x** = `https://developer.flutterwave.com/reference/x`, **V4R:x** = `https://developer.flutterwave.com/v4.0.0/reference/x`, **V3D:x** = `https://developer.flutterwave.com/docs/x`, **V4D:x** = `https://developer.flutterwave.com/v4.0.0/docs/x`.
- Amounts: v3 schemas type most amounts as `integer`, but responses carry decimals (`"amount": "2,000.00"`, `"fee": 10.75`). v4 uses decimal major units everywhere. Parse every amount with an exact decimal parser.

## 1. Hosts, auth, headers

| | v3 | v4 |
|---|---|---|
| Base URL (live) | `https://api.flutterwave.com/v3` | `https://f4bexperience.flutterwave.com` ([V4D:environments](https://developer.flutterwave.com/v4.0.0/docs/environments)) |
| Base URL (test) | same host, test keys (`FLWSECK_TEST-…`) | `https://developersandbox-api.flutterwave.com` (older pages: `https://api.flutterwave.cloud/developersandbox`) |
| Auth | `Authorization: Bearer <secret key>`. Regenerating keys "will invalidate all existing keys" at once ([V3D:authentication](https://developer.flutterwave.com/docs/authentication)) | OAuth2 client credentials: `POST https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token` (form: `client_id`, `client_secret`, `grant_type=client_credentials`). `access_token` lives **600 s**; refresh a minute early. `Authorization: Bearer <access_token>` ([V4D:authentication](https://developer.flutterwave.com/v4.0.0/docs/authentication)) |
| Keys | secret, public (client side), encryption key (3DES for direct card charge) | client id + secret; encryption key (AES-256-GCM, 12-char nonce) for card fields |
| Idempotency | **none**. Duplicate transfer `reference` → `400 "Payout with this ref already exists"`; bills → `"Duplicate transaction reference"`; RFQ → `"A quote with this reference already exists."` | `X-Idempotency-Key` (12–255 alphanumeric) on every POST. A reused key returns the **first** response with header `X-Idempotency-Cache-Hit: true`. Safe to retry 5xx/network errors with the same key ([V4D:idempotency](https://developer.flutterwave.com/v4.0.0/docs/idempotency)) |
| Trace id | — | `X-Trace-Id` (12–255 alphanumeric), echoed for support ([V4D:api-headers](https://developer.flutterwave.com/v4.0.0/docs/api-headers)) |
| Test scenarios | test cards/accounts | `X-Scenario-Key`, e.g. `scenario:auth_pin&issuer:approved`; invalid key → `pending` ([V4D:testing](https://developer.flutterwave.com/v4.0.0/docs/testing)) |
| Client-side tamper check | `payload_hash = sha256(amount+currency+customer_email+tx_ref+sha256(secret))` on Inline/Standard/HTML checkout ([V3D:checksum](https://developer.flutterwave.com/docs/checksum)) | — |
| Rate limit | 429 per merchant; no number published ([V3D:rate-limit](https://developer.flutterwave.com/docs/rate-limit)) | **500 requests/minute**; 429, or non-JSON Cloudflare `1015` from the edge. Backoff with jitter ([V4D:common-errors](https://developer.flutterwave.com/v4.0.0/docs/common-errors)) |
| Timeouts | 503 after ~28 s; for charges, payouts and bills query status **before** any retry ([V3D:handling-error-timeouts](https://developer.flutterwave.com/docs/handling-error-timeouts)) | charges/orders: `201` with `next_action.type = requires_requery` after 25–28 s. Wait 20 s, `GET` the charge/order, then 40 s; still unresolved after a minute → `failed` |
| Transfer prerequisites | "Transfer via API" enabled, IPs whitelisted | same; error codes `218400 API_TRANSFER_DISABLED`, `220400 IP_WHITELISTING_REQUIRED`, `221400 NON_WHITELISTED_IP`, `222400 BLACKLISTED_IP` |

Note: the v4 environments page's multi-environment code sample has the sandbox and production URLs **swapped** (`isProd ? developersandbox… : f4bexperience…`). Do not copy it.

## 2. v4 (current) reference — 58 pages

All v4 endpoints share: Bearer token, optional `X-Trace-Id`, `X-Idempotency-Key` on creates, `X-Scenario-Key` in sandbox. Errors are `{status:"failed", error:{type, code, message, validation_errors[]}}` (400 `10400`, 401 `10401`, 403 `10403`, 409 `10409 RESOURCE_CONFLICT`). Ids are prefixed strings: `cus_`, `pmd_`, `chg_`, `ord_`, `trf_`, `rcb_`/`rcw_` (recipient), `sdr_`, `stm_`, `chb_`, `wbk_`, `bnk_`, `brh_`, `mob_`. `reference` is 6–42 chars `^[a-zA-Z0-9\-]+$`, unique per merchant.

**There is no v4 endpoint for**: payout subaccounts / per-user wallets, collection subaccounts or split payments, payment plans or subscriptions, hosted checkout (Standard), BVN/NIN/identity, bulk-transfer creation, bills, OTP, FX trades, tokenized-charge endpoint (use `recurring:true` on a saved payment method). v4 "wallets" are the merchant's own balances.

### 2.1 Customers
| Endpoint | Request | Response / notes | Source |
|---|---|---|---|
| `POST /customers` | `email` (req, regex); `name{first,middle,last}` (2–50, letters); `phone{country_code 1–3 digits, number 7–10 digits}`; `address{line1,city,state,postal_code,country ISO2}` | `data.id cus_…` | [V4R:customers_create](https://developer.flutterwave.com/v4.0.0/reference/customers_create) |
| `GET /customers` `?page&size` | | paged | [V4R:customers_list](https://developer.flutterwave.com/v4.0.0/reference/customers_list) |
| `GET /customers/{id}` · `PUT /customers/{id}` | PUT: name, phone, address | | [get](https://developer.flutterwave.com/v4.0.0/reference/customers_get) · [put](https://developer.flutterwave.com/v4.0.0/reference/customers_put) |
| `POST /customers/search` | `email` | list | [V4R:customers_search](https://developer.flutterwave.com/v4.0.0/reference/customers_search) |

### 2.2 Payment methods, charges, orders, orchestrator
| Endpoint | Request | Response / notes | Source |
|---|---|---|---|
| `POST /payment-methods` | `type` ∈ `card` (`card{nonce(12), encrypted_card_number, encrypted_expiry_month, encrypted_expiry_year, encrypted_cvv, billing_address, card_holder_name, cof{enabled, agreement_id, trace_id}}`), `bank_account`, `mobile_money{network, country_code, phone_number, use_qr}`, `opay`, `applepay{card_holder_name}`, `googlepay{card_holder_name}`, `ussd{account_bank}`; `customer_id` | `pmd_…`, device_fingerprint, client_ip | [V4R:payment_methods_post](https://developer.flutterwave.com/v4.0.0/reference/payment_methods_post) |
| `GET /payment-methods`, `GET /payment-methods/{id}` | | | [list](https://developer.flutterwave.com/v4.0.0/reference/payment_methods_list) · [get](https://developer.flutterwave.com/v4.0.0/reference/payment_methods_get) |
| `POST /charges` | `amount` (decimal), `currency` (ISO 4217, long enum), `reference`, `customer_id`, `payment_method_id` (all req); `redirect_url`, `meta`, `authorization` (oneOf `otp{code 4–8 digits}`, `pin{nonce, encrypted_pin}`, `external_3ds{eci,time,authentication_token,transaction_id,version,transaction_status Y/N/U/A/R,status_reason_code,amount}`, `avs{address}`), `recurring` (bool; "bypass authorization flows", terminal status only), `order_id` (preauth capture), `merchant_vat_amount` | `status` ∈ succeeded, pending, failed, voided; `next_action` ∈ redirect_url, requires_pin, requires_otp, requires_additional_fields, requires_requery, payment_instruction, requires_capture, requires_bank_transfer, qr_code; `processor_response{type,code}`; `fees`, `settled`, `settlement_id[]`, `disputed`, `refunded`. 409 `1100409 CHARGE_ALREADY_EXISTS` on reused reference | [V4R:charges_post](https://developer.flutterwave.com/v4.0.0/reference/charges_post) |
| `GET /charges` | filters: status, reference, from, to, customer_id, virtual_account_id, payment_method_id, order_id, page, size | | [V4R:charges_list](https://developer.flutterwave.com/v4.0.0/reference/charges_list) |
| `GET /charges/{id}` | | the verification call | [V4R:charges_get](https://developer.flutterwave.com/v4.0.0/reference/charges_get) |
| `PUT /charges/{id}` | `authorization` (OTP/PIN/3DS/AVS), `meta` | continue a pending charge | [V4R:charges_put](https://developer.flutterwave.com/v4.0.0/reference/charges_put) |
| `POST /orchestration/direct-charges` | one call: `amount, currency, reference, customer{…}, payment_method{…}` (same oneOf as above), `redirect_url`, `authorization`, `merchant_vat_amount` | creates customer + method + charge | [V4R:orchestration_direct_charge_post](https://developer.flutterwave.com/v4.0.0/reference/orchestration_direct_charge_post) |
| `POST /orders` | preauth: `amount, currency, reference, customer_id, payment_method_id`, `authorization{type:3ds}` | `ord_…`, status ∈ completed, pending, authorized, partially-completed, voided, failed | [V4R:orders_post](https://developer.flutterwave.com/v4.0.0/reference/orders_post) |
| `PUT /orders/{id}` | `action` ∈ void, capture | capture > order amount → `1143400` | [V4R:orders_put](https://developer.flutterwave.com/v4.0.0/reference/orders_put) |
| `GET /orders`, `GET /orders/{id}` | | | [list](https://developer.flutterwave.com/v4.0.0/reference/orders_list) · [get](https://developer.flutterwave.com/v4.0.0/reference/orders_get) |
| `POST /orchestration/direct-orders` | orchestrated order (card preauth) | | [V4R:orchestration_direct_order_post](https://developer.flutterwave.com/v4.0.0/reference/orchestration_direct_order_post) |
| `GET /fees` | `amount, currency, payment_method` (req); `card6`, `country`, `network` | `charge_amount`, `fee[]` | [V4R:fees_get](https://developer.flutterwave.com/v4.0.0/reference/fees_get) |

Security: card fields must be AES-256-GCM encrypted client-side (`nonce` 12 alphanumeric; failure → 422 `CLIENT_ENCRYPTION_ERROR 11100/1137400`) ([V4D:encryption](https://developer.flutterwave.com/v4.0.0/docs/encryption)). Raw card data reaching our servers puts us in PCI SAQ-D. The error table lists `CHECKOUT_SESSION_NOT_FOUND 1800404` / `CHECKOUT_SESSION_ALREADY_EXISTS 1801409`, so a v4 hosted checkout exists internally, but no endpoint is published.

### 2.3 Virtual accounts (v4)
| Endpoint | Request | Response / notes | Source |
|---|---|---|---|
| `POST /virtual-accounts` | `reference`, `customer_id`, `currency` ∈ **NGN, GHS, EGP, KES, MAD, ZAR**, `account_type` ∈ static, dynamic (req); `amount` (0 for static), `expiry` 60–31 536 000 s (default 3600), `narration`, `bvn`/`nin` (11 digits; NGN static needs one), `customer_account_number` (**required for EGP and KES**), `bank_code` (NGN `090567` Flutterwave MFB; GHS `GH200100` First Bank), `meta`, `merchant_vat_amount` | `account_number`, `account_bank_name`, `status` active/inactive, `account_expiration_datetime`, `customer_reference` | [V4R:virtual_accounts_post](https://developer.flutterwave.com/v4.0.0/reference/virtual_accounts_post) |
| `PUT /virtual-accounts/{id}` | `action_type` ∈ update_bvn, update_status; `status:"inactive"`; `bvn` | | [V4R:virtual_accounts_put](https://developer.flutterwave.com/v4.0.0/reference/virtual_accounts_put) |
| `GET /virtual-accounts` `?reference`, `GET /virtual-accounts/{id}` | | | [list](https://developer.flutterwave.com/v4.0.0/reference/virtual_accounts_list) · [get](https://developer.flutterwave.com/v4.0.0/reference/virtual_account_get) |

The guide says PWBT is "NGN and GHS only" and that each VA is "linked to your settlement wallet" ([V4D:pay-with-bank-transfer](https://developer.flutterwave.com/v4.0.0/docs/pay-with-bank-transfer)): money lands in the **merchant's** balance, pooled. A v4 VA is not a per-user wallet.

### 2.4 Transfers (v4)
| Endpoint | Request | Response / notes | Source |
|---|---|---|---|
| `POST /direct-transfers` (orchestrator) | `type` ∈ bank, mobile_money, wallet, cash_pickup, crypto; `action` ∈ instant, deferred, scheduled (req); `reference`, `narration` ≤180, `callback_url` (overrides the dashboard webhook URL), `disburse_option{date_time "YYYY-MM-DD HH:MM:SS" ≥30 min ahead, timezone}`, `payment_instruction{source_currency, destination_currency, amount{value, applies_to: source_currency|destination_currency}, recipient{…}, sender{…}, transfer_purpose}` | `trf_…`, status ∈ NEW, PENDING, INITIATED, SUCCESSFUL, FAILED, CANCELLED; `fee`, `debit_information{actual_debit_amount, rate_used, vat}`, `payment_information{proof}`, `provider_response{type,code}`, `reversal` | [V4R:direct_transfers_post](https://developer.flutterwave.com/v4.0.0/reference/direct_transfers_post) |
| `POST /transfers` (general) | `action`, `reference`, `narration`, `callback_url`, `disburse_option`, `payment_instruction{recipient_id (req), sender_id, amount, source/destination currency}` | | [V4R:transfers_post](https://developer.flutterwave.com/v4.0.0/reference/transfers_post) |
| `GET /transfers` | cursor `next/previous`; filters bulk_id, recipient_id, sender_id, currencies, action, type, status, from, to | | [V4R:transfers_list](https://developer.flutterwave.com/v4.0.0/reference/transfers_list) |
| `GET /transfers/{id}` | | `301404 TRANSFER_NOT_FOUND` | [V4R:transfer_get](https://developer.flutterwave.com/v4.0.0/reference/transfer_get) |
| `PUT /transfers/{id}` | deferred/scheduled only: `initiate`, `close`, `disburse_option` | | [V4R:transfer_put](https://developer.flutterwave.com/v4.0.0/reference/transfer_put) |
| `POST /transfers/{id}/retries` | `action` ∈ retry (failed only, `404400`), duplicate (successful only, `401400`); `reference`, `callback_url` | `405400 POSSIBLE_DUPLICATE_RETRIES` | [V4R:transfer_post_retry](https://developer.flutterwave.com/v4.0.0/reference/transfer_post_retry) |
| `POST /transfers/recipients` | bank: NGN, EGP, ETB, EUR (IBAN+swift+name/phone/email/address), GBP (sort code, account_type), GHS (**branch required**), MWK, USD (routing, swift, account_type), ZAR (phone, email, address), KES, RWF, SLL, UGX, XAF, XOF; mobile money: EGP, ETB, GHS, KES, RWF, TZS, UGX, XAF, XOF, ZMW (`network`, `msisdn`); also wallet, cash_pickup, crypto | `270409 RECIPIENT_ALREADY_EXISTS` | [V4R:transfers_recipients_create](https://developer.flutterwave.com/v4.0.0/reference/transfers_recipients_create) |
| `GET/DELETE /transfers/recipients/{id}`, `GET /transfers/recipients` | | | [get](https://developer.flutterwave.com/v4.0.0/reference/transfers_recipients_get) · [delete](https://developer.flutterwave.com/v4.0.0/reference/transfers_recipients_delete) · [list](https://developer.flutterwave.com/v4.0.0/reference/transfers_recipients_list) |
| `POST /transfers/senders` | generic, bank_gbp/eur (name, email, phone, address), bank_egp/mobile_money_egp (+ `national_identification{type PASSPORT|DRIVERS_LICENSE|NATIONAL_ID, identifier, expiration_date}`, `date_of_birth`) | `sdr_…` | [V4R:transfers_senders_create](https://developer.flutterwave.com/v4.0.0/reference/transfers_senders_create) |
| `GET/DELETE /transfers/senders/{id}`, `GET /transfers/senders` | | | [get](https://developer.flutterwave.com/v4.0.0/reference/transfers_senders_get) · [delete](https://developer.flutterwave.com/v4.0.0/reference/transfers_senders_delete) · [list](https://developer.flutterwave.com/v4.0.0/reference/transfers_senders_list) |
| `POST /transfers/rates` · `GET /transfers/rates/{id}` | `source{currency}`, `destination{currency, amount}`, `precision` 2–9 | `rate`, source/destination amounts | [post](https://developer.flutterwave.com/v4.0.0/reference/transfer_rates_post) · [get](https://developer.flutterwave.com/v4.0.0/reference/transfer_rates_get) |

Wallet transfers go to another Flutterwave **merchant** (`recipient.wallet{provider:"flutterwave", identifier:<merchant id>}`), or between our own currency balances with our own merchant id ([V4D:wallet-to-wallet](https://developer.flutterwave.com/v4.0.0/docs/wallet-to-wallet)). They cannot address a PSA.

### 2.5 Balances, banks, lookups (v4)
| Endpoint | Request | Response / notes | Source |
|---|---|---|---|
| `GET /wallets/balances` · `GET /wallets/balances/{currency}` | | `{currency, available_balance}` (merchant) | [all](https://developer.flutterwave.com/v4.0.0/reference/fetch_wallet_balances) · [one](https://developer.flutterwave.com/v4.0.0/reference/fetch_currency_wallet_balance) |
| `GET /wallets/statement` | `currency` (req), from, to, cursor | `transactions[]` | [V4R:get_wallet_statement](https://developer.flutterwave.com/v4.0.0/reference/get_wallet_statement) |
| `GET /banks?country=` · `GET /banks/{id}/branches` | | `bnk_…`, code, name; branches with swift/bic | [banks](https://developer.flutterwave.com/v4.0.0/reference/banks_get) · [branches](https://developer.flutterwave.com/v4.0.0/reference/bank_branches_get) |
| `GET /mobile-networks?country=` | | `mob_…`, network, name | [V4R:mobile_networks_get](https://developer.flutterwave.com/v4.0.0/reference/mobile_networks_get) |
| `POST /banks/account-resolve` | `currency` + `account{code, number}`: **NGN** (10 digits), **GHS** (10–13 digits), **UGX** (10–14), **USD** (NG domiciliary, `country:"NG"`), **GBP** (Confirmation of Payee: `type` personal + `name{first,last}` or corporate + `business_name`) | `account_name`. No KES, ZAR, XOF/XAF | [V4R:bank_account_resolve_post](https://developer.flutterwave.com/v4.0.0/reference/bank_account_resolve_post) |
| `POST /wallets/account-resolve` | `provider:"flutterwave"`, `identifier` (merchant id) | `name` | [V4R:wallet_account_resolve_post](https://developer.flutterwave.com/v4.0.0/reference/wallet_account_resolve_post) |

### 2.6 Refunds, chargebacks, settlements (v4)
| Endpoint | Request | Response / notes | Source |
|---|---|---|---|
| `POST /refunds` | `amount`, `charge_id`, `reason` ∈ duplicate, fraudulent, requested_by_customer, expired_uncaptured_charge (all req) | status ∈ new, pending, requires_action, succeeded, completed, failed, cancelled. Errors `1402400` (> charge), `1403400` (pending charge), `1404400` (already refunded). Several partials allowed up to the charge total; debited from available balance or next settlement. Card 3–15 days, MoMo 3–5, bank 24 h ([V4D:refunds](https://developer.flutterwave.com/v4.0.0/docs/refunds)) | [V4R:refunds_post](https://developer.flutterwave.com/v4.0.0/reference/refunds_post) |
| `GET /refunds`, `GET /refunds/{id}` | | | [list](https://developer.flutterwave.com/v4.0.0/reference/refunds_list) · [get](https://developer.flutterwave.com/v4.0.0/reference/refunds_get) |
| `GET /chargebacks` (`page,size,from,to`), `GET /chargebacks/{id}` | | `stage` ∈ new, second, pre-arbitration, arbitration, invalid; `status` ∈ new, pending, initiated, accepted, declined, won, lost, reversed; `due_datetime`, `arn`, `settlement_id` | [list](https://developer.flutterwave.com/v4.0.0/reference/chargebacks_list) · [get](https://developer.flutterwave.com/v4.0.0/reference/chargebacks_get_by_id) |
| `PUT /chargebacks/{id}` | `status` ∈ accepted, declined, partially-accepted; `uploaded_proof` (URL) or `proof_data` (base64); `comment`; `amount` | decline needs comment + proof (`1703400`) | [V4R:chargeback_put](https://developer.flutterwave.com/v4.0.0/reference/chargeback_put) |
| `POST /chargebacks` | `charge_id, amount, type local|international, expiry (h)` | sandbox simulation | [V4R:chargebacks_post](https://developer.flutterwave.com/v4.0.0/reference/chargebacks_post) |
| `GET /settlements`, `GET /settlements/{id}` | | `stm_…`, gross/net, fees[], chargeback, refund, `destination` (wallet/bank), status ∈ disburse-pending, pending, reviewed, approved, completed, completed-offline, failed, flagged, processing, on-hold; `charges[]` | [list](https://developer.flutterwave.com/v4.0.0/reference/settlement_list) · [get](https://developer.flutterwave.com/v4.0.0/reference/settlement_get) |

Chargebacks: a lien is placed on the settlement or payout balance; no response by the due date (**48 hours** in the v4 guide) → `lost` ([V4D:chargebacks-1](https://developer.flutterwave.com/v4.0.0/docs/chargebacks-1)).

### 2.7 Webhooks (v4)
| Item | Detail | Source |
|---|---|---|
| Events (OpenAPI `webhooks`) | `charge.completed`, `order.authorization`, `transfer.disburse`, `transfer.reversal` (`reversal{reversal_datetime, initial_status, reconciliation_status:"REVERSED", reconciliation_type D|C}`), `refund.completed` | [V4R:refund_completed_webhook](https://developer.flutterwave.com/v4.0.0/reference/refund_completed_webhook) |
| Envelope | `{webhook_id (wbk_…) — the guide calls it id, timestamp (ms), type, data}` | [V4D:webhooks](https://developer.flutterwave.com/v4.0.0/docs/webhooks) |
| Signature | header `flutterwave-signature` = **base64(HMAC-SHA256(raw body, secret hash))**. The same page's framework samples compare the header to the secret directly; verify the real behaviour in sandbox before trusting either | [V4D:webhooks](https://developer.flutterwave.com/v4.0.0/docs/webhooks) |
| Delivery | 200 only = success; 60 s timeout; 3 retries, 30 min apart (enable retries in the dashboard); duplicates possible | same |
| Resend | `POST /resend-webhook {id (chg_/ord_/trf_/wbk_), type}` | [V4R:resend_webhook](https://developer.flutterwave.com/v4.0.0/reference/resend_webhook) |
| Delivery vendor | errors `1602422 UNPROCESSABLE_SVIX_RESPONSE` show the webhooks run on Svix | [V4D:common-errors](https://developer.flutterwave.com/v4.0.0/docs/common-errors) |

## 3. v3 reference — 122 pages

v3 responses are `{status:"success"|"error", message, data}`; errors `{status:"error", message, data:null}`; 500s `{error_id, message, code:"app_error"}` ([V3D:common-errors](https://developer.flutterwave.com/docs/common-errors)). Many v3 schemas list required fields loosely; the notes below follow the pages.

### 3.1 Standard checkout, charges, validation
| Endpoint | Request | Notes | Source |
|---|---|---|---|
| `POST /payments` (Standard) | `tx_ref`, `amount`, `customer{email (req), name, phone_number}` (req); `currency` (default NGN), `redirect_url`, `payment_options` (comma list), `configuration{session_duration ≤1440 min, max_retry_attempt}`, `link_expiration` (datetime), `customizations{title, logo}`, `payment_plan`, `subaccounts[{id}]`, `meta`; plus `payload_hash` ([V3D:checksum](https://developer.flutterwave.com/docs/checksum)) | `data.link` = `https://checkout.flutterwave.com/v3/hosted/pay/flwlnk-…`. Card data never touches us (SAQ-A) | [V3R:checkout](https://developer.flutterwave.com/reference/checkout) |
| `POST /charges?type=card` | encrypted payload (3DES with encryption key): `card_number, cvv, expiry_month, expiry_year, amount, currency, email, tx_ref`, `authorization{mode pin|avs_noauth, pin, city, address, state, country, zipcode}`, `preauthorize`, `payment_plan`, `redirect_url`, external-3DS fields `a_*`, `eci`, `is_custom_3ds_enabled` | direct charge = SAQ-D | [V3R:charge-a-card](https://developer.flutterwave.com/reference/charge-a-card) |
| `POST /charges?type=bank_transfer` | `amount, email, currency NGN|GHS, tx_ref`; `is_permanent`, `narration`, `bank_code` (`090567`), `subaccounts` | dynamic VA in `meta.authorization{transfer_account, transfer_bank, account_expiration, transfer_reference}` | [V3R:charge-via-bank-transfer](https://developer.flutterwave.com/reference/charge-via-bank-transfer) |
| `POST /charges?type=ussd` | `account_bank, amount, currency NGN, email, tx_ref` | USSD code returned | [V3R:charge-via-ussd](https://developer.flutterwave.com/reference/charge-via-ussd) |
| `POST /charges?type=qr` (NQR) | `amount, email, tx_ref, currency NGN, is_nqr:"1"` | QR image | [V3R:charge-via-nqr](https://developer.flutterwave.com/reference/charge-via-nqr) |
| `POST /charges?type=opay` | `amount, email, tx_ref, currency NGN` | redirect | [V3R:opay-charge](https://developer.flutterwave.com/reference/opay-charge) |
| `POST /charges?type=mono` (Pay with Bank NG) | `amount ≥ 200 NGN, email, tx_ref, currency NGN` | | [V3R:charge-nigerian-bank-accounts](https://developer.flutterwave.com/reference/charge-nigerian-bank-accounts) |
| `POST /charges?type=enaira` | `amount, email, tx_ref` | | [V3R:e-naira](https://developer.flutterwave.com/reference/e-naira) |
| `POST /charges?type=mpesa` | `amount, currency KES, phone_number (2547…), email, tx_ref` | STK push, async | [V3R:charge-via-mpesa](https://developer.flutterwave.com/reference/charge-via-mpesa) |
| `POST /charges?type=mobile_money_ghana` | `amount, currency GHS, email, tx_ref, phone_number, network` ∈ MTN, VODAFONE, TIGO | `meta.authorization{mode:redirect, redirect}` | [V3R:charge-via-ghana-mobile-money](https://developer.flutterwave.com/reference/charge-via-ghana-mobile-money) |
| `…mobile_money_uganda` (UGX; `network`, `voucher` for Vodafone), `…_rwanda` (RWF; `order_id` req), `…_tanzania` (TZS; Airtel, Tigo, Halopesa, Vodafone), `…_zambia` (ZMW; MTN, Airtel, Zamtel), `…_franco` (XAF/XOF; `country` CM, SN, BF, CI…; `authorization_code` for Orange BF) | | | [UG](https://developer.flutterwave.com/reference/charge-via-uganda-mobile-money) · [RW](https://developer.flutterwave.com/reference/charge-via-rwanda-mobile-money) · [TZ](https://developer.flutterwave.com/reference/charge-via-tanzania-mobile-money) · [ZM](https://developer.flutterwave.com/reference/charge-via-zambia-mobile-money) · [Franco](https://developer.flutterwave.com/reference/charge-via-francophone-mobile-money) |
| `…?type=ach_payment` (USD/ZAR; `customer_identifier`, `country US|ZA`), `…voucher_payment` (1Voucher ZAR, `pin`), `…capitec` (ZAR, needs enablement), `…account-ach-uk` (GBP/EUR, `billing_country`), `…fawry_pay` (EGP) | | | [ACH](https://developer.flutterwave.com/reference/charge-via-ach-payment) · [1Voucher](https://developer.flutterwave.com/reference/charge-via-voucher-payment) · [Capitec](https://developer.flutterwave.com/reference/capitec) · [UK/EU](https://developer.flutterwave.com/reference/charge-uk-bank-accounts) · [Fawry](https://developer.flutterwave.com/reference/charge-via-fawrypay) |
| `POST /validate-charge` | `otp, flw_ref`, `type` card|account | | [V3R:validate-a-charge](https://developer.flutterwave.com/reference/validate-a-charge) |
| `POST /charges/:flw_ref/capture` · `/void` · `/refund` | capture/refund `amount` | preauth | [capture](https://developer.flutterwave.com/reference/capture-preauth-charge) · [void](https://developer.flutterwave.com/reference/void-preauth-charge) · [refund](https://developer.flutterwave.com/reference/refund-preauth-charge) |

There is no v3 reference page for Apple Pay or Google Pay.

### 3.2 Tokenized charges and mandates
| Endpoint | Request | Notes | Source |
|---|---|---|---|
| `POST /tokenized-charges` | `token, email (exact email of the first charge), currency, country (merchant ISO), amount, tx_ref, redirect_url` (req); `first_name, last_name, ip, narration, device_fingerprint, payment_plan, subaccounts, preauthorize` | `400 "Wrong token or email passed"`; may return `pending` | [V3R:charge-with-token-1](https://developer.flutterwave.com/reference/charge-with-token-1) |
| `PUT /tokens/:token` | `email, phone_number, first_name, last_name` (all req) | re-points the token's customer: **server-only, audited** | [V3R:update-token-details](https://developer.flutterwave.com/reference/update-token-details) |
| `POST /bulk-tokenized-charges` · `GET /bulk-tokenized-charges/:id` · `/:id/transactions` | `retry_strategy{retry_interval, retry_amount_variable, retry_attempt_variable, last_retry_attempt}`, `bulk_data` | Flutterwave retries on its own: do not use for exactly-once renewals | [create](https://developer.flutterwave.com/reference/create-bulk-tokenized-charge) · [status](https://developer.flutterwave.com/reference/get-bulk-tokenized-charges) · [txns](https://developer.flutterwave.com/reference/get-bulk-tokenized-charges-transactions) |
| `POST /accounts/tokenize` (NG e-mandate) · `GET/PUT /accounts/token/{reference}` | `account_bank, account_number, address, amount ≥200, email, phone_number, end_date`; PUT `status` ∈ ACTIVE, SUSPENDED, DELETED | | [create](https://developer.flutterwave.com/reference/generate-a-token) · [get](https://developer.flutterwave.com/reference/get-a-token) · [update](https://developer.flutterwave.com/reference/update-a-token) |

### 3.3 Transactions, verification, refunds
| Endpoint | Request | Notes | Source |
|---|---|---|---|
| `GET /transactions/:id/verify` | | `status`, `tx_ref`, `flw_ref`, `amount`, `charged_amount`, `app_fee`, `amount_settled`, `currency`, `customer{email}`, `card{token, first_6digits, last_4digits, expiry, issuer, country}` | [V3R:verify-transaction](https://developer.flutterwave.com/reference/verify-transaction) |
| `GET /transactions/verify_by_reference?tx_ref=` | | | [V3R:verify-transaction-with-tx_ref](https://developer.flutterwave.com/reference/verify-transaction-with-tx_ref) |
| `GET /transactions` | `from, to` (req), page, customer_email, status, tx_ref, customer_fullname, currency | | [V3R:get-all-transactions](https://developer.flutterwave.com/reference/get-all-transactions) |
| `GET /transactions/:id/events` | | timeline | [V3R:get-transaction-events](https://developer.flutterwave.com/reference/get-transaction-events) |
| `GET /transactions/fee` | `amount, currency` (req), `payment_type` ∈ card, debit_ng_account, mobilemoney, bank_transfer, ach_payment; `card_first6digits` | `fee, flutterwave_fee, stamp_duty_fee, merchant_fee` (collections only) | [V3R:get-transaction-fee](https://developer.flutterwave.com/reference/get-transaction-fee) |
| `POST /transactions/:id/refund` | `amount` (partial), `comments`, `callbackurl` | `data{id, flw_ref, amount_refunded, status, destination:"payment_source", meta.source}`; 3–15 working days | [V3R:transaction-refund](https://developer.flutterwave.com/reference/transaction-refund) |
| `GET /refunds/:id` · `GET /refunds` | list: from, to, status, currency, flw_ref, id | statuses seen: completed, completed-mpgs, failed | [get](https://developer.flutterwave.com/reference/get-transaction-refunds) · [list](https://developer.flutterwave.com/reference/get-all-refunds) |
| `POST /transactions/:id/resend-hook` | `?wait=1` returns our endpoint's response | | [V3R:resend-transaction-webhook](https://developer.flutterwave.com/reference/resend-transaction-webhook) |

### 3.4 Transfers and beneficiaries (v3)
| Endpoint | Request | Notes | Source |
|---|---|---|---|
| `POST /transfers` | `account_bank, account_number, amount, currency` (req); `debit_subaccount` (PSA `account_reference`), `debit_currency`, `reference`, `narration`, `callback_url`, `beneficiary` (id), `beneficiary_name`, `destination_branch_code` (GH etc.), `meta[]` (sender/beneficiary KYC for cash pickup, DOM, ZAR, M-Pesa: `sender, sender_country, first_name, last_name, mobile_number, email, recipient_address…`), `skip_beneficiary_creation` | `status:"NEW"`, `fee`, `requires_approval`, `is_approved`. Errors: duplicate ref, `complete_message` such as `"DISBURSE FAILED: You can only spend NGN 1000000.00 at once"`. Internal moves: `account_bank:"flutterwave"`, `account_number:<barter_id or merchant id>` | [V3R:create-a-transfer](https://developer.flutterwave.com/reference/create-a-transfer) |
| `GET /transfers` | reference, page, page_size, status, from, to, `include_proof` (session id), `include_provider_ref`, `include_approver_info`, `include_vat`, `include_date_completed`, `include_rate`, `include_debit_currency_amount` | | [V3R:get-all-transfers](https://developer.flutterwave.com/reference/get-all-transfers) |
| `GET /transfers/{id}` | | 404 "Transfer not found" | [V3R:get-a-transfer](https://developer.flutterwave.com/reference/get-a-transfer) |
| `POST /transfers/{id}/retries` · `GET /transfers/{id}/retries` | | retry gets a new reference `…_RETRY_n` | [retry](https://developer.flutterwave.com/reference/transfer-retry) · [list](https://developer.flutterwave.com/reference/get-a-transfer-retry) |
| `GET /transfers/fee` | `amount, currency` (NGN, USD, GHS, KES, UGX, RWF…), `type` mobilemoney|account | list of `{fee_type, currency, fee}` | [V3R:get-transfer-fee](https://developer.flutterwave.com/reference/get-transfer-fee) |
| `POST /bulk-transfers` · `GET /transfers?batch_id=` | `currency, bulk_data[]` (same as single), `title` | | [create](https://developer.flutterwave.com/reference/create-bulk-transfer) · [status](https://developer.flutterwave.com/reference/get-a-bulk-transfer) |
| `GET /transfers/rates` · `POST/GET /bulk-rates` | `amount, source_currency, destination_currency`; bulk `batch_reference` ≥20 chars | | [rates](https://developer.flutterwave.com/reference/check-transfer-rates) · [bulk](https://developer.flutterwave.com/reference/query-bulk-transfer-rates) · [verify bulk](https://developer.flutterwave.com/reference/query-bulk-transfer-rates-copy) |
| `POST/GET /beneficiaries`, `GET/DELETE /beneficiaries/{id}` | `account_bank, account_number, beneficiary_name`, currency, bank_name | `/transfers` creates beneficiaries automatically unless `skip_beneficiary_creation=1` | [create](https://developer.flutterwave.com/reference/create-a-beneficiary) · [list](https://developer.flutterwave.com/reference/list-all-beneficiaries) · [get](https://developer.flutterwave.com/reference/fetch-a-beneficiary) · [delete](https://developer.flutterwave.com/reference/delete-a-beneficiary) |

### 3.5 Payout subaccounts (PSA, v3 only)
| Endpoint | Request | Notes | Source |
|---|---|---|---|
| `POST /payout-subaccounts` | `account_name, email, country` (req; sample `"US"`), `mobilenumber` | `id, account_reference (PSA…), barter_id, nuban, bank_name "Flutterwave MFB", bank_code 090567, status ACTIVE` | [V3R:create-a-payout-subaccount](https://developer.flutterwave.com/reference/create-a-payout-subaccount) |
| `GET /payout-subaccounts` | filters **`email`, `account_reference`, `nuban`**, `limit`, `next_cursor` | lookup by NUBAN is supported | [V3R:fetch-all-payout-subaccounts-1](https://developer.flutterwave.com/reference/fetch-all-payout-subaccounts-1) |
| `GET /payout-subaccounts/{ref}` · `PUT /payout-subaccounts/{ref}` | PUT: `account_name, email, mobilenumber` (req), `country` | `400 "Account reference is Invalid"` | [get](https://developer.flutterwave.com/reference/fetch-a-payout-subaccount) · [update](https://developer.flutterwave.com/reference/update-a-payout-subaccount) |
| `GET /payout-subaccounts/:ref/balances` | `currency` — "Possible value is NGN" | | [V3R:fetch-available-balance-payout-subaccount](https://developer.flutterwave.com/reference/fetch-available-balance-payout-subaccount) |
| `GET /payout-subaccounts/:ref/transactions` | `from, to` (req), `currency` (NGN), `page`, `fetch_limit` | statement lines | [V3R:fetch-transactions-on-a-payout-sub-account](https://developer.flutterwave.com/reference/fetch-transactions-on-a-payout-sub-account) |
| `GET /payout-subaccounts/:ref/static-account` | `currency` ("Only NGN virtual accounts are currently supported"), `verbose=1` (all numbers) | | [V3R:fetch-static-virtual-accounts-payout-subaccount](https://developer.flutterwave.com/reference/fetch-static-virtual-accounts-payout-subaccount) |
| `DELETE /payout-subaccounts/:ref` | | async: "deactivation has been submitted for processing" | [V3R:delete-a-subaccount](https://developer.flutterwave.com/reference/delete-a-subaccount) |
| `POST /payout-subaccounts/refunds` | `funding_reference` (req), `debit_currency` | reverses a funding; "irreversible"; debits main if the PSA is short ([V3D:payout-subaccount](https://developer.flutterwave.com/docs/payout-subaccount)) | [V3R:initiate-wallet-refund](https://developer.flutterwave.com/reference/initiate-wallet-refund) |
| `GET /payout-subaccounts/refunds` | `status` SUCCESSFUL|PENDING|FAILED, `from, to` (YYYY-MM-DD), `reference` | | [V3R:query-wallet-reversals](https://developer.flutterwave.com/reference/query-wallet-reversals) |
| `POST /payout-subaccounts/{ref}/fund-account` (test only) | `currency, amount` | sandbox funding mock (guide only) | [V3D:payout-subaccount](https://developer.flutterwave.com/docs/payout-subaccount) |

Withdrawals and moves use `POST /transfers` with `debit_subaccount`. The `debit_subaccount` field text says "The `id` of a payout subaccount", but every sample passes the `account_reference` string (`PSA…`).

### 3.6 Virtual account numbers (v3)
| Endpoint | Request | Notes | Source |
|---|---|---|---|
| `POST /virtual-account-numbers` | `email`, `amount` (dynamic) (req); `currency` ∈ **NGN, GHS**; `is_permanent`, `expires` 60–5 270 401 s, `tx_ref`, `firstname`, `lastname`, `narration` (GHS: 35 chars), `bvn` (NGN static), `nin`, `phonenumber`, `bank_code` | `order_ref`, `flw_ref`, `account_number`, `bank_name`, `expiry_date`. Credits main | [V3R:create-a-virtual-account-number-1](https://developer.flutterwave.com/reference/create-a-virtual-account-number-1) |
| `POST /bulk-virtual-account-numbers` · `GET /bulk-virtual-account-numbers/:batch_id` | `batch_ref, bulk_data[{firstname, lastname, email, bvn, nin, is_permanent}]`, currency | queued | [create](https://developer.flutterwave.com/reference/create-bulk-virtual-account-numbers) · [get](https://developer.flutterwave.com/reference/get-bulk-virtual-account-details) |
| `GET /virtual-account-numbers/:order_ref` · `PUT …/:order_ref {bvn}` · `POST …/:order_ref {status: inactive|active}` | | reactivation only for NGN Flutterwave MFB accounts | [get](https://developer.flutterwave.com/reference/get-a-virtual-account-detail) · [bvn](https://developer.flutterwave.com/reference/update-bvn) · [status](https://developer.flutterwave.com/reference/deactivate-and-reactivate-virtual-accounts) |

GHS VAs: available to Ghana-registered merchants; others must ask for activation; an under- or over-payment **fails** ([V3D:ghs-virtual-accounts](https://developer.flutterwave.com/docs/ghs-virtual-accounts)).

### 3.7 Collection subaccounts (splits), payment plans, subscriptions
| Endpoint | Request | Notes | Source |
|---|---|---|---|
| `POST /subaccounts` | `account_bank, account_number, business_name, country, split_value, business_mobile` (req); `split_type` percentage|flat, `business_email`, `business_contact`, `meta[]` | `subaccount_id RS_…`; settles to a **bank account** | [V3R:create-a-sub-account](https://developer.flutterwave.com/reference/create-a-sub-account) |
| `GET /subaccounts`, `GET/PUT/DELETE /subaccounts/:id` | | | [list](https://developer.flutterwave.com/reference/fetch-all-subaccounts) · [get](https://developer.flutterwave.com/reference/fetch-a-single-subaccount) · [update](https://developer.flutterwave.com/reference/update-a-subaccount) · [delete](https://developer.flutterwave.com/reference/delete-a-subaccount-1) |
| `POST /payment-plans` | `amount, name, interval` (req), `duration` | | [V3R:create-payment-plan-1](https://developer.flutterwave.com/reference/create-payment-plan-1) |
| `GET /payment-plans`, `GET/PUT /payment-plans/:id`, `PUT /payment-plans/:id/cancel` | | | [list](https://developer.flutterwave.com/reference/get-payment-plans) · [get](https://developer.flutterwave.com/reference/get-a-payment-plan) · [update](https://developer.flutterwave.com/reference/update-a-payment-plan) · [cancel](https://developer.flutterwave.com/reference/cancel-a-payment-plan) |
| `GET /subscriptions`, `PUT /subscriptions/:id/cancel`, `PUT /subscriptions/:id/activate` | | `subscription.cancelled` webhook | [list](https://developer.flutterwave.com/reference/get-all-subscriptions) · [cancel](https://developer.flutterwave.com/reference/cancel-a-subscription-1) · [activate](https://developer.flutterwave.com/reference/activate-a-subscription-1) |

### 3.8 Chargebacks, settlements, balances (v3)
| Endpoint | Request | Notes | Source |
|---|---|---|---|
| `GET /chargebacks` | page, `status` ∈ lost, won, initiated, accepted, declined; from, to, currency, `flw_ref`, `id` | `meta.history[]` shows "Debit and hold chargeback amount", `source` availablebalance/ledgerbalance | [V3R:list-a-chargeback](https://developer.flutterwave.com/reference/list-a-chargeback) · [single](https://developer.flutterwave.com/reference/list-a-chargeback-1) |
| `PUT /chargebacks/{id}` | `action` accept|decline, `comment` (both req) | no proof field in the schema | [V3R:acceptdecline-a-chargeback](https://developer.flutterwave.com/reference/acceptdecline-a-chargeback) |
| `POST /upload_image` (multipart `image`) | | returns a hosted URL for chargeback proof | [V3R:upload-proof](https://developer.flutterwave.com/reference/upload-proof) |
| `GET /settlements` | page, from, to, `subaccount_id`, `disburse_ref` | status incl. `flagged`; `destination` e.g. `autowallet` | [V3R:get-all-settlements](https://developer.flutterwave.com/reference/get-all-settlements) |
| `GET /settlements/:id` | page | gross, app_fee, stampduty, net, `transactions[]` with `settlement_amount` | [V3R:get-a-settlement](https://developer.flutterwave.com/reference/get-a-settlement) |
| `GET /balances` · `GET /balances/:currency` | | `available_balance`, `ledger_balance` (merchant) | [all](https://developer.flutterwave.com/reference/get-all-wallet-balances) · [one](https://developer.flutterwave.com/reference/get-balances-per-currency) |
| `GET /wallet/statement` | `from, to, currency` (req), `type C|D`, page, `include_transaction_type`, `include_payout_id`, `payout_ref`, `payout_id` | `balance_before/after`, `reference`, `statement_type` | [V3R:get-balance-history](https://developer.flutterwave.com/reference/get-balance-history) |

### 3.9 Banks, resolve, identity (v3)
| Endpoint | Request | Notes | Source |
|---|---|---|---|
| `GET /banks/:country` | `include_provider_type=1` (bank vs mobile money) | | [V3R:get-all-banks](https://developer.flutterwave.com/reference/get-all-banks) |
| `GET /banks/:id/branches` | | `branch_code`, swift, bic | [V3R:get-bank-branches](https://developer.flutterwave.com/reference/get-bank-branches) |
| `POST /accounts/resolve` | `account_number, account_bank` (req); `country` (guide) | NG bank, GH bank, GH mobile money, Flutterwave merchant id ([V3D:bank-account-verification-1](https://developer.flutterwave.com/docs/bank-account-verification-1)) | [V3R:resolve-account-transfer-details](https://developer.flutterwave.com/reference/resolve-account-transfer-details) |
| `GET /card-bins/:bin` | | issuing country, card type, issuer | [V3R:resolve-card-bins](https://developer.flutterwave.com/reference/resolve-card-bins) |
| `POST /bvn/verifications` | `bvn` (11), `firstname`, `lastname` (req), `redirect_url` | `data.url` (single-use NIBSS consent page) or `null` if the user consented before; `reference` (25 chars). Needs approval by email ([V3D:bvn-verification](https://developer.flutterwave.com/docs/bvn-verification)) | [V3R:initiate-consent-request-for-bvn-verification](https://developer.flutterwave.com/reference/initiate-consent-request-for-bvn-verification) |
| `GET /bvn/verifications/{reference}` | `include_complete_message` | `status` COMPLETED, `bvn_data{bvn, nin, first/surname, dateOfBirth, phoneNumber1, email, gender, faceImage (base64), watchlisted, …}`; `bvn.completed` webhook | [V3R:retrieve-bvn-information](https://developer.flutterwave.com/reference/retrieve-bvn-information) |

No NIN, Ghana Card, Kenyan ID or SA ID endpoint exists in any version.

### 3.10 Bills, Remita, OTP, FX (v3)
| Endpoint | Notes | Source |
|---|---|---|
| `GET /top-bill-categories?country=NG`, `GET /bills/{category}/billers`, `GET /billers/{code}/items`, `GET /bill-items/{item}/validate?customer=`, `POST /billers/{code}/items/{item}/payment {country, customer_id, amount, reference, callback_url}`, `POST /bulk-bills`, `GET /bills/:reference?verbose=1`, `GET /bills/summary`, `GET /bills/history` (NG, GH, KE, ZM), data-bundle biller types | debits our balance; `singlebillpayment.status` webhook | [categories](https://developer.flutterwave.com/reference/get-supported-bill-categories) · [billers](https://developer.flutterwave.com/reference/get-biller-information) · [items](https://developer.flutterwave.com/reference/get-bill-information) · [validate](https://developer.flutterwave.com/reference/validate-customer-details) · [pay](https://developer.flutterwave.com/reference/create-a-bill-payment) · [bulk](https://developer.flutterwave.com/reference/create-bulk-bill-payment) · [status](https://developer.flutterwave.com/reference/get-status-of-a-bill-payment) · [summary](https://developer.flutterwave.com/reference/get-bill-payments-summary) · [history](https://developer.flutterwave.com/reference/get-bill-payments-history) · [data](https://developer.flutterwave.com/reference/biller-types-for-data-bundles) |
| Remita: `GET /billers`, `GET /billers/:code/products`, `GET /billers/:code/products/:product`, `POST /billers/:code/products/:product/orders`, `PUT /product-orders/:reference` | government payments | [agencies](https://developer.flutterwave.com/reference/get-bill-payment-agencies) · [products](https://developer.flutterwave.com/reference/get-products-under-a-agency) · [amount](https://developer.flutterwave.com/reference/get-amount-to-be-paid-for-a-product) · [order](https://developer.flutterwave.com/reference/create-order-using-billing-code-and-product-id) · [update](https://developer.flutterwave.com/reference/update-bills-order) |
| `POST /otps {length 5–7, customer{name,email,phone}, sender, send, medium[sms,email,whatsapp], expiry min}`, `POST /otps/{reference}/validate {otp}` | the create response **returns the OTP in clear** even when Flutterwave sends it; never expose that response to a client | [create](https://developer.flutterwave.com/reference/create-otp) · [validate](https://developer.flutterwave.com/reference/validate-otp-1) |
| FX: `POST /rfq {base_currency, target_currency, quantity, reference}`, `GET /rfq/{id}`, `POST /trades {quote_id, narration}`, `GET /trade/{id}` | treasury FX on our balances | [rfq](https://developer.flutterwave.com/reference/create-trade-quote) · [quote](https://developer.flutterwave.com/reference/check-quote-status) · [trade](https://developer.flutterwave.com/reference/create-trade) · [status](https://developer.flutterwave.com/reference/check-trade-status) |
| Introduction: REST, JSON, all endpoints need keys; status page | | [V3R:introduction-1](https://developer.flutterwave.com/reference/introduction-1) |

### 3.11 Webhooks (v3)
| Event | Shape | Source |
|---|---|---|
| `charge.completed` | `{event, "event.type", data{id, tx_ref, flw_ref, amount, charged_amount, app_fee, status, payment_type, customer, card}}` | [V3D:webhooks](https://developer.flutterwave.com/docs/webhooks) |
| `transfer.completed` | `data{id, account_number, bank_code, fullname, currency, debit_currency, amount, fee, status, reference, complete_message, requires_approval, is_approved}` | same |
| PSA funding (`transfer.completed`) | `debit_currency:"PSA"`, `narration:"WALLET FUNDING"`, `reference:"PSA_…"`, `meta{sender_account_number, sender_bank_code}`; enable "payout subaccounts wallet funding hook" under **v3 webhooks** | [V3D:payout-subaccount](https://developer.flutterwave.com/docs/payout-subaccount) |
| `subscription.cancelled`, `bvn.completed`, `singlebillpayment.status` | | [V3D:webhooks](https://developer.flutterwave.com/docs/webhooks) |
| Refund | no envelope: `{id, AmountRefunded, status, FlwRef, destination, settlement_id, meta, walletId, AccountId, TransactionId}` | same |
| Virtual card debit/OTP | separate shape (not used) | same |

Authentication: header `verif-hash` equals the secret hash you set (no HMAC); compare in constant time. Same delivery rules as v4 (200 only, 60 s, 3 retries 30 min apart). Flutterwave's IPs are dynamic: do not allowlist.

## 4. v2 (legacy Rave) — 109 pages

Endpoints under `/flwv3-pug/getpaidx/api/…` and `/v2/gpx/…`, with `seckey` in the body or query. Superseded by v3; only of historical interest. Two things matter: v2 had virtual cards (`/v2/services/virtualcards/*`), and the v2 subaccount, transfer, wallet-to-wallet and BVN-validation pages show nothing that v3 lacks. Nothing in v2 changes the design.

## 5. Errors (v4 codes worth handling)

| Code | Type | Handling |
|---|---|---|
| 10400 / 10422 | REQUEST_NOT_VALID / UNPROCESSABLE | bug; do not retry |
| 10401 | UNAUTHORIZED | refresh the OAuth token once, then alert |
| 10409, 1100409, 201409, 1900409 | conflict / CHARGE / transfer REFERENCE / VA reference ALREADY_EXISTS | look up by reference; never re-send with a new reference |
| 0301–0304, 228400 | transfer limits (single, monthly, daily) | fail the payout and alert |
| 0307 | INSUFFICIENT_BALANCE | reconciliation alert |
| 0306, 0308, 214400, 10500 | payout creation failed / service unavailable | **query by reference first** |
| 215400 | COMPLIANCE_APPROVAL_REQUIRED (merchant KYC) | ops |
| 216400–218400, 220400–223400 | transfers disabled, API transfers disabled, IP whitelisting, blacklisted IP/account | page on-call |
| 250400, 251400, 252400, 260400, 261400, 262400 | account verification / invalid / unknown bank / not supported / not CoP participant / account changed | ask the user to fix the payout account |
| 404400, 401400, 403400, 405400 | retry/duplicate rules | — |
| 1137400 / 11100 | CLIENT_ENCRYPTION_ERROR | — |
| 1402400–1404400 | refund amount / pending / already refunded | — |
| 1703400–1708400 | chargeback decline needs comment + proof, invalid proof, already exists | — |

Full lists: [V4D:common-errors](https://developer.flutterwave.com/v4.0.0/docs/common-errors). v3 errors are free-text `message`s: match on HTTP status and re-query, never on message text.

## 6. Coverage checklist

Status meanings: **read** = page fetched as `.md` and read; **read (shell)** = `.md` returned an HTML shell twice, content read from the page's embedded `ssr-props` JSON; **failed** = not retrievable after two tries.

**Indexes:** `https://developer.flutterwave.com/llms.txt` read · `https://developer.flutterwave.com/v4.0.0/llms.txt` read · `https://developer.flutterwave.com/v2.0.0/llms.txt` read · `https://developer.flutterwave.com/reference/` (sidebar, 122 links) read · `https://developer.flutterwave.com/sitemap.xml` **failed (404, three tries incl. `sitemap_index.xml` and `v4.0.0/sitemap.xml`)**.

**v3 reference, `https://developer.flutterwave.com/reference/<slug>` — read (85):** acceptdecline-a-chargeback, biller-types-for-data-bundles, capitec, charge-a-card, charge-nigerian-bank-accounts, charge-uk-bank-accounts, charge-via-ach-payment, charge-via-bank-transfer, charge-via-fawrypay, charge-via-francophone-mobile-money, charge-via-ghana-mobile-money, charge-via-mpesa, charge-via-nqr, charge-via-rwanda-mobile-money, charge-via-tanzania-mobile-money, charge-via-uganda-mobile-money, charge-via-ussd, charge-via-voucher-payment, charge-via-zambia-mobile-money, charge-with-token-1, checkout, check-quote-status, check-trade-status, check-transfer-rates, create-a-beneficiary, create-a-bill-payment, create-a-payout-subaccount, create-a-sub-account, create-a-transfer, create-a-virtual-account-number-1, create-bulk-bill-payment, create-bulk-tokenized-charge, create-bulk-transfer, create-bulk-virtual-account-numbers, create-otp, create-payment-plan-1, create-trade, create-trade-quote, delete-a-beneficiary, e-naira, fetch-a-beneficiary, fetch-all-payout-subaccounts-1, fetch-all-subaccounts, fetch-a-payout-subaccount, generate-a-token, get-a-bulk-transfer, get-all-refunds, get-all-settlements, get-all-subscriptions, get-all-transactions, get-all-transfers, get-all-wallet-balances, get-a-token, get-a-transfer, get-a-transfer-retry, get-balance-history, get-biller-information, get-bill-information, get-bill-payment-agencies, get-bill-payments-history, get-bill-payments-summary, get-payment-plans, get-supported-bill-categories, get-transaction-fee, get-transfer-fee, initiate-consent-request-for-bvn-verification, initiate-wallet-refund, introduction-1, list-a-chargeback, list-a-chargeback-1, list-all-beneficiaries, opay-charge, query-bulk-transfer-rates, query-bulk-transfer-rates-copy, query-wallet-reversals, resolve-account-transfer-details, retrieve-bvn-information, transfer-retry, update-a-payout-subaccount, update-a-token, upload-proof, validate-a-charge, validate-customer-details, validate-otp-1, verify-transaction-with-tx_ref.

**v3 reference — read (shell) (37):** activate-a-subscription-1, cancel-a-payment-plan, cancel-a-subscription-1, capture-preauth-charge, create-order-using-billing-code-and-product-id, deactivate-and-reactivate-virtual-accounts, delete-a-subaccount, delete-a-subaccount-1, fetch-a-single-subaccount, fetch-available-balance-payout-subaccount, fetch-static-virtual-accounts-payout-subaccount, fetch-transactions-on-a-payout-sub-account, get-all-banks, get-amount-to-be-paid-for-a-product, get-a-payment-plan, get-a-settlement, get-a-virtual-account-detail, get-balances-per-currency, get-bank-branches, get-bulk-tokenized-charges, get-bulk-tokenized-charges-transactions, get-bulk-virtual-account-details, get-products-under-a-agency, get-status-of-a-bill-payment, get-transaction-events, get-transaction-refunds, refund-preauth-charge, resend-transaction-webhook, resolve-card-bins, transaction-refund, update-a-payment-plan, update-a-subaccount, update-bills-order, update-bvn, update-token-details, verify-transaction, void-preauth-charge.

**v4 reference, `https://developer.flutterwave.com/v4.0.0/reference/<slug>` — read (58):** bank_account_resolve_post, bank_branches_get, banks_get, chargeback_put, chargebacks_get_by_id, chargebacks_list, chargebacks_post, charges_get, charges_list, charges_post, charges_put, customers_create, customers_get, customers_list, customers_put, customers_search, direct_transfers_post, fees_get, fetch_currency_wallet_balance, fetch_wallet_balances, get_wallet_statement, mobile_networks_get, orchestration_direct_charge_post, orchestration_direct_order_post, orders_get, orders_list, orders_post, orders_put, payment_methods_get, payment_methods_list, payment_methods_post, refund_completed_webhook, refunds_get, refunds_list, refunds_post, resend_webhook, settlement_get, settlement_list, transfer_get, transfer_post_retry, transfer_put, transfer_rates_get, transfer_rates_post, transfers_list, transfers_post, transfers_recipients_create, transfers_recipients_delete, transfers_recipients_get, transfers_recipients_list, transfers_senders_create, transfers_senders_delete, transfers_senders_get, transfers_senders_list, virtual_account_get, virtual_accounts_list, virtual_accounts_post, virtual_accounts_put, wallet_account_resolve_post.

**v2 reference, `https://developer.flutterwave.com/v2.0.0/reference/<slug>` — read (99):** account-verification, api-keys-1, api-request-and-response-standards, api-response, bank-account-debit-uk, bank-account-payments, bill-payments, bulk-charge, bulk-transfer, bvn-validation, cancel-payment-plan, capture, card-bin-check, card-payments, charge-with-token, create-a-transfer-recipient, create-a-virtual-account-number, create-a-virtual-card, create-order, create-payment-plan, create-subaccount, delete-a-subaccount, delete-recipient, exchange-rates, fetch-a-chargeback, fetch-a-payment-plan, fetch-a-settlement, fetch-a-subscription, fetch-card-transactions, fetch-recipients, fetch-transfers, freeze-unfreeze-a-card, fund-a-card, get-all-balances, get-all-refunds, get-applicable-transfer-fee, get-a-virtual-card, get-balance-history, get-bulk-charge-status, get-fees, get-transfer-balance, ghana-mobile-money, handling-timeouts-via-api, how-transfers-work, initiate-transfer, introduction, introduction-1, list-a-beneficiary, list-all-chargebacks, list-all-settlements, list-all-subscriptions, list-a-payment-plan, list-a-transfer, list-of-banks, list-of-banks-for-transfer, list-subaccount, list-transactions, list-virtual-cards, mobile-money-francophone, mpesa, pay-with-bank-transfer-nigeria, preauthorisation-using-a-charge-token, preauthorise-card-1, qr-code-payments, ratesforexinput, rave-encryption, rave-parameters, refund, refund-or-void, refundpost, resend-failed-webhooks, retrieve-status-of-bulk-transfer, rwanda-mobile-money, save-a-card, terminate-a-virtual-card, test-bank-accounts-1, test-cards-1, testinput, transaction-insights, transfer-retry, uganda-mobile-money, update-card-balance, update-email-for-a-token, update-order, update-subaccount, upload-image, us-ach-payments, ussd, validate-account-charge-1, validate-card-charge-1, validate-otp, virtual-account-numbers, voucher-payments-offline, wallet-to-wallet-transfers, webhooks, whatsapp-otpsms-api, withdraw-from-a-card, xrequery-transaction-verification, zambia-mobile-money.

**v2 reference — read (shell) (10):** accept-a-chargeback, activate-a-subscription, cancel-a-subscription, decline-a-chargeback, edit-payment-plan, fetch-subaccount, fetch-transfer-retries, get-refund-details, terminate-a-virtual-account-number, update-bvn.

**Supporting docs — read:** v3 `https://developer.flutterwave.com/docs/<slug>`: authentication, webhooks, rate-limit, common-errors, encryption, best-practices, payout-subaccount, virtual-account, ngn-virtual-accounts, ghs-virtual-accounts, split-payments, bvn-verification, bank-account-verification-1, introduction-7, transaction-verification, handling-error-timeouts, checksum, testing. v4 `https://developer.flutterwave.com/v4.0.0/docs/<slug>`: authentication, api-headers, encryption, common-errors, webhooks, idempotency, testing, best-practices, environments, settlements, refunds, chargebacks-1, wallet-to-wallet, pay-with-bank-transfer, mobile-money, mobile-money-1, bank-transfer, general-transfer-flow, direct-transfer-flow, main-payment-flow, payment-orchestrator-flow, card, stablecoins.

**Failed:** none apart from the sitemaps above.
