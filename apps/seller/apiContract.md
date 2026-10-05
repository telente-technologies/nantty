# Zudomart Dashboard — API contract

The Zudomart Dashboard (`apps/seller`, hosted at `https://dashboard.<domain>`) is a Backend-for-Frontend: the browser only talks to the dashboard's own `/bff/*` routes, and the dashboard's server calls the API below with the seller's bearer token. The API must add the dashboard origin (`DASHBOARD_ORIGIN`, e.g. `https://dashboard.zudomart.com`) to its CORS allow-list (`CORS_ORIGINS`). Today every call is server-to-server from the dashboard's `/bff` routes, but the origin must be allowed for any browser call and the payment callback flow.

## Conventions

- Base path: `/api/v1`. All seller-scoped resources live under `/api/v1/seller/...` and are scoped to the caller's store (the store the authenticated user is a member of). Every resource id taken from a path or body must be checked for ownership on the server.
- Auth: `Authorization: Bearer <accessToken>` (15 min). Refresh tokens rotate on every use; reuse of an old refresh token revokes the session.
- Staff: every team member is an existing Zudomart app user who signs in with their own app credentials. There are no shared-device operator tokens, PINs or separate staff accounts.
- Plans: `free | pro | business`, derived from `SellerAccess.subscription` (no active subscription = free). Feature gating lives in `apps/seller/src/config/planFeatures.config.ts` (`minimumPlanByFeature`, `planLimitsByPlan`). Any endpoint marked **Plan: pro** or **Plan: business** must return `402 PLAN_FEATURE_REQUIRED` `{ message, code, requiredPlan }` when the store's plan is lower. Basic selling (products, stock levels, app orders, customers, messages, delivery, reviews, payouts) is never gated.
- Store: `X-Seller-Store: <storeId>` is sent when someone who manages several stores has switched store in the top bar. The API must check the caller is a member of that store and scope everything to it; without it, use the caller's default store.
- Location: `X-Seller-Location: <locationId>` carries the location selected in the top bar. It is a default, never an authorisation: validate it belongs to the store.
- Money everywhere: `{ "amountMinor": integer, "currency": "NGN"|"GHS"|"KES"|"ZAR"|"GBP"|"EUR"|"USD" }` in the **store's** currency. Request bodies send amounts as `...Minor` integers; the server assumes the store currency and rejects anything else. Percentages are integer basis points (750 = 7.5%).
- Lists: `{ "data": T[], "nextCursor": string | null }`; query `cursor`, `limit` (default 25, max 200).
- Errors: `{ "message": string, "code": string, "issues"?: [{ "path", "message" }] }`. `401` only for missing/expired auth (the BFF signs the user out). Validation is `400 VALIDATION_FAILED`.
- `Idempotency-Key` header (8–128 chars `[A-Za-z0-9_-]`) is **required** on: order refunds, payouts, stock adjustments and transfers, product imports, order fulfilment. Replays return the original response with header `Idempotent-Replayed: true`.
- CSV endpoints return `text/csv; charset=utf-8` with `Content-Disposition: attachment; filename="..."`. Cells beginning with `= + - @` must be neutralised against formula injection.
- Types referenced below are TypeScript interfaces in `apps/seller/src/types/*.type.ts` (the source of truth for field names and shapes).
- Roles: `owner | manager | inventory | sales | accountant`. Each role has default permissions (`permissionsByStaffRole` in `apps/seller/src/config/rolePermissions.config.ts`); a staff member may carry a custom `permissions: SellerPermission[]` list (Business plan) that replaces the role defaults. The owner always has every permission. The permission each endpoint needs matches `apiPermissionRules` in that file; the API must enforce the same rules (deny by default).

## Auth (existing endpoints the dashboard relies on)

### POST /api/v1/auth/login
Body: `{ identifier: string (email or username), password: string }`
Response 200: `{ accessToken, refreshToken, expiresIn, tokenType: "Bearer", user: CurrentUserDto, isNewUser }`
Errors: 401 INVALID_CREDENTIALS, 429

### POST /api/v1/auth/refresh
Body: `{ refreshToken }` → 200 `{ accessToken, refreshToken, expiresIn, tokenType }`. Errors: 401 INVALID_REFRESH_TOKEN, 401 REFRESH_TOKEN_REUSED (session revoked).

### POST /api/v1/auth/otp/send
Body: `{ destination: email, purpose: "reset" }` → 200 `{ expiresIn }`. Used by "Forgot password?". Must not reveal whether an account exists; rate-limited.

### POST /api/v1/auth/otp/verify
Body: `{ destination, code: "6 digits", purpose: "reset" }` → 200 `{ otpToken }`. Errors: 400 (wrong/expired), 429. Locks after 5 failed attempts.

### POST /api/v1/auth/password/reset
Body: `{ otpToken, password }` → 200/204. Signs out every other session of the account. The dashboard keeps `otpToken` in a signed httpOnly cookie and never exposes it to the browser.

### POST /api/v1/auth/logout
Body: `{ refreshToken }` → 204.

### GET /api/v1/users/me
Response 200: CurrentUserDto (`id, name, username, email, avatarUrl, ...`).

## Access and plans

Dashboard access = **any approved Zudomart seller** (a store member). It does not need Gold verification or a paid subscription: a store without an active subscription is on the **Free** plan. Non-members see "start selling in the app"; stores whose verification status is `suspended` or `revoked` see a restricted-store page. Paid plans (Pro, Business) only unlock the features listed in `planFeatures.config.ts`. Gold verification is separate and only controls the gold badge.

### GET /api/v1/seller/access
Permission: signed in (any user).
Response 200: `SellerAccess` (src/types/sellerAccess.type.ts)
```json
{
  "storeId": "store_… | null",
  "storeName": "string | null",
  "verification": { "status": "unverified|pending|verified|suspended|revoked", "color": "GOLD", "tier": "PRO|PREMIUM|null", "badgeVisible": true },
  "subscription": { "status": "trialing|active|past_due|cancelled|expired|suspended", "plan": "PRO|BUSINESS", "currentPeriodEnd": "ISO|null" },
  "entitlements": { "maxStaffSeats": 25, "maxLocations": 10, "reducedEscrowFee": true, "priorityPlacement": true, "adCredits": { "amountMinor": 5000000, "currency": "NGN" }, "apiAccess": true },
  "role": "owner|manager|inventory|sales|accountant|null",
  "permissions": ["orders:view", "..."] | null
}
```
`subscription` and `entitlements` are `null` when the store is on Free. `permissions` is the member's custom permission list, or `null` to use the role defaults. `verification.tier` stays `PRO|PREMIUM` (badge tier) and is independent of the plan. A user who is not a member of any store gets `storeId: null, role: null`.

### GET /api/v1/seller/verification
Permission: store member. Available before the store is active.
Response 200: `{ status: VerificationStatus, note: string|null, submittedAt: ISO|null, documents: [{ kind, label, status: "missing"|"in_review"|"approved"|"rejected" }] }`

### GET /api/v1/seller/subscription/plans
Permission: **public** (no token) — the dashboard's logged-out landing page shows Pro and Business pricing next to the always-free plan. The dashboard forwards the visitor's `Accept-Language` and `X-Forwarded-For` so the API can price in the visitor's local currency. Response 200: `CursorPage<SubscriptionPlan>` where `SubscriptionPlan = { id, tier: "PRO"|"BUSINESS", price: Money, interval: "month"|"year", entitlements: GoldEntitlements, perks: [{ title, description }] }`. Perks are admin-configured; the UI never hardcodes them. Launch prices for Nigeria (returned by this endpoint in the visitor's currency, never hardcoded in the UI): Free ₦0 (not returned — the free plan is implicit), Pro `{ amountMinor: 500000, currency: "NGN" }`/month, Business `{ amountMinor: 1500000, currency: "NGN" }`/month; yearly plans are optional. Pro and Business also grant the **Gold business checkmark**, subject to business verification: on activation the server sets `verification.tier` (`PRO` for Pro, `PREMIUM` for Business) and `badgeVisible: true` only once `verification.status = "verified"`; until then the plan works but no checkmark shows. Include a perk such as `{ title: "Gold business checkmark", description: "After business verification." }`.

### GET /api/v1/seller/subscription
Permission: store member. Response 200: `SubscriptionDetails` (`subscription`, `planId`, `cancelAtPeriodEnd`, `paymentMethodSummary`, `provider`, `invoices: SubscriptionInvoice[]`).

### POST /api/v1/seller/subscription/checkout
Permission: billing:manage (owner). Body: `{ planId }`.
Response 201: `{ authorizationUrl, accessCode, reference, provider: "paystack" }`. The dashboard opens the Paystack Popup with `accessCode` and falls back to redirecting to `authorizationUrl`. The callback URL must be `${DASHBOARD_ORIGIN}/billing-checkout/callback` (Paystack appends `reference`/`trxref`).
Errors: 404 PLAN_NOT_FOUND. Verification is not required. Switching plans uses the same endpoint.

### POST /api/v1/seller/subscription/verify
Permission: billing:manage. Body: `{ reference }`. The server verifies with the provider (never trusts the redirect) and activates the plan. Response 200: `SubscriptionDetails`. Errors: 404 PAYMENT_NOT_FOUND, 402 PAYMENT_NOT_SUCCESSFUL.

### POST /api/v1/seller/subscription/cancel
### POST /api/v1/seller/subscription/resume
Permission: billing:manage. Cancel sets `cancelAtPeriodEnd: true`; at period end the store returns to Free (never loses dashboard access); resume clears it. Response 200: `SubscriptionDetails`. Audit-logged.

## Catalog, inventory and media

Types: `Product`, `ProductVariant`, `ProductCategory`, `ProductVisibility`, `ProductAttribute`, `ProductVideo`, `Supplier`, `InventoryMovement`, `StockAdjustment`, `StockTransfer` in `apps/seller/src/types/catalog.type.ts`; request/response shapes (`ProductUpsertRequest`, `ProductImportRequest`, `ProductImportResult`, `InventoryLevelRow`, `StockAdjustmentRequest`, `StockTransferRequest`, `MediaUploadSession`, `MediaRecord`, `ProductBulkActionRequest`, `ProductUsageSummary`, `InventorySummary`, `InventoryLocationSummary`, `ReorderSuggestionRow`, `ReorderLevelUpdateRequest`, `SupplierUpsertRequest`, `CategoryUpsertRequest`) in `apps/seller/src/types/productRequests.type.ts`. Validation rules shared with the UI: `apps/seller/src/utils/productValidation.util.ts`. All Money is in the store currency; all amounts are integer minor units. Every mutation below is written to the audit log.

Plan gating (see Conventions → Plans; locked calls return `402 PLAN_FEATURE_REQUIRED`): creating and editing single products, categories, stock levels, adjustments and low-stock alerts are **free**. `bulk_tools` (Pro): `POST /products/bulk`, `GET /products/export`, `POST /products/import`. `advanced_inventory` (Pro): movements, transfers, suppliers, reorder list and reorder levels. Active products are capped at `planLimitsByPlan[plan].maxActiveProducts` (Free 100, Pro 2,000, Business unlimited): any create/update/publish that would make a product `active` over the cap returns `409 PRODUCT_LIMIT_REACHED`; drafts are never capped.

New product fields: `visibility` (`public` = Mart, search, feeds and store page; `store_only` = only the seller's store page; `link_only` = only via direct link), `publishAt` (ISO; only on drafts — the server activates the product at that time and lists it if it has an image), `attributes` (≤ 20 × { name 1–40, value 1–200 }), `videos` (≤ 3 × { id, url https ≤ 500, title ≤ 80 }), `supplierId` (one of the store's suppliers or null). Variants add `reorderPoint` and `reorderQuantity` (0–1,000,000).

### GET /api/v1/seller/categories
Permission: catalog:view
Response 200: CursorPage<ProductCategory> (nextCursor null). Each category includes `description` (string, may be empty) and `productCount` (non-archived products in it).

### POST /api/v1/seller/categories
Permission: products:manage
Body: CategoryUpsertRequest { name 2–40 (unique per store, case-insensitive), description ≤ 300 }
Response 201: ProductCategory (productCount 0). Errors: 400 VALIDATION_FAILED, 409 CATEGORY_LIMIT_REACHED (100 per store)

### PATCH /api/v1/seller/categories/:categoryId
Permission: products:manage
Body: CategoryUpsertRequest. Renaming updates `categoryName` on every product in it.
Response 200: ProductCategory. Errors: 400 VALIDATION_FAILED, 404 CATEGORY_NOT_FOUND

### DELETE /api/v1/seller/categories/:categoryId
Permission: products:manage
Rules: products in it keep existing with `categoryId: null`; refused while a tax rate targets the category.
Response 204. Errors: 404 CATEGORY_NOT_FOUND, 409 CATEGORY_IN_USE_BY_TAX

### GET /api/v1/seller/products
Permission: catalog:view
Query: q? (matches name, any variant SKU or barcode), categoryId?, variantId? (product that owns this variant), status? ("active"|"draft"|"scheduled"|"archived"|"all"; default = active + draft; scheduled = drafts with publishAt), online? ("true"|"false"), visibility? ("public"|"store_only"|"link_only"), supplierId?, stock? ("low"|"out", evaluated at locationId or across all locations), locationId?, sort? ("updated" default | "updated_asc" | "name" | "name_desc" | "price_asc" | "price_desc" | "stock" | "stock_desc"), cursor?, limit? (1–200, default 25)
Response 200: CursorPage<Product>

### POST /api/v1/seller/products
Permission: products:manage
Body: ProductUpsertRequest — name 2–120; description ≤ 5000; categoryId one of the store's or null; status draft|active|archived; taxable/trackInventory/publishedOnline booleans; tags ≤ 20 × ≤ 30 chars (lower-cased, deduped by server); options ≤ 3 (name 1–30, 1–30 unique values of 1–40 chars); imageMediaIds ≤ 10 (media must be `ready` and owned by the store, or already on the product); variants 1–100: optionValues must pick exactly one value per option and combinations must be unique, sku /^[A-Za-z0-9._-]{1,64}$/ unique per store (case-insensitive), barcode null or 8–14 digits (13 digits must pass the EAN-13 check digit) unique per store, priceMinor ≥ 0, compareAtPriceMinor null or > priceMinor, costPriceMinor null or ≥ 0, lowStockThreshold 0–100000, openingStock [{locationId, quantity 0–1e6}] (create only; locations must belong to the store), reorderPoint?/reorderQuantity? 0–1e6 (default: lowStockThreshold and max(10, 4 × lowStockThreshold)); plus visibility? (default public), publishAt? (ISO, status must be draft, ≤ 12 months ahead), attributes?, videos? [{url, title}], supplierId?.
Prices by country (optional, every plan; `planFeatures` has no gate for it): each variant may carry `regionalPrices: [{ currency, priceMinor, compareAtPriceMinor? }]` for NGN, GHS, KES, ZAR, GBP, EUR, USD (not the store currency; one per currency; price above zero; compare-at above price). Responses return the same array on each variant. Buyers in that currency's market are charged that price in that currency; a seller's lines share one currency, so a market price applies only when every variant of the order from that seller has one, otherwise the default price is charged. Buyers without a market price see the default price plus `approxPrice` (rounded-down FX from the currency module); checkout recomputes prices server-side from the delivery address country. Invalid entries give `variants.N.regionalPrices.M.currency|priceMinor` issues.
Server rules: variant title is derived from option values ("Default" when no options); publishedOnline is forced false unless status is active; stock starts at openingStock per location (0 elsewhere).
Response 201: Product
Errors: 400 VALIDATION_FAILED (issues[] with paths like `variants.2.sku`, `attributes.1.value`, `videos.0.url`, `publishAt`), 409 PRODUCT_LIMIT_REACHED, 422 MEDIA_NOT_READY, 403 STORE_NOT_APPROVED (the store is suspended or not active; also returned by publish and duplicate)

### GET /api/v1/seller/products/:productId
Permission: catalog:view
Response 200: Product. Errors: 404 PRODUCT_NOT_FOUND
Rule: reading products first activates any draft whose publishAt has passed (the real server should do this with a scheduled job at publishAt).

### PATCH /api/v1/seller/products/:productId
Permission: products:manage
Body: full ProductUpsertRequest (replacement semantics). Variants with `id` are updated in place and keep their stock; `id: null` creates a variant with 0 stock; omitted variants are deleted.
Server rules: stock is never changed by this endpoint (use adjustments/transfers); deleting a variant that still has non-zero stock is refused.
Response 200: Product
Omitted optional fields (visibility, attributes, videos, supplierId, reorder fields) keep their current values.
Errors: 400 VALIDATION_FAILED, 404 PRODUCT_NOT_FOUND / VARIANT_NOT_FOUND, 409 VARIANT_HAS_STOCK, 409 PRODUCT_LIMIT_REACHED (draft/archived → active over the cap), 422 MEDIA_NOT_READY

### DELETE /api/v1/seller/products/:productId
Permission: products:manage
Archives (status archived, unpublished, publishAt cleared); never hard-deletes because orders reference it.
Response 200: Product

### POST /api/v1/seller/products/:productId/publish
### POST /api/v1/seller/products/:productId/unpublish
Permission: products:manage
Body: {}
Rules: publish requires status active and at least one image. Listings share the same stock as every location.
Response 200: Product. Errors: 409 PRODUCT_NOT_ACTIVE, 409 PRODUCT_NEEDS_IMAGE, 403 STORE_NOT_APPROVED (publish only)

### GET /api/v1/seller/products/usage
Permission: catalog:view
Response 200: ProductUsageSummary { activeProducts, draftProducts (unscheduled), scheduledProducts, archivedProducts, maxActiveProducts: number | null (null = unlimited on the plan) }

### POST /api/v1/seller/products/bulk
Permission: products:manage. Plan: pro (bulk_tools).
Body: ProductBulkActionRequest { action: "publish"|"unpublish"|"archive"|"set_category"|"set_visibility"|"change_price_percent", productIds: string[1..200], categoryId?: string|null (set_category), visibility? (set_visibility), pricePercentBasisPoints?: integer −9000..50000, ≠ 0 (change_price_percent; e.g. 1000 = +10%) }
Rules: products that cannot be published (not active or no image) are skipped, not failed. change_price_percent rounds each variant price to the nearest minor unit and clears compare-at prices that would no longer be higher than the new price.
Response 200: { updatedProductIds: string[] }
Errors: 400 INVALID_ACTION / INVALID_SELECTION / INVALID_CATEGORY / INVALID_VISIBILITY / INVALID_PERCENT, 402 PLAN_FEATURE_REQUIRED

### POST /api/v1/seller/products/:productId/duplicate
Permission: products:manage
Body: {}
Rules: creates a draft copy named "<name> (copy)" with the same details, images, options, attributes, videos and prices; every variant gets a new id, a unique SKU ("<sku>-COPY", "-COPY2"…), no barcode and zero stock.
Response 201: Product. Errors: 404 PRODUCT_NOT_FOUND

### POST /api/v1/seller/products/barcodes
Permission: products:manage
Body: { count: 1–100 }
Response 200: { barcodes: string[] } — valid EAN-13 in the store-internal range (prefix 2), unique across the store at generation time (not reserved; uniqueness is re-checked on save).

### GET /api/v1/seller/products/export
Permission: catalog:view. Plan: pro (bulk_tools).
Query: locationId? (opening_stock column = on hand there; all locations when omitted)
Response 200: text/csv (Content-Disposition attachment) with header `product_name,description,category,option1_name,option1_value,option2_name,option2_value,sku,barcode,price,compare_at_price,cost_price,low_stock_threshold,opening_stock,taxable,published_online`, one row per variant, prices as major-unit decimals in the store currency. Cells beginning with = + - @ must be prefixed with ' (CSV injection).

### POST /api/v1/seller/products/import
Permission: products:manage. Plan: pro (bulk_tools).
Headers: Idempotency-Key required
Body: ProductImportRequest { locationId, rows: ProductImportRow[1..2000] } — all row cells are strings as typed in the CSV; prices are major-unit decimals in the store currency.
Rules: a row whose SKU matches an existing variant updates its price, cost price and low-stock threshold; other rows are grouped by product_name into new products (option columns become options, category by name, opening_stock to locationId); a new name that equals an existing product name fails; any invalid variant fails the whole group. Failed rows are reported, valid ones still commit.
Response 200: ProductImportResult { created, updated, failed: [{row, message}] }
Errors: 400 INVALID_LOCATION / INVALID_ROWS / IDEMPOTENCY_KEY_REQUIRED, 402 PLAN_FEATURE_REQUIRED

### GET /api/v1/seller/inventory/levels
Permission: inventory:manage
Query: locationId (defaults to X-Seller-Location, then the default location), q?, stock? ("low" = available ≤ lowStockThreshold, includes out | "out" = available ≤ 0 | "in" = available > lowStockThreshold), lowStockOnly? ("true", legacy alias of stock=low), sort? ("name" default | "onHand" | "available" | "reserved" | "value"), direction? ("ascending" default | "descending"), cursor?, limit? (default 50)
Response 200: CursorPage<InventoryLevelRow> — available = onHand − reserved (reserved = units held for paid app orders not yet shipped); stockValue = costPrice × max(onHand, 0); includes reorderPoint and reorderQuantity. Archived and untracked products are excluded.

### GET /api/v1/seller/inventory/summary
Permission: inventory:manage
Query: locationId? (a location id, or "all"/omitted for every active location)
Response 200: InventorySummary { locationId|null, skuCount, onHand, reserved, available (negatives counted as 0), lowStockCount (0 < available ≤ alert), outOfStockCount (available ≤ 0), needsReorderCount (available ≤ reorderPoint), stockValue (at cost), retailValue (at selling price) }

### GET /api/v1/seller/inventory/locations
Permission: inventory:manage
Response 200: CursorPage<InventoryLocationSummary> (every location, active and inactive; nextCursor null): { locationId, name, kind, city, isDefault, active, skuCount, onHand, reserved, lowStockCount (low + out), stockValue }. Adding locations stays on POST /seller/locations (Free 1 location; more needs `multiple_warehouses`, Pro).

### GET /api/v1/seller/inventory/movements
Permission: inventory:manage. Plan: pro (advanced_inventory).
Query: locationId?, kind? (InventoryMovementKind), variantId?, q? (product name, SKU, reference), from?/to? (YYYY-MM-DD, store timezone, inclusive), cursor?, limit? (default 25)
Response 200: CursorPage<InventoryMovement>, newest first. One immutable ledger row per stock change: `adjustment` (any reason, incl. supplier deliveries; reference = reason or goods-received number), `transfer_out` (at send, −qty at source) / `transfer_in` (at receive, +qty at destination), `order_reserved` (−qty available when an app order is paid), `order_shipped` (−qty on hand when shipped; reference = order number; location = fulfilment.fromLocationId), `order_returned` (+qty when a return is received). actorName is the staff member, or "@username" of the buyer for order rows. The server should write these rows at the moment of each change rather than derive them.

### GET /api/v1/seller/inventory/reorder
Permission: inventory:manage. Plan: pro (advanced_inventory).
Query: locationId (defaults like /levels), cursor?, limit? (default 50)
Response 200: CursorPage<ReorderSuggestionRow> — every tracked variant at that location with available ≤ reorderPoint, most urgent first: { variantId, productId, productName, variantTitle, sku, locationId, available, reorderPoint, reorderQuantity, suggestedQuantity (≥ reorderQuantity, enough to get back above the reorder point), supplier: { id, name, leadTimeDays } | null (from product.supplierId), estimatedCost: costPrice × suggestedQuantity | null }

### PATCH /api/v1/seller/inventory/reorder-levels
Permission: inventory:manage. Plan: pro (advanced_inventory).
Body: ReorderLevelUpdateRequest { variantId, reorderPoint 0–1e6, reorderQuantity 1–1e6 }
Response 200: ProductVariant. Errors: 400 VALIDATION_FAILED, 404 VARIANT_NOT_FOUND. Audit `inventory.reorder_level_set`.

### GET /api/v1/seller/suppliers
Permission: inventory:manage. Plan: pro (advanced_inventory).
Query: q? (name, contact, phone), cursor?, limit? (≤ 200, default 50)
Response 200: CursorPage<Supplier> — productCount = non-archived products whose supplierId is this supplier.

### POST /api/v1/seller/suppliers
Permission: inventory:manage. Plan: pro.
Body: SupplierUpsertRequest { name 2–80, contactName ≤ 80, phone /^\+?[0-9 ]{7,20}$/, email null|valid, address ≤ 200, leadTimeDays 0–180, paymentTerms ≤ 80, notes null|≤ 500 }
Response 201: Supplier. Errors: 400 VALIDATION_FAILED, 402 PLAN_FEATURE_REQUIRED

### PATCH /api/v1/seller/suppliers/:supplierId
Permission: inventory:manage. Plan: pro. Body: SupplierUpsertRequest (full replacement). Response 200: Supplier. Errors: 400, 404 SUPPLIER_NOT_FOUND

### DELETE /api/v1/seller/suppliers/:supplierId
Permission: inventory:manage. Plan: pro. Products linked to it get supplierId null. Response 204. Errors: 404 SUPPLIER_NOT_FOUND

### GET /api/v1/seller/inventory/adjustments
Permission: inventory:manage
Query: locationId?, reason?, q?, cursor?, limit?
Response 200: CursorPage<StockAdjustment> (newest first)

### POST /api/v1/seller/inventory/adjustments
Permission: inventory:manage
Headers: Idempotency-Key required
Body: StockAdjustmentRequest { locationId, reason: "received"|"count"|"damaged"|"theft"|"returned"|"expired"|"other", note ≤ 500 (required for theft and other), lines: [{variantId, quantityDelta ≠ 0, |x| ≤ 1e6}] 1–200, unique variants }
Rules: applied atomically; a line may not take on-hand below zero unless reason is "count"; updates the single stock count used for app orders. Free on every plan.
Response 201: CursorPage<StockAdjustment> (the created adjustments, nextCursor null)
Errors: 400 VALIDATION_FAILED, 409 INSUFFICIENT_STOCK

### GET /api/v1/seller/inventory/transfers
Permission: inventory:manage. Plan: pro (advanced_inventory) for every transfer endpoint below.
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
Permission: media:upload (served by the TS media service)
Body: { fileName 1–255, mimeType "image/jpeg"|"image/png"|"image/webp"|"image/avif", sizeBytes 1..10 MiB, purpose: "product", sha256?: 64 hex of the whole file }
Response 201: `{ mode: "single"|"multipart", uploadMode: "presigned"|"proxied", uploadId, mediaId, chunkSizeBytes, totalChunks, uploadedChunks: number[], expiresAt, url?, headers? }`. Files under 8 MiB are `single`: the browser PUTs the whole file to `url` with `headers` (object storage; its origin must be listed in `SELLER_UPLOAD_ORIGINS` for the CSP and allowed by the bucket CORS rules). Larger files are `multipart`.

### PUT /api/v1/media/uploads/:uploadId/chunks/:chunkIndex
Only for `multipart` with `uploadMode: "proxied"`. Headers: Content-Type: application/octet-stream; X-Chunk-Sha256. Errors: 400 CHUNKS_NOT_SUPPORTED (single uploads), 403 PROXIED_CHUNKS_DISABLED.

### POST /api/v1/media/uploads/:uploadId/chunks/urls
Only for `multipart` with `uploadMode: "presigned"`. Body `{ chunkIndexes: number[] (1–16) }`. Response 200: `{ urls: [{ chunkIndex, url, method: "PUT", expectedBytes, expiresAt }] }`; the browser PUTs each chunk to its URL.

### POST /api/v1/media/uploads/:uploadId/complete
No body. Response 200: `{ mediaId, status: "processing" }`. Errors: 409 UPLOAD_NOT_RECEIVED / CHUNKS_MISSING / UPLOAD_CLOSED, 422 SIZE_MISMATCH.

### GET /api/v1/media/:mediaId
Response 200: `{ id, type, status: "processing"|"ready"|"failed", purpose, width, height, variants: [{ url, width, height, format }], failureReason?, failureHint? }`. The dashboard polls every second (up to 20 s) and uses the widest variant.

## Orders, returns and disputes (online marketplace)

Online orders are the marketplace orders customers place in the Zudomart mobile app — the same records the app shows; the dashboard never creates orders. Types: `OnlineOrder`, `OrderTimelineEvent`, `OrderInternalNote`, `OrderRefund`, `OrderDeliveryDetails`, `ReturnRequest`, `OrderDispute` in `apps/seller/src/types/order.type.ts`; `DeliveryStatus` in `apps/seller/src/types/delivery.type.ts`. All resources are scoped to the caller's store; any id from another store returns 404. Every mutation appends an `OrderTimelineEvent` (visible to the seller) and an audit log entry, and notifies the buyer in the app where noted. Not plan-gated.

`OnlineOrder` (additions to the previous shape): `invoiceNumber` (e.g. `INV-10482`), `buyer.phone: string | null`, `paymentStatus: "paid" | "partially_refunded" | "refunded"`, `paymentProvider: "paystack"`, `paymentMode: "escrow" | "direct"` (chosen by the buyer per seller group at checkout; direct only for verified stores, the seller is paid right away and refunds are issued by the seller via `/refunds`), `escrowFee: Money`, `escrowFeeBasisPoints` (150, or 100 on Business), `paymentProcessingFee: Money` (Paystack's fee, charged to the seller on every order; escrow orders also carry the escrow fee, both on the seller-group total including shipping and deducted at payout), `paymentReference` (the provider transaction reference), `paidAt`, `refundedAmount: Money`, `refunds: OrderRefund[]`, `delivery: { status: DeliveryStatus, riderName, riderPhone, estimatedDeliveryAt, attempts, lastAttemptNote }`, `timeline: OrderTimelineEvent[]` (oldest first; `kind` ∈ placed | paid | accepted | rejected | processing | ready | shipped | delivery_failed | delivered | completed | cancelled | returned | refunded | disputed | note), `notes: OrderInternalNote[]` (seller-only, never shown to the buyer), `conversationId: string | null` (the order-linked chat, if one exists).

Status model (`OnlineOrderStatus`): `new` (paid into escrow, awaiting the seller) → `processing` (accepted) → `ready` (packed, awaiting courier) → `shipped` → `delivered` → `completed` (buyer confirmed or auto-release; escrow released). Side states: `cancelled` (rejected/cancelled before shipping), `returned`, `refunded`, `disputed`. `delivery.status` is kept in step: new→pending, processing→preparing, ready→ready_for_pickup, shipped→in_transit (or failed after a failed attempt), delivered/completed→delivered, cancelled/refunded→cancelled, returned→returned.

### GET /api/v1/seller/orders
Permission: orders:view
Query: status? (OnlineOrderStatus | "all"), q? (order number, buyer name or username, city, payment reference), from? / to? (YYYY-MM-DD, inclusive, store timezone), sort? ("createdAt" default | "total" | "items" | "buyer" | "status"), direction? ("descending" default | "ascending"), cursor?, limit? (1–200, default 25)
Response 200: `CursorPage<OnlineOrder> & { countsByStatus: Record<OnlineOrderStatus, number> }` — `countsByStatus` covers all of the store's orders (not just the filtered page).
Errors: 400 VALIDATION_FAILED (unknown status or sort).

### GET /api/v1/seller/orders/:orderId
Permission: orders:view
Response 200: `OnlineOrder`. Errors: 404 ORDER_NOT_FOUND.
The dashboard renders the invoice (`/orders/:id/invoice`) and payment receipt (`/orders/:id/invoice?document=receipt`) client-side from this response and prints them to PDF with a print stylesheet, so no separate invoice endpoint is needed. `invoiceNumber` must be stable and unique per store.

### POST /api/v1/seller/orders/:orderId/accept
Permission: orders:manage. Body: `{}`.
Response 200: `OnlineOrder` (status "processing", delivery.status "preparing", timeline `accepted`). Notifies the buyer.
Errors: 404 ORDER_NOT_FOUND, 409 ORDER_NOT_NEW.

### POST /api/v1/seller/orders/:orderId/reject
Permission: orders:manage
Body: `{ reason: string 5–500 }` (shown to the buyer)
Response 200: `OnlineOrder` (status "cancelled", escrowStatus "refunded", paymentStatus "refunded", refundedAmount = total, a new `OrderRefund`, timeline `rejected`).
Errors: 400 VALIDATION_FAILED, 404, 409 ORDER_NOT_NEW (accepted orders use /cancel).
Rules: full escrow refund through the ledger; release reserved stock; notify the buyer.

### POST /api/v1/seller/orders/:orderId/status
Permission: orders:manage
Body: `{ status: "processing" | "ready" | "delivered" }`
Allowed transitions: new→processing, processing→ready, ready→processing, shipped→delivered. Shipping itself goes through /fulfilment.
Response 200: `OnlineOrder`. For "delivered": `deliveredAt` = now, `escrowReleaseAt` = now + the platform's auto-release window (mock: 3 days), `delivery.status` "delivered", `delivery.attempts` +1.
Errors: 404, 409 INVALID_STATUS_CHANGE.

### POST /api/v1/seller/orders/:orderId/fulfilment
Permission: orders:manage
Headers: Idempotency-Key required (replay returns the stored response with `Idempotent-Replayed: true`).
Body: courier: string 2–60; trackingNumber: string /^[A-Za-z0-9-]{4,40}$/; trackingUrl: https URL ≤300 | null; fromLocationId: active location id of the store.
Response 200: `OnlineOrder` with status "shipped", `fulfilment` set, `delivery.status` "in_transit", `delivery.estimatedDeliveryAt` from the matching delivery area's ETA, timeline `shipped`.
Errors: 400 VALIDATION_FAILED, 404 ORDER_NOT_FOUND, 409 ORDER_NOT_SHIPPABLE (status not new/processing/ready).
Rules: stock was reserved at checkout; on ship reduce both onHand and reserved at fromLocationId. Notify the buyer with the tracking details. Escrow stays held until delivery confirmation or auto-release.

### POST /api/v1/seller/orders/:orderId/cancel
Permission: orders:manage
Body: reason: string 5–500 (shown to buyer)
Response 200: `OnlineOrder` (status "cancelled", escrowStatus "refunded", paymentStatus "refunded", refund recorded, delivery.status "cancelled").
Errors: 404 ORDER_NOT_FOUND, 409 ORDER_NOT_CANCELLABLE (already shipped or later).
Rules: full escrow refund to buyer through the ledger; release reserved stock.

### POST /api/v1/seller/orders/:orderId/notes
Permission: orders:manage
Body: `{ body: string 2–1000 }`
Response 201: `OnlineOrder` with the new `OrderInternalNote` (`authorName` = acting staff member) appended. Notes are never exposed to the buyer API.
Errors: 400 VALIDATION_FAILED, 404.

### POST /api/v1/seller/orders/:orderId/refunds
Permission: orders:manage
Headers: Idempotency-Key required.
Body: `{ amountMinor: integer > 0 (store currency), reason: string 5–500 }`
Response 201: `OnlineOrder` with the `OrderRefund` appended, `refundedAmount` increased and `paymentStatus` "partially_refunded", or — when the whole remaining amount is refunded — `paymentStatus` "refunded", status "refunded", escrowStatus "refunded". Timeline `refunded`.
Errors: 400 VALIDATION_FAILED (amount above `total − refundedAmount`), 404, 409 ORDER_NOT_REFUNDABLE (cancelled, already fully refunded, or disputed — Zudomart decides refunds while a dispute is open).
Rules: refunds come out of escrow while held, otherwise from the seller's wallet balance through the ledger (may take it negative — show as owed); the provider fee is not refunded to the seller; notify the buyer.

### POST /api/v1/seller/orders/:orderId/conversation
Permission: orders:manage (the dashboard only shows "Contact customer" to members with messages:manage too)
Body: none. Response 200: `Conversation` — the existing order-linked conversation with the buyer, or a newly created empty one (also sets `OnlineOrder.conversationId`). The dashboard then opens `/messages?conversation=:id`.
Errors: 404.

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
Permission: orders:manage. Header: `Idempotency-Key` (required; 400 IDEMPOTENCY_KEY_REQUIRED without it).
Body: body: string 10–2000
Response 201: `OrderDispute` with the new message (from "seller") appended and status "under_review".
Errors: 400 VALIDATION_FAILED, 404, 409 DISPUTE_CLOSED.

## Delivery

Delivery data is derived from the store's online orders (`OnlineOrder.delivery`, `fulfilment`, `shippingFee`) plus the store's delivery areas. Types in `apps/seller/src/types/delivery.type.ts`: `DeliveryShipment`, `DeliverySummary`, `DeliveryArea`, `DeliveryAreaInput`. Pipeline statuses shown as tabs: pending, preparing, ready_for_pickup, in_transit, delivered, failed. Not plan-gated. Every write appends an order timeline event (where it concerns an order) and an audit log entry.

### GET /api/v1/seller/delivery/summary
Permission: delivery:manage
Response 200: `DeliverySummary` — `countsByStatus` (pipeline statuses only), `feesCollectedLast30Days: Money` (sum of `shippingFee` on non-cancelled orders created in the last 30 days), `averageDeliveryDays: number | null` (shippedAt→deliveredAt, one decimal), `failedDeliveryRateBasisPoints` (failed ÷ (delivered + failed)), `onTimeRateBasisPoints` (delivered on or before `estimatedDeliveryAt`).

### GET /api/v1/seller/delivery/shipments
Permission: delivery:manage
Query: status? (pipeline status | "all"; "all" excludes cancelled and returned), q? (order number, buyer, city, tracking number, rider), cursor?, limit? (≤200; the dashboard asks for 200 and sorts/pages client-side)
Response 200: `CursorPage<DeliveryShipment>` (one row per order: orderId, orderNumber, buyerName, buyerUsername, city, state, status, courier, trackingNumber, riderName, riderPhone, estimatedDeliveryAt, attempts, lastAttemptNote, deliveryFee, itemsCount, orderedAt, updatedAt = latest timeline event).
Errors: 400 VALIDATION_FAILED (unknown status).

### PATCH /api/v1/seller/delivery/shipments/:orderId
Permission: delivery:manage
Body (all optional): `{ riderName: string 2–60 | "", riderPhone: /^\+?[0-9 ]{7,16}$/ | "", estimatedDeliveryAt: ISO, retry: boolean }` — empty strings clear the rider; `retry: true` moves a `failed` shipment back to `in_transit` for another attempt.
Response 200: `DeliveryShipment`. Errors: 400 VALIDATION_FAILED, 404 ORDER_NOT_FOUND.

### POST /api/v1/seller/delivery/shipments/:orderId/attempts
Permission: delivery:manage
Body: `{ outcome: "delivered" | "failed", note?: string ≤300 (required, ≥3, when failed) }`
Response 200: `DeliveryShipment`. "delivered" has the same effect as `POST /orders/:id/status { status: "delivered" }`; "failed" sets delivery.status "failed", increments attempts, stores the note and adds a `delivery_failed` timeline event (the buyer is notified to reschedule).
Errors: 400 VALIDATION_FAILED, 404, 409 NOT_IN_TRANSIT (only in_transit or failed shipments).

### GET /api/v1/seller/delivery/areas
Permission: delivery:manage. Response 200: `CursorPage<DeliveryArea>` (all areas, nextCursor null).
These areas drive the delivery fee and ETA the buyer sees at checkout in the Zudomart app for this store.

### POST /api/v1/seller/delivery/areas
Permission: delivery:manage
Body: `DeliveryAreaInput` — name 2–60; state 2–40; cities: 1–40 unique non-empty strings; feeMinor: integer 0–100,000,000 (store currency); estimatedDaysMin: integer 0–30; estimatedDaysMax: integer ≥ min, ≤30; active: boolean.
Response 201: `DeliveryArea` (fee as Money in the store currency).
Errors: 400 VALIDATION_FAILED, 409 AREA_LIMIT_REACHED (max 50 areas).

### PATCH /api/v1/seller/delivery/areas/:areaId
Permission: delivery:manage. Body: any subset of `DeliveryAreaInput` (validated as a whole after merging). Response 200: `DeliveryArea`. Errors: 400, 404 AREA_NOT_FOUND.

### DELETE /api/v1/seller/delivery/areas/:areaId
Permission: delivery:manage. Response 204. Errors: 404 AREA_NOT_FOUND. Orders already placed keep the fee they paid.

## Shipping configuration

Sellers ship their own orders; ZudoMart validates the customer's address against the seller's rules and calculates the charge. Shipping is priced **per order group** (all items from this seller in one checkout), never per item. **Available on every plan including Free** (`shipping_rules` in `planFeatures.config.ts`, minimum plan `free`; never returns 402). Permission: `delivery:manage` for writes, any store member for reads. Types in `apps/seller/src/types/shipping.type.ts`; Nigeria geo data (36 states + FCT; LGAs for the major states) in `apps/seller/src/constants/nigeriaGeo.constant.ts`. All amounts are `Money` `{ amountMinor, currency }`.

Shapes:
- `ShippingDestination`: `{ level: "country" | "state" | "lga", countryCode: "NG", stateCode: string | null (ISO 3166-2 suffix, e.g. "OG"), lgaName: string | null }`. A `country` destination covers every state; a `state` destination covers every LGA in it.
- `ShippingZone`: `{ id, name, destinations: ShippingDestination[] }` — a named destination group. A zone belongs to exactly one rule and is created, edited and deleted with it.
- `ShippingRule`: `{ id, zoneId, type: "flat_fee" | "free", fee: Money (zero when free), active: boolean }`.
- `ShippingProfile`: `{ id, currency, pricedPer: "order_group", freeShippingThreshold: Money | null, zones: ShippingZone[], rules: ShippingRule[], updatedAt }`. One profile per store.
- `ShippingCalculation`: `{ outcome: "fee" | "free_rule" | "free_threshold" | "not_deliverable", fee: Money, ruleId, zoneName, matchedLevel, thresholdApplied: Money | null }`.
- `ShippingCalculationSnapshot` (extends `ShippingCalculation`): `{ orderId, destinationLabel, orderSubtotal: Money, feeCharged: Money, calculatedAt }` — stored on the order at checkout and never recalculated.

Resolution: consider active rules whose zone contains the customer's location; the most specific match wins (lga over state over country). A `free` rule gives free shipping; otherwise if `freeShippingThreshold` is set and the order group subtotal is at or above it the fee is zero; otherwise the rule's fee applies. No match means `not_deliverable` and checkout is blocked for that address.

### GET /api/v1/seller/shipping/profile
Response 200: `ShippingProfile`. A new store gets an empty profile (no rules, no threshold).

### PATCH /api/v1/seller/shipping/profile
Body: `{ freeShippingThresholdMinor: number > 0 | null }` (`null` turns the threshold off). Response 200: `ShippingProfile`. 422 on a non-positive amount.

### POST /api/v1/seller/shipping/rules
Body: `{ zoneName: string 2–60, destinations: ShippingDestination[] (1+, valid state codes and LGA names), type: "flat_fee" | "free", feeMinor: integer 0–100000000 (ignored when free), active?: boolean (default true) }`.
Response 201: `{ zone: ShippingZone, rule: ShippingRule }`. 409 `RULE_LIMIT_REACHED` beyond 50 rules. 422 with issue paths `zoneName`, `type`, `feeMinor`, `destinations`.

### PATCH /api/v1/seller/shipping/rules/:ruleId
Body: any subset of the POST body (a lone `{ active }` is the per-rule toggle). Response 200: `{ zone, rule }`. 404 `RULE_NOT_FOUND`.

### DELETE /api/v1/seller/shipping/rules/:ruleId
Removes the rule and its zone. Response 204. 404 `RULE_NOT_FOUND`.

### GET /api/v1/seller/shipping/preview
Query: `stateCode` (required), `lgaName` (optional), `orderTotalMinor` (required integer ≥ 0). Response 200: `ShippingCalculation` for the current profile, for example Ogun with a 3000000 order total returns `{ outcome: "fee", fee: { amountMinor: 200000, currency: "NGN" } }`. The dashboard computes the same result client-side from the profile with `calculateShippingForOrderGroup`.

### GET /api/v1/seller/orders/:orderId/shipping-snapshot
Permission: orders:view. Response 200: `ShippingCalculationSnapshot` — destination, rule applied, outcome and the fee charged, shown on order detail. 404 `ORDER_NOT_FOUND`.


## Messages (customer conversations)

These are the same buyer↔store conversations as the Zudomart mobile app (one conversation per buyer per store, optionally linked to an order); replies sent from the dashboard arrive in the app in real time and vice versa. Types in `apps/seller/src/types/conversation.type.ts`: `Conversation`, `ConversationMessage`, `ConversationThread`. Seller-side messages carry the acting staff member's name in `senderName` but are shown to the buyer as the store. Not plan-gated. Message bodies are plain text; the API must strip/escape markup and rate-limit sends.

### GET /api/v1/seller/conversations
Permission: messages:manage
Query: filter? ("all" default | "unread" | "orders" — order-linked only), q? (customer name, username, order number, last message text), cursor?, limit? (≤200, default 50)
Response 200: `CursorPage<Conversation> & { unreadConversationsCount: number }`, most recently updated first. `unreadCount` = customer messages the store has not read.

### GET /api/v1/seller/conversations/:conversationId
Permission: messages:manage
Response 200: `ConversationThread` = `{ conversation, messages: ConversationMessage[] }` (oldest first; the API may cap at the latest 200 and add cursor paging later).
Errors: 404 CONVERSATION_NOT_FOUND.

### POST /api/v1/seller/conversations/:conversationId/messages
Permission: messages:manage
Body: `{ body: string 1–2000 }`
Response 201: `ConversationMessage` (from "seller"). Updates the conversation's lastMessage/updatedAt and pushes a notification to the buyer.
Errors: 400 VALIDATION_FAILED, 404, 403 CUSTOMER_BLOCKED_STORE, 429.

### POST /api/v1/seller/conversations/:conversationId/read
Permission: messages:manage. Body: none. Response 200: `Conversation` with `unreadCount` 0 (marks every customer message read for the store).
Errors: 404.

## Customers (CRM)

Customers are Zudomart app buyers (the people who placed marketplace orders in the app), plus anyone the seller adds by hand. Types: `Customer`, `CustomerPurchase`, `CustomersSummary`, `CustomerSegment`, `CustomerSegmentRule`, `CustomerSegmentInput` in `apps/seller/src/types/customer.type.ts`. Segment rule evaluation is mirrored in `apps/seller/src/utils/customerSegmentRules.util.ts`. All Money is in the store currency. Stats (`totalSpent`, `averageOrderValue`, `purchasesCount`, `firstPurchaseAt`, `lastPurchaseAt`, `city`) are computed server-side from the buyer's app orders (cancelled and refunded orders excluded). There are no in-store sales.

### GET /api/v1/seller/customers
Permission: customers:view
Query: q? (name, @username, phone, email, city), tag?, type? ("all" | "new" = exactly 1 order | "returning" = 2+ orders | "no_orders"), segmentId? (built-in or custom; **Plan: pro**, ignored on Free), sort? ("recent" default = last order | "spend" | "purchases" | "aov" | "first" | "name"), direction? ("asc" | "desc"; default desc, except name asc), cursor?, limit? (≤200, default 25)
Response 200: CursorPage<Customer>
Errors: 404 SEGMENT_NOT_FOUND

### GET /api/v1/seller/customers/summary
Permission: customers:view
Response 200: `CustomersSummary` = `{ totalCustomers, newThisMonth (first order in the current store-timezone month), returningCustomers (2+ orders), repeatRateBasisPoints (returning ÷ customers with ≥1 order), averageOrderValue: Money, totalRevenue: Money, growth: [{ month: "YYYY-MM", newCustomers, returningCustomers }] (last 6 months, oldest first) }`

### POST /api/v1/seller/customers
Permission: customers:manage
Body: `{ name 2–80, phone?, email?, tags?: string[] (≤10, lower-cased, ≤24 chars), marketingOptIn?: boolean }`
Response 201: Customer. Errors: 400 VALIDATION_FAILED; 409 CUSTOMER_EXISTS `{ message, code, customer }` (same phone or email).

### GET /api/v1/seller/customers/export
Permission: customers:view. Same query as the list. Returns CSV: Name, Phone, Email, Zudomart username, City, Tags, Total spent, Average order value, Currency, Orders, First order, Last order, Marketing opt-in.

### GET /api/v1/seller/customers/:customerId
### PATCH /api/v1/seller/customers/:customerId
Permission: customers:view (GET), customers:manage (PATCH). PATCH body as POST (all optional). Response 200: Customer. Errors: 404 CUSTOMER_NOT_FOUND, 409 CUSTOMER_EXISTS.

### GET /api/v1/seller/customers/:customerId/purchases
Permission: customers:view. Query: cursor?, limit? (default 20)
Response 200: `CursorPage<CustomerPurchase>` = app orders by this buyer, newest first: `{ kind: "online_order", id, reference (order number), status (OnlineOrderStatus), total: Money, itemsCount, createdAt }`.

### POST /api/v1/seller/customers/:customerId/notes
Permission: customers:manage. Body `{ body: 2–1000 }`. Response 201: Customer (note prepended, author = caller).

### GET /api/v1/seller/customers/segments
Permission: customers:view. **Plan: pro** (`customer_segments`).
Response 200: `CursorPage<CustomerSegment>` (nextCursor null). Four built-in segments are always returned first: `seg_new` (1 order, first order ≤30 days ago), `seg_returning` (2+ orders), `seg_vip` (total spent ≥ the store's top-15% spend threshold, recomputed daily), `seg_at_risk` (2+ orders and none for ≥60 days); then the store's custom segments. Each has live `customerCount`, `totalSpent`, `averageOrderValue`.

### POST /api/v1/seller/customers/segments
### PATCH /api/v1/seller/customers/segments/:segmentId
Permission: customers:manage. **Plan: pro**.
Body `CustomerSegmentInput` = `{ name 2–60, description ≤200, rules: 1–8 × { field: "total_spent"|"average_order_value" (value = minor units int ≥0) | "purchases_count"|"days_since_last_purchase"|"days_since_first_purchase" (int ≥0) | "tag"|"city" (string 1–40, case-insensitive equality) | "marketing_opt_in" (boolean), operator: "at_least"|"at_most"|"equals" } }`. A customer is in the segment when every rule matches.
Response 201/200: CustomerSegment. Errors: 400 VALIDATION_FAILED; 404 SEGMENT_NOT_FOUND (built-in segments cannot be edited); 409 SEGMENT_LIMIT_REACHED (20 custom segments); 402 PLAN_FEATURE_REQUIRED.

### DELETE /api/v1/seller/customers/segments/:segmentId
Permission: customers:manage. **Plan: pro**. Response 204. Custom segments only.

## Promotions (discount codes and product discounts)

Types: `Promotion`, `PromotionStatus` (`apps/seller/src/types/promotion.type.ts`); validation `apps/seller/src/utils/promotionValidation.util.ts`. Promotions apply to marketplace orders in the Zudomart app only — there is no channel field and no in-store use. Discount codes (`coupon`) and product discounts (`automatic`) are included on every plan; `scheduled_sale` too.

### GET /api/v1/seller/promotions
Permission: promotions:manage. Query: status? ("all"|"active"|"scheduled"|"expired"|"disabled"), kind? ("all"|"coupon"|"automatic"|"scheduled_sale"), q?, cursor?, limit? (default 50).
Response 200: CursorPage<Promotion> (status recomputed from the schedule and usage on every read).

### POST /api/v1/seller/promotions
### PATCH /api/v1/seller/promotions/:promotionId
Permission: promotions:manage.
Body (PromotionInput): name 3–80; kind "coupon" | "automatic" | "scheduled_sale"; code (coupon only) /^[A-Z0-9_-]{3,24}$/ (server upper-cases; unique per store, 409 COUPON_CODE_TAKEN); discount `{ kind: "percent", value: 1–10000 bp } | { kind: "amount", value: minor units > 0 }`; scope `{ kind: "all"|"products"|"categories", ids: string[] (≤200, required unless all) }`; minimumSpendMinor int ≥0 | null; usageLimit / usageLimitPerCustomer int 1–10,000,000 | null; startsAt ISO; endsAt ISO | null (required for scheduled_sale, > startsAt). PATCH may also send `{ status: "disabled" | "active" }` to switch off/on.
Response 201/200: Promotion. Errors: 400 VALIDATION_FAILED, 404 PROMOTION_NOT_FOUND, 409 COUPON_CODE_TAKEN.

### GET /api/v1/seller/promotions/:promotionId
### DELETE /api/v1/seller/promotions/:promotionId
Permission: promotions:manage. GET → Promotion; DELETE → 204 (orders already discounted keep their discount; prefer switching off promotions that have been used).

### POST /api/v1/seller/promotions/validate-code
Permission: promotions:manage (the app's checkout uses the same logic server-side).
Body: `{ code, subtotalMinor: int ≥0 }`. Response 200 `{ promotionId, code, discount, scope, discountMinor, message }`. Errors: 404 COUPON_NOT_FOUND, 422 COUPON_NOT_APPLICABLE (disabled, not started, expired/limit reached, below minimum spend). Checkout re-validates and increments `usedCount` atomically.

## Marketing

Types in `apps/seller/src/types/marketing.type.ts`; validation in `apps/seller/src/utils/marketingValidation.util.ts`. Flash sales, bundles and featured products need **Plan: pro** (`advanced_promotions`) and return `402 PLAN_FEATURE_REQUIRED` on Free. Product ids must belong to the store and be active. All prices are minor units in the store currency.

### GET /api/v1/seller/marketing/overview
Permission: promotions:manage. Not gated.
Response 200: `MarketingOverview` = `{ activeCampaigns, scheduledCampaigns, redemptionsLast30Days, revenueLast30Days: Money, discountGivenLast30Days: Money, campaigns: MarketingCampaign[] }` where `MarketingCampaign = { id, kind: "discount_code"|"product_discount"|"scheduled_sale"|"flash_sale"|"bundle"|"featured_products", name, status: "draft"|"scheduled"|"active"|"ended"|"paused", startsAt, endsAt, reach (unique buyers who saw it), redemptions (codes used / units sold / taps for featured), revenue: Money (order revenue attributed to the campaign), href (dashboard path) }`. Flash sales, bundles and featured products are only included when the plan has `advanced_promotions`.

### GET /api/v1/seller/marketing/product-options
Permission: promotions:manage. Query: q?. Response 200: `CursorPage<MarketingProductOption>` (≤20 active products) `{ productId, name, imageUrl, price: Money (first variant) }`.

### GET /api/v1/seller/marketing/flash-sales
Permission: promotions:manage. **Plan: pro**. Query: status?, cursor?, limit?. Response 200: CursorPage<FlashSale> newest start first; status recomputed from the schedule (paused stays paused).
`FlashSale = { id, name, items: [{ productId, productName, imageUrl, originalPrice, salePrice, stockCap: int|null, soldCount }], startsAt, endsAt, status, reach, revenue, createdAt }`

### POST /api/v1/seller/marketing/flash-sales
### PATCH /api/v1/seller/marketing/flash-sales/:flashSaleId
Permission: promotions:manage. **Plan: pro**.
Body `FlashSaleInput` = `{ name 3–80, startsAt ISO, endsAt ISO (> startsAt, ≤ 7 days later), items: 1–20 unique × { productId, salePriceMinor (> 0 and < the product's regular price), stockCap: int 1–100,000 | null } }`. PATCH may instead send `{ action: "pause" | "resume" | "end" }`.
Response 201/200: FlashSale. Errors: 400 VALIDATION_FAILED, 404 NOT_FOUND, 409 FLASH_SALE_ENDED (edit after end). The sale price stops applying once `soldCount` reaches `stockCap`. Buyers see a countdown in the app.

### DELETE /api/v1/seller/marketing/flash-sales/:flashSaleId
Permission: promotions:manage. **Plan: pro**. 204. Errors: 409 FLASH_SALE_ACTIVE (end it first).

### GET /api/v1/seller/marketing/bundles
### POST /api/v1/seller/marketing/bundles
### PATCH /api/v1/seller/marketing/bundles/:bundleId
### DELETE /api/v1/seller/marketing/bundles/:bundleId
Permission: promotions:manage. **Plan: pro**.
`ProductBundle = { id, name, description, items: [{ productId, productName, imageUrl, quantity, unitPrice }], bundlePrice, regularPrice (sum of unit price × quantity), status: "active"|"paused"|"draft", soldCount, revenue, createdAt }`.
Body `ProductBundleInput` = `{ name 3–80, description ≤300, bundlePriceMinor (> 0 and < regular total), status, items: 1–10 unique products × { productId, quantity 1–20 }, at least 2 units in total }`. Responses: GET CursorPage<ProductBundle>; POST 201 / PATCH 200 ProductBundle; DELETE 204. Errors: 400 VALIDATION_FAILED, 404 NOT_FOUND.

### GET /api/v1/seller/marketing/featured-products
### PUT /api/v1/seller/marketing/featured-products
Permission: promotions:manage. **Plan: pro**.
`FeaturedProduct = { productId, productName, imageUrl, price, placement: "storefront"|"mart", position (1-based), featuredSince, views, clicks }`.
PUT body `{ items: [{ productId, placement }] }` replaces the whole ordered list (≤12 items, ≤4 with placement "mart", unique products). Response 200: CursorPage<FeaturedProduct> in display order. Errors: 400 VALIDATION_FAILED.

## Ads summary (read-only view of Ads Manager)

Campaigns are created and edited in Ads Manager (`NEXT_PUBLIC_ADS_MANAGER_URL`, `https://ads.zudomart.com`); creating ads is not gated. The dashboard only reads results. Types in `apps/seller/src/types/ads.type.ts`.

### GET /api/v1/seller/ads/summary
Permission: ads:view. **Plan: pro** (`ads_tools`); 402 PLAN_FEATURE_REQUIRED on Free.
Query: from?, to? (YYYY-MM-DD, default last 30 days, ≤ 366 days).
Response 200: `AdsSummary` = `{ from, to, hasAdsAccount, adCreditBalance: Money|null, totals: AdPerformanceTotals, daily: [{ date, spend, attributedRevenue, clicks, impressions }] (one per day, zero-filled), campaigns: AdCampaignSummary[] }` where `AdPerformanceTotals = { spend: Money, impressions, clicks, clickThroughRateBasisPoints, attributedOrders, attributedRevenue: Money, returnOnAdSpendHundredths (revenue ÷ spend × 100) }` and `AdCampaignSummary = AdPerformanceTotals & { id, name, objective: "sales"|"traffic"|"awareness"|"followers", placement, status: "active"|"paused"|"scheduled"|"ended"|"in_review"|"rejected", dailyBudget: Money, startsAt, endsAt|null, manageUrl (deep link into Ads Manager) }`. Attribution: an app order counts for a campaign when the buyer clicked that campaign's ad within 7 days before ordering (last click wins). Metrics are within the date range only.

## Reviews and reputation

Types in `apps/seller/src/types/review.type.ts`. Buyers write reviews in the app after delivery (`isVerifiedPurchase`). Not plan-gated.

### GET /api/v1/seller/reviews
Permission: reviews:manage
Query: kind? ("all"|"product"|"store"), rating? (1–5), replied? ("yes"|"no"), q? (text, buyer, product, order number), sort? ("newest" default | "oldest" | "lowest" | "highest" | "helpful"), cursor?, limit? (default 10)
Response 200: CursorPage<Review> where `Review = { id, kind, product: { id, name, imageUrl } | null, rating 1–5, title|null, body, author: { name, username }, orderNumber|null, isVerifiedPurchase, photoCount, helpfulCount, status: "published"|"reported"|"hidden", reply: { body, authorName, createdAt, updatedAt|null } | null, createdAt }`.

### GET /api/v1/seller/reviews/summary
Permission: reviews:manage
Response 200: `ReviewsSummary` = `{ averageRatingHundredths, totalReviews, productReviews, storeReviews, distribution: { "1".."5": count }, responseRateBasisPoints (replied ÷ total), unansweredCount, trend: [{ month: "YYYY-MM", averageRatingHundredths, reviewCount }] (last 6 months) }`. Hidden reviews are excluded.

### PUT /api/v1/seller/reviews/:reviewId/reply
Permission: reviews:manage. Body `{ body: 2–1000 }`. Creates or edits the store's single public reply (author shown as the store name; edits set `updatedAt`). The buyer gets an app notification. Response 200: Review. Errors: 400 VALIDATION_FAILED, 404 REVIEW_NOT_FOUND. Audit `review.replied`.

### DELETE /api/v1/seller/reviews/:reviewId/reply
Permission: reviews:manage. Response 200: Review with `reply: null`.

### POST /api/v1/seller/reviews/:reviewId/report
Permission: reviews:manage. Body `{ reason: "spam"|"offensive"|"fake"|"not_about_purchase"|"personal_information"|"other", details?: ≤500 (5–500 required when reason is "other") }`. Sends the review to Zudomart moderation; it stays visible until a moderator decides. Response 200: Review (status "reported"). Errors: 400 VALIDATION_FAILED, 404 REVIEW_NOT_FOUND, 409 ALREADY_REPORTED.

## Dashboard, reports, wallet and payouts

Types: `apps/seller/src/types/dashboard.type.ts`, `report.type.ts`, `wallet.type.ts`, `walletExtra.type.ts`, `finance.type.ts`; report kinds and groups in `apps/seller/src/constants/reportCatalog.constant.ts`. All Money is in the store currency. Dates in query strings are `YYYY-MM-DD` store-local dates (store `timezone`), inclusive. Online orders are the marketplace orders placed in the Zudomart app; there are no in-store sales, so reports have no channel filter. Fee model used by the demo backend (the API is the source of truth): marketplace commission 3.5% + payment processing 1.5% of the order's item subtotal, deducted before escrow is released; shipping is not part of the seller's revenue; the withdrawal fee is the payment provider's fee.

### GET /api/v1/seller/dashboard
Permission: dashboard:view (every role). Plan: free.
Query: `locationId?: string | "all"` — only narrows the low-stock figures (app orders are not tied to a location). 400 VALIDATION_FAILED if the location is not the store's.
Response 200: `DashboardSummary` (apps/seller/src/types/dashboard.type.ts). All Money is in the store currency; "today" and day boundaries use the store timezone. Sales = order line subtotals of app orders, excluding `cancelled` and `refunded` orders and excluding shipping.
- `salesToday` / `salesThisWeek` (rolling 7 days) / `salesThisMonth` (rolling 30 days): `{ label, current: Money, previous: Money, ordersCount }` — `previous` is the same-length period immediately before.
- `lifetimeSales`: `{ total: Money, ordersCount }` since the store opened.
- `ordersByStatus`: one entry per status, in this order: new, processing, ready, shipped, delivered, completed, cancelled, returned, refunded, disputed.
- `dailyRevenue`: exactly 30 points, oldest first, zero-filled: `{ date: "YYYY-MM-DD", revenue: Money, ordersCount }`.
- `topProducts`: up to 5 products by revenue in the last 30 days: `{ productId, name, imageUrl, unitsSold, revenue }`.
- `lowStockAlerts`: up to 8 variant×location rows where `onHand − reserved ≤ lowStockThreshold`, lowest first.
- `catalog`: `{ totalProducts (non-archived), activeProducts, draftProducts, lowStockCount, outOfStockCount }` (counts of variant×location rows).
- `traffic`: `{ storeViews, previousStoreViews, visitors, conversionRateBasisPoints, previousConversionRateBasisPoints, dailyStoreViews: number[30] }` for the last 30 days vs the 30 before. Conversion = orders ÷ unique visitors, in basis points. Views come from the app's storefront and product-page view events.
- `customerGrowth`: `{ totalCustomers, newCustomers (first seen in last 30 days), previousNewCustomers, returningCustomers (more than one purchase and bought in last 30 days), dailyNewCustomers: number[30] }`.
- `balances`: `WalletBalances` or `null` when the caller lacks wallet:view. "Pending settlement" in the UI = escrow + pending.
- `recentOrders`: 6 newest app orders: `{ id, orderNumber, customerName, customerUsername, itemsCount, total, status, createdAt }`.
- `activity`: up to 10 newest `DashboardActivityEntry` `{ id, kind: "order_placed"|"order_shipped"|"order_delivered"|"dispute_opened"|"return_requested"|"team_action", summary, actorName|null, href|null, createdAt }` merged from orders, disputes, returns and the audit log; never in the future.
- `alerts`: `DashboardAlert[]` `{ kind: "orders_to_accept"|"disputes_awaiting_response"|"returns_requested"|"out_of_stock"|"low_stock"|"unanswered_messages", severity: "info"|"caution"|"error", count, title, description, href }` — only kinds with count > 0. `unanswered_messages` = conversations whose last message is from the customer (see Messages).

### GET /api/v1/seller/reports/:reportKind
Permission: reports:view
Path: reportKind ∈ sales-by-day | sales-by-product | sales-by-category | sales-by-location | tax | orders-by-status | order-fulfilment-time | inventory-valuation | low-stock | customers-new-vs-returning | top-customers | best-sellers | slow-sellers | settlements | fees | refunds | payouts | ads-campaigns
Plan: Free = groups Sales (`sales-by-*`, `tax`) and Inventory (`inventory-valuation`, `low-stock`). Every other kind is **Plan: pro** (`advanced_reports`) → `402 PLAN_FEATURE_REQUIRED { message, code, requiredPlan: "pro" }` on Free. (Excel and PDF are produced client-side from the JSON response; the UI only offers them on Pro.)
Query: from?: date (default today − 29 days), to?: date (default today), max span 366 days, from ≤ to (ignored by inventory-valuation and low-stock); locationId?: string | "all" (fulfilment location = the location an order shipped from; honoured by sales-by-day, sales-by-product, sales-by-category, inventory-valuation, low-stock); format?: "csv".
Response 200 (JSON): `ReportResult { reportKind, title, from, to, columns: ReportColumn[] {key, label, kind: "text"|"money"|"number"|"percent"|"date"}, rows: Record<key, string|number|Money|null>[], totals: Record<key, …> | null, generatedAt }`. Percent cells are basis points. Date cells are `YYYY-MM-DD` or ISO.
Response 200 (format=csv): `text/csv` attachment `<kind>_<from>_<to>.csv`; money columns as major-unit decimals with the currency in the header (`Revenue (NGN)`), percent as `12.50` with `(%)` in the header; totals row last; formula-injection neutralised.
Sales are order lines of orders whose status is not cancelled / refunded / returned, dated by order `createdAt`.
- sales-by-day: one row per day (zero-filled): date, orders, items, averageOrder, revenue.
- sales-by-product: product, category, units, revenue, cost (variant cost × units), grossProfit, margin.
- sales-by-category: group (category), orders, units, revenue, share.
- sales-by-location: group (customer's shipping state), orders, units, revenue, share.
- tax: one row per store tax rate: taxName, rate, taxableSales (net), taxCollected, grossSales; plus "Exempt (not taxable)".
- orders-by-status: status (label), orders, value (order total incl. shipping), share of orders — every order created in range.
- order-fulfilment-time: one row per week (Monday start) of shipped orders: week, shipped, averageHoursToShip (created → shipped), averageHoursToDeliver (shipped → delivered), shippedWithin48Hours (bp).
- inventory-valuation: product, variant, sku, location, onHand, unitCost, costValue, retailValue, potentialProfit (tracked, non-archived products).
- low-stock: variants of active tracked products where available (onHand − reserved) ≤ lowStockThreshold: product, variant, sku, location, status ("Low stock"|"Out of stock"), available, reorderLevel, suggestedReorder (max(2 × reorderLevel − available, 1)), reorderCost.
- customers-new-vs-returning: per week: customers, newCustomers (first ever order with this store falls in that week), returningCustomers, newRevenue, returningRevenue, returningShare.
- top-customers: top 50 buyers by item subtotal: customer, username, state, orders, spent, averageOrder, lastOrder.
- best-sellers: top 25 products by units: rank, product, category, units, orders, revenue.
- slow-sellers: active products with ≤ 2 units sold in range: product, category, units, onHand, stockValue (at cost).
- settlements: settlements settled in range: reference, settledAt, orders, gross, fees, net, status.
- fees: one row per fee type (see GET /seller/finance/fees): fee, rate, count, amount, shareOfSales.
- refunds: refunds in range (see GET /seller/finance/refunds): date, order, customer, kind, reason, amount.
- payouts: payouts requested in range: requestedAt, reference, account, status, amount, fee.
- ads-campaigns: one row per Ads Manager campaign with delivery in range: campaign, status, spend, impressions, clicks, clickThroughRate (bp), orders (attributed), revenue (attributed), roas (revenue ÷ spend, 2 decimals). Source: the ads service (apps/ads); attribution window owned by the ads service.
Errors: 400 VALIDATION_FAILED (bad dates/location), 402 PLAN_FEATURE_REQUIRED, 404 REPORT_NOT_FOUND.

### GET /api/v1/seller/wallet/balances
Permission: wallet:view
Response 200: WalletBalances { escrow, pending (released, clearing — shown as "pending settlement"), available, nextEscrowReleaseAt }. Balances come only from the ledger.

### GET /api/v1/seller/wallet/transactions
Permission: wallet:view
Query: kind?: WalletTransactionKind (`escrow_hold | escrow_release | payout | refund | fee | affiliate_commission | ads_charge | subscription_charge | adjustment` — `pos_settlement` is removed); from?: date; to?: date; cursor?; limit? (≤ 200, default 25)
Response 200: CursorPage<WalletTransaction>, newest first.

### GET /api/v1/seller/wallet/statements
Permission: wallet:view
Query: month: `YYYY-MM` (required)
Response 200: text/csv (`wallet-statement-<month>.csv`) columns Date, Description, Reference, Type, Balance, Direction, Amount (<CUR>) — debits negative, oldest first. The PDF version is rendered by the dashboard from GET /seller/finance/statements/:month and printed by the browser.
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

### GET /api/v1/seller/finance/summary
Permission: wallet:view
Query: from?, to? (default last 30 days)
Response 200: `FinanceSummary { from, to, balances: WalletBalances, grossSales, totalFees, refunds, netEarnings, paidOut, ordersCount, upcomingReleases: EscrowEntry[] (≤5, status held, soonest releaseExpectedAt first) }`.
- grossSales = item subtotals of orders created in range whose escrow was not refunded; totalFees = sum of the fee lines of GET /finance/fees for the same range; netEarnings = grossSales − totalFees; refunds = sum of RefundEntry.amount created in range; paidOut = payouts requested in range that did not fail.

### GET /api/v1/seller/finance/escrow
Permission: wallet:view
Query: status?: "held"|"released"|"refunded"|"disputed"; q? (order number, buyer name or username); cursor?; limit? (≤ 200, default 50)
Response 200: `EscrowEntriesPage = CursorPage<EscrowEntry> & { countsByStatus: Record<EscrowStatus, number>, totalsByStatus: Record<EscrowStatus, Money> }` (counts and totals ignore the status/q filter). `EscrowEntry { orderId, orderNumber, buyerName, buyerUsername, gross (item subtotal), fees, net (= order.sellerPayout), status, heldAt, releaseExpectedAt (held only), releasedAt, settlementId }`, newest heldAt first.
Errors: 400 VALIDATION_FAILED (unknown status).

### GET /api/v1/seller/finance/settlements
Permission: wallet:view
Query: cursor?, limit? (≤ 200, default 50)
Response 200: CursorPage<Settlement>, newest first. `Settlement { id, reference ("STL-YYYYMMDD" of the week start), periodStart, periodEnd, ordersCount, gross, fees, net, status: "settled"|"clearing", settledAt }`. A settlement batches the escrow released into the wallet during one week (Monday–Sunday, store timezone); the current week is "clearing".

### GET /api/v1/seller/finance/settlements/:settlementId
Permission: wallet:view
Response 200: `SettlementDetail { settlement, orders: EscrowEntry[] }`.
Errors: 404 SETTLEMENT_NOT_FOUND.

### GET /api/v1/seller/finance/fees
Permission: wallet:view
Query: from?, to? (default last 30 days)
Response 200: `FinanceFeeBreakdown { from, to, grossSales, totalFees, netEarnings, lines: FinanceFeeLine[] }`, `FinanceFeeLine { kind: "escrow_fee"|"payment_processing"|"withdrawal"|"ads"|"subscription", label, description, rateBasisPoints: number|null, count, amount }` — always all five kinds (zero when unused). Escrow fee (1.5%, 1% on Business) and processing come from orders created in range (refunded orders excluded, their fees are returned); withdrawal from payouts requested in range; ads and subscription from wallet charges in range.

### GET /api/v1/seller/finance/refunds
Permission: wallet:view
Query: from?, to? (default last 90 days), q?, cursor?, limit? (≤ 200, default 50)
Response 200: CursorPage<RefundEntry>, newest first. `RefundEntry { id, orderId, orderNumber, buyerName, kind: "cancelled_before_shipping"|"refunded_order"|"approved_return", reason, amount (money returned to the buyer), feesReturned, createdAt }`. Sources: orders whose escrow was refunded, plus return requests with status refunded.

### GET /api/v1/seller/finance/statements
Permission: wallet:view
Response 200: `{ data: StatementMonthSummary[], nextCursor: null }` — the last 12 months, newest first. `StatementMonthSummary { month: "YYYY-MM", openingBalance, credits, debits, closingBalance, transactionsCount }`; credits/debits/balances count only movements on the **available** bucket; transactionsCount counts every wallet movement in the month.

### GET /api/v1/seller/finance/statements/:month
Permission: wallet:view
Path: month `YYYY-MM`
Response 200: `StatementDetail { summary: StatementMonthSummary, storeName, storeAddress, generatedAt, lines: StatementLine[] }` where `StatementLine = WalletTransaction & { runningBalance: Money }` (available-bucket running balance), oldest first.
Errors: 400 VALIDATION_FAILED.

### GET /api/v1/seller/wallet/payouts/schedule
Permission: wallet:view
Response 200: `PayoutSchedule { mode: "manual"|"daily"|"weekly"|"monthly", weekday: 0–6 (0 = Sunday), dayOfMonth: 1–28, keepMinimumBalance: Money, accountId: string|null, nextRunAt: ISO|null }`. Default `{ mode: "manual", weekday: 1, dayOfMonth: 1, keepMinimumBalance: 0, accountId: default payout account }`.

### PUT /api/v1/seller/wallet/payouts/schedule
Permission: wallet:withdraw (owner only)
Body: `{ mode, weekday: int 0–6, dayOfMonth: int 1–28, keepMinimumBalanceMinor: int ≥ 0, accountId: string|null (required unless mode is "manual"; must be one of the store's verified payout accounts) }`
Response 200: PayoutSchedule with `nextRunAt` computed (09:00 store time on the next matching day; null for manual).
Server rules: an automatic payout withdraws `available − keepMinimumBalance − provider fee` when that is ≥ minimumPayout, with the same ledger rules and audit trail as POST /seller/wallet/payouts (actor "system", Idempotency-Key = schedule id + run date). Audit `payout_schedule.updated`.
Errors: 400 VALIDATION_FAILED (paths mode, weekday, dayOfMonth, keepMinimumBalanceMinor, accountId), 403 FORBIDDEN.

## Sales analytics

Types: `apps/seller/src/types/analytics.type.ts`. Same sales definition as the dashboard (app orders, line subtotals, excluding cancelled/refunded orders, store timezone). Refunds = totals of refunded orders plus refund amounts of returns with status `refunded` in the range. Fees = Zudomart commission per order (`subtotal − sellerPayout`). **Net sales = gross − refunds − fees.** Conversion = orders ÷ unique visitors (basis points).

Common query: `from`, `to` (YYYY-MM-DD, inclusive, store timezone). Defaults: last 30 days ending today. Rules: `from ≤ to`, `to` not in the future, span ≤ 731 days. Errors: 400 VALIDATION_FAILED `issues[{ path: "from"|"to", message }]`.

### GET /api/v1/seller/analytics/overview
Permission: analytics:view. Plan: free (history is clamped).
History clamp: the server never returns data older than `planLimitsByPlan[plan].analyticsHistoryDays` (Free 30, Pro 365, Business 730) counted back from today. If `from` is older it is moved forward, `from` in the response is the effective start, `requestedFrom` echoes the request and `historyLimitedToDays` is set to the limit (otherwise null). No 402 here.
Response 200: `AnalyticsOverview`
`{ from, to, requestedFrom, historyLimitedToDays, grossSales, netSales, ordersCount, averageOrderValue (gross ÷ orders, rounded), conversionRateBasisPoints, refunds, fees, refundedOrdersCount, unitsSold, storeViews, visitors, previous: { grossSales, netSales, ordersCount, averageOrderValue, conversionRateBasisPoints } (same-length period immediately before), bucket: "hour"|"day"|"week"|"month", series: [{ periodStart, grossSales, netSales, ordersCount, storeViews }] }`
Bucket rule: 1 day → 24 hourly points (`periodStart` "YYYY-MM-DDTHH:00"); ≤ 62 days → daily; ≤ 200 days → weekly (weeks start Monday, first bucket starts at `from`); longer → monthly. Points are zero-filled and oldest first.

### GET /api/v1/seller/analytics/breakdowns
Permission: analytics:view. **Plan: pro** (`advanced_analytics`) — Free stores get `402 PLAN_FEATURE_REQUIRED { message, code, requiredPlan: "pro" }`.
Response 200: `AnalyticsBreakdowns`
- `bestProducts`: up to 10 active products with sales, by revenue desc; `slowProducts`: up to 10 active products with the fewest units sold (ties: more stock first). Each `AnalyticsProductPerformance = { productId, name, imageUrl, categoryName, unitsSold, revenue, productViews, conversionRateBasisPoints (units ÷ product views), stockAvailable (Σ onHand − reserved across locations), lastSoldAt: "YYYY-MM-DD"|null }`.
- `byCategory`, `byState`, `byCity`: up to 12 `AnalyticsSegmentRow { key, label, ordersCount (distinct orders), unitsSold, revenue, shareBasisPoints (of total line revenue in range) }`, revenue desc. Location = the order's delivery address (`byCity` key `"City|State"`, label `"City, State"`).
- `byHourOfDay`: 24 rows `{ slot: 0–23, ordersCount, revenue }` (order subtotal), store timezone. `byWeekday`: 7 rows, `slot` 0 = Sunday.
- `refunds`: every refund in range, newest first: `AnalyticsRefundRow { id, orderId, orderNumber, customerName, amount, reason, refundedAt }`.

## Store settings, locations, staff and audit log

Types: `StoreSettings`, `StoreLocation`, `TaxRate`, `NotificationPreferences`, `StorePolicies` (src/types/store.type.ts); `StaffMember`, `AuditLogEntry` (src/types/staff.type.ts); `StorefrontProfile`, `StorefrontUpdateRequest`, `StorefrontOpeningHours`, `StorefrontSocialLinks` (src/types/storefront.type.ts); `SecurityOverview`, `SecuritySession`, `LoginHistoryEntry` (src/types/security.type.ts); `ApiKey`, `CreatedApiKey`, `WebhookEndpoint`, `CreatedWebhookEndpoint`, `WebhookDelivery`, `StoreIntegration` (src/types/developer.type.ts). Every endpoint is scoped to the caller's store (from the access token). Every write appends an audit log entry (actor, action, target, summary, IP). The register-era fields `receipt`, `paymentMethods` and `discountApprovalThresholdBasisPoints` are removed from StoreSettings; reject them with 400 if sent.

### GET /api/v1/seller/settings
Permission: settings:view (every store role)
Response 200: StoreSettings — `{ storeId, name, handle, logoUrl, description, country, currency, timezone, locale, phone, email, address, taxes: TaxRate[], pricesIncludeTax, policies: { returns, shipping, privacy }, notifications: NotificationPreferences }`.
`NotificationPreferences = { newOrderEmail, newOrderSms, lowStockEmail, lowStockSms, payoutEmail, disputeEmail, reviewEmail, messageDigestEmail, dailySummaryEmail, weeklyPerformanceEmail }` (all boolean).

### PATCH /api/v1/seller/settings
Permission: settings:manage (owner, manager)
Body: partial StoreSettings. Editable keys only: name (2–80), description (≤500), phone (E.164-ish), email, address (5–200), taxes (TaxRate[] ≤20: id [A-Za-z0-9_-]{1,40} unique, name 1–40, rateBasisPoints int 0–10000, isDefault bool, appliesToCategoryIds null | non-empty array of existing category ids; exactly one default and the default has appliesToCategoryIds null), pricesIncludeTax bool, policies ({ returns, shipping, privacy } strings ≤2000 each — shown on the store page, at checkout and on packing slips), notifications (all NotificationPreferences keys, booleans).
Plan: the automated-alert keys `lowStockEmail`, `lowStockSms`, `dailySummaryEmail`, `weeklyPerformanceEmail` can only be switched **on** with feature `automated_alerts` (Pro); otherwise 402 PLAN_FEATURE_REQUIRED. Switching them off is always allowed.
Read-only (rejected with 400 if sent): storeId, handle, logoUrl, country, currency, timezone, locale.
Response 200: full StoreSettings after the change.
Errors: 400 VALIDATION_FAILED with issues[{path, message}] (paths like `taxes.1.rateBasisPoints`, `policies.returns`); 402 PLAN_FEATURE_REQUIRED; 403 FORBIDDEN.

### GET /api/v1/seller/locations
Permission: settings:view
Response 200: CursorPage<StoreLocation> (all locations, active and inactive; nextCursor null)

### POST /api/v1/seller/locations
Permission: settings:manage
Body: { name 2–60 (unique per store, case-insensitive), kind "store"|"warehouse", address 5–200, city 2–60, state 2–60, phone? }
Response 201: StoreLocation (country copied from the store, isDefault false, active true). New location gets a zero stock row for every variant.
Errors: 400 VALIDATION_FAILED; 409 LOCATION_EXISTS; 409 LOCATION_LIMIT_REACHED when active locations ≥ `planLimitsByPlan[plan].maxLocations` (Free 1, Pro 3, Business 10).

### PATCH /api/v1/seller/locations/:locationId
Permission: settings:manage
Body: any of { name, kind, address, city, state, phone|null, active bool, isDefault true }
Response 200: StoreLocation
Errors: 404 LOCATION_NOT_FOUND; 409 DEFAULT_LOCATION (cannot deactivate the default; default must be active); 409 LOCATION_LIMIT_REACHED (re-activation over the plan limit).
Rules: no delete — deactivate instead. Setting isDefault moves the default flag from the previous default.

Staff are always existing Zudomart app users. There are no separate staff accounts and no email/SMS invites: the store adds a Zudomart user, the user gets a team request in the Zudomart app, accepts it there, and signs in to the dashboard with their own Zudomart credentials.

### GET /api/v1/seller/zudomart-users
Permission: any signed-in store member. Query: `q` (≥2 chars; username with or without "@", or display name). Response 200: `{ data: ZudomartUserCandidate[] }` (max 10) where `ZudomartUserCandidate = { userId, name, username, avatarUrl }`. Public profile fields only — never email, phone or other private data. Excludes suspended/banned accounts and accounts that block the caller.

### GET /api/v1/seller/staff/candidates
Permission: staff:manage. Same as `/seller/zudomart-users` but excludes users already on this store's team.

### GET /api/v1/seller/staff
Permission: staff:manage (owner, manager)
Query: q? (name/username), cursor?, limit? (≤200)
Response 200: CursorPage<StaffMember> where `StaffMember = { id, userId, name, username, avatarUrl, role, status: "invited"|"active"|"suspended", permissions: SellerPermission[] | null, locationIds, lastActiveAt, invitedAt }`. `permissions: null` = role defaults; a list = custom permissions that fully replace the role defaults. Returned on Free too (the UI shows only the owner and an upgrade prompt).

### POST /api/v1/seller/staff
Permission: staff:manage. Plan: pro (`team`).
Body: { userId (an existing Zudomart user), role: manager|inventory|sales|accountant, locationIds: non-empty array of the store's location ids, permissions?: SellerPermission[] | null }
Response 201: StaffMember with status "invited" — the user receives a team request in the Zudomart app (push + in-app) and becomes "active" when they accept there. They sign in with their own Zudomart credentials; there are no staff passwords, PINs or email invites.
Errors: 400 VALIDATION_FAILED (unknown userId, unknown permission, or a permission reserved for the owner: billing:manage, developer:manage, wallet:withdraw); 402 PLAN_FEATURE_REQUIRED (Free plan, or `permissions` sent without the Business `advanced_permissions` feature); 403 OWNER_ROLE_RESERVED; 403 OWNER_ONLY (only the owner may add managers); 409 STAFF_EXISTS; 409 SEAT_LIMIT_REACHED when non-suspended staff (active + invited, owner excluded) ≥ planLimitsByPlan[plan].maxStaffSeats (Pro 5, Business 25).

### PATCH /api/v1/seller/staff/:staffId
Permission: staff:manage
Body: any of { name, role (not owner), status "active"|"suspended", locationIds, permissions: SellerPermission[] | null }
`permissions: null` resets to role defaults. Sending a list requires `advanced_permissions` (Business) → else 402. Owner-reserved permissions are rejected (400). Nobody can change their own permissions.
Response 200: StaffMember.
Errors: 403 CANNOT_EDIT_SELF; 403 OWNER_PROTECTED; 403 OWNER_ONLY (only the owner changes managers or grants manager); 402 PLAN_FEATURE_REQUIRED; 409 SEAT_LIMIT_REACHED (reactivating over the limit); 404 STAFF_NOT_FOUND.
Rules: a permission change takes effect on the member's next request — the API must recompute `SellerAccess.permissions` for that member (and drop any cached access) immediately. Suspending revokes their dashboard sessions for this store.

---

### DELETE /api/v1/seller/staff/:staffId
Permission: staff:manage
Response 204. Errors: 403 CANNOT_REMOVE_SELF, OWNER_PROTECTED, OWNER_ONLY; 404.
Rules: ends their dashboard sessions for this store; history (orders, audit) keeps their name.

### GET /api/v1/seller/audit-log
Permission: audit:view (owner, manager, accountant)
Query: actorId?, action? (prefix match, e.g. "orders.", "staff.", "settings."), from? / to? (YYYY-MM-DD, inclusive, store timezone), cursor?, limit? (≤200, default 50)
Response 200: CursorPage<AuditLogEntry>, newest first.
Actions written: staff.invited, staff.updated, staff.removed, settings.updated, location.created, location.updated, subscription.cancelled — plus those from other modules (order.accepted, order.refunded, inventory.adjusted, order.shipped, payout.requested…).

### Subscription endpoints used by /settings/billing (defined in the access/subscription section)
GET /seller/subscription → SubscriptionDetails; POST /seller/subscription/checkout {planId} → {authorizationUrl, reference, provider}; POST /seller/subscription/verify {reference}; POST /seller/subscription/cancel and /resume → SubscriptionDetails (billing:manage, owner only; checkout never requires verification). GET /seller/verification → { status, note, submittedAt, documents[{kind,label,status}] }.

## Storefront

The store page buyers see in the Zudomart app. One source of truth for featured products (Marketing → Featured reads and writes the same list).

### GET /api/v1/seller/storefront
Permission: storefront:manage (owner, manager). Not plan-gated.
Response 200: StorefrontProfile
```json
{
  "storeId": "store_…", "name": "Ìfẹ́ Lifestyle", "handle": "ife.lifestyle",
  "publicUrl": "https://zudomart.com/@ife.lifestyle",
  "logoUrl": "https://… | null", "coverUrl": "https://… | null",
  "tagline": "≤80 chars", "description": "≤500 chars",
  "policies": { "returns": "…", "shipping": "…", "privacy": "…" },
  "openingHours": [{ "weekday": "monday", "isOpen": true, "opensAt": "09:00", "closesAt": "19:00" }],
  "socialLinks": { "instagram": "https://…|null", "tiktok": null, "x": null, "whatsapp": null, "facebook": null, "website": null },
  "featuredProducts": [{ "productId": "prd_…", "name": "…", "imageUrl": "…|null", "price": { "amountMinor": 1850000, "currency": "NGN" }, "isAvailable": true }],
  "deliveryAreas": ["Lagos", "FCT"],
  "followerCount": 18420, "averageRating": 4.7,
  "updatedAt": "ISO"
}
```
`openingHours` always has 7 entries, Monday first, times `HH:mm` in the store timezone. `featuredProducts` follows the saved order; when none were chosen, the 4 newest active published products. `isAvailable` false = the product is no longer active/published (shown as "Hidden"). `deliveryAreas` is a read-only summary of the store's delivery areas (managed in Delivery). `name`, `description` and `policies` are the same values as in StoreSettings.

### PATCH /api/v1/seller/storefront
Permission: storefront:manage
Body (StorefrontUpdateRequest, all optional): name (2–80), tagline (≤80), description (≤500), logoMediaId (ready media id from /media/uploads, or null to remove), coverMediaId (same; 3:1 image recommended), policies ({ returns, shipping, privacy } ≤2000 each), openingHours (exactly 7 entries Monday→Sunday; isOpen bool; opensAt < closesAt when open), socialLinks (every network key; value null or an `https://` URL ≤200), featuredProductIds (≤8 distinct ids of this store's products, in display order).
Response 200: StorefrontProfile after the change. Writes name/description/policies/logo through to StoreSettings.
Errors: 400 VALIDATION_FAILED (paths `openingHours`, `socialLinks.instagram`, `policies.returns`, `featuredProductIds`); 422 MEDIA_NOT_READY. Audit `storefront.updated`.

---

## Account security

Account-level settings of the signed-in Zudomart user (they also protect the app). 2-step verification and password changes stay in the Zudomart app. Suggested permission: **signed in** (every member should be able to see and end their own sessions) — today `apiPermissionRules` maps `/seller/security` writes to settings:manage; please relax to `signed_in` when implementing.

### GET /api/v1/seller/security
Response 200: SecurityOverview `{ twoStepVerification: { enabled, method: "authenticator_app"|"email"|null, enabledAt }, passwordChangedAt, sessions: SecuritySession[], loginHistory: LoginHistoryEntry[] }`.
`SecuritySession = { id, device ("Chrome on Windows", "Zudomart app on iPhone 13"), app: "dashboard"|"mobile_app", location ("Lekki, Lagos"), ipAddress (masked, e.g. "102.89.•••.14"), signedInAt, lastActiveAt, isCurrent }` — all sessions of the user's account, dashboard and app.
`LoginHistoryEntry = { id, outcome: "success"|"wrong_password"|"blocked", device, location, ipAddress (masked), occurredAt }` — last 20, newest first.

### DELETE /api/v1/seller/security/sessions/:sessionId
Revokes that session's refresh token immediately. Response 204. Errors: 404 SESSION_NOT_FOUND; 409 CURRENT_SESSION (use sign-out for the current one). Audit `security.session_revoked`.

### POST /api/v1/seller/security/sessions/sign-out-others
Revokes every session of the account except the caller's. Response 200 `{ endedCount }`. Audit `security.sessions_revoked`.

---

## Developers: API keys and webhooks

Permission: developer:manage (owner only). Plan: pro (`api_webhooks`) — every endpoint returns 402 PLAN_FEATURE_REQUIRED below Pro.

### GET /api/v1/seller/developers/api-keys
Response 200: CursorPage<ApiKey> `{ id, name, prefix ("zk_live_4f9a"), scopes: ApiKeyScope[], createdBy, createdAt, lastUsedAt|null }`. Never returns secrets.
`ApiKeyScope = products:read | products:write | inventory:read | inventory:write | orders:read | orders:write | customers:read | finance:read`.

### POST /api/v1/seller/developers/api-keys
Body: { name 2–60, scopes: non-empty ApiKeyScope[] }
Response 201: `{ apiKey: ApiKey, secret: "zk_live_…" }` — the full secret is returned **once**; store only a hash (show `prefix` afterwards). Max 10 active keys (409 API_KEY_LIMIT_REACHED). Audit `developer.api_key_created`.

### DELETE /api/v1/seller/developers/api-keys/:keyId
Revokes immediately. Response 204. 404 API_KEY_NOT_FOUND. Audit `developer.api_key_revoked`.

### GET /api/v1/seller/developers/webhooks
Response 200: CursorPage<WebhookEndpoint> `{ id, url, description, events: WebhookEvent[], active, signingSecretPreview ("whsec_••••a91c"), createdAt, lastDeliveryAt|null, recentFailureCount }`.
`WebhookEvent = order.created | order.updated | order.delivered | order.refunded | product.updated | inventory.low_stock | payout.paid | review.created | message.received`.

### POST /api/v1/seller/developers/webhooks
Body: { url (public https only; reject localhost/private IPs/internal hosts — SSRF), description? ≤80, events: non-empty WebhookEvent[] }
Response 201: `{ webhook: WebhookEndpoint, signingSecret: "whsec_…" }` (secret shown once). Deliveries are POSTs with JSON body `{ id, event, createdAt, data }` and header `Zudomart-Signature: t=<unix>,v1=<HMAC-SHA256(secret, "t.body")>`; retried with backoff for 24 hours. Audit `developer.webhook_created`.

### PATCH /api/v1/seller/developers/webhooks/:webhookId
Body: any of { url, events, active bool }. Response 200: WebhookEndpoint. 404 WEBHOOK_NOT_FOUND. Audit `developer.webhook_updated`.

### DELETE /api/v1/seller/developers/webhooks/:webhookId
Response 204. Audit `developer.webhook_deleted`.

### POST /api/v1/seller/developers/webhooks/:webhookId/test
Sends a sample event for the first subscribed event type. Response 201: WebhookDelivery.

### GET /api/v1/seller/developers/webhook-deliveries
Query: webhookId? Response 200: CursorPage<WebhookDelivery> `{ id, webhookId, event, responseStatus|null, durationMilliseconds|null, outcome: "delivered"|"failed"|"retrying", attemptedAt }` — last 50, newest first.

---

## Integrations

Permission: GET settings:view; connect/disconnect/sync settings:manage.

### GET /api/v1/seller/integrations
Response 200: CursorPage<StoreIntegration> `{ id: "quickbooks"|"xero"|"zoho_books"|"google_sheets"|"meta_catalog"|"whatsapp_business", name, category: "accounting"|"spreadsheets"|"marketing"|"messaging", description, requiredPlanFeature: "accounting_integrations"|null, status: "connected"|"not_connected"|"needs_attention", connectedAccount|null, connectedAt|null, lastSyncedAt|null }`.

### POST /api/v1/seller/integrations/:integrationId/connect
Body: {} (real implementation: returns `{ authorizationUrl }` for the provider's OAuth page when not yet authorised; the callback completes the connection). Plan: accounting integrations need Business (`accounting_integrations`) → 402 otherwise. Response 200: StoreIntegration. Reconnecting a `needs_attention` integration uses the same call. Audit `integration.connected`.

### POST /api/v1/seller/integrations/:integrationId/disconnect
Revokes stored provider tokens. Response 200: StoreIntegration (not_connected). Audit `integration.disconnected`.

### POST /api/v1/seller/integrations/:integrationId/sync
Starts a sync now. Response 200: StoreIntegration (lastSyncedAt updated). 409 INTEGRATION_NOT_CONNECTED.

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
Response 200 (target): `CursorPage<MyStoreEntry>` — every store the user belongs to: `{ storeId, storeName, brandId|null, role, verification: { status, tier, badgeVisible }, subscription: { status, plan } | null, isCurrent }`.
Backend today: returns the same `SellerAccess` as `GET /seller/access` for the store in `X-Seller-Store` (or the default store). The dashboard reads either shape (`readMyStoreEntries`), so the switcher lists only the current store until the backend returns the list. The store switch BFF checks membership by calling it with the requested store in `X-Seller-Store`.

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

## Free trials, bundle and Gold-only plan (web only, Paystack plan with a verification charge)

Plans still come from `GET /seller/subscription/plans` (Pro NGN 5,000/mo, Business NGN 15,000/mo; yearly rows carry the admin yearly discount). Billing is **per business profile**: each store/brand has its own subscription, invoices and payment method. The account email is used for the Paystack customer, receipts and reminders; **no endpoint accepts an email**.

### GET /api/v1/seller/subscription/trial
Permission: billing:manage. Response 200: `BillingOffer` = `{ profileName, accountEmail? (read-only; not sent by the backend yet), trialLength: "DAYS_7"|"MONTH_1", trialDays, yearlyDiscountPercent, verificationCharge: Money, isEligible, ineligibleReasons: [{ code, message }], activeTrial: ActiveTrial|null, bundle: { hasActiveBlue, discountPercent, maximumBusinesses }, goldOnlyPlan: { monthly, yearly, isActive? } }`. Eligibility is decided by the server from admin rules (account age, verified email, one trial per person/card/device/phone, max risk score, completed orders). `message` is gentle, user-facing copy. `ActiveTrial` = `{ planId, tier, interval, startedAt, endsAt, daysLeft, isCancelled, cardSummary, priceAfterTrial, verificationCharge: { amount, status: "REFUNDED"|"REFUND_PENDING" }, reminders?: [{ daysBefore: 3|1, sendsAt }] }` (`reminders` is not sent by the backend yet; the panel hides the row). The client shows reminders at 3 days and 1 day before the end.

Pricing display: monthly with active Blue = price x (1 - bundle%). Yearly = monthly x 12 x (1 - max(yearly%, bundle%)); the bigger discount wins and they never stack. The bundle applies to at most `maximumBusinesses` businesses, lapses at renewal if Blue ends, and never to Black.

### POST /api/v1/seller/subscription/trial/checkout
Body `{ planId }` (a Pro/Business plan, or `gold_only_monthly` / `gold_only_yearly`). Response 201: `{ authorizationUrl, accessCode, reference, provider: "paystack" }`. The dashboard opens the Paystack Popup with `accessCode` (redirect to `authorizationUrl` as the fallback); the card is never handled by Zudomart. Paystack makes a small verification charge (NGN 50) that is refunded at once, and the subscription is created with `start_date` at the end of the free period. Errors: 404 PLAN_NOT_FOUND, 409 TRIAL_NOT_AVAILABLE (message explains why).

### POST /api/v1/seller/subscription/trial/verify
Body `{ reference }` (references start `TRL_` for trials, `GLD_` for Gold-only). Response 200: `BillingOffer`. A trial sets the subscription to `trialing` with `currentPeriodEnd` = trial end. Gold appears only after business verification. Error: 404 PAYMENT_NOT_FOUND.

### POST /api/v1/seller/subscription/trial/cancel
One tap. No charge is made; access continues until the trial end. Response 200: `BillingOffer`. Error: 409 NO_TRIAL.

## Business documents (never blocks store creation or selling)

### GET /api/v1/seller/business-documents
Permission: billing:manage (owner only: documents belong to the signed-in account, not the store). Response 200: `{ documents: [{ kind: "cac_certificate"|"identity"|"address_proof", label, status: "not_uploaded"|"pending"|"approved"|"rejected", fileUrl|null (5-minute signed view link), rejectionReason|null, submittedAt|null }], allApproved }`. The dashboard derives the description, the overall status (banner until all are approved) and the Gold checkmark state (Pro/Business after approval).

### POST /api/v1/seller/business-documents/:kind/upload-intents
Body `{ fileName ≤200, contentType: "application/pdf"|"image/jpeg"|"image/png"|"image/webp", sizeBytes ≤10 MB }`. Response 201: `{ documentId, objectKey, uploadUrl, headers, expiresAt }` (10 minutes). The browser PUTs the file to `uploadUrl` with `headers` (origin in `SELLER_UPLOAD_ORIGINS`). Errors: 400 VALIDATION_FAILED, 404 (unknown kind), 409 ALREADY_APPROVED.

### PUT /api/v1/seller/business-documents/:kind
Body `{ documentId }` (or `{ fileUrl }`). Response 200: the same body as the GET; the document becomes `pending` and goes to the admin queue. Errors: 404 (no upload intent), 409 UPLOAD_MISSING.

## Store rewards (seller-funded; owner, 2026-10-03)
Seller-funded store credit. Zudomart does not fund or hold money for it: it is a price reduction the seller absorbs. Credit is valid only at the issuing store, is never cash, never withdrawable, and never usable at other stores. It is earned only when an order completes (after escrow release) and is reversed if the order is refunded.

Types: `StoreRewardsRules`, `StoreRewardsSummary` (src/types/store.type.ts). `StoreSettings.storeRewards = { enabled, percentBackBasisPoints (0–2000), minimumOrder: Money, maxPerOrder: Money, expiryDays (7–730) }`, edited through `PATCH /api/v1/seller/settings` (key `storeRewards`, same rules as other settings keys, store currency only).
`Customer.storeCreditBalance: Money` and `storeCreditExpiresAt: ISO | null` are read-only (derived from the per-store credit ledger).

### GET /api/v1/seller/marketing/rewards/summary
Permission: promotions:manage. Response 200: `{ outstandingLiability: Money, customersWithCredit: int, issuedLast30Days: Money, redeemedLast30Days: Money }`.

Backend requirement: per-store credit ledger in go-commerce (not go-money cash): entries per (store, buyer) with earn on order completion, reverse on refund, redeem at checkout as a discount line, expiry.
