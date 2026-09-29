# Zudomart Dashboard — API contract

The Zudomart Dashboard (`apps/seller`, hosted at `https://dashboard.<domain>`) is a Backend-for-Frontend: the browser only talks to the dashboard's own `/bff/*` routes, and the dashboard's server calls the API below with the seller's bearer token. The API must add the dashboard origin (`DASHBOARD_ORIGIN`, e.g. `https://dashboard.zudomart.com`) to its CORS allow-list (`CORS_ORIGINS`). Today every call is server-to-server from the dashboard's `/bff` routes, but the origin must be allowed for any browser call and the payment callback flow.

## Conventions

- Base path: `/api/v1`. All seller-scoped resources live under `/api/v1/seller/...` and are scoped to the caller's store (the store the authenticated user is a member of). Every resource id taken from a path or body must be checked for ownership on the server.
- Auth: `Authorization: Bearer <accessToken>` (15 min). Refresh tokens rotate on every use; reuse of an old refresh token revokes the session.
- Shared-device cashiers: when a cashier has unlocked the register with their PIN, the BFF also sends `X-Seller-Operator: <operatorToken>`. The API must treat the operator's staff role as the effective role for that request (never more than the account's own role allows) and attribute actions (sales, shifts, refunds, audit log) to the operator's staff id.
- Store: `X-Seller-Store: <storeId>` is sent when someone who manages several stores has switched store in the top bar. The API must check the caller is a member of that store and scope everything to it; without it, use the caller's default store.
- Location: `X-Seller-Location: <locationId>` carries the location selected in the top bar. It is a default, never an authorisation: validate it belongs to the store.
- Money everywhere: `{ "amountMinor": integer, "currency": "NGN"|"GHS"|"KES"|"ZAR"|"GBP"|"EUR"|"USD" }` in the **store's** currency. Request bodies send amounts as `...Minor` integers; the server assumes the store currency and rejects anything else. Percentages are integer basis points (750 = 7.5%).
- Lists: `{ "data": T[], "nextCursor": string | null }`; query `cursor`, `limit` (default 25, max 200).
- Errors: `{ "message": string, "code": string, "issues"?: [{ "path", "message" }] }`. `401` only for missing/expired auth (the BFF signs the user out). Wrong PINs are `403 PIN_INCORRECT` or `423 PIN_LOCKED`. Validation is `400 VALIDATION_FAILED`.
- `Idempotency-Key` header (8–128 chars `[A-Za-z0-9_-]`) is **required** on: POS sales, refunds, payouts, stock adjustments and transfers, product imports, loyalty adjustments, order fulfilment. Replays return the original response with header `Idempotent-Replayed: true`.
- CSV endpoints return `text/csv; charset=utf-8` with `Content-Disposition: attachment; filename="..."`. Cells beginning with `= + - @` must be neutralised against formula injection.
- Types referenced below are TypeScript interfaces in `apps/seller/src/types/*.type.ts` (the source of truth for field names and shapes).
- Roles: `owner | admin | manager | cashier | inventory | support`. The permission each endpoint needs matches `apps/seller/src/config/rolePermissions.config.ts`; the API must enforce the same rules (deny by default).

## Auth (existing endpoints the dashboard relies on)

### POST /api/v1/auth/login
Body: `{ identifier: string (email, phone or username), password: string }`
Response 200: `{ accessToken, refreshToken, expiresIn, tokenType: "Bearer", user: CurrentUserDto, isNewUser }`
Errors: 401 INVALID_CREDENTIALS, 429

### POST /api/v1/auth/refresh
Body: `{ refreshToken }` → 200 `{ accessToken, refreshToken, expiresIn, tokenType }`. Errors: 401 INVALID_REFRESH_TOKEN, 401 REFRESH_TOKEN_REUSED (session revoked).

### POST /api/v1/auth/otp/send
Body: `{ destination: email|phone, purpose: "reset" }` → 200 `{ expiresIn }`. Used by "Forgot password?". Must not reveal whether an account exists; rate-limited.

### POST /api/v1/auth/otp/verify
Body: `{ destination, code: "6 digits", purpose: "reset" }` → 200 `{ otpToken }`. Errors: 400 (wrong/expired), 429. Locks after 5 failed attempts.

### POST /api/v1/auth/password/reset
Body: `{ otpToken, password }` → 200/204. Signs out every other session of the account. The dashboard keeps `otpToken` in a signed httpOnly cookie and never exposes it to the browser.

### POST /api/v1/auth/logout
Body: `{ refreshToken }` → 204.

### GET /api/v1/users/me
Response 200: CurrentUserDto (`id, name, username, email, avatarUrl, ...`).

## Access and Gold subscription

Dashboard access = a **verified** store on an **active or trialing Gold Pro or Gold Premium** subscription. Non-members see "apply in the app", unverified/pending/suspended/revoked stores see the verification page, verified stores without an active Gold plan see the plans page.

### GET /api/v1/seller/access
Permission: signed in (any user).
Response 200: `SellerAccess` (src/types/sellerAccess.type.ts)
```json
{
  "storeId": "store_… | null",
  "storeName": "string | null",
  "verification": { "status": "unverified|pending|verified|suspended|revoked", "color": "GOLD", "tier": "PRO|PREMIUM|null", "badgeVisible": true },
  "subscription": { "status": "trialing|active|past_due|cancelled|expired|suspended", "plan": "PRO|PREMIUM", "currentPeriodEnd": "ISO|null" } ,
  "entitlements": { "maxStaffSeats": 25, "maxLocations": 10, "reducedCommission": true, "priorityPlacement": true, "adCredits": { "amountMinor": 5000000, "currency": "NGN" }, "apiAccess": true },
  "role": "owner|admin|manager|cashier|inventory|support|null"
}
```
`subscription` and `entitlements` are `null` when the store has never subscribed. A user who is not a member of any store gets `storeId: null, role: null`.

### GET /api/v1/seller/verification
Permission: store member. Available before the store is active.
Response 200: `{ status: VerificationStatus, note: string|null, submittedAt: ISO|null, documents: [{ kind, label, status: "missing"|"in_review"|"approved"|"rejected" }] }`

### GET /api/v1/seller/subscription/plans
Permission: **public** (no token) — the dashboard's logged-out landing page shows Gold pricing. The dashboard forwards the visitor's `Accept-Language` and `X-Forwarded-For` so the API can price in the visitor's local currency. Response 200: `CursorPage<SubscriptionPlan>` where `SubscriptionPlan = { id, tier: "PRO"|"PREMIUM", price: Money, interval: "month"|"year", entitlements: GoldEntitlements, perks: [{ title, description }] }`. Perks are admin-configured; the UI never hardcodes them.

### GET /api/v1/seller/subscription
Permission: store member. Response 200: `SubscriptionDetails` (`subscription`, `planId`, `cancelAtPeriodEnd`, `paymentMethodSummary`, `provider`, `invoices: SubscriptionInvoice[]`).

### POST /api/v1/seller/subscription/checkout
Permission: billing:manage (owner). Body: `{ planId }`.
Response 201: `{ authorizationUrl, reference, provider: "paystack"|"flutterwave" }` — the provider's hosted page. The callback URL registered with the provider must be `${DASHBOARD_ORIGIN}/billing-checkout/callback` (Paystack appends `reference`/`trxref`; Flutterwave appends `tx_ref`).
Errors: 409 STORE_NOT_VERIFIED, 404 PLAN_NOT_FOUND. Switching plans uses the same endpoint.

### POST /api/v1/seller/subscription/verify
Permission: billing:manage. Body: `{ reference }`. The server verifies with the provider (never trusts the redirect) and activates the plan. Response 200: `SubscriptionDetails`. Errors: 404 PAYMENT_NOT_FOUND, 402 PAYMENT_NOT_SUCCESSFUL.

### POST /api/v1/seller/subscription/cancel
### POST /api/v1/seller/subscription/resume
Permission: billing:manage. Cancel sets `cancelAtPeriodEnd: true`; resume clears it. Response 200: `SubscriptionDetails`. Audit-logged.

## Cashier PIN sessions (never exposed to the browser; the BFF keeps the operator token in an httpOnly cookie)

### GET /api/v1/seller/staff/pin-roster
Permission: store member. Query: `locationId?`. Response 200: `CursorPage<{ staffId, name, role, locked }>` — active staff with a PIN at that location.

### POST /api/v1/seller/staff/pin-sessions
Permission: store member (the shared device's signed-in account). Body: `{ staffId, pin: "4–6 digits", registerId? }`.
Response 201: `{ operatorToken, operator: { staffId, name, role }, expiresAt }`.
Rules: PINs are hashed server-side (scrypt/argon2id), compared in constant time; 5 wrong attempts lock the PIN for 15 minutes. Errors: 403 PIN_INCORRECT (message includes tries left), 423 PIN_LOCKED.

### DELETE /api/v1/seller/staff/pin-sessions/current
Header `X-Seller-Operator`. Revokes the operator token. Response 204.


## Point of sale

Types: `apps/seller/src/types/pos.type.ts` (PosShift, PosSale, SaleRefund, ParkedSale, CreateSaleRequest, DiscountInput), `apps/seller/src/types/posExtra.type.ts` (PosCatalogSnapshot, DiscountApproval, PosPayLink, ReceiptShareResult, PinRosterEntry, PromotionCodeValidation), `store.type.ts` (PosRegister, StoreSettings), `catalog.type.ts`.
All money is `Money` in the store currency. Cashier identity is the PIN operator when the `X-Seller-Operator` header is present, otherwise the signed-in staff member. "Manage all shifts" = role with `pos:manage_all_shifts` (owner, admin, manager).

### GET /api/v1/seller/pos/registers
Permission: catalog:view
Query: locationId?: string; includeInactive?: "true" (default: only active registers)
Response 200: CursorPage<PosRegister> (openShiftId is the currently open shift or null)

### GET /api/v1/seller/pos/catalog
Permission: pos:sell
Query: locationId: string
Response 200: PosCatalogSnapshot `{ locationId, products: Product[] (status active, variants with stock per location), categories: ProductCategory[], settings: StoreSettings, generatedAt }`
Errors: 404 LOCATION_NOT_FOUND
Notes: the register caches this for offline use; keep it complete (not paginated). Future: `updatedSince` for deltas.

### GET /api/v1/seller/pos/shifts
Permission: pos:sell
Query: registerId?, status?: "open"|"closed", cursor?, limit? (≤200, default 20)
Response 200: CursorPage<PosShift>, newest first. Open shifts carry live totals and expectedCash.
Rules: without manage-all-shifts, only shifts the caller opened are returned.

### GET /api/v1/seller/pos/shifts/:shiftId
Permission: pos:sell
Response 200: PosShift
Errors: 404 SHIFT_NOT_FOUND, 403 SHIFT_NOT_YOURS

### POST /api/v1/seller/pos/shifts
Permission: pos:sell
Body: { registerId: string, openingFloatMinor: integer ≥ 0 }
Response 201: PosShift (status "open"; sets register.openShiftId)
Errors: 400 VALIDATION_FAILED, 404 REGISTER_NOT_FOUND, 409 SHIFT_ALREADY_OPEN

### POST /api/v1/seller/pos/shifts/:shiftId/cash-movements
Permission: pos:sell
Headers: Idempotency-Key required
Body: { kind: "pay_in"|"pay_out", amountMinor: integer > 0, reason: string 1–200 }
Response 201: PosShift (with live totals)
Errors: 400 VALIDATION_FAILED, 403 SHIFT_NOT_YOURS, 409 SHIFT_CLOSED, 409 NOT_ENOUGH_CASH (pay out above expected cash)

### POST /api/v1/seller/pos/shifts/:shiftId/close
Permission: pos:sell
Body: { countedCashMinor: integer ≥ 0, note?: string ≤ 500 }
Response 200: PosShift (status "closed", frozen totals, expectedCash, countedCash, cashVariance = counted − expected, closedBy/closedAt); clears register.openShiftId
Errors: 403 SHIFT_NOT_YOURS, 409 SHIFT_CLOSED
Rules: expectedCash = openingFloat + cash payments − cash refunds + pay-ins − pay-outs. Non-zero variance is audit-logged.

### GET /api/v1/seller/pos/sales
Permission: pos:sell
Query: from?, to? (YYYY-MM-DD, default last 30 days), locationId?, registerId?, cashierId?, status?: SaleStatus, paymentMethod?: PaymentMethod, q? (receipt number, customer name/phone), cursor?, limit?
Response 200: CursorPage<PosSale>, newest first
Rules: without manage-all-shifts, only the caller's own sales.

### GET /api/v1/seller/pos/sales/:saleId
Permission: pos:sell
Response 200: PosSale
Errors: 404 SALE_NOT_FOUND (also for sales the caller may not see)

### POST /api/v1/seller/pos/sales
Permission: pos:sell
Headers: Idempotency-Key required (the register sends clientSaleId as the key)
Body: CreateSaleRequest
- clientSaleId: [A-Za-z0-9_-]{8,128}; a second request with the same clientSaleId returns the existing sale (200)
- lines 1–200: { variantId, quantity 1–9999, discount: DiscountInput|null }
- cartDiscount: DiscountInput|null (percent value in basis points ≤ 10000; amount in minor units)
- couponCode?: string, loyaltyPointsToRedeem: integer ≥ 0, customerId?: string
- payments 1–10: { method: enabled PaymentMethod, amountMinor > 0, tenderedMinor (cash only, ≥ amountMinor), reference? ≤ 80 }
- offlineCreatedAt: ISO string when rung up offline, else null
Response 201: PosSale (server-assigned receiptNumber)
Errors: 400 VALIDATION_FAILED / INVALID_LINES / INVALID_QUANTITY / INVALID_DISCOUNT / INVALID_PAYMENT / INVALID_TENDER, 403 SHIFT_NOT_YOURS, 403 DISCOUNT_APPROVAL_REQUIRED, 404 SHIFT_NOT_FOUND / CUSTOMER_NOT_FOUND, 402 PAY_LINK_NOT_PAID, 409 SHIFT_CLOSED, 409 INSUFFICIENT_STOCK, 422 ITEM_NOT_AVAILABLE / REGISTER_MISMATCH / COUPON_INVALID / COUPON_USED_UP / COUPON_MINIMUM_NOT_MET / LOYALTY_REDEMPTION_INVALID / PAYMENT_METHOD_DISABLED / PAYMENT_TOTAL_MISMATCH
Server rules:
- Recompute every price, discount, coupon, loyalty redemption and tax on the server from current product prices and StoreSettings (same algorithm as `apps/seller/src/utils/posCartPricing.util.ts`); client totals are ignored.
- Sum of payment amounts must equal the server total (online sales). Offline sales (offlineCreatedAt set) are accepted even if prices changed since, and are accepted into a shift that was open at offlineCreatedAt.
- A line or cart discount above settings.discountApprovalThresholdBasisPoints needs discount.approvedByStaffId matching an unexpired approval from POST /discount-approvals, unless the cashier has pos:approve_discount.
- Online sales fail with INSUFFICIENT_STOCK when available (onHand − reserved) at the shift's location is too low; offline sales always decrement (stock may go negative and should be flagged).
- Decrement stock at the shift's location (shared with the online marketplace), update customer totals/loyalty (earn `floor(totalMajor × pointsEarnedPerMajorUnit)`, subtract redeemed points), increment coupon usage, and attach to the shift totals.
- pay_link / zudomart_wallet payments must reference a paid pay link for exactly that amount.

### GET /api/v1/seller/pos/sales/:saleId/refunds
Permission: pos:sell
Response 200: CursorPage<SaleRefund>

### POST /api/v1/seller/pos/sales/:saleId/refunds
Permission: pos:refund
Headers: Idempotency-Key required
Body: { kind: "refund"|"exchange", method: enabled PaymentMethod, reason: string 3–300, lines: [{ saleLineId, quantity ≥ 1, restock: boolean }] }
Response 201: SaleRefund
Errors: 400 VALIDATION_FAILED, 409 ALREADY_REFUNDED, 422 REFUND_QUANTITY_INVALID
Rules: refund amount per line = lineTotal × quantity / line.quantity (server computed); quantity ≤ quantity − refundedQuantity; restock returns units to the sale's location; sale status becomes partially_refunded/refunded; cash refunds reduce the shift's expected cash; audit-logged.

### POST /api/v1/seller/pos/sales/:saleId/share
Permission: pos:sell
Body: { channel: "email"|"sms"|"whatsapp", destination?: string (required email for email, phone for sms, optional phone for whatsapp) }
Response 200: ReceiptShareResult `{ url, message, channel, sentTo }` — the backend sends email/SMS itself; for WhatsApp the dashboard opens wa.me with `message`. `url` is a public, unguessable receipt link.
Errors: 400 VALIDATION_FAILED, 404 SALE_NOT_FOUND

### GET /api/v1/seller/pos/parked-sales
Permission: pos:sell
Query: registerId?
Response 200: CursorPage<ParkedSale>

### POST /api/v1/seller/pos/parked-sales
Permission: pos:sell
Body: { registerId, label: string 1–80, customerName?: string ≤ 80, itemsCount ≥ 1, totalMinor ≥ 0, cart: object (opaque register cart JSON, ≤ 60 KB) }
Response 201: ParkedSale
Errors: 400 VALIDATION_FAILED

### DELETE /api/v1/seller/pos/parked-sales/:parkedSaleId
Permission: pos:sell
Response 204 (called when a parked sale is recalled)
Errors: 404 PARKED_SALE_NOT_FOUND

### POST /api/v1/seller/pos/discount-approvals
Permission: pos:sell
Body: DiscountApprovalRequest `{ staffId, pin: 4–6 digits, discountMinor > 0, grossMinor ≥ discountMinor, reason: 1–200 }`
Response 201: DiscountApproval `{ approvalId, approvedBy: { id, name }, expiresAt }` (valid 10 minutes)
Errors: 400 VALIDATION_FAILED, 403 PIN_INCORRECT (never 401), 423 PIN_LOCKED (5 wrong PINs → 15 min lock, shared counter with PIN sign-in), 403 APPROVER_NOT_ALLOWED (approver lacks pos:approve_discount), 409 APPROVAL_NOT_NEEDED
Rules: PINs are stored hashed; audit-log approvals.

### POST /api/v1/seller/pos/pay-links
Permission: pos:sell
Body: { amountMinor > 0, clientSaleId }
Response 201: PosPayLink `{ reference, url, amount, status: "pending", expiresAt }` — buyer pays in the Zudomart app/wallet.

### GET /api/v1/seller/pos/pay-links/:reference
Permission: pos:sell
Response 200: PosPayLink (status "pending"|"paid"|"expired"; mark paid only after provider/wallet ledger confirmation)
Errors: 404 PAY_LINK_NOT_FOUND

### GET /api/v1/seller/staff/pin-roster (used by the register lock screen)
Permission: signed in store member
Query: locationId?
Response 200: CursorPage<PinRosterEntry> `{ staffId, name, role, locked }` — active staff with a PIN at that location. Never returns PIN data.

### Also consumed by the register (owned by other areas)
- GET /api/v1/seller/customers?q=&limit=8 → CursorPage<Customer>; POST /api/v1/seller/customers { name, phone?, email? } → Customer
- POST /api/v1/seller/promotions/validate-code { code, subtotalMinor, channel: "pos" } → PromotionCodeValidation
- POST /api/v1/seller/staff/pin-sessions and DELETE /api/v1/seller/staff/pin-sessions/current (via the dashboard's /bff/session/operator)


## Catalog, inventory and media

Types: `Product`, `ProductVariant`, `ProductCategory`, `StockAdjustment`, `StockTransfer` in `apps/seller/src/types/catalog.type.ts`; request/response shapes (`ProductUpsertRequest`, `ProductImportRequest`, `ProductImportResult`, `InventoryLevelRow`, `StockAdjustmentRequest`, `StockTransferRequest`, `MediaUploadSession`, `MediaRecord`) in `apps/seller/src/types/productRequests.type.ts`. Validation rules shared with the UI: `apps/seller/src/utils/productValidation.util.ts`. All Money is in the store currency; all amounts are integer minor units. Every mutation below is written to the audit log.

### GET /api/v1/seller/categories
Permission: catalog:view
Response 200: CursorPage<ProductCategory> (nextCursor null)

### GET /api/v1/seller/products
Permission: catalog:view
Query: q? (matches name, any variant SKU or barcode), categoryId?, variantId? (product that owns this variant), status? ("active"|"draft"|"archived"|"all"; default = active + draft), online? ("true"|"false"), stock? ("low"|"out", evaluated at locationId or across all locations), locationId?, sort? ("updated" default | "name" | "price_asc" | "price_desc" | "stock"), cursor?, limit? (1–200, default 25)
Response 200: CursorPage<Product>

### POST /api/v1/seller/products
Permission: products:manage
Body: ProductUpsertRequest — name 2–120; description ≤ 5000; categoryId one of the store's or null; status draft|active|archived; taxable/trackInventory/publishedOnline booleans; tags ≤ 20 × ≤ 30 chars (lower-cased, deduped by server); options ≤ 3 (name 1–30, 1–30 unique values of 1–40 chars); imageMediaIds ≤ 10 (media must be `ready` and owned by the store, or already on the product); variants 1–100: optionValues must pick exactly one value per option and combinations must be unique, sku /^[A-Za-z0-9._-]{1,64}$/ unique per store (case-insensitive), barcode null or 8–14 digits (13 digits must pass the EAN-13 check digit) unique per store, priceMinor ≥ 0, compareAtPriceMinor null or > priceMinor, costPriceMinor null or ≥ 0, lowStockThreshold 0–100000, openingStock [{locationId, quantity 0–1e6}] (create only; locations must belong to the store).
Server rules: variant title is derived from option values ("Default" when no options); publishedOnline is forced false unless status is active; stock starts at openingStock per location (0 elsewhere).
Response 201: Product
Errors: 400 VALIDATION_FAILED (issues[] with paths like `variants.2.sku`), 422 MEDIA_NOT_READY

### GET /api/v1/seller/products/:productId
Permission: catalog:view
Response 200: Product. Errors: 404 PRODUCT_NOT_FOUND

### PATCH /api/v1/seller/products/:productId
Permission: products:manage
Body: full ProductUpsertRequest (replacement semantics). Variants with `id` are updated in place and keep their stock; `id: null` creates a variant with 0 stock; omitted variants are deleted.
Server rules: stock is never changed by this endpoint (use adjustments/transfers); deleting a variant that still has non-zero stock is refused.
Response 200: Product
Errors: 400 VALIDATION_FAILED, 404 PRODUCT_NOT_FOUND / VARIANT_NOT_FOUND, 409 VARIANT_HAS_STOCK, 422 MEDIA_NOT_READY

### DELETE /api/v1/seller/products/:productId
Permission: products:manage
Archives (status archived, unpublished); never hard-deletes because sales reference it.
Response 200: Product

### POST /api/v1/seller/products/:productId/publish
### POST /api/v1/seller/products/:productId/unpublish
Permission: products:manage
Body: {}
Rules: publish requires status active and at least one image. Online listings and the register share one stock.
Response 200: Product. Errors: 409 PRODUCT_NOT_ACTIVE, 409 PRODUCT_NEEDS_IMAGE

### POST /api/v1/seller/products/bulk
Permission: products:manage
Body: { action: "publish"|"unpublish"|"archive", productIds: string[1..200] }
Rules: products that cannot be published (not active or no image) are skipped, not failed.
Response 200: { updatedProductIds: string[] }

### POST /api/v1/seller/products/barcodes
Permission: products:manage
Body: { count: 1–100 }
Response 200: { barcodes: string[] } — valid EAN-13 in the in-store range (prefix 2), unique across the store at generation time (not reserved; uniqueness is re-checked on save).

### GET /api/v1/seller/products/export
Permission: catalog:view
Query: locationId? (opening_stock column = on hand there; all locations when omitted)
Response 200: text/csv (Content-Disposition attachment) with header `product_name,description,category,option1_name,option1_value,option2_name,option2_value,sku,barcode,price,compare_at_price,cost_price,low_stock_threshold,opening_stock,taxable,published_online`, one row per variant, prices as major-unit decimals in the store currency. Cells beginning with = + - @ must be prefixed with ' (CSV injection).

### POST /api/v1/seller/products/import
Permission: products:manage
Headers: Idempotency-Key required
Body: ProductImportRequest { locationId, rows: ProductImportRow[1..2000] } — all row cells are strings as typed in the CSV; prices are major-unit decimals in the store currency.
Rules: a row whose SKU matches an existing variant updates its price, cost price and low-stock threshold; other rows are grouped by product_name into new products (option columns become options, category by name, opening_stock to locationId); a new name that equals an existing product name fails; any invalid variant fails the whole group. Failed rows are reported, valid ones still commit.
Response 200: ProductImportResult { created, updated, failed: [{row, message}] }
Errors: 400 INVALID_LOCATION / INVALID_ROWS / IDEMPOTENCY_KEY_REQUIRED

### GET /api/v1/seller/inventory/levels
Permission: inventory:manage
Query: locationId (defaults to X-Seller-Location, then the default location), q?, lowStockOnly? ("true" = onHand ≤ lowStockThreshold), cursor?, limit? (default 50)
Response 200: CursorPage<InventoryLevelRow> — available = onHand − reserved (reserved = units held for paid online orders); stockValue = costPrice × max(onHand, 0). Archived and untracked products are excluded.

### GET /api/v1/seller/inventory/adjustments
Permission: inventory:manage
Query: locationId?, reason?, q?, cursor?, limit?
Response 200: CursorPage<StockAdjustment> (newest first)

### POST /api/v1/seller/inventory/adjustments
Permission: inventory:manage
Headers: Idempotency-Key required
Body: StockAdjustmentRequest { locationId, reason: "received"|"count"|"damaged"|"theft"|"returned"|"expired"|"other", note ≤ 500 (required for theft and other), lines: [{variantId, quantityDelta ≠ 0, |x| ≤ 1e6}] 1–200, unique variants }
Rules: applied atomically; a line may not take on-hand below zero unless reason is "count"; updates the single shared stock used by POS and online.
Response 201: CursorPage<StockAdjustment> (the created adjustments, nextCursor null)
Errors: 400 VALIDATION_FAILED, 409 INSUFFICIENT_STOCK

### GET /api/v1/seller/inventory/transfers
Permission: inventory:manage
Query: status? ("in_transit"|"received"|"cancelled"), cursor?, limit?
Response 200: CursorPage<StockTransfer>

### POST /api/v1/seller/inventory/transfers
Permission: inventory:manage
Headers: Idempotency-Key required
Body: StockTransferRequest { fromLocationId ≠ toLocationId, lines: [{variantId, quantity > 0}] 1–200 unique, note ≤ 500 }
Rules: stock leaves the source immediately (status in_transit, not sellable anywhere); refuses if the source has less than requested. Server assigns reference TRF-####.
Response 201: StockTransfer. Errors: 400 VALIDATION_FAILED, 409 INSUFFICIENT_STOCK

### POST /api/v1/seller/inventory/transfers/:transferId/receive
### POST /api/v1/seller/inventory/transfers/:transferId/cancel
Permission: inventory:manage
Headers: Idempotency-Key required
Rules: only from in_transit; receive adds the quantities to the destination, cancel returns them to the source.
Response 200: StockTransfer. Errors: 404 TRANSFER_NOT_FOUND, 409 TRANSFER_ALREADY_FINISHED

### POST /api/v1/media/uploads
Permission: media:upload
Body: { fileName 1–200, mimeType "image/jpeg"|"image/png"|"image/webp"|"image/avif", sizeBytes 1..15 MiB, purpose: "product", sha256?: 64 lowercase hex of the whole file }
Response 201: MediaUploadSession { uploadId, chunkSizeBytes (the dashboard handles any size; mock uses 1 MiB — keep ≤ 8 MiB because the dashboard BFF caps request bodies at 12 MiB), totalChunks, uploadedChunks: number[] (for resuming) }
Errors: 413 FILE_TOO_LARGE, 415 UNSUPPORTED_MEDIA_TYPE

### PUT /api/v1/media/uploads/:uploadId/chunks/:chunkIndex
Permission: media:upload
Headers: Content-Type: application/octet-stream; X-Chunk-Sha256: hex SHA-256 of this chunk
Body: raw bytes; every chunk is exactly chunkSizeBytes except the last.
Response 200: { uploadId, uploadedChunks: number[] } — idempotent per index (re-sending a chunk replaces it).
Errors: 400 INVALID_CHUNK_INDEX / CHUNK_SIZE_MISMATCH, 404 UPLOAD_NOT_FOUND, 422 CHUNK_CHECKSUM_MISMATCH (the client retries with backoff)

### POST /api/v1/media/uploads/:uploadId/complete
Permission: media:upload
Body: {}
Rules: all chunks present; whole-file sha256 must match if it was declared; magic bytes must match mimeType; server then processes (AVIF/WebP renditions) asynchronously.
Response 200: { mediaId, status: "processing"|"ready" }
Errors: 409 UPLOAD_INCOMPLETE, 415 FILE_TYPE_MISMATCH, 422 FILE_CHECKSUM_MISMATCH

### GET /api/v1/media/:mediaId
Permission: media:upload
Response 200: MediaRecord { mediaId, status, url (null until ready; must be an https origin allowed by the dashboard CSP via SELLER_MEDIA_URL), mimeType }. The dashboard polls every second (up to 20 s) until ready.


## Orders, returns and disputes (online marketplace)

Types: `OnlineOrder`, `ReturnRequest`, `OrderDispute` in `apps/seller/src/types/order.type.ts`. All resources are scoped to the caller's store; any id from another store returns 404. Mutations are written to the audit log.

### GET /api/v1/seller/orders
Permission: orders:view
Query: status? (OnlineOrderStatus | "all"), q? (order number, buyer name or username), from? / to? (YYYY-MM-DD, inclusive, store timezone), cursor?, limit? (1–200, default 25)
Response 200: `CursorPage<OnlineOrder> & { countsByStatus: Record<OnlineOrderStatus, number> }` newest first.
Errors: 400 VALIDATION_FAILED (unknown status).

### GET /api/v1/seller/orders/:orderId
Permission: orders:view
Response 200: `OnlineOrder`. Errors: 404 ORDER_NOT_FOUND.

### POST /api/v1/seller/orders/:orderId/fulfilment
Permission: orders:manage
Headers: Idempotency-Key required (replay returns the stored response with `Idempotent-Replayed: true`).
Body: courier: string 2–60; trackingNumber: string /^[A-Za-z0-9-]{4,40}$/; trackingUrl: https URL ≤300 | null; fromLocationId: active location id of the store.
Response 200: `OnlineOrder` with status "shipped" and `fulfilment` set.
Errors: 400 VALIDATION_FAILED, 404 ORDER_NOT_FOUND, 409 ORDER_NOT_SHIPPABLE (status not paid/processing).
Rules: stock for the lines was reserved at checkout; on ship reduce both onHand and reserved at fromLocationId (shared online/in-store stock). Notify the buyer. Escrow stays held until delivery confirmation or auto-release.

### POST /api/v1/seller/orders/:orderId/cancel
Permission: orders:manage
Body: reason: string 5–500 (shown to buyer)
Response 200: `OnlineOrder` (status "cancelled", escrowStatus "refunded").
Errors: 404 ORDER_NOT_FOUND, 409 ORDER_NOT_CANCELLABLE (already shipped or later).
Rules: full escrow refund to buyer through the ledger; release reserved stock.

### GET /api/v1/seller/returns
Permission: orders:view
Query: status? (ReturnRequestStatus | "all"), q?, cursor?, limit?
Response 200: `CursorPage<ReturnRequest>`.

### POST /api/v1/seller/returns/:returnId/approve
Permission: orders:manage. Body: {} . Response 200: `ReturnRequest` (status "approved").
Errors: 404 RETURN_NOT_FOUND, 409 RETURN_STATE_CONFLICT (only from "requested").

### POST /api/v1/seller/returns/:returnId/decline
Permission: orders:manage. Body: note: string ≥5 (shown to buyer). Response 200: `ReturnRequest` (status "declined").
Errors: 400 VALIDATION_FAILED, 404, 409 RETURN_STATE_CONFLICT.

### POST /api/v1/seller/returns/:returnId/receive
Permission: orders:manage
Body: restock: boolean; locationId: location id (required when restock is true)
Response 200: `ReturnRequest` (status "refunded").
Errors: 400 VALIDATION_FAILED, 404, 409 RETURN_STATE_CONFLICT (only from "approved").
Rules: refund `refundAmount` to the buyer from escrow/wallet via the ledger (idempotent per return); if restock, add returned quantities back to onHand at locationId.

### GET /api/v1/seller/disputes
Permission: orders:view. Query: status?, cursor?, limit?. Response 200: `CursorPage<OrderDispute>`.

### GET /api/v1/seller/disputes/:disputeId
Permission: orders:view. Response 200: `OrderDispute`. Errors: 404 DISPUTE_NOT_FOUND.

### POST /api/v1/seller/disputes/:disputeId/responses
Permission: orders:manage
Body: body: string 10–2000
Response 201: `OrderDispute` with the new message (from "seller") appended and status "under_review".
Errors: 400 VALIDATION_FAILED, 404, 409 DISPUTE_CLOSED.

## Customers (CRM)

Types: `Customer`, `CustomerPurchase` in `apps/seller/src/types/customer.type.ts`.

### GET /api/v1/seller/customers
Permission: customers:view (cashiers use it for POS lookup)
Query: q? (name, phone, email, username), tag?, sort? ("recent" default | "spend" | "name"), cursor?, limit? (POS uses 8)
Response 200: `CursorPage<Customer>`.

### POST /api/v1/seller/customers
Permission: customers:view (POS quick-create)
Body: name: string 2–80; phone?: string (+?digits, 7–19) | null; email?: email | null; tags?: string[] (≤10, /^[a-z0-9-]{1,24}$/); marketingOptIn?: boolean
Response 201: `Customer` (totals zero in the store currency).
Errors: 400 VALIDATION_FAILED; 409 CUSTOMER_EXISTS with body `{ message, code, customer: Customer }` when the phone (normalised, 0→234) or email already belongs to a customer of this store.

### GET /api/v1/seller/customers/export
Permission: customers:manage. Query: same filters as the list.
Response 200: text/csv (Content-Disposition attachment) — Name, Phone, Email, Zudomart username, Tags, Loyalty points, Total spent (major units), Currency, Purchases, Last purchase, Marketing opt-in. Cells beginning with = + - @ are prefixed with ' to prevent formula injection.

### GET /api/v1/seller/customers/:customerId
Permission: customers:manage. Response 200: `Customer`. Errors: 404 CUSTOMER_NOT_FOUND.

### PATCH /api/v1/seller/customers/:customerId
Permission: customers:manage. Body: same fields as POST (full profile). Response 200: `Customer`.
Errors: 400, 404, 409 CUSTOMER_EXISTS.

### GET /api/v1/seller/customers/:customerId/purchases
Permission: customers:manage. Query: cursor?, limit? (default 20)
Response 200: `CursorPage<CustomerPurchase>` merging POS sales (kind "pos_sale", reference = receipt number) and online orders (kind "online_order", matched by the buyer's Zudomart account), newest first.

### POST /api/v1/seller/customers/:customerId/notes
Permission: customers:manage. Body: body: string 2–1000. Response 201: `Customer` (note prepended, author = acting staff).

### POST /api/v1/seller/customers/:customerId/loyalty-adjustments
Permission: customers:manage
Headers: Idempotency-Key required
Body: pointsDelta: non-zero integer (|x| ≤ 1,000,000); reason: string 3–200
Response 200: `Customer`.
Errors: 400 VALIDATION_FAILED, 404, 422 POINTS_BELOW_ZERO.
Rules: points ledger entry + audit log; earn/redeem rules come from `StoreSettings.loyalty`.

## Promotions

Types: `Promotion` in `apps/seller/src/types/promotion.type.ts`; validation mirrors `apps/seller/src/utils/promotionValidation.util.ts`.

### GET /api/v1/seller/promotions
Permission: promotions:manage. Query: status? (PromotionStatus | "all"), q?, cursor?, limit?
Response 200: `CursorPage<Promotion>`. Status is derived at read time: "disabled" if switched off, else "scheduled" before startsAt, "expired" after endsAt or when usedCount ≥ usageLimit, otherwise "active".

### POST /api/v1/seller/promotions
Permission: promotions:manage
Body (PromotionInput): name 3–80; kind "coupon" | "automatic" | "scheduled_sale"; code (coupon only) /^[A-Z0-9_-]{3,24}$/ (server upper-cases; unique per store); discount {kind:"percent", value: basis points 1–10000} | {kind:"amount", value: minor units ≥1 in the store currency}; scope {kind:"all"|"products"|"categories", ids: string[] (required unless all)}; minimumSpendMinor: integer ≥0 | null; usageLimit: integer ≥1 | null; usageLimitPerCustomer: integer ≥1 | null; channels: non-empty subset of ["online","pos"]; startsAt ISO; endsAt ISO | null (> startsAt; required for scheduled_sale)
Response 201: `Promotion`.
Errors: 400 VALIDATION_FAILED (issues per field), 409 COUPON_CODE_TAKEN.

### GET /api/v1/seller/promotions/:promotionId
Permission: promotions:manage. Response 200: `Promotion`. Errors: 404 PROMOTION_NOT_FOUND.

### PATCH /api/v1/seller/promotions/:promotionId
Permission: promotions:manage
Body: any subset of PromotionInput fields, plus optional status: "disabled" (switch off) | "active" (switch back on; real status re-derived from the schedule).
Response 200: `Promotion`. Errors: 400, 404, 409 COUPON_CODE_TAKEN.

### DELETE /api/v1/seller/promotions/:promotionId
Permission: promotions:manage. Response 204. Past orders keep their applied discount.

### POST /api/v1/seller/promotions/validate-code
Permission: pos:sell (called by the POS; online checkout uses the same logic server-side)
Body: code: string (case-insensitive); subtotalMinor: integer ≥0 (cart subtotal after line discounts, store currency); channel: "pos" | "online"
Response 200: `{ promotionId, code, discount: {kind, value}, scope: {kind, ids}, discountMinor, message }` — discountMinor is an estimate on the whole subtotal; the sale endpoint must recompute on eligible lines.
Errors: 400 VALIDATION_FAILED; 404 COUPON_NOT_FOUND; 422 COUPON_NOT_APPLICABLE with a human message (switched off, not started, expired/usage limit reached, wrong channel, below minimum spend).
Rules: never trust the client's discount — POST /seller/pos/sales and online checkout re-validate the code, per-customer limits and scope, and increment usedCount atomically.


## Dashboard, reports, wallet and payouts

Types: `apps/seller/src/types/dashboard.type.ts`, `report.type.ts`, `wallet.type.ts`, `walletExtra.type.ts`; report kinds in `apps/seller/src/constants/reportCatalog.constant.ts`. All Money is in the store currency. Dates in query strings are `YYYY-MM-DD` store-local dates (store `timezone`), inclusive.

### GET /api/v1/seller/dashboard
Permission: dashboard:view
Query: locationId?: string | "all" (default all). Must be one of the store's locations.
Response 200: DashboardSummary
- salesToday / salesThisWeek (rolling 7 days) / salesThisMonth (rolling 30 days): `current` vs `previous` (the same length period immediately before), `transactionsCount` = distinct POS sales + online orders.
- Revenue = POS sale line totals net of refunded quantities (voided excluded) + online order line subtotals (cancelled/refunded excluded; shipping excluded). When a location is given, POS figures are for that location; online orders are store-wide and still included.
- ordersByStatus: count per OnlineOrderStatus for the whole store.
- channelSplit and dailyRevenue (exactly 30 points, oldest first, zero-filled): last 30 days split pos/online.
- topProducts: top 6 by revenue in the last 30 days.
- lowStockAlerts: up to 12 variants where onHand − reserved ≤ lowStockThreshold at the location (or any location when "all"), active tracked products only, lowest first.
- balances: WalletBalances, or null when the caller's effective role lacks wallet:view.
- recentActivity: 8 newest POS sales and online orders merged.
Errors: 400 VALIDATION_FAILED (unknown locationId), 403 FORBIDDEN.

### GET /api/v1/seller/reports/:reportKind
Permission: reports:view
Path: reportKind ∈ sales-by-day | sales-by-product | sales-by-category | sales-by-staff | sales-by-payment-method | sales-by-location | tax | inventory-valuation | shifts
Query: from?: date (default today − 29 days), to?: date (default today), max span 366 days, from ≤ to; locationId?: string | "all"; channel?: "all" | "pos" | "online" (ignored by sales-by-staff, inventory-valuation, shifts); format?: "csv".
Response 200 (JSON): ReportResult { reportKind, title, from, to, columns: ReportColumn[], rows: Record<string, string|number|Money|null>[], totals: same | null, generatedAt }
- Column kinds: text, money (Money object), number, percent (integer basis points, 750 = 7.5%), date (YYYY-MM-DD or ISO timestamp).
- Filter rule: when a locationId is set and channel is "all" or "pos", online orders are excluded (they are not tied to a shop); channel "online" always shows online orders.
- sales-by-day: one row per day in range (zero-filled): date, transactions, items, pos, online, revenue.
- sales-by-product: product, category, units, revenue, cost (variant cost price × units), grossProfit, margin.
- sales-by-category: category, units, revenue, share.
- sales-by-staff (POS only): staff, transactions, items, revenue, averageSale.
- sales-by-payment-method: method (captured POS payments by method; online orders as "Online checkout (escrow)"), transactions, amount, share.
- sales-by-location: location (online as "Online marketplace"), transactions, items, revenue, share.
- tax: one row per store tax rate: taxName, rate, taxableSales (net of tax), taxCollected, grossSales; plus an "Exempt (not taxable)" row. Tax per line = the tax stored on the POS sale line; for online orders compute with the product's rate (category-specific rate, else default) honouring settings.pricesIncludeTax.
- inventory-valuation (point in time, dates ignored): product, variant, sku, location, onHand, unitCost, costValue, retailValue, potentialProfit per variant × location (filtered by locationId).
- shifts: openedAt, location, register, cashier, status, sales, netSales, expectedCash, countedCash, variance (shifts opened within range).
Response 200 (format=csv): `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="<kind>_<from>_<to>.csv"`; money columns as decimal major units with the currency code in the header (e.g. `Revenue (NGN)`), percent as decimal percent; totals row last. CSV cells starting with = + - @ must be neutralised.
Errors: 400 VALIDATION_FAILED (bad dates/channel/location), 404 REPORT_NOT_FOUND.

### GET /api/v1/seller/wallet/balances
Permission: wallet:view
Response 200: WalletBalances { escrow, pending, available, nextEscrowReleaseAt }. Balances come only from the ledger.

### GET /api/v1/seller/wallet/transactions
Permission: wallet:view
Query: kind?: WalletTransactionKind; from?: date; to?: date; cursor?; limit? (≤ 200, default 25)
Response 200: CursorPage<WalletTransaction>, newest first.

### GET /api/v1/seller/wallet/statements
Permission: wallet:view
Query: month: `YYYY-MM` (required)
Response 200: text/csv (`wallet-statement-<month>.csv`) columns Date, Description, Reference, Type, Balance, Direction, Amount (<CUR>) — debits negative, oldest first.
Errors: 400 VALIDATION_FAILED.

### GET /api/v1/seller/wallet/payout-settings
Permission: wallet:view
Response 200: WalletPayoutSettings { minimumPayout: Money, fee: Money, schedule: string }

### GET /api/v1/seller/wallet/payouts
Permission: wallet:view
Query: cursor?, limit?
Response 200: CursorPage<Payout>, newest first.

### POST /api/v1/seller/wallet/payouts
Permission: wallet:withdraw (owner only)
Headers: Idempotency-Key required (replays return the original response with `Idempotent-Replayed: true`)
Body: { amountMinor: integer > 0, ≥ minimumPayout, accountId: string (one of the store's verified payout accounts) }
Response 201: Payout (status "processing")
Server rules: fee is charged on top; amount + fee ≤ available (row-locked ledger transaction); writes debit ledger entries for the payout and the fee on the available bucket; audit log `payout.requested`; provider transfer runs async and updates status to paid/failed (failed → reversal credit).
Errors: 400 VALIDATION_FAILED / IDEMPOTENCY_KEY_REQUIRED, 403 FORBIDDEN, 422 INSUFFICIENT_AVAILABLE_BALANCE.

### GET /api/v1/seller/wallet/banks
Permission: wallet:view
Response 200: CursorPage<WalletBank { code, name }> for the store's country (from the payment provider's bank list).

### GET /api/v1/seller/wallet/payout-accounts
Permission: wallet:view
Response 200: CursorPage<PayoutAccount>. Account numbers and names are only ever returned masked (e.g. `******4471`, `IFE LIFE***LE LTD`). Full numbers are stored encrypted (DATA_ENCRYPTION_KEY) and never returned.

### POST /api/v1/seller/wallet/payout-accounts/resolve
Permission: wallet:withdraw
Body: { bankCode: string (from /banks), accountNumber: string — country rule: NG NUBAN 10 digits; GH 10–16 digits; KE 8–16; ZA 9–12; others 6–34 alphanumerics }
Response 200: ResolvedPayoutAccount { resolutionId, bankCode, bankName, accountNameMasked, accountNumberMasked } — resolutionId valid 10 minutes, single use; the full number stays server-side with the resolution.
Errors: 400 VALIDATION_FAILED, 422 ACCOUNT_NOT_RESOLVED.

### POST /api/v1/seller/wallet/payout-accounts
Permission: wallet:withdraw
Headers: Idempotency-Key required
Body: { resolutionId: string }
Response 201: PayoutAccount (first account becomes default). Audit `payout_account.added`. The backend should require the resolved name to match the verified business/owner name.
Errors: 409 ACCOUNT_EXISTS, 422 RESOLUTION_EXPIRED.

### PATCH /api/v1/seller/wallet/payout-accounts/:accountId
Permission: wallet:withdraw
Body: { isDefault: true }
Response 200: PayoutAccount (all others lose default).
Errors: 400 VALIDATION_FAILED, 404 ACCOUNT_NOT_FOUND.

### DELETE /api/v1/seller/wallet/payout-accounts/:accountId
Permission: wallet:withdraw
Response 204. Audit `payout_account.removed`.
Errors: 404 ACCOUNT_NOT_FOUND, 409 DEFAULT_ACCOUNT (must set another default first when more than one), 409 PAYOUT_IN_PROGRESS.


## Store settings, locations, registers, staff and audit log

Types: `StoreSettings`, `StoreLocation`, `PosRegister`, `TaxRate`, `ReceiptTemplate`, `PaymentMethodSetting`, `LoyaltyRules`, `NotificationPreferences` (src/types/store.type.ts); `StaffMember`, `AuditLogEntry` (src/types/staff.type.ts); `CursorPage<T>`, `ApiErrorBody` (src/types/pagination.type.ts). Every endpoint is scoped to the caller's store (from the access token; operator token in `X-Seller-Operator` overrides the acting staff member and role). Every write below appends an audit log entry (actor, action, target, summary, IP).

### GET /api/v1/seller/settings
Permission: settings:view (every store role; the register also reads it)
Response 200: StoreSettings

### PATCH /api/v1/seller/settings
Permission: settings:manage (owner, admin)
Body: partial StoreSettings. Editable keys only: name (2–80), description (≤500), phone (E.164-ish), email, address (5–200), taxes (TaxRate[] ≤20: id [A-Za-z0-9_-]{1,40} unique, name 1–40, rateBasisPoints int 0–10000, isDefault bool, appliesToCategoryIds null | non-empty array of existing category ids; exactly one default and the default has appliesToCategoryIds null), pricesIncludeTax bool, receipt (ReceiptTemplate: showLogo, showCashierName bool; headerText ≤120, footerText ≤200, returnPolicy ≤400; paperWidth "58mm"|"80mm"), paymentMethods (PaymentMethodSetting[] — each method at most once, label 1–40, instructions null|≤300, at least one enabled), discountApprovalThresholdBasisPoints int 0–10000, loyalty (enabled bool, pointsEarnedPerMajorUnit int 0–1000, redeemValuePerPoint Money in the store currency with amountMinor int 0–10,000,000, minimumPointsToRedeem int 0–1,000,000), notifications (all NotificationPreferences keys, booleans).
Read-only (rejected with 400 if sent): storeId, handle, logoUrl, country, currency, timezone, locale — these come from verification.
Response 200: full StoreSettings after the change.
Errors: 400 VALIDATION_FAILED with issues[{path, message}] (paths like `taxes.1.rateBasisPoints`, `loyalty.redeemValuePerPoint`); 403 FORBIDDEN.
Rules: tax/loyalty/threshold changes apply to new sales only; NG stores are seeded with VAT 7.5% default but nothing is hardcoded.

### GET /api/v1/seller/locations
Permission: settings:view
Response 200: CursorPage<StoreLocation> (all locations, active and inactive; nextCursor null)

### POST /api/v1/seller/locations
Permission: settings:manage
Body: { name 2–60 (unique per store, case-insensitive), kind "store"|"warehouse", address 5–200, city 2–60, state 2–60, phone? }
Response 201: StoreLocation (country copied from the store, isDefault false, active true). New location gets a zero stock row for every variant.
Errors: 400 VALIDATION_FAILED; 409 LOCATION_EXISTS; 409 LOCATION_LIMIT_REACHED when active locations ≥ entitlements.maxLocations of the store's active Gold plan (null = unlimited; no active plan = 0).

### PATCH /api/v1/seller/locations/:locationId
Permission: settings:manage
Body: any of { name, kind, address, city, state, phone|null, active bool, isDefault true }
Response 200: StoreLocation
Errors: 404 LOCATION_NOT_FOUND; 409 DEFAULT_LOCATION (cannot deactivate the default; default must be active); 409 OPEN_SHIFT (cannot deactivate while a register there has an open shift); 409 LOCATION_LIMIT_REACHED (re-activation over the plan limit).
Rules: no delete — deactivate instead. Setting isDefault moves the default flag from the previous default.

### POST /api/v1/seller/pos/registers
Permission: settings:manage
Body: { locationId (active location with kind "store"), name 2–40 }
Response 201: PosRegister (openShiftId null, active true)
Errors: 400 VALIDATION_FAILED

### PATCH /api/v1/seller/pos/registers/:registerId
Permission: settings:manage
Body: any of { name 2–40, active bool }
Response 200: PosRegister
Errors: 404 REGISTER_NOT_FOUND; 409 OPEN_SHIFT (cannot deactivate with an open shift)
Note: GET /seller/pos/registers?locationId (documented in the POS section) is read by the settings page with `includeInactive=true` so deactivated registers can be re-activated; please support that flag.

Staff are always existing Zudomart app users. There are no separate staff accounts and no email/SMS invites: the store adds a Zudomart user, the user gets a team request in the Zudomart app, accepts it there, and signs in to the dashboard with their own Zudomart credentials.

### GET /api/v1/seller/zudomart-users
Permission: any signed-in store member. Query: `q` (≥2 chars; username with or without "@", or display name). Response 200: `{ data: ZudomartUserCandidate[] }` (max 10) where `ZudomartUserCandidate = { userId, name, username, avatarUrl }`. Public profile fields only — never email, phone or other private data. Excludes suspended/banned accounts and accounts that block the caller.

### GET /api/v1/seller/staff/candidates
Permission: staff:manage. Same as `/seller/zudomart-users` but excludes users already on this store's team.

### GET /api/v1/seller/staff
Permission: staff:manage (owner, admin)
Query: q? (name/username), cursor?, limit? (≤200)
Response 200: CursorPage<StaffMember> — never includes PIN hashes or attempt counters.

### POST /api/v1/seller/staff
Permission: staff:manage
Body: { userId (an existing Zudomart user), role one of admin|manager|cashier|inventory|support, locationIds: non-empty array of the store's location ids }
Response 201: StaffMember `{ id, userId, name, username, avatarUrl, role, status: "invited", ... }` — the user receives a team request in the Zudomart app (push + in-app notification) and becomes "active" when they accept there.
Errors: 400 VALIDATION_FAILED (unknown userId); 403 OWNER_ROLE_RESERVED; 403 OWNER_ONLY (only the owner may create admins); 409 STAFF_EXISTS (user already on the team); 409 SEAT_LIMIT_REACHED when non-suspended staff (active + invited, owner included) ≥ entitlements.maxStaffSeats.

### PATCH /api/v1/seller/staff/:staffId
Permission: staff:manage
Body: any of { name, role (not owner), status "active"|"suspended", locationIds }
Response 200: StaffMember
Errors: 403 CANNOT_EDIT_SELF (nobody changes their own role/status); 403 OWNER_PROTECTED (the owner cannot be changed); 403 OWNER_ONLY (only the owner changes admins or grants admin); 409 SEAT_LIMIT_REACHED (reactivating over the limit); 404 STAFF_NOT_FOUND.
Rules: suspending revokes that member's sessions and register PIN sessions immediately. Reactivating someone who never accepted returns them to "invited".

### DELETE /api/v1/seller/staff/:staffId
Permission: staff:manage
Response 204. Errors: 403 CANNOT_REMOVE_SELF, OWNER_PROTECTED, OWNER_ONLY; 404.
Rules: ends all their sessions and operator (PIN) sessions; history (sales, audit) keeps their name.

### POST /api/v1/seller/staff/:staffId/pin
Permission: staff:manage
Body: { pin: 4–6 digits; reject repeated digits (1111) and straight runs (1234, 9876) }
Response 200: StaffMember (hasPosPin true, pinLockedUntil null).
Rules: hash with a memory-hard KDF (scrypt/argon2id) plus per-PIN salt; never return or log the PIN; resets failed attempts. Only the owner may set the owner's PIN (403 OWNER_PROTECTED).
Errors: 400 VALIDATION_FAILED; 404.

### POST /api/v1/seller/staff/:staffId/unlock-pin
Permission: staff:manage
Response 200: StaffMember (pinLockedUntil null, failed attempts reset).
Related: PIN sessions (POST /seller/staff/pin-sessions) lock a PIN for 15 minutes after 5 wrong attempts (423 PIN_LOCKED); wrong PIN is 403 PIN_INCORRECT (never 401).

### GET /api/v1/seller/audit-log
Permission: audit:view (owner, admin)
Query: actorId?, action? (prefix match, e.g. "pos.", "staff.", "settings."), from? / to? (YYYY-MM-DD, inclusive, store timezone), cursor?, limit? (≤200, default 50)
Response 200: CursorPage<AuditLogEntry>, newest first.
Actions written: staff.invited, staff.updated, staff.removed, staff.pin_set, staff.pin_unlocked, settings.updated, location.created, location.updated, register.created, register.updated, subscription.cancelled — plus those from other modules (pos.discount_approved, pos.refund_issued, inventory.adjusted, order.shipped, payout.requested…).

### Subscription endpoints used by /settings/billing (defined in the access/subscription section)
GET /seller/subscription → SubscriptionDetails; POST /seller/subscription/checkout {planId} → {authorizationUrl, reference, provider}; POST /seller/subscription/verify {reference}; POST /seller/subscription/cancel and /resume → SubscriptionDetails (billing:manage, owner only). GET /seller/verification → { status, note, submittedAt, documents[{kind,label,status}] }.


## Affiliates & creators

Types: `apps/seller/src/types/affiliate.type.ts`. All amounts are `Money` in the store currency. Commission rates are integer basis points (800 = 8%), 0–5000. All endpoints are store-scoped to the caller's store (ownership checked server-side) and write an audit-log entry on every change. The dashboard only displays commissions: the backend ledger takes commission from the order and pays the creator when escrow is released. Refunded orders reverse it. Sellers never pay creators directly.

Commission for an order = sum over lines of `lineTotal × effectiveRate(product)`, where effectiveRate = the product override, otherwise the program default, or 0 if the product is excluded. The rate is locked when the order is placed. A live invitation's `commissionBasisPoints`, when set, overrides product rates for sales attributed to that live.

### GET /api/v1/seller/affiliates/settings
Permission: affiliates:manage
Response 200: AffiliateProgramSettings `{enabled, defaultCommissionBasisPoints, autoApproveCreatorsWithFollowersAbove: number|null, cookieWindowDays}`

### PATCH /api/v1/seller/affiliates/settings
Permission: affiliates:manage
Body (partial): enabled: boolean; defaultCommissionBasisPoints: int 0–5000; autoApproveCreatorsWithFollowersAbove: int 0–100000000 | null; cookieWindowDays: int 1–90
Response 200: AffiliateProgramSettings
Errors: 400 VALIDATION_FAILED (issues[])
Rules: if disabled, new requests are refused and existing links stop attributing new orders; owed commission is still settled.

### GET /api/v1/seller/affiliates/overview
Permission: affiliates:manage
Response 200: AffiliateOverview `{settings, creatorDrivenSales, commissionsOwed, commissionsPaid, activeCreatorsCount, pendingRequestsCount, topCreators: AffiliateCreatorPerformance[] (max 5, by sales)}`. Excludes reversed commissions.

### GET /api/v1/seller/affiliates/requests
Permission: affiliates:manage
Query: status?: pending|approved|declined; cursor?; limit? (≤200)
Response 200: CursorPage<AffiliateRequest> `{id, creator: AffiliateCreator, message, requestedAt, status, decisionReason}`

### POST /api/v1/seller/affiliates/requests/:requestId/approve
### POST /api/v1/seller/affiliates/requests/:requestId/decline
Permission: affiliates:manage
Body: `{reason?: string ≤300}` (used for decline, shown to the creator)
Response 200: AffiliateRequest
Errors: 404 REQUEST_NOT_FOUND; 409 REQUEST_ALREADY_DECIDED; 400 VALIDATION_FAILED
Rules: approving adds the creator to the store's program with status active and notifies the creator. Auto-approve applies when the creator's followers exceed `autoApproveCreatorsWithFollowersAbove`.

### GET /api/v1/seller/affiliates/creators
Permission: affiliates:manage
Query: from?, to? (YYYY-MM-DD, filters by order date); cursor?
Response 200: CursorPage<AffiliateCreatorPerformance> `{creator, clicks, orders, sales, commissionOwed, commissionPaid, lastSaleAt, status: active|paused}` sorted by sales desc

### PATCH /api/v1/seller/affiliates/creators/:creatorId
Permission: affiliates:manage
Body: `{status: "active"|"paused"}`
Response 200: AffiliateCreatorPerformance
Errors: 404 CREATOR_NOT_FOUND; 400 VALIDATION_FAILED
Rules: paused creators' links stop attributing new orders.

### DELETE /api/v1/seller/affiliates/creators/:creatorId
Permission: affiliates:manage
Response 204
Errors: 404 CREATOR_NOT_FOUND
Rules: removes the creator from the program. Commission already owed is still paid at escrow release.

### GET /api/v1/seller/affiliates/product-commissions
Permission: affiliates:manage
Query: q? (product name); cursor?; limit? (≤200)
Response 200: CursorPage<ProductCommissionRow> `{productId, productName, imageUrl, price (first variant), commissionBasisPoints|null (null = default), excluded, estimatedCommission}` — only non-archived products published online

### PUT /api/v1/seller/affiliates/product-commissions/:productId
Permission: affiliates:manage
Body: `{commissionBasisPoints: int 0–5000 | null, excluded?: boolean}`
Response 200: `{productId, commissionBasisPoints, excluded}`
Errors: 404 PRODUCT_NOT_FOUND; 400 VALIDATION_FAILED

### GET /api/v1/seller/affiliates/commission-ledger
Permission: affiliates:manage
Query: status?: owed|paid|reversed; cursor?; limit?
Response 200: CursorPage<CommissionLedgerEntry> `{id, orderNumber, creatorId, creatorUsername, orderTotal, commission, status, orderedAt, escrowReleaseAt|null, paidAt|null}` newest first
Rules: status mirrors the order's escrow: held/disputed → owed, released → paid (paidAt = release time), refunded → reversed.

### GET /api/v1/seller/affiliates/creator-directory
Permission: affiliates:manage
Query: q? (username/name); niche?; cursor?; limit?
Response 200: CursorPage<AffiliateCreator & {isInYourProgram: boolean}> — only creators accepted into the Zudomart Creator Program

### GET /api/v1/seller/affiliates/live-invitations
Permission: affiliates:manage
Query: status?: pending|accepted|declined|live|ended|cancelled; cursor?; limit?
Response 200: CursorPage<LiveInvitation> `{id, creator, products:[{id,name,imageUrl}], proposedStartAt, commissionBasisPoints|null, message, status, createdAt}`

### POST /api/v1/seller/affiliates/live-invitations
Permission: affiliates:manage
Body: creatorId: string (Creator Program member); productIds: string[] 1–20 (active products of this store, deduplicated); proposedStartAt: ISO datetime in the future and within 90 days; commissionBasisPoints: int 0–5000 | null; message: string ≤500
Response 201: LiveInvitation (status pending); notifies the creator in the app
Errors: 400 VALIDATION_FAILED; 404 CREATOR_NOT_FOUND; 409 AFFILIATE_PROGRAM_OFF

### POST /api/v1/seller/affiliates/live-invitations/:invitationId/cancel
Permission: affiliates:manage
Response 200: LiveInvitation (status cancelled)
Errors: 404 INVITATION_NOT_FOUND; 409 INVITATION_NOT_CANCELLABLE (only pending/accepted)


## Brands, Official Store and brand protection

A business can operate as a **Brand** (Go identity model): a brand profile with its own team (brand members are separate from store staff). A store belongs either to one brand or to an individual. Types: `apps/seller/src/types/brand.type.ts`.

Brand-scoped endpoints only work for brands where the signed-in user is an **active brand member**; otherwise `404 BRAND_NOT_FOUND` (never reveal other brands). Brand roles: `owner` (everything, only one), `admin` (team, stores, claims; only the owner can create/remove/change admins), `editor` (profile only), `viewer` (read). Dashboard permission rules also apply (`settings:view` to read, `settings:manage` to write). Every write is audit-logged (`targetType: "brand"`).

### Store context header

`X-Seller-Store: <storeId>` — sent by the BFF on every call once a user switches store with the top-bar switcher (stored in a signed, httpOnly, session-bound cookie). The API must resolve the caller's membership **for that store** (and reject with 403 if the user is not a member), then scope every `/seller/...` call — including `GET /seller/access` — to it. Without the header, use the user's default store. The operator header (`X-Seller-Operator`) is only valid for the store it was issued in.

### GET /api/v1/seller/stores/mine
Permission: signed in (available before the store is active, used by the switcher).
Response 200: `CursorPage<MyStoreEntry>` — every store the user belongs to: `{ storeId, storeName, brandId|null, role, verification: { status, tier, badgeVisible }, subscription: { status, plan } | null, isCurrent }`.

### GET /api/v1/seller/brands
Permission: settings:view. Response 200: `CursorPage<BrandSummary>` — brands the user is an active member of, with `myRole`, `registrationStatus`, `officialStoreStatus`, `storeCount`.

### GET /api/v1/seller/brands/directory
Permission: settings:view (all roles have it; used by the product editor). Query: `q?` (≤ 80 chars).
Response 200: `CursorPage<BrandDirectoryEntry>` — registered brands plus the brands linked to the caller's store; `isMine` = the caller's store is linked to the brand; own brands first; max 50.

### GET /api/v1/seller/brands/:brandId
Permission: settings:view + brand member. Response 200: `Brand` — `verification` is the Gold state of the brand's Official/first linked store, `officialStore` is computed (see below).

### PATCH /api/v1/seller/brands/:brandId
Permission: settings:manage + brand role owner/admin/editor.
Body (all optional): `name` (2–60; **409 REGISTERED_NAME_LOCKED** if the brand is registered — the name follows the trademark), `description` (≤ 1000), `website` (`https://…`, ≤ 200, or null), `logoMediaId` / `coverMediaId` (from the chunked media API, must be `ready`; upload `purpose` should be `"brand"`), `logoUrl`/`coverUrl` (null to remove). Unknown keys → 400.
Response 200: `Brand`. Errors: 400 VALIDATION_FAILED, 403 BRAND_ROLE_FORBIDDEN, 422 MEDIA_NOT_READY.

### GET /api/v1/seller/brands/:brandId/members
Response 200: `CursorPage<BrandMember>`.

### POST /api/v1/seller/brands/:brandId/members
Permission: settings:manage + brand owner/admin. Body: `{ userId, role: "admin"|"editor"|"viewer" }` — `userId` is an existing Zudomart user found via `GET /seller/zudomart-users` (only the owner may add admins). Creates an `invited` member `{ id, userId, name, username, role, status }`; the user accepts the brand team request in the Zudomart app. No email invitations.
Response 201: `BrandMember`. Errors: 400 VALIDATION_FAILED (unknown userId), 409 MEMBER_EXISTS, 409 MEMBER_LIMIT_REACHED (30), 403 BRAND_ROLE_FORBIDDEN.

### PATCH /api/v1/seller/brands/:brandId/members/:memberId
Body: `{ role: "admin"|"editor"|"viewer" }`. Rules: owner's role is locked (409 OWNER_ROLE_LOCKED), nobody changes their own role (409 OWN_ROLE_LOCKED), only the owner makes or changes admins. Response 200: `BrandMember`.

### DELETE /api/v1/seller/brands/:brandId/members/:memberId
Rules: owner cannot be removed; you cannot remove yourself; only the owner removes admins. Response 204.

### POST /api/v1/seller/brands/:brandId/stores
Permission: settings:manage + brand owner/admin. Body: `{ storeId }` — must be a store where the caller is owner/admin (403 STORE_NOT_MANAGED) and not linked to another brand (409 STORE_HAS_BRAND). Response 200: `Brand`.

### DELETE /api/v1/seller/brands/:brandId/stores/:storeId
Unlink. 409 OFFICIAL_STORE_LINKED if it is the active Official Store. Response 204. Products tagged `own` for this brand in that store should lose the tag (or be flagged for review).

### GET /api/v1/seller/brands/:brandId/official-store
Response 200: `OfficialStoreDetails` = `{ officialStore: { status: "not_eligible"|"eligible"|"active"|"suspended", storeId, reason }, requirements: [{ key, label, met, howToFix }], candidateStoreId }`.
Requirements (all must be met): `brand_registered` (registration.status = registered), `store_linked`, `store_gold_verified` (the candidate store's verification = verified), `gold_plan_active` (Gold Pro/Premium active or trialing), `no_open_trademark_disputes`. An active Official Store whose requirements lapse becomes `suspended` with a reason.

### POST /api/v1/seller/brands/:brandId/official-store/apply
Permission: settings:manage + brand **owner**. Response 200: `OfficialStoreDetails`. Errors: 409 ALREADY_OFFICIAL, 422 OFFICIAL_STORE_REQUIREMENTS_UNMET (message lists what is missing). The real backend may put the application into manual review; the mock activates immediately.

### GET /api/v1/seller/brands/:brandId/protection/listings
Permission: settings:view + brand member; **403 BRAND_PROTECTION_REQUIRES_OFFICIAL** unless the brand's Official Store is active.
Query: `q?`, `risk?` (`high|medium|low`), `cursor`, `limit`. Response 200: `CursorPage<BrandListingReport>` — listings by **other** sellers tagged with this brand: seller, title, image, `price: Money`, `yourRecommendedPrice: Money|null` (lowest price of the matching product in the Official Store), `priceDifferenceBasisPoints`, `relationshipClaimed`, `risk` + `riskReasons` (claims `own` without being linked, price ≤ 50%/80% of yours, seller account < 30 days), `openClaimId`. Sorted high risk first.

### GET /api/v1/seller/brands/:brandId/protection/claims
Same access rule. Response 200: `CursorPage<BrandClaim>` newest first.

### POST /api/v1/seller/brands/:brandId/protection/claims
Permission: settings:manage + brand owner/admin + Official Store active.
Body: `{ kind: "counterfeit"|"trademark"|"unauthorised_seller", listingIds: string[] (1–20, must be this brand's listings without an open claim), evidence: string (30–2000), declaration: true }`.
Response 201: `BrandClaim` (status `submitted`); the listings get `openClaimId`. Zudomart's brand team reviews and moves the claim to `under_review` → `upheld` (listings removed, sellers notified) or `rejected`, with `resolution`. Errors: 400 VALIDATION_FAILED.

### POST /api/v1/seller/brands/:brandId/protection/claims/:claimId/withdraw
Only `submitted`/`under_review` claims (409 CLAIM_CLOSED otherwise). Response 200: `BrandClaim` (status `withdrawn`, listings' `openClaimId` cleared).

### Product brand tagging (extends the products endpoints)
`Product.brand?: { brandId, name, relationship: "own"|"authorised_reseller"|"genuine_resale" } | null`.
`POST /api/v1/seller/products` and `PATCH /api/v1/seller/products/:productId` accept `brand: { brandId, relationship } | null` (omit on PATCH to keep the current tag). Rules: the brand must exist; `own` only when the caller's store is linked to that brand; resale relationships only for **registered** brands. Errors are field issues `brand.brandId` / `brand.relationship` in a 400 VALIDATION_FAILED.
