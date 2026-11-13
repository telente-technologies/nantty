# Logistics V1 — seller delivery or optional Kwikpik

> **Status: contract and implementation plan, not a live integration.** A store
> may keep fulfilling orders itself, or explicitly opt in to a configured
> logistics provider. Self-delivery remains the default and existing seller
> shipping behavior must continue to work. The internal feature is Natty
> Logistics V1; the documented Kwikpik integration target is its separate
> Partnership API v2.

Last reviewed: 2026-11-13.

## 0. Founder-approved v1 market and contact rules

- Seller/store registration and provider-managed logistics are Nigeria-only
  for v1. The commerce API checks the signed-in account's persisted country
  (`NG`); client locale, IP-derived region, and request-supplied country are
  not eligibility evidence. The account country is a profile preference, not
  proof of physical presence or identity; it is an initial eligibility gate,
  and seller identity/business review remains separate. The client gate is
  only explanatory UX.
- Seller application asks whether that seller/store can handle logistics.
  This is an explicit opt-in, stored on the application and defaulting to off.
  It is not yet a store-level provider booking switch: there is no provider
  booking integration or checkout mode to activate until the remaining V1
  work is implemented and reviewed.
- Creator Program consideration remains a separate program and may include
  creators outside Nigeria. This exception does not make seller/store
  registration available outside Nigeria.
- Buyer and seller phone numbers are compulsory when provider-managed delivery
  requires them. Never send either party's email address to a logistics
  provider. Share other shipment data (such as recipient/pickup names and
  physical addresses) only when required by an approved provider contract and
  after the required disclosure/consent. If the provider requires an email,
  use only Nantty's company-controlled `LOGISTICS_CONTACT_EMAIL`; never
  substitute a customer or seller email. Keep that setting in adapter
  configuration rather than the generic booking request. It is empty by
  default and no adapter consumes it yet. Keep provider booking disabled until
  an adapter and contact address are verified.

## 1. Confirmed repository state

- Seller-managed shipping profiles, zones and price rules are implemented and
  used by checkout. Sellers manually update fulfillment and tracking.
- Seller application requests require a phone and an explicit logistics
  capability choice; buyer address creation requires a normalized phone. Order
  checkout revalidates legacy delivery addresses, canonicalizes supported
  international formats to E.164, and rejects blank or malformed phone values
  before they reach fulfillment.
- The provider-facing request address contains a phone field but no email
  field. No provider adapter exists, so `LOGISTICS_CONTACT_EMAIL` is configured
  separately but is not currently delivered to any provider.
- `LOGISTICS_ENABLED` defaults to `false`.
- A provider-neutral Go interface, registry, database foundation and parcel
  catalog metadata exist, but there is no Kwikpik adapter, provider quote route,
  provider booking route, webhook route, or provider choice in checkout yet.
- A least-privilege, read-only staff logistics queue is sourced from shipped
  order groups, so seller-entered tracking is visible even when no provider
  `Shipment` row exists; a linked provider shipment enriches that row when
  present. It exposes tracking details and sanitized exception summaries to
  `logistics:read` staff, while omitting contact details, address snapshots,
  and raw provider payloads. Buyer order responses expose the carrier and
  tracking number but never the carrier URL. The shipment email links to the
  Nantty order page. The admin page links each item to its order investigation
  view; it cannot book, cancel, retry, or resolve provider operations while no
  adapter is enabled.
- Existing seller delivery dashboard endpoints cover marketplace orders and
  seller-entered tracking only. Persisted provider opt-in, standalone merchant
  delivery batches/jobs, and provider billing are not implemented.
- The active checkout still uses seller shipping rules. This V1 plan does not
  turn every store onto Kwikpik or remove the seller-managed path.
- The provider-facing `logistics.Parcel` contract now uses weight, count,
  description, declared value and currency; it no longer
  requires or sends dimensions, package category or a fragile flag.

## 2. Store and buyer behavior

Each store controls whether it offers:

1. **Seller delivery** — default; the seller's existing shipping profile and
   manual delivery workflow remain authoritative.
2. **Kwikpik delivery** — opt-in; shown only when the provider is configured,
   returns a valid estimate for the route and parcel, and the store is ready to
   dispatch.

Enabling Kwikpik must not remove seller delivery unless the store explicitly
chooses that policy. At checkout, a multi-store cart gets one fulfillment
selection per seller order group. Do not silently switch modes when a quote or
booking fails. Offer a clear retry, seller-delivery alternative if configured,
or order recovery/refund path.

Store delivery settings should expose: enabled methods, pickup address and
contact, pickup instructions, optional pickup coordinates, currency, and the
seller's readiness/dispatch rules. Do not expose provider credentials or allow
stores to edit provider pricing. The buyer chooses from server-returned options;
the client never submits a trusted delivery amount.

## 3. Kwikpik request field map for backend and frontend

Kwikpik publishes an estimate operation and two order-creation shapes (bulk
packages and unified order). These are not identical schemas. The adapter must
map from one validated Natty request into the selected Kwikpik operation; the
frontend should use Natty's stable contract, not Kwikpik's raw payload.

### 3.1 Natty's stable parcel input

| Natty field | UI source | Required in Natty V1 | Kwikpik mapping / note |
| --- | --- | --- | --- |
| `weightGrams` | Seller product/variant; confirm actual packed weight at dispatch when needed | Yes for a provider estimate/booking | Convert exactly to `packageWeightInKg`; order creation documents weight as required. No dimensions are sent. |
| `packageCount` | Seller packing step; default 1 | Yes, default 1 | Maps to unified `quantity` or the count of bulk `packages`. |
| `contentsDescription` | Product title/SKU, seller editable | Optional, limit Natty input to 300 chars | Kwikpik truncates `description` to 50 characters; send a safe concise description. |
| `declaredValue` | Derived server-side from eligible order item totals | Yes for creation; estimate may omit it | Maps to `packageValue`; never trust a client-supplied amount. Kwikpik describes it as insurance valuation, not insurance coverage. |
| `currency` | Server-derived from the order | Yes | Kwikpik response includes currency; reject mismatches instead of silently converting. |

Natty V1 does not offer or charge delivery insurance. The adapter must always
send `isInsured: false` where the provider requires the field, must not forward
an insurance premium as a customer charge, and must not create an insurance
line item. `packageValue` remains the provider-required declared value; it is
not an insurance purchase.

**Do not collect as provider-required fields:** length, width, height,
volumetric divisor, product category, or fragile flag. Kwikpik's published
estimate and creation fields do not require parcel dimensions. Existing catalog
dimension data may remain for other carriers or historical compatibility, but
must not block this provider's UI or be sent by this adapter.

Kwikpik's estimate docs list optional `packageSize` values based on weight, but
the stated ranges overlap at 20 kg and do not define every boundary. Natty
should send weight and omit `packageSize` unless Kwikpik clarifies the mapping.
Do not ask sellers to enter size separately.

### 3.2 Address and contact inputs

| Field | UI source | Required for provider order | Notes |
| --- | --- | --- | --- |
| `pickupAddress` | Store pickup address | Yes | Full physical address, up to 300 chars. |
| `pickupContactName` | Store delivery contact | Yes | Up to 100 chars. |
| `pickupContactPhone` | Verified/store contact phone | Yes | Validate/canonicalize server-side. |
| `pickupLatitude`, `pickupLongitude` | Geocoded store address | No in docs | Useful for rider navigation; require valid coordinate pair if supplied. |
| `pickupNotes` | Store instructions | No | Gate/entrance and safe pickup directions; do not expose secrets such as access codes in public tracking. |
| `deliveryAddress` | Buyer's selected saved address | Yes | Full address, up to 300 chars. |
| `deliveryContactName` | Address recipient | Yes | Recipient name. |
| `deliveryContactPhone` | Address recipient | Yes | Recipient contact phone. |
| `deliveryLatitude`, `deliveryLongitude` | Geocoded saved address | No in docs | Useful for navigation; require a valid pair if supplied. |
| `deliveryNotes` | Buyer | No | Optional safe instructions, with a length limit. |
| `scheduledPickupTime` | Seller dispatch scheduling | No | ISO-8601; docs state at least 30 minutes in the future. UI must explain timezone and availability. |
| `dropOffLocationId` | Provider location lookup | No | Optional hub/depot routing. V1 UI should omit this unless the product deliberately offers drop-off. |

### 3.3 Estimate request fields

Kwikpik estimate operation documents `packages` as required (1–100). Each
package has a required `deliveryAddress`; weight, size, declared value and
insurance are optional in the estimate schema. Natty will still require weight
for provider-enabled physical shipments so the estimate and eventual booking
use the same parcel facts.

Optional estimate inputs include `destinationArea`, `packageSize`,
`packageWeightInKg`, `packageValue`, per-package `isInsured`, `vehicleType`,
`pickupAddress`, `dropOffLocationId`, and order-level `isInsured`.

Natty requests uninsured delivery only. Send `isInsured: false` where required
(or omit it where permitted); reject a response that adds a non-zero insurance
premium instead of charging that premium.

The estimate response documents per-package `estimatedPrice`,
`insurancePremium`, `isInsured`, `packageWeightInKg`, `packageSize` and
`currency`, plus total price/insurance/currency in the broader estimate
response. Insurance premium is described as included in estimated price. Natty
does not expose or charge it; estimate requests must be uninsured.

### 3.4 Create-order fields

**Bulk shape:** `orders[]` is required; the documented maximum is 1,000 orders
per call. Each order requires pickup address/contact name/contact phone and a
`packages[]` array. Each package requires `merchantPackageNumber`, destination
address, recipient name/phone, package weight and declared package value.

**Unified shape:** one order object inside `orders[]`; pickup address/contact
name/contact phone, destination address/contact name/contact phone, package
weight, `quantity`, and package value are required. Package description,
contents/items, coordinates, notes, email, scheduled pickup, vehicle preference,
drop-off location and metadata are optional.

Never send a buyer or seller email in a provider request. Where the confirmed
provider operation accepts a pickup-contact email, map only Natty's configured
`LOGISTICS_CONTACT_EMAIL` from adapter configuration to that field; omit
recipient/delivery email fields and keep all email values out of the generic
provider request contract.
Natty may send customer-facing delivery emails and push notifications through
its own notification service. Buyer and seller phone numbers needed to
complete a booking may be shared only after the seller capability opt-in and
buyer checkout disclosure/confirmation. Store the consent evidence and send
no more contact data than the confirmed provider request requires.

The API docs conflict on vehicle enums: one operation says `BIKE` (standard),
`CAR`, `VAN`, `TRUCK`; another also lists `BICYCLE` and `MOTORCYCLE`. Do not
show a vehicle selector or send a guessed value until Kwikpik confirms the
canonical accepted enum and how it affects price.

## 4. Service choices, delivery time and pricing display

The public docs do **not** provide fixed prices or a rate card for Express,
Same-day, standard, or every delivery route. They provide an estimate operation
that returns a live estimated price and currency. The docs show `SAME_DAY` as an
example `deliveryTimeline` in tracking data; that is not evidence of a separate
pre-checkout service SKU or an Express tariff.

Therefore:

- Request estimates server-side for each supported route/parcel. Show only
  options the provider actually returns and Natty can book.
- If a provider response supplies `deliveryTimeline` (for example `SAME_DAY`),
  show that exact value as the estimated timeline. Do not infer that `BIKE`
  means Same-day or label an option Express without a confirmed service
  definition.
- Display provider name, returned service/timeline, vehicle if known, estimate,
  currency, quote/estimate time, and returned conditions. Clearly label an estimate as estimated until the
  provider confirms a booking price.
- The docs do not define a quote ID/expiry or guaranteed price-lock for the
  estimate operation. Do not assume a quote can be reserved or booked at the
  same amount. Confirm expiry and price-change semantics with Kwikpik.
- Do not invent a fixed platform fee or surcharge. If Kwikpik returns an
  additional charge or final price, show it as a separate named component only
  when the provider gives that data. Reconfirm buyer consent if the payable
  total changes.
- Currency values from the provider are decimal amounts. Parse as decimal and
  convert to Natty integer minor units using the currency exponent; never use
  binary floating point for money.

### Frontend screen mapping

1. **Store settings → Delivery:** existing seller shipping remains enabled by
   default. Add an explicit “Offer Kwikpik delivery” opt-in and pickup address,
   contact name/phone, optional coordinates, pickup notes, and dispatch
   readiness. Do not expose provider keys or manual provider pricing.
2. **Product/variant form:** require/collect weight for provider fulfillment;
   allow existing seller shipping to work when weight is absent. Do not block a
   seller who only uses self-delivery. Dimensions are not a Kwikpik requirement.
3. **Cart/checkout:** for each store group show “Seller delivery” and, only if
   enabled and successfully estimated, provider choices. A provider choice card
   shows returned service/timeline, estimated total, currency, and conditions.
   Explicitly show unavailable
   or failed quote states without fabricating a price.
4. **Order confirmation/detail:** show selected fulfillment mode, provider
   reference, tracking number/URL and current provider status when booked. For
   seller delivery, keep the current seller-entered status/tracking UI.
5. **Seller orders → Ready for pickup:** confirm packed weight/count and pickup
   details; show price changes before booking and require an authorized action
   if re-consent is needed.
6. **Seller dashboard → Deliveries:** provide cursor-paginated delivery lists,
   status/date/search filters, and detail views showing Natty reference,
   recipient, chosen timeline, provider booking state, tracking events, payment
   state, and Natty-held receipt/evidence. Never display raw webhook payloads,
   provider credentials, or private data from another store.
7. **Seller dashboard → Create / bulk delivery:** allow a paid, verified seller
   to select existing orders or enter recipient, address, phone, weight, package
   count, declared value, and optional delivery notes. Preview and validate
   every row and quote before booking; show row-level success/failure. Kwikpik's
   documented 1,000-order bulk maximum is a per-request ceiling, not an
   all-or-nothing guarantee. Natty should send bounded batches and persist each
   package result independently with a stable unique reference for safe retry.
8. **Seller dashboard → Confirm delivery spend:** before booking, itemize the
   provider estimate, seller's configured buyer delivery fee (if any), seller
   subsidy, and seller funding amount. Debit available cleared seller balance;
   if insufficient, keep the delivery unbooked and offer the existing secure
   wallet-funding/card setup flow. Do not charge a saved card without explicit
   logistics-specific consent, a server-created payment intent, and an
   idempotent verified settlement. Never collect card data in the logistics UI.

## Seller dashboard scope and eligibility

The dashboard has two distinct delivery workflows:

- **Order fulfillment:** one seller/store delivery for each marketplace order
  group. It may use current seller-managed fulfillment or an opted-in provider.
- **Seller-created/bulk delivery:** merchant-originated delivery jobs created
  from seller workspace. These are not new marketplace purchase orders and
  must not fabricate buyer payments or order merchandise.

Only an active eligible paid Gold seller plan with approved business/store
verification may use provider-funded dashboard tools. A badge alone is not
authorization; check active commercial entitlement, store ownership, and the
required store permission on every API request. Plan checks fail closed. Loss or
expiry of a plan blocks new quotes/creations but does not erase, cancel, or hide
already-booked deliveries. Seller-managed shipping and its existing free access
remain available.

The seller can choose whether the buyer contributes a delivery fee. If the
seller sets a custom delivery charge, render it as a distinct seller-configured
fee next to the live provider estimate; never call the full combined amount a
Kwikpik price. The seller can absorb all or part of the actual carrier cost.
Where the seller funds booking first, the ledger must show the seller debit and
later buyer contribution/settlement separately. A carrier booking or a seller
uploaded receipt is not proof that Natty's buyer payment settled. The UI may
show “Paid” only from a verified Natty ledger/provider settlement, with
reference and receipt evidence.

The current seller plan resolver has `free`, `pro`, and `business` levels
(`seller_pro` and `seller_business` are subscription plan codes). The new
`logistics_dashboard` feature minimum is `pro`, so both paid resolver levels
qualify for that generic capability gate. This is only a reusable entitlement
definition today: no logistics route calls it. Canonical Gold Basic/Premium
mapping and a separate verified-Gold check still need to be applied in each
command before access is exposed.

The current `Shipment` record is unique per marketplace `order_group_id` and
cannot represent standalone seller-created deliveries. Add separate
ownership-scoped delivery batch and package/job resources, with status/payment
state, provider refs, quote refs, actor audit events, and stable idempotency
keys. Do not weaken the order-group uniqueness constraint or invent marketplace
orders to fit this workflow.

For a cart containing multiple stores, checkout continues creating separate
order groups and delivery selections per store. If one store has multiple
pickup addresses, partition the store's items by fulfillment origin as well;
never combine packages with different pickup locations into one provider order.

## 5. Booking, tracking, events and safety

- Keep provider credentials in backend secret configuration only. Docs specify
  `x-api-key` authentication and `https://logistics-api.kwikpik.io` as the API
  base; confirm staging/production credential and host behavior with Kwikpik.
- Do not book until the order is paid and the seller marks it ready for pickup.
  The provider adapter must record intent before the external call and use a
  stable order-group reference to prevent duplicate bookings. Provider docs do
  not describe an `Idempotency-Key`; confirm how duplicate `orderRef` and
  `merchantPackageNumber` values behave.
- Validate every provider response as untrusted input. Store raw payload only
  under an explicit retention/access policy; normalize statuses at the adapter
  boundary.
- Kwikpik documents package-level statuses including `PENDING`, `RECEIVED`,
  `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`, and
  return states. Order status alone is insufficient; map package statuses and
  preserve status history.
- Webhooks use `X-Kwikpik-Webhook-Id` and `X-Kwikpik-Signature` with
  `t=<unix-seconds>,v1=<hex>`. Verify HMAC-SHA256 over `<timestamp>.<raw body>`
  with constant-time comparison, reject stale timestamps, deduplicate event IDs,
  persist the event before acknowledging, and process asynchronously. Docs say
  acknowledge within 30 seconds and retries reuse the same webhook ID.
- The documented simulator is staging-only at
  `https://logistics-sandbox.kwikpik.io`; it was not called during this review.
- Cancellation, failed delivery, return-to-origin and redelivery are separate
  state transitions. Never automatically charge a buyer for a provider retry
  or price adjustment. Show reason and cost, determine the responsible payer
  from disclosed policy, and obtain consent/payment before a paid redelivery.

## 6. Checkout and ledger requirements

Provider delivery is optional per store and selected per seller order group.
The current checkout shipping amount is added to the group total. Before
provider bookings are enabled, the payment/escrow split must distinguish:

```text
merchandiseMinor
sellerDeliveryFeeMinor
providerDeliveryEstimateMinor
buyerDeliveryContributionMinor
sellerDeliverySubsidyMinor
platformDeliverySubsidyMinor
providerActualCostMinor
providerAdjustmentMinor
```

Marketplace commission must apply to merchandise under the existing pricing
policy, not silently to a courier pass-through. Record estimate, buyer consent,
provider actual, payer allocation, settlement and any variance as auditable
entries. A provider cost increase cannot be silently passed to the buyer or
deducted from seller funds.

The batch create request must use an `Idempotency-Key` stable across retries and
reference a Natty quote/batch, not a client-supplied provider price. For linked
Natty orders, derive recipient and declared value from the server-side order
snapshot. For standalone merchant jobs, require a merchant reference,
destination/contact, weight, package count, declared value and currency. Check
store ownership, active paid entitlement, approved business verification,
`delivery:manage` permission, coordinate/address consistency, and integer
minor-unit amounts at the edge. Bound request sizes below the carrier limit,
chunk provider calls and persist partial results per package. A timeout while
booking is an unknown outcome: query by stable reference before retrying.

Persist delivery payment state independently from provider shipment state. The
dashboard status model should distinguish `awaiting_funds`, `payment_pending`,
`paid`, `booking_pending`, `booked`, `in_transit`, `delivered`, `failed`,
`cancel_pending`, `cancelled`, `refund_pending`, and `refunded`. A batch can be
partial while individual rows retain their state. A card charge requires
explicit logistics-specific off-session consent, a Natty payment intent and
verified idempotent settlement; a click on “Create delivery” is not sufficient
consent.

## 7. Internal API contract to implement

These are **proposed Natty routes**, not Kwikpik paths; they are not mounted yet.

| Method | Proposed route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/stores/{storeId}/delivery-options` | Read seller-enabled methods and settings. |
| `PUT` | `/api/v1/seller/stores/{storeId}/delivery-settings` | Seller toggles provider opt-in and edits pickup details; self-delivery remains independent. |
| `POST` | `/api/v1/cart/delivery-options` | Return seller-delivery rule and live provider estimate choices per store group. |
| `POST` | `/api/v1/orders/checkout` | Accept selected fulfillment mode and opaque server-issued quote ID, never client price. |
| `POST` | `/api/v1/seller/orders/{orderId}/ready-for-pickup` | Confirm readiness and trigger idempotent booking. |
| `GET` | `/api/v1/orders/{orderId}/delivery` | Authorized buyer/seller delivery view. |
| `POST` | `/api/v1/webhooks/delivery/kwikpik` | Signed, deduplicated provider event intake. |
| `GET` | `/api/v1/seller/deliveries` | Cursor-paginated dashboard list with filters. |
| `POST` | `/api/v1/seller/delivery-batches/quotes` | Validate and estimate a bounded batch; no booking or debit. |
| `POST` | `/api/v1/seller/delivery-batches` | Confirm an explicitly priced batch using idempotency and payer allocation. |
| `GET` | `/api/v1/seller/deliveries/{deliveryId}` | Ownership-scoped tracking, payment state, and evidence. |
| `POST` | `/api/v1/seller/deliveries/{deliveryId}/cancel` | Cancel with provider outcome and any refundable amount. |

All settings and quotes require store ownership/account authorization. Checkout
must revalidate quote ownership, currency, expiry and amount server-side. The
provider method must be unavailable when the store has not opted in, even if a
client submits a provider selection.

For checkout-linked delivery, server-resolve recipient, declared value, seller,
and store from the order; do not trust request payload copies. For dashboard
standalone rows, require destination name/phone/address, weight, package count,
declared value/currency, and seller-provided merchant reference. Explicitly
bound batch size, validate every row, and report partial results by stable row
reference. Use cursor pagination for dashboard lists and enforce the same
store-scoped authorization on list, detail, cancel and retry routes.

### Suggested frontend-facing DTOs

Store settings (provider off by default):

```typescript
type StoreDeliverySettings = {
  sellerDelivery: { enabled: boolean };
  providerDelivery: {
    provider: 'kwikpik';
    enabled: boolean; // defaults false; verified Gold + active paid plan required
    buyerPaysDelivery: boolean;
    sellerDeliveryFee: MoneyView | null; // distinct from the provider estimate
    pickup: {
      address: string;
      contactName: string;
      contactPhone: string;
      instructions: string | null;
      latitude: number | null;
      longitude: number | null;
    };
  };
};
```

Checkout options (the quote ID is an opaque Natty-owned identifier):

```typescript
type MoneyView = { amountMinor: number; currency: string };
type DeliveryOption =
  | {
      fulfillmentMode: 'seller_managed';
      fee: MoneyView;
      serviceLabel: string;
    }
  | {
      fulfillmentMode: 'provider_managed';
      provider: 'kwikpik';
      quoteId: string;
      serviceLabel: string | null;
      deliveryTimeline: string | null;
      vehicleType: string | null;
      estimatedPrice: MoneyView;
      conditions: string[];
      quotedAt: string;
      validUntil: string;
      isEstimated: true;
    };
type StoreDeliveryOptions = { storeId: string; options: DeliveryOption[] };

type MerchantDeliveryDraft = {
  merchantReference: string;
  orderGroupId?: string;
  destination: {
    address: string;
    contactName: string;
    contactPhone: string;
    latitude?: number;
    longitude?: number;
    instructions?: string;
  };
  parcel: {
    weightGrams: number;
    packageCount: number;
    contentsDescription?: string;
    declaredValue?: MoneyView; // server-derived for linked Natty orders
  };
  serviceChoiceId: string; // opaque Natty quote ID; never a raw provider price
  buyerDeliveryFee?: MoneyView; // seller-configured, shown as its own line
  payer: 'seller' | 'buyer_contribution_plus_seller_remainder';
  savedPaymentAuthorizationId?: string; // after explicit logistics consent
};

type DeliveryPaymentEvidence = {
  state: 'awaiting_funds' | 'payment_pending' | 'paid' | 'failed' | 'refunded';
  amount: MoneyView;
  paymentReference: string | null;
  receiptUrl: string | null; // Natty-hosted and authorized
  paidAt: string | null;
};
```

Nullable service label/timeline/vehicle stay absent or null unless the provider
actually returns them. `validUntil` is Natty's cache policy, not a claim that
Kwikpik locks that price. Checkout submits only `storeId`, `fulfillmentMode`,
and the selected opaque `quoteId`; the server retrieves the stored estimate and
revalidates it. The quote endpoint must return a structured unavailable state
instead of silently omitting a store's only delivery method. Never return a
fabricated zero-price provider option when an estimate fails.

## 8. Backend mapping to Kwikpik

| Natty contract | Kwikpik Partnership API v2 field |
| --- | --- |
| `reference` | `orderRef` or `merchantPackageNumber` (confirm uniqueness/length rules) |
| `pickup.address` | `pickupAddress` |
| `pickup.contact.name` / `phone` | `pickupContactName` / `pickupContactPhone` |
| `pickup.instructions` | `pickupNotes` |
| `pickup.coordinates` | `pickupLatitude` / `pickupLongitude` |
| `destination.address` | `deliveryAddress` |
| `destination.contact.name` / `phone` | `deliveryContactName` / `deliveryContactPhone` |
| `destination.instructions` | `deliveryNotes` |
| `destination.coordinates` | `deliveryLatitude` / `deliveryLongitude` |
| `parcel.weightGrams` | `packageWeightInKg` (exact grams-to-kg conversion) |
| `parcel.packageCount` | `quantity` for unified request; package array count for bulk request |
| `parcel.contentsDescription` | `description` (truncate only after validation; provider limit is 50 chars) |
| server-derived `parcel.declaredValue` | `packageValue` |
| optional selected vehicle | `vehicleType` only after enum confirmation |
| provider returned timeline | `deliveryTimeline` when included in quote/tracking response |

No dimensions, category, fragile flag, provider email, or client-supplied
delivery price are part of this mapping. Pickup and recipient phone numbers are
sent only when required for a partner booking and after the documented data-
sharing consent. No delivery insurance is requested or charged in Natty V1.

## 9. Provider confirmations required before live integration

The public docs are enough to design the data capture, but not enough to safely
publish a complete service/pricing selector. Confirm with Kwikpik:

1. Exact operation paths, HTTP methods, and API version prefix for estimate,
   create (bulk/unified), track, cancel, locations, labels, and webhook setup.
2. Staging credentials/base URL and a synthetic-data test account; production
   must remain disabled until contract tests pass.
3. Whether estimate responses include service options, `deliveryTimeline`,
   vehicle, ETA, quote ID, expiry, componentized surcharges, and a guaranteed
   amount at booking.
4. Whether “Express” or Same-day is actually bookable, its service code,
   coverage, cutoff time, SLA meaning, and how its price differs. The public
   example `SAME_DAY` alone does not establish a purchasable tier.
5. Canonical vehicle enum; weight maximums and accepted units for each route.
6. Exact declared-value currency/decimal convention and whether insurance is
   available in our merchant account, its premium calculation, exclusions,
   limits, policy reference and claim process.
7. Price components/surcharges, tax treatment, quote freshness, reweigh/price
   adjustment rules, and who is billed.
8. Duplicate-reference behavior, cancellation cutoffs/fees, redelivery/RTO
   costs and payer, webhook event coverage/retry guarantees, and event ordering.
9. Serviceability/coverage behavior for non-geocoded addresses and whether
   address or coordinates are authoritative.

Do not call a sandbox or production endpoint until credentials, target
environment and test-data boundaries are explicitly configured. No external
Kwikpik API call was made for this documentation review.

## 10. Rollout and acceptance

1. Keep seller-managed fulfillment as the default; add store opt-in/settings.
2. Add request/response DTOs and validators based on this contract.
3. Add Kwikpik mapping/unit tests, including decimal money conversion, required
   weight, optional contact fields, and provider enum rejection.
4. Add live estimate route and frontend choices; feature-gate by environment,
   store and supported coverage.
5. Split delivery money in checkout/escrow and verify financial invariants.
6. Add seller-ready booking, idempotency, webhook verification and tracking.
7. Run contract tests only against Kwikpik staging with synthetic addresses and
   parcels before considering limited rollout.

Acceptance requires self-delivery to remain functional, provider delivery to
be opt-in, all buyer-visible prices to come from server-side provider estimates
and consent, weight to be validated, Same-day/Express to appear only when
confirmed by a live supported option, and duplicate/replayed bookings/events to
have no duplicate financial or delivery effect.

## 11. Sources

- [Kwikpik Partnership API documentation](https://docs.kwikpik.io/) — read
  2026-11-03. The page labels the API v2 and documents API key authentication,
  estimates, bulk/unified order creation, tracking, cancellation, locations,
  labels, status events, webhooks and staging simulator.
- Current implementation: `services/go/modules/orders/src/logistics/`,
  `services/go/modules/orders/src/databases/schema/logistics.schema.go`,
  `services/go/modules/orders/src/services/checkoutPlan.service.go`, and
  `services/go/modules/orders/src/configs/orders.config.go`.

## 12. Buyer and seller delivery visibility (2026-11-13)

- Checkout remains quote-driven: delivery price is calculated by the backend for the chosen saved address and current cart revision; stale quotes must be refreshed and reviewed before payment. Product-detail shipping text is informational and does not substitute for a checkout quote.
- Seller fulfillment views now preserve the saved address snapshot's second line, postal code, and delivery details in order detail, invoice, and packing slip. These fields are visible to the fulfilling seller for that order; they are not included in buyer-facing or staff logistics summaries.
- Buyer order detail in web and React Native now renders a bounded event history from the buyer-authorized order-detail endpoint. Only recognized order-state events are exposed with fixed buyer-safe wording; internal notes and arbitrary event summaries remain seller-only. This timeline is an audit of Nantty order/seller updates, not carrier tracking.
- Courier selection, provider booking, carrier webhooks, and live carrier tracking remain unimplemented. The buyer UI discloses that live courier tracking may not be available, and seller-entered tracking remains the current manual path. Do not represent this as a live logistics-provider integration.
- Verification for this increment: `go test ./...` in the orders module passed; webapp/seller TypeScript checks, mobile `tsc --noEmit`, focused mobile product/review/checkout tests, targeted ESLint, and whitespace checks passed. Provider sandbox, production API, payment, and device-level validation were not run.
