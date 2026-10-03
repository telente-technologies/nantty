# Zudomart pricing (Nigeria launch)

Status: recommended defaults, 3 October 2026. Every price here is an admin-editable setting. None is hardcoded in a UI. Prices are in NGN and stored as `amountMinor` (kobo). "Est." marks an estimate, not a sourced figure.

## 1. Summary table

| Product | Web (Paystack) | In app (Apple / Google) | Yearly (web) | Yearly saving |
|---|---|---|---|---|
| Blue Essential (no badge: account protection, edit window) | ₦1,000/mo | ₦1,200/mo | ₦9,600 | 20% |
| **Blue Verified (the blue checkmark)**, `blueMonthlyPrice` | **₦2,500/mo** | **₦2,900/mo** (est. store price point) | ₦24,000 | 20% |
| Blue Premium = the "Premium" user subscription (badge, fewer ads, 6 streak restores, boost credit) | ₦4,500/mo | ₦5,500/mo | ₦43,200 | 20% |
| Seller Free | ₦0 | web only | – | – |
| Seller Pro (includes Gold after KYB) | ₦5,000/mo | web only | ₦48,000 | 20% |
| Seller Business (includes Gold, 1% escrow fee) | ₦15,000/mo | web only | ₦144,000 | 20% |
| Gold-only (brands that don't sell) | ₦3,000/mo | web only | ₦28,800 | 20% |
| Gold-only with active Blue (bundle −15%) | ₦2,550/mo | web only | best of bundle or yearly, never both | – |
| Black (government) | ₦50,000/mo | web only, invoiced | ₦480,000 | 20% |
| **Commission on products** | **0%** | – | – | – |
| Escrow fee (seller pays, deducted from payout) | 1.5% of the seller-group total incl. shipping (Free and Pro), 1% (Business) | – | – | – |
| Direct payment (verified stores) | No Zudomart fee; seller covers Paystack processing only | – | – | – |
| Payment processing | Paystack cost passed through to the seller, shown as its own line | – | – | – |
| Buyer fee | ₦0 | – | – | – |

The current repo defaults already match most of this (Pro ₦5,000, Business ₦15,000, Gold-only ₦3,000, Black ₦50,000, 15% bundle, 20% yearly). The changes are the owner's switch from a 5% commission to 0% commission plus a 1.5% / 1% escrow fee (`ESCROW_PLATFORM_COMMISSION_BPS` default 500 → 150), the Blue prices, the admin plan seed (was ₦25,000 / ₦60,000 for the Gold tiers), the yearly maths, and the seller ad credits.

## 2. Evidence

### 2.1 Consumer subscriptions in Nigeria

| Service | NGN price | Source (date) |
|---|---|---|
| X Premium | ₦3,650/mo, ₦38,500/yr | TechEconomy, Technology Times (reported Dec 2024, unchanged since) |
| X Premium+ | ₦34,000/mo | same |
| Meta Verified | $11.99 web / $14.99 iOS, not localised (≈ ₦15,900 / ₦19,900 at ₦1,327/$, est.) | Prime Business Africa; FX: TechEconomy NFEM rate, 14 Sep 2026 |
| WhatsApp Plus (Meta) | ₦1,199/mo | Brandspur Nigeria, 22 Jun 2026 |
| Facebook / Instagram Plus | $3.99 (≈ ₦5,300, est.) | Brandspur Nigeria, 22 Jun 2026 |
| YouTube Premium | ₦1,700/mo individual, ₦2,800 family | Nairametrics, 5 Apr 2025 |
| Spotify Premium | ₦1,600 individual, ₦800 student, ₦2,100 duo, ₦2,500 family | Interspace Music / TechCabal, May–Jul 2026 |
| Netflix | ₦2,500 mobile, ₦4,000 basic, ₦6,500 standard, ₦8,500 premium | WhatKeptMeUp, 23 Jul 2026 |
| Showmax | ₦2,000 mobile to ₦6,500 | same |
| iCloud+ | ₦1,300 (50 GB), ₦4,500 (200 GB), ₦14,900 (2 TB) | MacRumors, 17 Jul 2026 |
| Telegram Premium | ≈ $1.20/mo (≈ ₦1,600, est.) | Marix guide, 2026 |

Reading: Nigerian consumers already pay ₦1,000–₦2,500 for single-purpose subscriptions (music, storage, ad-free video). ₦3,650 (X Premium) is the reference point for a paid checkmark, and Meta's unlocalised ~₦16,000 is the expensive outlier. Price points cluster on ₦1,000, ₦1,500, ₦2,500, ₦4,500 and ₦5,000.

### 2.2 Seller tools and marketplaces

| Tool | Price | Source (date) |
|---|---|---|
| Bumpa Starter | ₦15,000/quarter (₦5,000/mo) | getbumpa.com/pricing (fetched 3 Oct 2026) |
| Bumpa Pro | ₦30,000/quarter (₦10,000/mo); yearly saves up to 20% | same |
| Jumia commission | 5–20% by category (fashion 12–20%, beauty 12–18%, electronics 5–10%), plus logistics fees, 14-day payouts | Kolonell, 2026 |
| Konga commission | 5–15% by category and merchant class | Kolonell / Konga seller handbook, 2026 |
| Paystack Storefront, Flutterwave Store | free tools, transaction fees only | vendor sites (not re-verified) |
| Paystack local cards | 1.5% + ₦100, capped at ₦2,000; ₦100 waived under ₦2,500; 3.9% international; 7.5% VAT on fees | paystack.com/pricing (blocked our fetcher); confirmed by Kolonell, 20 Aug 2026 |
| Paystack transfers | ₦10 (≤ ₦5,000), ₦25 (≤ ₦50,000), ₦50 (above) | Paystack pricing page (verify before launch) |

Reading: ₦5,000/month is the established price for a Nigerian small-seller tool (Bumpa Starter), and ₦10,000 is the next step up. Zudomart Pro gives a store plus an audience plus the Gold checkmark, so ₦5,000 holds. Marketplaces that bring traffic and logistics take 5–20%. Zudomart takes **0% commission** and charges only for escrow protection (1.5%, or 1% on Business). "0% commission, escrow protection from 1%" is a strong pitch against Jumia's 5–20%, and it matches how Instagram vendors think: they pay for safety, not for being listed.

### 2.3 Creator money

| Item | Figure | Source (date) |
|---|---|---|
| TikTok coins, web | ≈ ₦1,100 for 70 coins (≈ ₦15.7/coin) | Grey, 29 Aug 2026 |
| TikTok coins, in app | ≈ ₦1,500 for 70 coins (≈ ₦21.4/coin), 20–30% more than web | same |
| Apple App Store | 30%, or 15% under the Small Business Program (< $1M/yr) | Apple developer terms |
| Google Play | 15% on subscriptions and on the first $1M/yr | Google Play service fees |

### 2.4 Ads

| Item | Figure | Source (date) |
|---|---|---|
| Meta CPM, Nigeria | ₦450–₦5,000, average ≈ $1.50 (≈ ₦2,100) | Grey, "Facebook Ads cost in Nigeria (2026)" |
| Meta CPC, Nigeria | ₦30–₦300 | same |
| Instagram Reels CPM | ₦600–₦2,000 | same |
| Meta minimum daily budget | ₦2,000–₦2,500, plus 7.5% VAT | same |

### 2.5 Macro context

| Indicator | Figure | Source (date) |
|---|---|---|
| Headline inflation | 15.39% y/y, August 2026 (from 23.14% a year earlier); food 19.57% | NBS via Nairametrics / VON, 15 Sep 2026 |
| Minimum wage | ₦70,000/month (review due 2027) | Playroll / Trading Economics, 2026 |
| Formal-sector pay | median ≈ ₦120,000–₦150,000/month (est.; NBS publishes no average) | Hivedesk salary guide, 2026 |
| Informal employment | ≈ 93% of jobs | same |
| Paying for digital news | ≈ 6% of Nigerians | Reuters Institute Digital News Report |
| FX | ≈ ₦1,327/$ (NFEM), parallel ≈ ₦1,390 | TechEconomy, 14 Sep 2026 |

Reading: ₦2,500 is about 3.6% of the minimum wage and about 2% of median formal pay. That's affordable for the urban, salaried, seller and creator audience that buys checkmarks, but only a small share of users will pay. Plan on 1–3% of monthly actives subscribing (est.). Inflation has slowed, so naira prices can hold for 12 months. Review them every 6 months.

## 3. Rationale by product

**Blue Verified, ₦2,500 web / ₦2,900 in app.** This undercuts X Premium (₦3,650) by about 30% and Meta Verified by about 85%, and sits on a familiar ₦2,500 price point (Netflix Mobile, Spotify Family). Store maths: ₦2,900 × 0.85 ≈ ₦2,465 net under a 15% fee, which matches web net (₦2,500 − ₦37.50 Paystack). A 30% Apple fee leaves ₦2,030, so join Apple's Small Business Program before launch. `blueMonthlyPrice` was a ₦1,000 placeholder and is now ₦2,500. The blue checkmark still needs ID verification. Payment never buys a badge on its own.

**Blue Essential, ₦1,000.** A low-friction entry point beside WhatsApp Plus (₦1,199) and iCloud 50 GB (₦1,300), with no badge.

**Blue Premium (the "Premium" subscription), ₦4,500 / ₦5,500.** Premium is the top Blue tier (`verification.tier === "PREMIUM"`). It funds the separate Premium creator pool and gives 6 streak restores a month. Its value is the badge plus fewer ads plus perks, priced like Showmax Entertainment (₦4,500) and below Netflix Standard. Premium+ style pricing (₦34,000) isn't viable in Nigeria.

**Seller Pro ₦5,000 and Business ₦15,000 (unchanged).** These match Bumpa Starter, and Business sits 50% above Bumpa Pro because it adds API access, 25 seats, priority placement and a lower escrow fee (1% instead of 1.5%). A Business seller with ₦2,000,000 a month of escrow orders saves ₦10,000 in escrow fees, so for high-volume stores the plan nearly pays for itself. Ad credits drop to ₦1,000 (Pro) and ₦5,000 (Business). Before, the ₦10,000 Pro credit was worth twice the plan price. Seller plans are sold on the web only.

**Gold-only ₦3,000 (unchanged).** Cheaper than Pro, so selling brands upgrade, and a little above Blue Verified because KYB costs Zudomart more to run. The admin validator keeps it below Pro.

**Blue+Gold bundle, 15% (unchanged).** ₦3,000 becomes ₦2,550. This rewards founders who run a personal and a brand profile. It doesn't stack with the yearly discount, is capped at 3 businesses and never applies to Black.

**Black ₦50,000 (unchanged), ₦480,000 a year.** Agencies buy yearly through procurement, so offer an annual invoice. Two-admin vetting and yearly re-verification justify the price. It's small next to an agency's budget and much less than an impersonation incident costs. Offer a fee waiver (admin-granted lifetime checkmark) for emergency services where it helps public safety.

**Yearly discount, 20% everywhere.** This matches the existing `trial-rules.yearlyDiscountPercent` and Bumpa's "up to 20%". The admin plan seed now computes yearly as 12 × monthly × 0.8 (it was × 10, about 17%).

### 3.1 Creator subscriptions (bands a creator picks from)

| Band | Web | In app (est. store points) |
|---|---|---|
| Supporter | ₦500 | ₦600 |
| Fan | ₦1,000 | ₦1,200 |
| Superfan | ₦2,000 | ₦2,400 |
| VIP | ₦5,000 | ₦5,900 |
| Custom (web) | ₦300–₦20,000 | nearest store point |

Creator share: 80% of net (after the store or Paystack fee). Zudomart keeps 20%, which is between Patreon (8–12% plus processing) and YouTube memberships (30%). Bands keep prices on familiar ₦ points and map cleanly to store price points.

### 3.2 Coin packs

Rule: 1 coin is not ₦1. A coin's net value is **₦10** after the channel fee (`COIN_NET_VALUES=NGN:1000`). Channel prices are set so net value per coin stays within about ±7% across channels. The web gets small bonuses because Paystack (about 2–3.5%) is much cheaper than a 15–30% store cut.

| Coins | Web (bonus) | Net/coin web | Android (15%) | Net/coin | iOS at 30% | iOS at 15% (Small Business Program) |
|---|---|---|---|---|---|---|
| 100 | ₦1,000 | ₦9.85 | ₦1,200 | ₦10.20 | ₦1,500 | ₦1,200 |
| 500 | ₦5,000 | ₦9.65 | ₦5,900 | ₦10.03 | ₦7,200 | ₦5,900 |
| 1,000 | ₦10,000 (+30) | ₦9.47 | ₦11,900 | ₦10.12 | ₦14,500 | ₦11,900 |
| 2,500 | ₦25,000 (+100) | ₦9.43 | ₦29,900 | ₦10.17 | ₦35,900 | ₦29,900 |
| 5,000 | ₦50,000 (+250) | ₦9.36 | ₦59,900 | ₦10.18 | ₦72,000 | ₦59,900 |
| 10,000 | ₦100,000 (+600) | ₦9.25 | ₦119,000 | ₦10.12 | ₦145,000 | ₦119,000 |

Even after store markup, Zudomart coins cost less per coin than TikTok's (₦10–₦14.5 against ₦15.7–₦21.4). In-app NGN price points must snap to Apple's and Google's Nigeria tiers (est.), and store prices include 7.5% VAT, which trims net by a few percent. Gift creator share stays on the admin `gift.shareTiers` (50% → 60% → 70%). `COIN_CHANNEL_FEE_BPS` web default moves from 200 to 300, because the ₦100 Paystack flat fee makes 2% too optimistic below ₦20,000. Keep iOS at 3000 until Small Business Program enrolment is confirmed, then set it to 1500 and use the 15% column.

### 3.3 Commission, escrow fee and payment fees (owner decision, 3 Oct 2026)

- **Commission:** 0% on products. Zudomart takes no percentage of what a seller sells.
- **Escrow fee:** 1.5% of the escrow amount, which is the seller-group total including shipping (the money escrow actually holds). It drops to 1% on the Business plan (the highest Gold tier). The seller pays it, deducted from the payout at release. On a refund, no escrow fee is charged on the refunded part. Config: `ESCROW_PLATFORM_COMMISSION_BPS=150` (default changed from 500); the Business 100 bps rate is an admin setting (`escrowFee.businessPlanBasisPoints` in admin revenue rules) and still needs wiring in go-money.
- **Direct payments** (verified stores, no escrow): Zudomart adds nothing. The seller covers only Paystack's processing fee.
- **Processing:** the seller pays Paystack's actual fee (1.5% + ₦100, max ₦2,000, ₦100 waived under ₦2,500), shown as its own line on both paths. Assumption to confirm with the owner: on escrow orders the escrow fee comes on top of processing. If the 1.5% had to cover processing, a ₦10,000 order would leave Zudomart ₦-100.
- **Buyer:** no checkout fee and no escrow fee. Escrow is the trust product, and surprise fees cause checkout abandonment.
- **Payouts:** the daily automatic payout is free, with Zudomart absorbing the ₦10–₦50 Paystack transfer fee. Extra instant payouts pass the transfer fee through.
- **All-in example:** on a ₦20,000 escrow order the seller pays ₦300 (1.5% escrow) + ₦400 (Paystack) = 3.5%, or ₦400 (2%) by direct payment. Jumia fashion takes 12–20% plus logistics.
- **Revenue impact:** marketplace revenue per order is about 70% lower than with a 5% commission, so subscriptions, ads, coins and checkmarks carry more of the model. Escrow-fee revenue grows with order value and needs no category tables.

### 3.4 Ads and boosts

| Item | Recommended | Repo today |
|---|---|---|
| CPM reserve (floor) | ₦500 | ₦500 (`ReservePerMilleMinor`), keep |
| CPC floor | ₦30 (est.; Meta's low end) | not configured |
| Minimum daily budget | ₦1,000 (half Meta's minimum, to attract small sellers) | ₦1,000, keep |
| Boost packages | ₦1,000 / 1 day, ₦3,000 / 3 days, ₦7,000 / 7 days, ₦15,000 / 7 days wider reach | suggestions = minimum × 1, 3, 7, 15, matches |
| In-app boosts (IAP) | ₦1,200 / ₦3,500 / ₦8,500 / ₦17,900 (est.) | – |

The floors sit at Meta's low end because Zudomart's targeting data is new. Raise them once fill rate passes about 70%.

## 4. Launch promotions

- **Blue Verified:** the first month is ₦1,000 on the web for the first 90 days after launch. The free trial stays web-only (existing trial rules: 7 days, card saved).
- **Founding sellers:** the first 1,000 stores get Pro at ₦2,500/month for 3 months and no escrow fee on their first ₦250,000 of escrow orders.
- **Founding creators:** a 10% platform share on subscriptions (instead of 20%) for 6 months.
- **Coins:** double coins on the first 100-coin web pack.
- **Black:** the first year at ₦400,000 for agencies onboarded in the first 6 months.

## 5. What to A/B test

1. Blue Verified at ₦2,000, ₦2,500 or ₦3,000 (web), measuring conversion × revenue per visitor.
2. A 17%, 20% or 25% yearly discount, and the mix of yearly against monthly plans.
3. Pro at ₦4,000 or ₦5,000, with and without the 7-day trial.
4. A 1% or 1.5% escrow fee for Free sellers, and how often verified sellers pick direct payment over escrow.
5. Coin pack anchoring: "most popular" on 500 or on 1,000 coins, and web bonus size.
6. A ₦500 or ₦1,000 entry boost.

## 6. Revisit

- Every 6 months, or when inflation or FX moves more than 10%.
- Apple Small Business Program status (switch iOS coin and subscription prices to the 15% column).
- Paystack's live pricing page (our fetch was blocked) and whether Paystack supports escrow holding.
- Per-plan escrow fee wiring (Business 1%) in go-money, and the CPC floor in go-ads. Field names still say "commission" (`ESCROW_PLATFORM_COMMISSION_BPS`, `PlatformCommissionBps`, admin money mocks `commissionBasisPoints`) and should be renamed to escrow fee in the Paystack rebuild.
- Non-NGN prices in the admin plan seed weren't researched.
- Ghana and Kenya prices before those launches.
- Legal and tax review: VAT on subscriptions and coins, and consumer-protection wording for trials.

## Sources

- TechEconomy, X Premium Nigeria prices: https://techeconomy.ng/nigerians-face-51-hike-as-x-raises-premium-monthly-subscription-to-34000
- Technology Times: https://technologytimes.ng/nigerians-hit-with-51-increase-as-x-hikes-fees/
- Prime Business Africa, Meta Verified: https://www.primebusiness.africa/facebook-instagram-verified-users-to-pay-monthly/
- Brandspur Nigeria, Meta Plus tiers (22 Jun 2026): https://brandspurng.com/2026/06/22/meta-launches-paid-subscription-plans-for-whatsapp-facebook-instagram-with-₦1199-monthly-whatsapp-plus-tier/
- Nairametrics, YouTube Premium (5 Apr 2025): https://nairametrics.com/2025/04/05/youtube-increases-youtube-premium-service-price-by-54-in-nigeria/
- Interspace Music, Spotify NGN (2026): https://interspacemusic.com/blog/spotify-premium-naira-african-streaming-economics-2026/
- TechCabal, Spotify Nigeria (25 May 2026): https://techcabal.com/2026/05/25/spotify-on-nigerias-streaming-economy/
- WhatKeptMeUp, Netflix and Showmax (Jul 2026): https://whatkeptmeup.com/latest-nigerian-movies/streaming-services-in-nigeria-netflix-subscription-price-and-details/
- MacRumors, iCloud+ (17 Jul 2026): https://macrumors.com/2026/07/17/apple-icloud-plus-price-increase
- Marix, Telegram Premium by country (2026): https://marix.app/library/guides/telegram-premium-cheapest-country-2026
- Bumpa pricing: https://www.getbumpa.com/pricing
- Kolonell, Jumia vs own store (2026): https://kolonell.com/en/blog/sell-on-jumia-vs-own-store-nigeria-2026
- Kolonell, Paystack vs Flutterwave (20 Aug 2026): https://kolonell.com/en/blog/paystack-vs-flutterwave-payout-fees-nigeria-2026
- Paystack pricing: https://paystack.com/pricing
- Grey, TikTok coins Nigeria (29 Aug 2026): https://grey.co/blog/buy-tiktok-coins-nigeria
- Grey, Facebook ads cost Nigeria (2026): https://grey.co/blog/facebook-ads-cost-nigeria
- Nairametrics, August 2026 inflation (15 Sep 2026): https://nairametrics.com/2026/09/15/nigerias-headline-inflation-eases-to-15-39-in-august/
- Playroll, Nigeria minimum wage 2026: https://playroll.com/minimum-wage/nigeria
- Hivedesk, Nigeria salary guide 2026: https://www.hivedesk.com/salary-guides/nigeria
- TechEconomy, NFEM rate (14 Sep 2026): https://techeconomy.ng/dollar-to-naira-exchange-rate-today-september-14-2026
- TechCabal, selling digital content in Nigeria: https://techcabal.com/2019/10/10/why-is-selling-digital-content-to-nigerians-still-an-uphill-task/
