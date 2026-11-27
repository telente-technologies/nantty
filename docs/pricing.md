# Nantty pricing (regional)

Status: this is a dated pricing proposal and implementation guide, not a live price list. Runtime prices come from the effective-dated subscription price book (`plan_prices` plus `plan_price_versions`) and can be changed by authorized staff. The source defaults live in `services/go/platform/regionpricing/regionPricing.plans.go`; checkout/API prices take precedence over every table in this document. Amounts use currency minor units. Do not publish or quote a proposal as an active price without checking the effective price returned by the service.

Current coin-pack implementation note (2026-11-27): coin package rows retain per-channel currency amounts and now accept optional supported-country overrides in Admin. The server prefers an exact resolved country/currency override, then falls back to the existing currency/USD rule. This does not revise the broader subscription or ad pricing proposal below. For mobile coin purchases, native store product pricing remains authoritative and must be shown from the platform billing SDK; server package amounts are not a substitute.

The legacy subscription catalogue is still being migrated to the canonical Blue Basic, Blue Premium, Gold Basic, Gold Premium and Black Government model. As of 2026-10-29, the Nigeria source defaults are Blue/legacy `blue` ₦2,500/month, Premium/legacy `premium` ₦20,000/month, Gold-only ₦3,000/month, seller Pro ₦5,000/month, seller Business ₦30,000/month, and legacy Black ₦50,000/month. Black's source row is not approved public pricing: the current working proposal is USD 300/month, USD 500 was mentioned earlier, and the amount remains pending confirmation; Black is not self-serve and public Help Centre copy must not quote either value. All figures are fresh-install defaults, not a read of any existing database. Gold Pro and Gold Business have store-channel price derivation enabled in code; whether a native store product is actually purchasable must be verified against the platform catalog and current client flow.

## 1. Historical proposal rules (owner, 4 Oct 2026; not a current checkout contract)

The regional tables below preserve an earlier pricing proposal for research and historical context. They have not been reconciled to all current founder decisions and must not be presented to customers as active prices. Only use the effective price book/checkout response for a quote. Current Nigeria fresh-install subscription defaults are summarized at the top of this document; the current configured Gold Business default is ₦30,000/month. Annual and mobile prices are calculated/configured values, not guaranteed published store prices.

- Prices differ per **pricing region**: Nigeria (NG, NGN), Ghana (GH, GHS), Kenya (KE, KES), South Africa (ZA, ZAR), United Kingdom (GB, GBP), Eurozone (EU, EUR; the 20 euro countries share one price), United States (US, USD).
- **Any other country pays the US price in USD.**
- A rejected verification refunds only the checkmark share on plans that sell more than the checkmark (§2.1).
- Regional prices cover every checkmark (Blue Essential/Verified/Premium, Gold through seller Pro/Business and Gold-only, Black), the Premium user subscription (= Blue Premium), coin packs, suggested creator-subscription bands, boosts, and ad floors and minimum budgets.
- **The creator ad revenue share (40%) is the same in every region.** So is the creator subscription share (80% of net) and the gift share tiers.
- **How the region is chosen** (`platform/regionpricing`):
  1. In the apps: the App Store storefront (`SKStorefront.countryCode`, ISO alpha-3) or Google Play billing country (alpha-2), sent as `X-Store-Storefront` with `X-Client-Platform: ios|android`. The store charges that storefront's price, so it wins.
  2. Profile country of the signed-in user.
  3. The CDN country header (`CloudFront-Viewer-Country`, set by the edge) or IP lookup.
  4. The `X-Client-Region` hint (device locale).
  5. Nothing known: US/USD.
  
  The web never trusts a storefront header, and the checkout never reads a `?currency=` choice, so a buyer can't pick a cheaper region.

## 2. Headline price table (monthly; web / app where sold in the app)

Historical proposal amounts only; the old same-price-for-Apple-and-Google assumption is no longer reliable. Store fees and catalog price points are platform/region-specific. Seller plans, Gold-only and Black channel availability must be checked against current checkout and store configuration.

| Product | NG (NGN) | GH (GHS) | KE (KES) | ZA (ZAR) | GB (GBP) | EU (EUR) | US (USD) and every other country |
|---|---|---|---|---|---|---|---|
| Blue Essential (no badge) | ₦1,000 / ₦1,200 | GH₵12 / GH₵15 | KSh 200 / KSh 250 | R29.99 / R34.99 | £2.49 / £2.99 | €2.49 / €2.99 | $2.49 / $2.99 |
| **Blue Verified (blue checkmark)** | **₦2,500 / ₦2,900** | **GH₵30 / GH₵35** | **KSh 500 / KSh 600** | **R59.99 / R69.99** | **£5.99 / £6.99** | **€5.99 / €6.99** | **$5.99 / $6.99** |
| **Premium (Blue Premium)** | **₦20,000 source default / store price derived from configured fee schedule** | historical proposal | historical proposal | historical proposal | historical proposal | historical proposal | historical proposal |
| Seller Pro (Gold after KYB) | ₦5,000 | GH₵60 | KSh 1,000 | R149.99 | £15 | €17 | $17 |
| Seller Business (Gold) | ₦30,000 source default | historical proposal | historical proposal | historical proposal | historical proposal | historical proposal | historical proposal |
| Gold only (brands that don't sell) | ₦3,000 | GH₵36 | KSh 600 | R89.99 | £9 | €10 | $10 |
| Black (government, invoiced) | ₦50,000 | GH₵600 | KSh 10,000 | R1,499.99 | £149 | €169 | $169 |

### 2.1 Yearly (20% off 12 months, snapped up to a price point)

| Product | NG | GH | KE | ZA | GB | EU | US |
|---|---|---|---|---|---|---|---|
| Blue Essential | ₦9,600 / ₦12,000 | GH₵116 / GH₵144 | KSh 1,950 / KSh 2,400 | R287.99 / R335.99 | £23.99 / £28.99 | €23.99 / €28.99 | $23.99 / $28.99 |
| Blue Verified | ₦24,000 / ₦28,000 | GH₵288 / GH₵336 | KSh 4,800 / KSh 5,800 | R575.99 / R671.99 | £57.99 / £67.99 | €57.99 / €67.99 | $57.99 / $67.99 |
| Premium | ₦192,000 from source annual-discount default; store price derived from configured fee schedule | historical proposal | historical proposal | historical proposal | historical proposal | historical proposal | historical proposal |
| Seller Pro | ₦48,000 | GH₵576 | KSh 9,600 | R1,439.99 | £144.99 | €163.99 | $163.99 |
| Seller Business | ₦288,000 from source annual-discount default | historical proposal | historical proposal | historical proposal | historical proposal | historical proposal | historical proposal |
| Gold only | ₦29,000 | GH₵346 | KSh 5,800 | R863.99 | £86.99 | €96.99 | $96.99 |
| Black | ₦480,000 | GH₵5,760 | KSh 96,000 | R14,399.99 | £1,430.99 | €1,622.99 | $1,622.99 |

Historical bundle configuration is not authoritative. Current bundle discount, covered profile scope, stacking and renewal terms must be verified in the price quote returned by checkout; do not rely on the 15%/three-business proposal above.

### 2.1 Checkmark share on a rejected verification

The former checkmark-share refund rule is a historical proposal, not a verified current billing contract. Current refund, verification-rejection, renewal and access behavior must be checked against the billing implementation and purchase-channel terms; see [billing/renewalsAndTrials.md](./billing/renewalsAndTrials.md).

### 2.2 Price points

Rounding (`RoundToPricePoint`): naira up to the next ₦100 (₦500 from ₦10,000); shillings to KSh 10 (KSh 50 from KSh 1,000); cedis to whole units; rand, pounds, euros and dollars end in .99 (.x9 below 10 units). Business-to-business plans (seller, Gold, Black) use whole pounds/euros/dollars because that's how SaaS is priced in those markets (Shopify, Meta Verified for business).

## 3. Coin packs (channel × currency)

Coins are never money. A pack has the same number of coins everywhere; only the price changes. Web packs are cheaper and add bonus coins because the card processing fee (Flutterwave) is a few percent against a 15–30% store fee. The iOS and Android prices are equal (assumes Apple's Small Business Program at 15%; see §6).

| Coins (web bonus) | NGN | GHS | KES | ZAR | GBP | EUR | USD |
|---|---|---|---|---|---|---|---|
| 100 | ₦1,000 / ₦1,200 | GH₵12 / GH₵15 | KSh 130 / KSh 160 | R18.99 / R22.99 | £0.99 / £1.19 | €0.99 / €1.19 | $0.99 / $1.19 |
| 500 | ₦5,000 / ₦6,000 | GH₵60 / GH₵75 | KSh 650 / KSh 800 | R94.99 / R114.99 | £4.99 / £5.99 | €4.99 / €5.99 | $4.99 / $5.99 |
| 1,000 (+30) | ₦10,000 / ₦12,000 | GH₵120 / GH₵150 | KSh 1,300 / KSh 1,600 | R189.99 / R229.99 | £9.99 / £11.99 | €9.99 / €11.99 | $9.99 / $11.99 |
| 2,500 (+100) | ₦25,000 / ₦30,000 | GH₵300 / GH₵375 | KSh 3,250 / KSh 4,000 | R474.99 / R574.99 | £24.99 / £29.99 | €24.99 / €29.99 | $24.99 / $29.99 |
| 5,000 (+250) | ₦50,000 / ₦60,000 | GH₵600 / GH₵750 | KSh 6,500 / KSh 8,000 | R949.99 / R1,149.99 | £49.99 / £59.99 | €49.99 / €59.99 | $49.99 / $59.99 |
| 10,000 (+600) | ₦100,000 / ₦120,000 | GH₵1,200 / GH₵1,500 | KSh 13,000 / KSh 16,000 | R1,899.99 / R2,299.99 | £99.99 / £119.99 | €99.99 / €119.99 | $99.99 / $119.99 |

Store product ids: `com.nantty.app.coins.tier1` … `tier6` (one id per tier; the per-storefront price is set in App Store Connect / Play Console to the column above). Nigerian coins stay cheaper than TikTok's (≈ ₦15.7–₦21.4 per coin, Grey, 29 Aug 2026). The creator's gift value per coin (`COIN_CASH_VALUES`) and the 25% transfer fee are unchanged.

## 4. Creator subscription bands (suggested; web / app)

| Band | NG | GH | KE | ZA | GB | EU | US |
|---|---|---|---|---|---|---|---|
| Supporter | ₦500 / ₦600 | GH₵6 / GH₵7 | KSh 100 / KSh 120 | R14.99 / R18.99 | £1.99 / £2.49 | €1.99 / €2.49 | $1.99 / $2.49 |
| Fan | ₦1,000 / ₦1,200 | GH₵12 / GH₵15 | KSh 200 / KSh 250 | R29.99 / R34.99 | £3.99 / £4.99 | €4.49 / €5.49 | $4.99 / $5.99 |
| Superfan | ₦2,000 / ₦2,400 | GH₵25 / GH₵30 | KSh 400 / KSh 500 | R59.99 / R69.99 | £7.99 / £9.99 | €8.99 / €10.99 | $9.99 / $11.99 |
| VIP | ₦5,000 / ₦5,900 | GH₵60 / GH₵70 | KSh 1,000 / KSh 1,200 | R149.99 / R179.99 | £15.99 / £19.99 | €17.99 / €21.99 | $19.99 / $24.99 |

The creator keeps 80% of net (after the store or Flutterwave fee) everywhere. US bands mirror Patreon/YouTube norms ($4.99 is YouTube's lowest membership price point).

Since 2026-10-05 creators pick a plan price from a fixed tier ladder (₦500, ₦1,000, ₦1,500, ₦2,000, ₦3,000, ₦4,000, ₦5,000 and the regional equivalents; yearly = 10 months) instead of typing one, so each price maps to an App Store / Google Play product. In the apps the price is grossed up by the store fee (admin setting `appStore.fees`: Apple 30%, or 15% in the Small Business Program; Google 15%), so the creator's net matches the web. Ladder, product ids and store setup: [integrations/appStoreProducts.md](integrations/appStoreProducts.md).

## 5. Ads and boosts (per targeted region)

### 5.1 Benchmarks (2025–2026, USD; ranges as published)

| Market | Meta (FB/IG) CPM | Meta CPC | TikTok CPM | YouTube CPM / CPV | X | Snapchat | Sources (date) |
|---|---|---|---|---|---|---|---|
| Nigeria | $0.30–$3.25 (₦450–₦5,000), avg ≈ $1.50 | ₦30–₦300 ($0.02–$0.19) | ≈ $2.89 | ≈ $2.89 CPM | n/a | n/a | Grey "Facebook ads cost in Nigeria (2026)"; Stackmatix "CPM by country 2026"; upgrowth.in YouTube CPM by country (2026) |
| Ghana | not published; est. $0.80–$2.00 | est. $0.03–$0.15 | n/a | n/a | n/a | n/a | est. from Nigeria/Kenya (no published source) |
| Kenya | $0.90–$2.40 (FB $1.20–$2.20) | est. $0.05–$0.20 | n/a | n/a | n/a | n/a | Stackmatix 2026; Adligator 2026 |
| South Africa | $2.20–$4.60 (FB $2.50–$4.00) | est. $0.10–$0.40 | ≈ $6.50 | ≈ $6.50 CPM | n/a | n/a | Stackmatix 2026; Superads.ai South Africa; upgrowth.in 2026 |
| UK | $8.40–$13.60 | $0.85 | £3–£6 (CPV 6s £0.01–£0.03) | ≈ $24 CPM; CPV €0.04–€0.12 | – | – | Stackmatix 2026; influee.co TikTok CPM 2026; megadigital/upgrowth 2026 |
| Eurozone (DE baseline) | $7.60–$12.40, avg $10.05 | $0.80 | $6–$9 | – | – | – | Stackmatix 2026; Adligator 2026; ttcalculator.net |
| US (and USD default) | $10.50–$16.80 (other sources $16–$21; US avg $20.48) | $0.97 | $9–$15 (avg $9) | CPV $0.02–$0.10, CPM ≈ $32.75 | CPM $5.65–$8, CPC $0.74 | CPM $2.50–$8 | Stackmatix 2026; 1clickreport (Meta CPM) 2026; megadigital TikTok 2026; topgrowthmarketing YouTube 2026; webtonic X 2026; hubfluence Snapchat 2026 |
| Global engagement / video | CPE $0.01–$0.08; ThruPlay $0.02–$0.06 (awareness) | – | – | – | – | – | adwave.com Facebook ad costs 2026; 1clickreport ThruPlay 2026 |

Reading: African CPMs are 5–15× cheaper than US/UK; South Africa is the priciest African market; X and Snapchat undercut Meta in the US/UK; TikTok sits between X/Snap and Meta.

### 5.2 Nantty floors and suggested bids (local currency)

| Region | CPM floor | Suggested CPM | CPC floor | Suggested CPC | Suggested cost per video view | Minimum daily budget | Suggested daily budget | Boost minimum / day |
|---|---|---|---|---|---|---|---|---|
| NG | ₦400 | ₦1,500 | ₦25 | ₦60 | ₦5 | ₦1,000 | ₦5,000 | ₦1,000 |
| GH | GH₵6 | GH₵18 | GH₵0.40 | GH₵1 | GH₵0.06 | GH₵15 | GH₵75 | GH₵15 |
| KE | KSh 80 | KSh 170 | KSh 5 | KSh 12 | KSh 0.60 | KSh 150 | KSh 750 | KSh 150 |
| ZA | R28 | R50 | R1.50 | R4 | R0.20 | R40 | R200 | R40 |
| GB | £2.50 | £6 | £0.30 | £0.55 | £0.02 | £5 | £25 | £5 |
| EU | €3 | €6.50 | €0.30 | €0.60 | €0.02 | €5 | €25 | €5 |
| US and every other country | $3.50 | $8 | $0.35 | $0.65 | $0.03 | $5 | $25 | $5 |

How they were set (all admin-editable in `regional-pricing`):

- **CPM floor** just under the low end of the cheapest major incumbent in that market (NG: Meta's ₦450 low end; KE/ZA: ≈ 65–90% of Meta's low end; GB: under TikTok's £3; EU: under TikTok's $6; US: around X's $5.65 and Snapchat's low end). A new network can't charge more than incumbents for unproven targeting, but a floor protects creators' share and stops race-to-the-bottom bids.
- **Suggested CPM / CPC** ≈ 70–80% of Meta's typical price (NG ≈ 70% of the ₦2,100 average; US ≈ 75% of Meta's $10.50 low end and under TikTok's $9; UK/EU ≈ 70% of Meta's low end). "Slightly below incumbents" is the pitch: cheaper reach than Meta with the same 40% creator share.
- **Suggested cost per view** follows TikTok/YouTube CPV and Meta ThruPlay ranges (US $0.02–$0.06 → $0.03; UK £0.01–£0.03 → £0.02); African values are scaled by the CPM ratio (est.).
- **Minimum daily budget** ≈ 700 impressions a day at the suggested CPM, enough for delivery to learn; **suggested daily budget** = 5× minimum (≈ 3,500 impressions a day). Meta's Nigerian minimum is ₦2,000–₦2,500, so ₦1,000 stays an attraction for small sellers; TikTok's US minimum is $20/day, so $5 undercuts it.
- The **creator ad revenue share stays 40%** in every region; only prices change.

### 5.3 Pre-launch cost picture (Ads Manager and boosts)

`POST /api/v1/ads/pricing/estimate` takes the targeted countries, billing currency, daily or lifetime budget, start/end dates (or days; 7 days when there is no end date) and objective, and returns, before launch:

- the suggested daily and lifetime budget and the minimum daily budget (the strictest targeted region, converted into the billing currency);
- total cost for the duration, impressions, reach, clicks, video views, results for the objective and cost per result, each as a low–high range;
- a per-region breakdown: budget split by audience size (`ADS_POPULATION_BY_COUNTRY`), each region's results and cost per result in the billing currency, an FX note (e.g. "1 GBP ≈ 1962.02 NGN (currency module rate)") and a warning when a region's share is below its own minimum.

Assumptions (stated in the UI as estimates): the auction clears at 75–130% of the suggested CPM, frequency 1.4–1.8, CTR 0.6–1.4%, 20–35% of impressions become 3-second video views, messages ≈ 10% of clicks, follows ≈ 5% of clicks. Example at the NG suggested budget (₦5,000/day × 7 days = ₦35,000): 17,948–31,111 impressions, 9,971–22,222 people, 107–435 clicks, ₦80–₦327 per click.

**Boost packages** (minimum × 1, 3, 7 and 15; reach from the same model):

| Region | 1 day | 3 days | 1 week | 1 week, wider reach |
|---|---|---|---|---|
| NG | ₦1,000 · 284–634 people | ₦3,000 · 854–1,904 | ₦7,000 · 1,993–4,444 | ₦15,000 · 4,273–9,523 |
| GH | GH₵15 · 356–793 | GH₵45 · 1,068–2,380 | GH₵105 · 2,492–5,555 | GH₵225 · 5,341–11,903 |
| KE | KSh 150 · 376–840 | KSh 450 · 1,131–2,520 | KSh 1,050 · 2,639–5,882 | KSh 2,250 · 5,655–12,604 |
| ZA | R40 · 341–761 | R120 · 1,025–2,285 | R280 · 2,392–5,332 | R600 · 5,127–11,427 |
| GB | £5 · 356–793 | £15 · 1,068–2,380 | £35 · 2,492–5,555 | £75 · 5,339–11,900 |
| EU | €5 · 328–732 | €15 · 986–2,197 | €35 · 2,301–5,127 | €75 · 4,928–10,984 |
| US / other | $5 · 266–595 | $15 · 801–1,785 | $35 · 1,869–4,166 | $75 · 4,004–8,925 |

Billing: an advertiser spends in the ad account currency; another region's floors and packages are converted with `currency.exchange_rate_revisions` (seed rates if unreadable), rounded up, so a naira account targeting the UK needs at least ₦9,810.13 a day (= £5). Reporting converts spend to USD (`reportingSpend`). The auction reserve is the viewer region's CPM floor in the ad's currency.

## 6. App stores

| Item | Figure | Source (date) |
|---|---|---|
| Apple commission | 30%, 15% in the Small Business Program (< $1M/yr) and on subscriptions after year one | Apple developer terms (checked 4 Oct 2026) |
| Google Play | 15% on subscriptions and on the first $1M/yr | Google Play service fees |
| Local storefront currencies | Nigeria, Kenya, South Africa and Ghana now have local-currency App Store storefronts; Apple re-prices them for VAT (Nigeria 7.5%; Kenya 16% VAT + 1.5% DST) | appsops.store, "App Store pricing in Africa 2026"; iMore (Kenya/Nigeria price changes) |
| Price points | Apple offers ~900 price points per storefront and lets you set per-storefront prices; without custom prices it converts from USD, which over-prices Africa | appsops.store 2026 |

Decisions: join Apple's Small Business Program before launch (then `COIN_CHANNEL_FEE_BPS=ios:1500`); set every storefront's price manually to the app column. **Verify:** if Apple still bills Ghana in USD, set the GH app prices to the US column in App Store Connect and change the GH row's iOS amounts in admin (est. risk).

## 7. Web payments: Flutterwave currency constraints

Flutterwave is the only web payment provider (owner, 2026-10-11). Country details: [`flutterwaveMigration.md`](integrations/flutterwaveMigration.md) §6.

| Region | Charge | Notes |
|---|---|---|
| Nigeria (platform entity) | NGN, and USD for international cards | Card, bank transfer, USSD; payout subaccounts (wallets) are NGN only |
| Ghana / Kenya / South Africa | GHS / KES / ZAR | Card plus MoMo (GH), M-Pesa (KE), account (ZA); each currency must be activated on the Flutterwave account. Direct mode, no wallet or escrow (§6 of the spec) |
| GBP / EUR | **not enabled** | Not in `FLUTTERWAVE_SUPPORTED_CURRENCIES`; UK/EU web buyers pay in USD |

**Owner decision (4 Oct 2026, kept):** UK and Eurozone web buyers **pay the US price in USD**. The apps keep store-local prices.

- `FLUTTERWAVE_SUPPORTED_CURRENCIES` (default `NGN,GHS,KES,ZAR,USD`) is the switch. For each web price the server decides: region currency if Flutterwave can charge it, otherwise the US price in USD, labelled **"Billed in USD"** (`billingNote` on `/api/v1/pricing/plans`, coin packs, creator bands and checkout). Remove a currency from the list until Flutterwave has activated it on the account.
- If USD is switched off, those regions show their local price with `canBuyOnWeb: false` and the note "Web checkout isn't available in your currency or in USD yet. Buy in the Nantty app, or try again later."; checkout returns `422 WEB_CURRENCY_NOT_ENABLED` and the coin pack list returns the same error instead of an empty list. This is the current server response text; its legacy brand wording needs a separate service change.

### 7.1 Owner setup checklist

1. **Flutterwave currencies:** ask Flutterwave to activate USD (international cards), GHS, KES and ZAR collections on the live account, then set `FLUTTERWAVE_SUPPORTED_CURRENCIES` in go-money's environment to the activated list. Test each currency in test mode before launch.
2. **Flutterwave fees:** read the processing fees per method and currency from the Flutterwave dashboard and confirm them in writing (question Q5 in the spec); the server reads the actual fee from each verified charge (`app_fee`), never a hardcoded rate.
3. **App Store Connect:** create the in-app products with exactly these ids: subscriptions `com.nantty.app.blue_essential.monthly|yearly`, `com.nantty.app.blue.monthly|yearly`, `com.nantty.app.premium.monthly|yearly` (one subscription group), coins `com.nantty.app.coins.tier1` … `tier6` (consumables). For each storefront (Nigeria, Ghana, Kenya, South Africa, UK, every eurozone country, US) set the price manually to the app column in §2 and §3; leave all other storefronts on the US price. Join the Small Business Program.
4. **Google Play Console:** create the same product ids (subscriptions with monthly and yearly base plans; coins as one-time products). Set per-country prices from §2/§3 for NG, GH, KE, ZA, GB, eurozone countries and US; use "US price" for other countries.
5. **Per-storefront overrides:** if a store forces a different id or price for one region, edit that region's row in Admin → Regional pricing (store product ids per `ios.month`, `ios.year`, `android.month`, `android.year`).
6. **Mobile build:** install the native StoreKit/Play Billing module and register it with `installStoreBillingAdapter` (apps/mobile/src/services/storeBilling.service.ts); the app then sends the storefront and buys with the server's product ids.

## 8. Market evidence

### 8.1 Consumer subscriptions (monthly)

| Service | NG | GH | KE | ZA | UK | DE (eurozone baseline) | US | Source (date) |
|---|---|---|---|---|---|---|---|---|
| X Premium | ₦3,650 | $8 (USD) | KSh 1,100 | not found | £8 | ≈ $12.62 equiv. | $8 | help.x.com price update (18 Feb 2025); tech-ish.com (29 Dec 2025); TechEconomy (Dec 2024) |
| X Basic | – | $3 | KSh 412.50 | – | £3 | – | $3 | same |
| Meta Verified | $11.99 web, not localised | – | not found | not found | £13.99 web / £16.99 app | – | $14.99 web / $17.99 app (Jun 2026) | handles.gg 2026; Prime Business Africa |
| YouTube Premium | ₦1,700 | not found | not found | R82 (Lite R50) | – | – | – | Nairametrics (5 Apr 2025); stuff.co.za (12 Aug 2026) |
| Spotify Premium | ₦1,600 | GH₵22 | KSh 419 | R69.99 | £12.99 | €12.99 | $12.99 (Feb 2026) | spotify.com/ke; TechCabal (May 2026); fastcompany.co.za (7 Aug 2025); MBW (Oct 2025); Android Authority (2026) |
| Netflix Standard | ₦6,500 | – | not found | R179 | £12.99 | €14 | $19.99 (26 Mar 2026) | WhatKeptMeUp (Jul 2026); Selectra UK; heise.de; priceworld (2026) |
| Telegram Premium | ≈ $1.20–$4 | – | not found | not found | ≈ $7 (≈ £4.99 in app) | ≈ $6 (≈ €4.99 in app) | $4.99 app / $3.99 bot | opentherank.com; marix.app (2026) |
| Shopify Basic | – | – | – | – | £25 (£19 yearly) | €32 ex VAT (€24 yearly) | $27 ($19 yearly) | craftshift.com, charle.co.uk, qualimero (2026) |
| Bumpa Starter / Pro | ₦5,000 / ₦10,000 | – | – | – | – | – | – | getbumpa.com (3 Oct 2026) |

Reading per market:

- **Nigeria:** ₦1,000–₦2,500 is the band for single-purpose subscriptions; X Premium ₦3,650 is the checkmark reference. Prices unchanged from 3 Oct.
- **Ghana:** Spotify is GH₵22 (≈ $1.40); X charges USD. Blue Verified at GH₵30 (≈ $1.94) sits just above Spotify (est. willingness to pay).
- **Kenya:** Spotify KSh 419, X Premium KSh 1,100 (≈ $8.50, X barely localises). Blue Verified KSh 500 ≈ Spotify; Premium KSh 900 below X.
- **South Africa:** Spotify R69.99, YouTube R82, Netflix Standard R179. Blue Verified R59.99 under Spotify; Premium R109.99 between YouTube and Netflix.
- **UK / Eurozone / US:** this historical benchmark compared earlier proposed prices and an escrow-fee model that is no longer the intended policy. Competitor prices and tax treatment require fresh source verification before external use; don't use this dated comparison as current pricing research.

### 8.2 Purchasing power (est.)

| Market | Indicator | Effect on price |
|---|---|---|
| NG | Minimum wage ₦70,000/mo; ₦1,327/$ NFEM (14 Sep 2026); inflation 15.39% (Aug 2026) | ₦2,500 ≈ 3.6% of minimum wage |
| GH, KE | Spotify/YouTube localise to ≈ $1.4–$3.2 | ≈ 25–40% of US price |
| ZA | Highest card penetration in Africa (appsops 2026); Spotify ≈ $3.85 | ≈ 50–65% of US price |
| GB, EU, US | Full price; VAT included in GB/EU consumer prices | 100% |

Our African prices land at ≈ 25–35% of the US price (NG, GH, KE) and ≈ 55% (ZA), matching the Spotify/YouTube localisation pattern.

FX used for conversions and the cross-region checks: the currency module's seed rates (₦1,550, GH₵15.5, KSh 129, R18.2, £0.79, €0.92 per $1; est.) until admins set live rates.

## 9. Nigeria-specific fees (historical 3 Oct proposal; superseded for fresh installs)

- The earlier proposal below charged a separate escrow percentage (1.5% standard / 1% Business). It is not the current intended policy: fresh-install settings now default platform escrow/sales commission to zero, with only actual Flutterwave processing/withdrawal costs passed through. Existing persisted settings were not inspected or changed in this audit; do not claim the policy is active for an existing environment until its effective admin `revenue` setting and checkout quote are verified.
- Launch promotions (Blue first month ₦1,000 for 90 days, founding sellers Pro ₦2,500 for 3 months, founding creators 10% share for 6 months, double first web coin pack, Black first year ₦400,000) stay Nigeria-only.

## 10. Where it lives

| Data | Store | Admin |
|---|---|---|
| Plan prices per region (web/iOS/Android, monthly/yearly) + store product ids per storefront | go-money `subscriptions.plan_prices` (migration `20261004120000_regional_plan_prices`), seeded from `platform/regionpricing` | Regional pricing → Plans & checkmarks (`PUT /api/v1/admin/subscriptions/price-table/{plan}/{region}`, audited) |
| Coin packs per channel × currency | go-money `wallet.coin_packages.prices` | Regional pricing → Coin packs (`PUT /api/v1/admin/coins/price-table/{packId}`, audited) |
| Ad floors, minimum budgets, boost minimums, creator bands | admin platform setting `regional-pricing` (versioned, audited) read by go-ads and go-money | Regional pricing → Ads, boosts & creator bands |

Viewer endpoints: `GET /api/v1/pricing/region`, `GET /api/v1/pricing/plans` (prices for the resolved region and channel, `storeProductId` in the apps, `billingNote`/`canBuyOnWeb` on the web), `GET /api/v1/pricing/creator-subscription-bands`, `GET /api/v1/coins/packages`, `GET /api/v1/ads/pricing?countries=&currency=` (floors, suggested bids and budgets, boost packages), `POST /api/v1/ads/pricing/estimate`, `GET /api/v1/ads/boosts/options` (with regional packages), `POST /api/v1/ads/boosts/estimate`.

go-money reads prices **only** from this price book: the old NGN overrides in `checkmark-pricing` (Blue/Gold-only/Black prices) and the per-currency prices in the admin "Plans & prices" document were removed; that page is now "Plans & perks" and links here. The checkmark-suggestion email quotes the research default for the user's region.

## 11. Revisit

- Every 6 months, or when FX moves more than 10% (naira, cedi and shilling prices first).
- Apple Small Business Program enrolment; Ghana App Store currency.
- GBP/EUR web charging (owner decision); Flutterwave GHS/KES/ZAR activation.
- Live CPM/CPC data per region after the first month: compare with §5.1, raise floors past 70% fill, and recalibrate the estimate assumptions (§5.3) from delivered campaigns.
- Legal and tax: VAT/GST on digital services in GB/EU (price displayed VAT-inclusive), Kenya DST, Nigerian VAT on coins and subscriptions.

## Sources

- Flutterwave v3 API reference and country support: [`integrations/flutterwaveApiReference.md`](integrations/flutterwaveApiReference.md) (read 2026-10-10).
- X Premium regional prices: https://help.x.com/premium-plus-price-update (18 Feb 2025); Kenya: https://tech-ish.com/2025/12/29/how-much-x-basic-premium-cost-in-kenya-in-2026/ ; https://opentherank.com/ai-pricing/x/
- TechEconomy, X Premium Nigeria: https://techeconomy.ng/nigerians-face-51-hike-as-x-raises-premium-monthly-subscription-to-34000
- Meta Verified 2026: https://handles.gg/blog/instagram-verification-cost-how-much-2026-actual-price ; https://www.primebusiness.africa/facebook-instagram-verified-users-to-pay-monthly/
- YouTube Premium SA: https://stuff.co.za/2026/08/12/youtube-premium-lite-finally-lands-in-sa-r50-m/ ; Nigeria: https://nairametrics.com/2025/04/05/youtube-increases-youtube-premium-service-price-by-54-in-nigeria/
- Spotify: https://www.spotify.com/ke-en/premium/ ; https://fastcompany.co.za/tech/2025-08-07-are-you-prepared-for-spotifys-new-subscription-prices-in-south-africa/ ; https://www.musicbusinessworldwide.com/spotify-raises-uk-and-switzerland-premium-prices-again-as-analysts-see-us-hike-by-early-2026/ ; https://www.androidauthority.com/spotify-premium-us-price-hike-3632761 ; https://techcabal.com/2026/05/25/spotify-on-nigerias-streaming-economy/ ; https://selectra.com.au/streaming/providers/spotify-plans-around-the-world
- Netflix: https://selectra.co.uk/tv-broadband/guides/streaming/netflix ; https://priceworld.com/blog/netflix-price-by-country-2026/ ; https://heise.de/-11226793 ; https://whatkeptmeup.com/latest-nigerian-movies/streaming-services-in-nigeria-netflix-subscription-price-and-details/
- Telegram Premium: https://opentherank.com/social-pricing/telegram/ ; https://marix.app/library/guides/telegram-premium-cheapest-country-2026
- Shopify Basic: https://craftshift.com/shopify-basic-plan-2026/ ; https://www.charle.co.uk/articles/shopify-pricing/ ; https://qualimero.com/en/blog/shopify-costs
- Bumpa: https://www.getbumpa.com/pricing
- Meta ads CPM/CPC by country (2026): https://stackmatix.com/blog/facebook-ads-cpm-by-country-2026 ; https://adligator.com/blog/meta-ads-cpm-by-country-benchmarks ; https://admanage.ai/blog/how-much-does-it-cost-to-advertise-on-facebook ; South Africa: https://www.superads.ai/facebook-ads-costs/cpm-cost-per-mille/south-africa ; Nigeria: https://grey.co/blog/facebook-ads-cost-nigeria
- TikTok ads CPM/CPC 2026: https://megadigital.ai/en/blog/tiktok-ad-benchmarks/ ; https://influee.co/gb/blog/tiktok-cpm ; https://ttcalculator.net/learn/tiktok-advertising-rates-benchmarks/ ; https://megadigital.ai/en/blog/how-much-do-tiktok-ads-cost/
- YouTube CPM/CPV 2026: https://upgrowth.in/youtube-cpm-by-country-global-comparison-2026/ ; https://topgrowthmarketing.com/youtube-ads-cost/ ; https://megadigital.ai/en/blog/youtube-ad-benchmarks/
- X ads 2026: https://www.webtonic.io/blog/e-commerce-twitter-ads-statistics ; Snapchat 2026: https://www.hubfluence.io/resources/snapchat-cpm-rates
- Meta engagement and ThruPlay 2026: https://adwave.com/resources/facebook-ad-costs ; https://www.1clickreport.com/blog/cost-per-thruplay-meta-ads-benchmark-2026 ; Instagram 2026: https://www.admetrics.io/post/instagram-ads-costs-complete-2026-pricing-guide
- App Store Africa storefronts: https://appsops.store/blog/app-store-pricing-africa-2026 ; https://www.imore.com/app-store-price-changes-are-coming-kenya-nigeria-peru-and-sweden
- TikTok coins Nigeria (29 Aug 2026): https://grey.co/blog/buy-tiktok-coins-nigeria
- Nigeria macro: https://nairametrics.com/2026/09/15/nigerias-headline-inflation-eases-to-15-39-in-august/ ; https://playroll.com/minimum-wage/nigeria ; https://techeconomy.ng/dollar-to-naira-exchange-rate-today-september-14-2026
