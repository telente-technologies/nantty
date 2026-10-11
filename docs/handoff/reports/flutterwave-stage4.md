# Flutterwave migration, stage 4: the apps

Date: 2026-10-11. Nothing is committed. package.json, lockfiles, services/*, flutterwaveMigration.md, chat files and the payments agent's subscription-checkout files were not edited (exceptions are listed under "Coordination").

The stage 1 and 2 reports were not on disk at the given path, so this stage was built against the code in `services/go` and against flutterwaveMigration.md §3, §5, §10 and Appendix C.

## Package changes for the owner (not done: package.json is off-limits)

Remove the `@paystack/inline-js` dependency in three apps, then run `pnpm install` to update the lockfile. No code imports it any more.

- `apps/webapp/package.json`: delete `"@paystack/inline-js": "^2.26.0",`
- `apps/seller/package.json`: delete `"@paystack/inline-js": "^2.26.0",`
- `apps/ads/package.json`: delete `"@paystack/inline-js": "^2.26.0",`

## What was built

### 1. Checkout (provider-neutral hosted link)

**Web apps (webapp, seller, ads)**
- New `src/utils/hostedCheckout.util.ts` redirects to `checkoutUrl ?? authorizationUrl`, as a full-page redirect with no popup.
- Redirects are allowed only to:
  - same-origin paths (the mock demo pages);
  - https hosts on an allowlist: `checkout.flutterwave.com`, `checkout-testing.flutterwave.com` and `checkout.paystack.com`.
- The webapp has unit tests that block other hosts, http, `//` and `javascript:` links.

**Inline-js removed**
- `types/paystackInline.d.ts` is deleted in webapp, seller and ads.
- `paystackCheckout.util.ts` remains in webapp and seller only as a redirect shim. It imports nothing, so the payments agent's files still compile: `seller/.../subscriptionPlanPicker.tsx` and `webapp/.../subscribeToCreatorDialog.tsx`.

**Mobile**
- Keeps the in-app browser and now uses `checkoutUrl`.
- Always polls after the browser closes, whether the user returned or dismissed it.

**Polling the result**
- The redirect back is display-only: `status=` is ignored everywhere.
- Each app polls the verify endpoint for that purpose every 3 seconds for about 2 minutes.
- While offline, polling pauses and the page says "You're offline. We'll check your payment again when you're back online".
- When time runs out, the page says the payment is still confirming and the user won't be charged twice.
- Webapp:
  - `components/actions/paymentPoll.hook.ts` is used by `/pay/return` (orders) and `/coins/return`.
  - `/coins/return` also accepts `tx_ref`.
- The ads return page and the seller subscription confirmation poll the same way.

**Provider field and buttons**
- The webapp and mobile no longer send `provider` to `/payments/initialize`; an empty value means the backend's default provider.
- Buttons read "Pay securely", or "Pay from wallet" when the wallet is chosen.

### 2. Wallet

**Pay from wallet (webapp and mobile)**
- Shown only when the wallet is active and available + depositHold − debt covers the order total.
- Flow: initialize, then `POST /payments/wallet-payments/{reference}` (Idempotency-Key), then the same poll.

**Add money**
- Webapp: `/wallet/add-money` and `components/wallet/walletAccountCard.tsx`. Mobile: `screens/wallet/addMoney.screen.tsx`.
- Shows bank, account number, account name and any extra funding numbers, with copy and share buttons.
- Notes cover:
  - deposits are spendable at once and withdrawable after 24 h (72 h for the first deposit);
  - the deposit fee appears on the receipt;
  - default daily limits of ₦50k / ₦200k / ₦5m.
- "Payments are processed by Flutterwave" appears only when `wallet.provider === "flutterwave"`.

**Outside Nigeria and missing accounts**
- Outside NG, the screen explains direct payment: no stored balance and no escrow.
- If the account number is missing (`WALLET_NOT_READY`):
  - below L1, it shows "Finish verification";
  - at L1, it shows "Get my account number", which calls `POST /payments/wallet/me/activate`.

**Seller and studio:** a compact wallet-account card on the payout panel. The seller BFF allowlist now includes `/payments/{wallet,verification}/me`.

**Escrow copy now matches the Terms and Help Centre**
- Nigeria: "locked in your own wallet, held by our licensed payment partner, until you confirm delivery".
- Elsewhere: "no escrow, you pay the seller directly; our dispute process still applies".
- The mobile text "Zudomart escrow" is gone. The webapp order timeline says "Paid" instead of "Paid into escrow".

### 3. Payout onboarding
- BVN consent card:
  - Webapp: `/wallet/payouts`, `components/wallet/bvnConsentCard.tsx`.
  - Seller: `bvnConsentPanel.tsx`.
  - Studio: `walletAccountAndConsent.tsx`.
  - Mobile: `bvnConsentCard.tsx` on payout setup.
- How it works:
  - `POST /payments/payout-onboarding/me/bank-validation?returnTo=` opens `consentUrl` (only trusted hosts on the web; the in-app browser on mobile).
  - Then `GET .../bank-validation` is polled.
- Shown only for NG. Smile ID stays the path elsewhere. No Paystack steps remain.

### 4. Error codes (shared dialogs)

`utils/paymentProblem.util.ts` exists in webapp, seller, ads and mobile. It uses the web-kit `requestConfirmation` or the mobile `showDialog`.

| Code | Dialog title | Action or behaviour |
|---|---|---|
| PAYMENT_AMOUNT_OUT_OF_RANGE | "Amount not allowed" | Shows the maximum or minimum, or "contact support" for large orders |
| WALLET_DAILY_LIMIT | "Wallet limit reached" | Shows the remaining amount from `details.remaining`; the webapp mock now passes `details` |
| SELLER_DEBT_LIMIT | Seller: "Selling paused". Buyer (webapp): "This seller can't take new orders" | — |
| VERIFICATION_REQUIRED | "Verification needed" | Opens payout setup |
| WALLET_NOT_READY, WALLET_ON_HOLD, BVN_REQUIRED | Own titles | Link to the right page |
| STEP_UP_REUSED | — | Treated as "step-up required": the step-up prompt re-opens once (webapp `stepUp.service.ts`, seller, studio, mobile) |
| CURSOR_EXPIRED | — | Comments already auto-restart; mobile clips For You now restarts too |
| COUNTRY_REQUIRED | — | Unchanged; reuses the payments agent's pickers |

The dialogs are wired into:
- webapp: checkout, coins, wallet activation and BVN;
- seller: product publish/save and withdraw;
- ads: top-up;
- mobile: checkout, payment and withdraw.

### 5. Mocks (Flutterwave-shaped)

**Webapp**
- New `mocks/providerWallet.mock.ts` covers the wallet, activation, `verification/me`, bank-validation and a mock-only decline route.
- Initialize returns `checkoutUrl` pointing at a new demo partner page, `/pay/demo`, plus `payment.provider: "flutterwave"`.
- The verify mock returns pending once, then paid.
- The demo page has three buttons:
  - **Pay**;
  - **Simulate a failed payment**: the return link still says `status=successful` but the poll says failed;
  - **Cancel**.
- Coins and boosts go through the demo page. The verification mock uses a `checkout.flutterwave.com` URL.
- The contract list adds `payments/wallet/me`, `verification/me` and `bank-validation`.

**Other apps**
- Mobile: Flutterwave links; a wallet mock with Wema Bank 8571234567.
- Seller: a provider-wallet mock, plus the demo page in Flutterwave's return shape.
- Ads: Flutterwave hosts. A top-up amount ending in 013 shows a success redirect followed by a failed poll.
- Studio: wallet and consent mocks.

### 6. Copy elsewhere

**Admin** (staff only; names are kept where they matter for operations):
- The price book, coin packs ("Web checkout"), ad pricing, trust rules, revenue rules, the config seed and the platform-metrics mock are now neutral or accurate.
- The webhook provider tab and the payout provider data still name providers. That is intentional.

**apps/web:** Terms and Privacy keep "Paystack during the move". That wording is legally needed, so it is unchanged.

## Grep audit: remaining "paystack" in apps (none user-facing)

**Types and provider enums**
- `PaymentProvider = "paystack" | "flutterwave"` in webapp, mobile and ads.
- Seller `order.type.ts` and `subscription.type.ts`.
- Mobile `providerWallet.type.ts`.
- Admin `paymentWebhooksWorkspace` provider tab (staff, functional).

**Host allowlists and CSP**
- `hostedCheckout.util.ts` in webapp, seller and ads.
- `next.config.ts` in seller and ads.
- `ads/src/config/adsEnvironment.config.ts` and `ads/.env.example`.

**Code-name shims**
- `webapp/src/utils/paystackCheckout.util.ts` and `seller/src/utils/paystackCheckout.util.ts`.
- They are imported only by the payments agent's `subscribeToCreatorDialog.tsx` and `subscriptionPlanPicker.tsx`; switch these to `openHostedCheckout`.

**Wire values**
- Ads sends `"paystack"` on top-up and add-card, because the backend requires it (see gaps).
- `paymentChannel: "web_paystack"` in the webapp and admin identity-verification mocks. This is a backend enum value; admin shows it humanised to staff.

**Mock and seed data**
- Admin payouts and coins seed `provider: "paystack"`, and the reserved username "paystack".
- Seller demo orders and finance, ads demo accounts and billing. The legacy rows display as "Card / bank transfer".
- `webapp/src/mocks/creatorSubscriptions.mock.ts`, which belongs to the payments agent and was left alone.

**Storage keys:** `mobile/src/utils/savedCard.util.ts` (`zudomart.paystack.savedCard.*`). Renaming would drop existing saved cards.

**Developer docs:** `apiContract.md` for admin, seller and ads, and `seller/README.md`.

**Legal text:** Terms and Privacy in apps/web.

**Tests:** the webapp `hostedCheckout.util.test.ts` and the mobile `paymentProblem.util.test.ts` assert that Paystack is never shown.

**Dependencies:** `package.json` in webapp, seller and ads (see the package changes section).

## QA

All heavy commands ran through `flock …/heavy.lock`, one at a time. Disk had 43 GB free.

| App | Check | Result |
|---|---|---|
| webapp | `tsc --noEmit` | clean |
| webapp | `test:units` | 184/184 |
| webapp | `test:contracts` | 81/81 |
| webapp | `WEBAPP_USE_MOCKS=true next build` | passes; `/wallet/add-money`, `/pay/demo` and `/pay/return` all build |
| webapp | eslint on touched files | 0 errors, 4 warnings |
| seller | `tsc` | clean |
| seller | contracts | 39/39 |
| seller | units | 7/7 |
| seller | `SELLER_USE_MOCKS=true next build` | passes |
| ads | `tsc` | clean |
| ads | contracts | 15/15 |
| studio | `tsc` | clean |
| studio | contracts | 54/54 |
| mobile | `tsc` | clean |
| mobile | jest: new tests, limit and country tests, all `src/contracts` | 19 suites / 92 tests pass |
| mobile | jest: wallet boost, modal system, comments cursor | 3 suites / 22 tests pass |
| admin | `tsc` | clean |
| admin | contracts | 35/38 |

The full mobile jest suite was not run.

The 3 admin failures are in `moneyContracts.test.ts`: coins reverse, withdrawals hold, and disputes resolve. They return 401 from the new single-use step-up mock guard (`mockGuards.mock.ts`, `STEP_UP_REUSED`), which another agent is changing. They are not caused by these copy edits.

### Adversarial checks

**Closing the checkout tab mid-payment**
- Webapp: the pending payment is kept in localStorage for 24 h, so it survives a closed tab. A pending order shows "Pay securely", which reopens the stored link or re-initializes with the fixed key `pay-{orderId}`, and "Check payment".
- Mobile: "Finish payment" uses the key `resume-{orderId}`.
- Seller and ads: no resume banner. The top-up stays pending and appears in billing history.

**Double-clicking Pay**
- In-flight ref guards plus stable idempotency keys: the checkout key is no longer regenerated when the payment source changes.
- The button stays disabled after the redirect starts. The same applies to the coin dialog, the ads top-up and mobile.

**The redirect says success but the poll says failed**
- The redirect params are never read. The demo page and the ads "…013" amount show the failed state.
- The order return page then says "The payment didn't go through… returned automatically".

**Offline during the poll**
- react-query pauses while offline, and the offline notice shows. Network and 5xx errors count as "still confirming", never as failed.

**Wallet account number missing**
- `WALLET_NOT_READY` becomes null, which shows "Finish verification" below L1 or "Get my account number" at L1.
- "Pay from wallet" is hidden, and a frozen wallet shows an on-hold note.

## Backend gaps (not edited; for the payments agent or owner)

1. **There is no `GET /api/v1/payments/{ref}`.** Apps poll the verify endpoint for each purpose instead: orders `POST /payments/orders/{id}/verify`, coins `/coins/purchases/{ref}/verify`, the subscription state, and the ads top-up status.
2. **Provider validators are still Paystack-only:**
   - `checkoutPayments.validator.go`, `coins.validator.go` and `creatorSubscriptionState.controller.go` accept `provider` = "paystack" or empty only.
   - The ads `startTopUp.command.go` requires `"paystack"` exactly and stores it.

   They should accept empty or "flutterwave" and record the provider actually used.
3. **Resuming payment assumes initialize reuses the order's open intent.** Re-initializing an order (resume) assumes it returns the existing open intent rather than creating a second one.
4. **Wallet limits:** no client endpoint exposes the user's wallet tier, daily limit or remaining amount. The Add money notes show the default ₦50k / ₦200k / ₦5m.
5. **Seller debt limit at buyer checkout:** orders `paymentRegistrationRefusals` has no buyer-facing mapping for `SELLER_DEBT_LIMIT`. The webapp overrides the copy for buyers.
6. **The `web_paystack` payment-channel enum** on verification cases should become neutral (e.g. `web_checkout`).
7. **The mobile BVN return link** `zudomart://payouts/bvn-return` must be on the backend's allowed `returnTo` list.
8. **Seller subscription verify** has no explicit "still pending" response. The seller app treats only network errors, 202, 425 and 503 as pending.
9. **`verifyUrl` on `VERIFICATION_REQUIRED`** isn't carried by the webapp and mobile error classes, so the dialog routes to payout setup.

## Coordination
- I did not edit `seller/.../subscriptionPlanPicker.tsx`, `countryRequiredDialog.tsx`, `webapp/.../subscribeToCreatorDialog.tsx` or `webapp/src/mocks/creatorSubscriptions.mock.ts`. The payments agent should switch the two components from `openPaystackCheckout` to `openHostedCheckout`, then delete both shims.
- The seller fork edited `seller/src/components/billing/subscriptionPaymentConfirmation.tsx` (the subscription callback poll) and made a one-line "Paid through" edit in `billingSettingsView.tsx`. The payments agent should re-read both before further edits.
