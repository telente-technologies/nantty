# Logistics v2 — provider delivery, Chowdeck first

> **Status: V2 plan, not launch.** Seller-managed delivery remains the current
> production flow. Nothing in this document is implemented yet. The first
> provider adapter is Chowdeck Relay; the engine must stay provider-agnostic so
> ShipBubble, GIG/Fez, Sendbox or rural partners can be added later without
> rewriting checkout or settlement.

Status date: 2026-10-20.

## 1. Scope and principles

### Current state (v1)

- Sellers configure shipping profiles, zones and rules.
- Buyers see the seller's delivery price at checkout.
- The seller fulfils the order and updates delivery status manually.
- No ZudoMart logistics network and no third-party courier API is used.

### V2 goal

The buyer sees only delivery options that are available for their exact route,
with the actual delivery fee. The selected fee is added to checkout. Free
delivery, insurance, failed delivery and redelivery are handled by explicit,
disclosed rules.

Two principles govern every provider:

1. **The buyer chooses the available provider.** ZudoMart requests live rates,
   filters out unavailable providers, and shows the delivery price before
   payment. A provider is never shown unless its route, parcel limits and quote
   are valid.
2. **The order's delivery policy decides who bears each cost.** The buyer,
   seller or ZudoMart may bear a cost depending on the circumstances. Provider
   charges must never silently become buyer charges.

### Non-goals for v2.0

- No station drop-off. Door-to-door pickup and delivery only.
- No hard-coded "six options". The option count is whatever the live quotes
  return after filtering.
- No provider booking before payment and seller readiness.
- No automatic post-payment price increase. Re-quote and obtain approval, or
  absorb the difference under the disclosed policy.
- No claim that every address in a city or state is serviceable.

## 2. Prerequisites

Before the checkout selector can be built:

- Buyer and store addresses need `latitude` and `longitude`, plus a normalized
  state/LGA and landmark/alternate phone where available.
- Products need actual weight, dimensions (length, width, height), package
  category, declared value and a fragile flag.
- Stores need a pickup address, contact name, phone, email and pickup hours.
- Delivery money must be separated from merchandise money in the payable and
  escrow calculations. Today `sellerNet` is calculated from
  `payable.AmountMinor - commission - payment.ProviderFeeMinor`, and
  `payable.AmountMinor` includes shipping. That makes shipping commissionable
  and can pay the seller the courier's money. This must be fixed before any
  provider fee is added.
- Provider contracts, sandbox credentials and webhook secrets must be in the
  server environment, never in a client app.

## 3. Checkout and booking flow

Use this flow for every provider.

1. **Seller prepares delivery details.**
   Pickup address, buyer address, parcel size, weight, contents and declared
   value.
2. **Request quotes in parallel.**
   Check coverage and request current prices. Do not create a shipment while the
   buyer is still comparing.
3. **Filter available options.**
   Remove unsupported routes, failed quote requests, expired quotes, parcels
   outside provider limits, station-only services and providers whose prepaid
   wallet cannot cover the booking.
4. **Buyer selects delivery.**
   Show provider, total fee, delivery estimate, door-to-door confirmation and
   any conditions. One selection per seller group in a multi-seller cart.
5. **Calculate final checkout.**
   Apply free-delivery rules, insurance and disclosed charges. Lock the quote
   for a short window (recommended 15–30 minutes).
6. **Confirm payment.**
   Payment covers merchandise and delivery. The order is paid, but the courier
   is not booked yet.
7. **Seller marks the order ready for pickup.**
   This is the booking gate. Booking earlier risks a rider arriving before the
   parcel is packed, especially for on-demand providers.
8. **Book delivery.**
   Revalidate the quote. If it expired, re-quote before booking. Use an
   idempotency key and never double-book.
9. **Track delivery.**
   Provider webhooks are the primary update path where the contract is
   confirmed; scheduled polling is the fallback. Every event is idempotent.
10. **Complete delivery.**
    Delivery completion updates buyer and seller dashboards, but escrow release
    still follows the normal inspection/auto-release rules.

A paid order must never be left with no delivery path. If booking fails, alert
operations and offer an alternate provider, seller delivery or a delivery-fee
refund.

## 4. Chowdeck Relay — first adapter

### 4.1 What the public documentation confirms

- Relay is an on-demand, door-to-door delivery product.
- The flow is two-step: request a fee quote, receive a `fee_id`, then create the
  delivery with that `fee_id`.
- Fee quotes are not permanent; delivery should be created promptly.
- The fee request accepts pickup and destination coordinates or address strings,
  plus `estimated_order_amount` and item details.
- Delivery creation accepts a caller reference, item type, sender/receiver
  contacts, optional delivery PIN, notes and notification preferences.
- Delivery lookup is by reference.
- Delivery statuses include `preparing`, `awaiting_pickup`, `in_transit`,
  `success` and `rejected`.
- Cancel is available by reference; it may fail after pickup.
- Redelivery has its own fee quote, a new fee ID and a wallet charge.
- Relay has a prepaid wallet with balance and history endpoints.

### 4.2 What is not confirmed and must be answered by Chowdeck

| Question | Why it matters |
| --- | --- |
| Which base URL is production? The Relay guide uses `https://api.relay.chowdeck.com`; the API reference uses `https://api.chowdeck.com/relay/...` | Do not assume the hosts are interchangeable. Make the base URL configurable and test every endpoint in sandbox. |
| What are the Relay-specific webhook events, signature format, retry policy and delivery guarantees? | Public webhook docs describe merchant order events, not clearly Relay package deliveries. Use polling as the fallback until confirmed. |
| Is there a coverage/serviceability endpoint or a current city/polygon list? | Coverage cannot be inferred from marketing. The live fee quote is the serviceability test; a list is still useful for pre-checkout messaging. |
| How are weight, dimensions, oversized items and surcharges handled? | The published fee request does not document weight/dimensions. Do not assume interstate volumetric rules apply. |
| Does Relay offer optional insurance, a policy reference and a claims endpoint? | `estimated_order_amount` is a declared value, not proof of insurance. Leave insurance disabled for this provider until confirmed. |
| What are the allowed `item_type` values? | The docs give examples, not a complete enum. Map our package categories to confirmed values. |
| Is there a sandbox environment and test wallet? | Needed for contract tests, webhook replay and failure-path testing. |
| Who bears the redelivery fee when the buyer is unavailable or the address is wrong? | The wallet is debited by ZudoMart; that does not mean the buyer has agreed to pay. |

### 4.3 Adapter behaviour

- Base URL and credentials come from server configuration per environment.
- Quote after the buyer selects an address, not on every cart render.
- Store the provider quote ID, amount, currency, expiry, service type and
  conditions.
- Book only after payment and seller readiness.
- Re-quote if the fee quote or delivery quote expired. If the new price differs,
  follow the price-variance policy; never silently charge more.
- Preflight the Relay wallet before showing or booking the option.
- Use our order-group reference as the provider reference; enforce uniqueness to
  prevent duplicate bookings.
- Generate a delivery PIN where supported and show it to the buyer only.
- Treat polling as authoritative until Relay webhooks are contractually
  confirmed.
- Normalize provider statuses into the platform status model; do not invent a
  status the provider did not send.

### 4.4 Suggested endpoint map

| Purpose | Method and path |
| --- | --- |
| Fee quote | `POST /relay/delivery/fee` |
| Create delivery | `POST /relay/delivery` |
| Get delivery | `GET /relay/delivery/{reference}` |
| Cancel delivery | `POST /relay/delivery/{reference}/cancel` |
| Redelivery quote | `POST /relay/delivery/{reference}/redelivery/fee` (confirm exact path) |
| Request redelivery | `POST /relay/delivery/{reference}/redelivery` (confirm exact path) |
| Wallet balance | `GET /relay/wallet/balance` |

Paths must be verified against the sandbox and the confirmed base URL before
implementation.

## 5. Who pays the delivery fee?

Separate the courier's actual charge from the party who bears it.

| Situation | Payer under the recommended policy |
| --- | --- |
| Normal paid delivery | Buyer |
| Seller offers free delivery | Seller, up to the seller's disclosed subsidy cap |
| Seller offers free delivery above a threshold | Seller, when the qualifying order meets the rule |
| ZudoMart delivery promotion | ZudoMart, unless another funding arrangement is disclosed |
| Buyer gives an incorrect address | Buyer, where the disclosed policy assigns the resulting redelivery cost |
| Buyer is unavailable after agreed attempts | Buyer may pay for redelivery under the disclosed policy |
| Seller is not available for pickup | Seller, where the failed pickup was the seller's responsibility |
| Seller packed the wrong item | Seller |
| Courier fails through its own fault | Courier refund/credit; do not automatically charge buyer or seller |
| Weather, road closure or another exceptional event | Apply the disclosed exception policy after assessing the actual cause |
| Damaged or lost in transit | Courier claims process and applicable insurance |

### 5.1 Free delivery

Example: merchandise ₦550,000, courier fee ₦4,000, seller free-delivery threshold
₦500,000.

- Buyer pays delivery: ₦0.
- Seller funds delivery: ₦4,000.
- Seller settlement deducts the ₦4,000 courier fee, separately from marketplace
  commission.

The threshold should be calculated from the eligible merchandise subtotal
**after discounts**, excluding shipping and insurance, so the rule is
predictable. Sellers should also be able to set a maximum shipping subsidy. If
a seller offers free delivery above ₦500,000 but caps their contribution at
₦5,000, any excess must be disclosed before the order is placed.

If the actual courier charge exceeds the quote, do not silently deduct the
difference from the seller or charge the buyer. Honour the original commitment
and absorb a small variance under policy, or obtain approval before changing
the order total.

## 6. Parcel weight and dimensions

Each seller should provide, when creating a shipping-ready order:

- actual weight in kilograms;
- length, width and height in centimetres;
- package category and contents;
- declared value;
- number of packages and a fragile flag.

Carriers may charge on actual weight, volumetric weight or a combination:

```
volumetric weight (kg) = (length_cm × width_cm × height_cm) / divisor
```

The divisor varies by provider and service, so it must be configurable per
provider. Example: 40 × 30 × 20 cm = 24,000 cm³; with a divisor of 5,000 the
volumetric weight is 4.8 kg. If actual weight is 2 kg, that carrier may charge
on 4.8 kg.

For Chowdeck Relay, the published fee request does not document weight or
dimensions. Validate the parcel against Chowdeck's confirmed limits before
showing the option. If a courier reweighs or remeasures the parcel, record the
adjustment and follow the disclosed approval/refund process.

## 7. Optional delivery insurance

Insurance is shown only when the selected provider or insurer actually offers
cover.

Flow:

1. Seller selects a delivery provider.
2. ZudoMart retrieves the provider's insurance options and terms.
3. Seller selects standard delivery or optional insurance and a permitted
   coverage amount.
4. ZudoMart obtains the confirmed premium.
5. Checkout shows who pays the premium.
6. Store the policy reference, coverage amount, premium, exclusions and insured
   shipment value.
7. If insurance is unavailable, do not display it.

Distinguish **declared value** from **insured value**. A seller must not insure
above the provider's permitted limit. Insurance is not a guarantee of
reimbursement for every loss or damage.

Chowdeck Relay insurance is **disabled** until Chowdeck confirms an insurance
selection and policy endpoint.

## 8. Failed delivery, cancellation and redelivery

A failed delivery does not automatically mean the buyer pays.

### 8.1 Failure reasons

| Failure reason | Recommended responsible party |
| --- | --- |
| Wrong buyer address | Buyer, where permitted and disclosed |
| Buyer unavailable after agreed attempts | Buyer may pay redelivery under the disclosed policy |
| Seller did not hand over the parcel | Seller |
| Seller packed the wrong item | Seller |
| Courier operational failure | Courier, subject to its contract |
| Exceptional event | Disclosed exception policy after assessing cause |
| Damage or loss | Courier claim and applicable insurance |

### 8.2 Chowdeck redelivery

1. Request a redelivery quote using the original delivery reference.
2. Receive a new fee ID and redelivery amount.
3. Submit the redelivery request with that fee ID.
4. The fee is deducted from the Relay wallet.

ZudoMart must still decide who bears the cost:

- record the failure reason and supporting evidence;
- request the current redelivery fee;
- notify the buyer of the reason and price;
- collect payment or an authorised balance deduction;
- book redelivery only after payment is confirmed.

If the courier caused the failure, do not charge the buyer just because ZudoMart
funded the redelivery first. Pursue the applicable courier credit or
reimbursement.

### 8.3 Cancellation

- Before booking: refund the delivery fee in full.
- After booking, before pickup: refund minus any provider cancellation fee.
- After pickup: non-refundable unless the provider caused the failure.
- Seller-managed delivery: seller policy and admin dispute.
- ShipBubble limitation for a later adapter: its cancel endpoint only cancels a
  scheduled future shipment, not an already processed label.
- Chowdeck cancellation may fail after pickup; handle the error gracefully.

### 8.4 Return to seller

Support return-to-seller, refund and claims workflows when redelivery is not
possible. The responsible party is determined from the recorded reason, not
from whichever API call is convenient.

## 9. Unified logistics orchestrator

```
ZudoMart checkout
        |
        v
Logistics orchestrator
  coverage | quotes | promotions | insurance
  booking | tracking | cost allocation | claims
        |
        +--> Chowdeck Relay (urban express, v2.0)
        +--> ShipBubble (aggregator, v2.1)
        +--> GIG / Fez (interstate, later)
        +--> Sendbox (aggregator, later)
        +--> ZudoMart rural partners (later)
        |
        v
Unified shipment record
  one order reference, status history,
  receipts, settlement and claims
```

Provider adapter interface:

```go
type DeliveryProvider interface {
    Quote(ctx context.Context, req QuoteRequest) ([]Quote, error)
    Book(ctx context.Context, req BookRequest) (Shipment, error)
    Cancel(ctx context.Context, shipmentID, reason string) error
    Track(ctx context.Context, shipmentID string) (Shipment, error)
    ParseWebhook(r *http.Request) (Event, error)
    Coverage(ctx context.Context) ([]Coverage, error)
}
```

Rules:

- One booking path per shipment. Do not book the same parcel through an
  aggregator and the underlying courier's direct API.
- Normalize statuses at the adapter boundary.
- Keep provider-specific fields in metadata, not in the core order table.
- Every quote and booking is idempotent.
- Provider errors are classified as retryable, terminal or needs-ops.

## 10. Data model

Proposed records:

- `shipment`: order group, pickup and destination, selected provider, quote
  reference, status, tracking reference.
- `parcel`: actual weight, dimensions, declared value, contents, package count.
- `delivery_quote`: provider, amount, currency, expiry, service type, conditions.
- `delivery_policy`: free-shipping threshold, funding party, subsidy cap,
  eligible products.
- `shipment_insurance`: insurer, policy reference, coverage amount, premium,
  claim status.
- `delivery_attempt`: attempt number, timestamp, failure reason, evidence,
  responsible party.
- `shipment_charge`: actual courier cost, buyer contribution, seller subsidy,
  platform subsidy, adjustments.
- `shipment_event`: provider status updates, webhook IDs and polling history.
- `delivery_claim`: loss/damage details, evidence, responsible party, claim
  amount and resolution.

Store all money as integer kobo. Preserve the original charge and add
adjustments; never overwrite the audit trail.

## 11. Money and ledger

Before provider delivery, split the payable:

```
merchandise_minor
delivery_fee_minor
platform_delivery_markup_minor
seller_delivery_income_minor
provider_delivery_cost_minor
```

Rules:

- Marketplace commission is calculated on merchandise only, after discounts and
  store credit.
- Provider delivery fee is a pass-through liability.
- Seller delivery fee is a seller receivable, released after delivery under the
  normal escrow rules.
- Platform delivery subsidy or markup is recorded separately.
- Payment processing fees are allocated proportionally or absorbed by the
  platform under a stated rule.
- Normalize provider units at the adapter boundary. Chowdeck amounts are in
  kobo; other providers may use major units with decimals.
- Prefunded provider wallets are an operational float. Record every top-up,
  debit and refund. The legal/accounting treatment of that float needs review
  against the "ZudoMart never holds customer money" decision before launch.
- A provider cost increase must never silently become a buyer charge. Re-quote,
  ask for approval, or absorb the difference under the disclosed policy.

## 12. Proposed API surface

- `POST /api/v1/checkout/delivery-options`
- `POST /api/v1/orders/checkout` with `deliverySelections`
- `POST /api/v1/checkout/delivery-quote-requests`
- `POST /api/v1/seller/delivery-quote-requests/{id}/quote`
- `POST /api/v1/seller/delivery-quote-requests/{id}/decline`
- `POST /api/v1/seller/orders/{id}/ready-for-pickup`
- `GET /api/v1/orders/{id}/delivery`
- `POST /api/v1/orders/{id}/delivery/redelivery/quote`
- `POST /api/v1/orders/{id}/delivery/redelivery/confirm`
- `POST /api/v1/webhooks/delivery/chowdeck`

Webhook requirements: signature verification, replay protection where the
provider supports it, idempotent event storage and a fast `200` response with
asynchronous processing.

## 13. Rollout

| Stage | Scope | Status |
| --- | --- | --- |
| V1 (now) | Seller-managed delivery only; seller sets price and updates status | Current |
| V2.0 | Logistics orchestrator, delivery ledger split, Chowdeck Relay sandbox, buyer selection UI, tracking, cancellation, redelivery | Planned |
| V2.1 | Second provider (ShipBubble or another aggregator), coverage sync, multi-courier options | Later |
| V2.2 | Rural/local partners, insurance partnerships, advanced claims and analytics | Later |

V2.0 is feature-flagged by provider, city and seller. It must not change the
current seller-managed checkout until the flag is enabled.

## 14. Open decisions

1. Does Chowdeck confirm `api.relay.chowdeck.com` or `api.chowdeck.com` as the
   production base URL?
2. Are Relay-specific webhooks available, and what is their signature and retry
   contract?
3. What is Chowdeck's current city/coverage list, and is there a serviceability
   endpoint?
4. What are Chowdeck's parcel weight, dimension and oversize rules?
5. Does Chowdeck Relay support insurance, and if so, what is the policy and
   claims flow?
6. Who bears a quote-to-booking price difference, and what is the cap?
7. What is the seller delivery fee cap: lower of ₦25,000 or 30% of the seller
   group?
8. Are free-delivery promotions seller-funded only in v1 of the feature?
9. What is the default insurance policy and declared-value limit?
10. Is provider delivery escrow-only in v2.0?
11. What is the legal/accounting treatment of the prepaid provider float?
12. Which cities are enabled at V2.0 launch?

## 15. Acceptance criteria

- Only serviceable, door-to-door options are shown.
- The displayed delivery fee is the amount added to checkout, including free
  delivery and insurance effects.
- An expired quote is never booked; the buyer is re-quoted or refunded.
- No provider charge is silently added to the buyer or deducted from the seller.
- Booking happens after payment and seller readiness, and only once.
- Webhooks are signature-verified, idempotent and safe to replay.
- Redelivery requires a recorded reason and an approved payer.
- Delivery completion updates both buyer and seller dashboards.
- Delivery money reconciles from buyer payment to provider wallet debit and
  seller/platform settlement.
- Seller-managed delivery continues to work unchanged while V2 is disabled.
