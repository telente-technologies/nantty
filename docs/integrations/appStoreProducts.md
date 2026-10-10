# Creator subscriptions in the App Store and Google Play

Fans can subscribe to creators inside the iOS and Android apps. The price in the app is the web price plus that store's fee, so the creator earns the same as on the web: Zudomart takes the store fee off the gross, then the creator keeps 80% of what is left (net).

The full product list, with every price per region, is in [`infra/appStore/creatorSubscriptionProducts.json`](../../infra/appStore/creatorSubscriptionProducts.json). It is generated from `services/go/platform/regionpricing/regionPricing.creatorTiers.go`, and `regionPricing.storeProducts_test.go` fails if the two drift apart.

## How the products work

### Price tiers

Creators no longer type a price. They pick one of seven tiers, and the backend refuses anything else (`422 PRICE_NOT_A_TIER`).

| Tier | NG | GH | KE | ZA | GB | EU | US (and every other country) |
|---|---|---|---|---|---|---|---|
| 500 | ₦500 | GH₵6 | KSh 100 | R14.99 | £1.99 | €1.99 | $1.99 |
| 1000 | ₦1,000 | GH₵12 | KSh 200 | R29.99 | £3.99 | €4.49 | $4.99 |
| 1500 | ₦1,500 | GH₵18 | KSh 300 | R44.99 | £5.99 | €6.99 | $7.49 |
| 2000 | ₦2,000 | GH₵25 | KSh 400 | R59.99 | £7.99 | €8.99 | $9.99 |
| 3000 | ₦3,000 | GH₵36 | KSh 600 | R89.99 | £11.99 | €13.49 | $14.99 |
| 4000 | ₦4,000 | GH₵48 | KSh 800 | R119.99 | £13.99 | €15.99 | $17.99 |
| 5000 | ₦5,000 | GH₵60 | KSh 1,000 | R149.99 | £15.99 | €17.99 | $19.99 |

- **Yearly plans** cost 10 × the monthly tier, so two months are free.
- **App prices** are `web price / (1 − store fee)`, rounded up to the regional price point. For example, ₦1,000 on the web is ₦1,500 on iOS (30% fee) and ₦1,200 on Android (15% fee). The JSON lists the `appleMinor`, `appleSmallBusinessMinor` and `googleMinor` prices for every region.
- The apps read these prices from `GET /api/v1/creators/{id}/subscription-plans?channel=ios|android|web`. Each plan has a `channelPrice` and a `storeProductId`. The app then shows the store's own localized price for that product.

### Why there are "slots", and why each product is its own subscription group

Apple and Google let one account hold **only one active subscription per product**. Apple goes further: a subscription group allows only one active subscription at a time. So "one product per tier" would stop a fan from subscribing to two creators who both charge ₦1,000.

The solution is slots: every tier and interval has **5 identical products**:

```
zudomart.creatorsub.tier_1000.s1.monthly
...
zudomart.creatorsub.tier_1000.s5.monthly
```

When a fan subscribes to a creator, the backend gives them the first slot they aren't already using at that tier. Each product sits in **its own subscription group** on iOS, and is its own subscription on Google Play, so slots never cancel or upgrade each other. A fan can therefore hold up to 5 creators per tier and interval: 70 creator subscriptions in all. Past that, the app shows `STORE_SLOTS_FULL` and offers web checkout.

The products don't name a creator. The link between a store purchase and a creator is made through:

- `appAccountToken` on iOS
- `obfuscatedAccountId` on Android

Both are set to the Zudomart creator-subscription id when the purchase starts, and the backend verifies them on every receipt and notification.

To raise the limit, add slots 6 onwards in both consoles, then bump `CreatorStoreSlots` and regenerate the JSON.

The totals are 7 tiers × 2 intervals × 5 slots = **70 products** per store, and **70 subscription groups** on iOS.

## App Store Connect (iOS)

1. **Agreements.** Under App Store Connect → Business, make sure the Paid Applications agreement, tax and banking are active.
2. **Small Business Program.** If Zudomart is enrolled in the App Store Small Business Program, set `appleSmallBusinessProgram: true` in admin config `appStore.fees`. iOS prices then use the 15% column (`appleSmallBusinessMinor`).
3. **Create the subscriptions.** Go to App → Monetization → Subscriptions. For each of the 70 products in the JSON:
   - Create a **subscription group**. Its reference name is the product id, for example `zudomart.creatorsub.tier_1000.s1.monthly`. Every product needs a group of its own.
   - Inside that group, add one auto-renewable subscription:
     - Product ID = `productId`
     - Reference name = `apple.referenceName`
     - Duration = `apple.duration`
     - Family Sharing off
   - **Price:** set the base country to Nigeria at `prices.NG.appleMinor` (minor units, so 150000 means ₦1,500). Use "manually adjust prices" so GH, KE, ZA, GB, the euro countries and the US match the `appleMinor` of their region. Pick the nearest Apple price point **at or above** each value. Let every other storefront follow the US price.
   - **Localization:** display name "Creator subscription", description "Supports a Zudomart creator you choose in the app".
   - Upload one review screenshot of the subscribe screen.
   - Tip: the App Store Connect API (`POST /v1/subscriptionGroups`, `/v1/subscriptions`, `/v1/subscriptionPrices`) can create all 70 from the JSON in a script. This is far faster than clicking.
4. **Server notifications.** Under App Information → App Store Server Notifications:
   - Production URL: `https://api.zudomart.com/webhooks/store-notifications/apple_iap`, **Version 2**.
   - Sandbox URL: the same path on the staging gateway.
5. **API key.** Under Users and Access → Integrations → In-App Purchase, generate a key. Then set:
   - `APPLE_IAP_ISSUER_ID` and `APPLE_IAP_KEY_ID`
   - `APPLE_IAP_PRIVATE_KEY_PATH`, which points to the downloaded `.p8` file
   - `APPLE_IAP_BUNDLE_ID=com.zudomart.app`
   - `APPLE_IAP_ROOT_CERTIFICATES_PATH`, which points to Apple Root CA G3 (download it from apple.com/certificateauthority)
   - `APPLE_IAP_ENVIRONMENT`: `Sandbox` or `Production`
   - `APPLE_IAP_API_BASE_URL`, which matches the environment: `https://api.storekit-sandbox.itunes.apple.com` or `https://api.storekit.itunes.apple.com`
6. **Testing.** Add Sandbox testers under Users and Access → Sandbox. Then install the development build (see below) and subscribe.

## Google Play Console (Android)

1. **Payments profile.** Make sure the payments profile is set up under Settings → Payments profile.
2. **Create the subscriptions.** Go to Monetize → Products → Subscriptions. For each of the 70 products:
   - Create a subscription. Product ID = `google.productId`, the same id as on iOS.
   - Add one **base plan**:
     - Base plan ID = `google.basePlanId` (`monthly` or `yearly`)
     - Auto-renewing, billing period = `google.billingPeriod`
     - Grace period 3 days (`google.gracePeriod`) and account hold 30 days
   - **Prices:** set Nigeria to `prices.NG.googleMinor`, and GH, KE, ZA, GB, the euro countries and the US to their `googleMinor`. Let other countries follow the US price.
   - Activate the base plan. Don't add free-trial offers: the app sends the base plan's offer token.
   - The Play Developer API (`monetization.subscriptions.create`) can create them from the JSON in bulk.
3. **Service account for receipt checks.**
   - In Google Cloud, create a service account and enable the "Google Play Android Developer API".
   - In Play Console → Users and permissions, invite the service account with **View financial data** and **Manage orders and subscriptions**.
   - Download its JSON key and set `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH` to it, plus `GOOGLE_PLAY_PACKAGE_NAME=com.zudomart.app`.
   - The backend calls `purchases.subscriptionsv2.get` to verify, and `purchases.subscriptions.acknowledge` to acknowledge. Google refunds anything left unacknowledged for 3 days; the app acknowledges too, when it finishes the transaction.
4. **Real-time Developer Notifications.**
   - Create a Pub/Sub topic, for example `play-rtdn`, and grant `google-play-developer-notifications@system.gserviceaccount.com` the **Pub/Sub Publisher** role on it.
   - Create a **push** subscription to `https://api.zudomart.com/webhooks/store-notifications/google_play` with **authentication enabled**: pick a service account, and set the audience to that same URL.
   - Set `GOOGLE_PLAY_RTDN_PUSH_AUDIENCE` to that URL and `GOOGLE_PLAY_RTDN_PUSH_SERVICE_ACCOUNT` to the push service account's email. The backend verifies Google's signed OIDC token on every push.
   - In Play Console → Monetize → Monetization setup, enter the topic name and send a test notification.
5. **Testing.** Add license testers under Settings → License testing, then install the development build from an internal testing track.

## Fees (admin)

Store fees live in the admin platform setting `appStore.fees` (permission `config:revenue`). Defaults:

```json
{"appleFeeBps": 3000, "appleSmallBusinessProgram": false, "appleSmallBusinessFeeBps": 1500, "googleSubscriptionFeeBps": 1500}
```

- Changing a fee changes the **displayed** channel price and how the next charge is split.
- It does **not** change the price in the store consoles. Update those by hand, using the JSON regenerated for the new fee.
- The creator's share is always computed from what the store actually charged, minus the configured fee.

## What the backend does

| Event | Effect |
|---|---|
| `POST /api/v1/creators/{creatorId}/subscriptions/store {planId, platform}` (Idempotency-Key) | Creates a pending store-billed subscription and picks a slot. Returns `productId`, `appAccountToken` and `obfuscatedAccountId`. Returns 503 `STORE_BILLING_UNAVAILABLE` before the fan pays if that store isn't configured. |
| `POST /api/v1/creator-subscriptions/store-receipts {platform, productId, receipt, transactionId}` (Idempotency-Key) | Verifies the purchase with Apple (signed JWS, or the App Store Server API when `transactionId` is sent) or Google (`subscriptionsv2`). Activates the subscription, posts the earnings once per store transaction, and acknowledges the purchase on Google Play. The app's "Restore purchases" uses the same endpoint. |
| Renewal (`DID_RENEW`, RTDN 1/2/4/7) | Posts a new charge and earnings; the period runs to the store's expiry. |
| `DID_FAIL_TO_RENEW`, RTDN 5 | `past_due` |
| Grace period (Apple `GRACE_PERIOD`, RTDN 6) | `past_due`, with access kept for 3 days |
| Auto-renew off (`DID_CHANGE_RENEWAL_STATUS`, RTDN 3) | `cancelled`, with access until the period ends |
| Auto-renew back on | `active` |
| `EXPIRED`, `GRACE_PERIOD_EXPIRED`, RTDN 12/13 | `expired` |
| `REFUND`, `REVOKE`, voided purchase | The charge is marked `refunded` and access ends. The creator's share is clawed back from their earnings; any part already withdrawn goes to their earnings-debt account. Emits `creatorSubscription.refunded`. |

- **Idempotency:** each notification id is processed once, and each store transaction id posts earnings once.
- **Cancelling:** fans cancel store-billed subscriptions in their store settings. The Zudomart cancel and resume endpoints return 409 `MANAGE_IN_STORE`, and the app shows a "Manage in the App Store / Google Play" button instead.

## Mobile development build

IAP needs native code, so it can't run in Expo Go. In Expo Go, the subscribe screen says "Subscriptions need the Zudomart app build" and disables the button.

```bash
cd apps/mobile
eas build --profile development --platform ios        # or android
npx expo start --dev-client
```

The `development` profile in `eas.json` builds with `expo-dev-client` and `expo-iap`; both are registered as config plugins in `app.json`.
