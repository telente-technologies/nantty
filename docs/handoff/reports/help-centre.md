# Help centre expansion report (2026-10-10)

There are now 250 articles in 22 topics; there were 84 in 16. Nothing is committed. The support service tests pass (7 files, 73 tests), and so does `tsc -p tsconfig.test.json`.

## Counts per topic

| Topic | Before | After |
|---|---|---|
| getting-started | 4 | 14 |
| account-and-login | 6 | 11 |
| checkmarks-and-verification | 3 | 11 |
| notifications-and-settings | 3 | 9 |
| contact-support | 3 | 7 |
| payments-and-wallet | 3 | 16 |
| wallet-security (new) | 0 | 10 |
| creators-and-earnings | 5 | 11 |
| buying-and-orders | 6 | 17 |
| selling | 10 | 22 |
| business-and-brands (new) | 0 | 6 |
| live | 6 | 13 |
| ads-and-boosts | 3 | 12 |
| posts-and-feed | 12 | 22 |
| clips-and-stories (new) | 0 | 7 |
| profiles-and-privacy | 6 | 12 |
| chat | 6 | 11 |
| safety-and-reporting | 5 | 13 |
| widgets-and-embeds (new) | 0 | 6 |
| accessibility (new) | 0 | 6 |
| troubleshooting (new) | 0 | 10 |
| legal-and-data (legal agent, untouched by us) | 3 | 4 |
| **Total** | **84** | **250** |

The new material includes:
- six role guides: new user, buyer, seller, creator, advertiser and brand/business
- a glossary
- an FAQ for every topic
- a large `common-error-messages` list

Every new article uses real UI labels, quotes the exact error messages from the code, and covers who it applies to (Nigeria vs elsewhere). Safety notes appear where relevant, and tags include synonyms and pidgin-friendly search words.

## Code and test changes

- `services/typescript/support/src/constants/helpCategories.constant.ts`:
  - Added 6 categories: clips-and-stories (filmStrip), wallet-security (lockKey), business-and-brands (buildings), widgets-and-embeds (appWindow), accessibility (personArmsSpread) and troubleshooting (wrench).
  - Retitled posts-and-feed to "Posts and feed".
  - Updated the payments description.
  - Seeding only creates missing categories, so existing databases keep their old titles.
- New `services/typescript/support/tests/content/helpContentLinks.test.ts`, which checks four things:
  - the 9 app-linked slugs still exist under the same topic;
  - every `/help/<topic>/<slug>` link and every `topicSlug`/`HELP_TOPIC_SLUG` in the mobile, webapp, web and dashboard sources resolves;
  - every article has tags and related links, and none relates to itself;
  - no article names Paystack or Flutterwave, mentions a waitlist, or describes phone or SMS login.

  The existing seed test already checks front matter, unique slugs, related and body links, no emoji and no personal data.
- Apps were not changed:
  - Mobile and webapp load help topics from the API; neither has a fixed topic list or icons.
  - Search is server-side, so it covers the new articles.
  - "Was this helpful?" voting already exists in both apps and the backend.
- No existing slug was renamed or moved between topics. The seeder keys on topic/slug and would skip a moved article.

## Outdated articles fixed (no article was deleted)

- **Login (`create-an-account`, `sign-in-and-passwords`):** they described phone/OTP login. They now cover email or username with a password, plus Google, and Apple on iPhone.
- **two-factor-authentication:** the backend refuses to turn it on ("Two-factor sign-in is not available yet."). The article now says so.
- **active-sessions:** sessions are listed only on the seller dashboard.
- **Paths and settings:** fixed in usernames, notification-settings (push on/off only), appearance, language and the privacy paths.
- **Payments:** payment-methods, buy-coins and premium named the provider or had wrong coin, Premium or saved-card facts. Coins are ₦1,200 per 100 in both the iPhone and Android apps.
- **Payouts:** payout-setup, withdrawals and seller-payouts described a free daily automatic payout through the provider. They now cover level 1 verification, step-up checks, limits, the 48-hour wait and own-name accounts.
- **Buying:** all six articles now describe escrow as Nigeria-only. Labels are fixed ("My orders", "Confirm receipt"), and an invalid `/terms` link was removed.
- **Creators:** creator-program listed "a verified phone number" as a requirement; that is gone and the real criteria are in. boost-a-post wrongly said in-app boosts use Apple or Google billing.
- **Posts and profiles:** create-a-post, how-your-feed-works, blocking-people, edit-your-profile, followers-and-following and profile-types claimed features that don't exist: post caption edit, a mute option, a date-of-birth field, a remove-follower option, and the wrong switcher.
- **Safety:** report-a-problem, copyright-and-account-status (it named a "Copyright" ticket category that doesn't exist) and suspensions-and-appeals.
- **Short articles expanded:** the six existing articles under 300 characters.

## Spot checks against the code (10, all pass)

1. **your-wallet-explained:** the 7 wallet lines match `walletLines.service.go`.
2. **withdrawal-limits:** 3 a day, a 10-minute gap, and daily caps of ₦500,000 at level 1 and ₦5,000,000 at level 2 match `withdrawalLimits.config.go`.
3. **new-payout-account-cooldown:** the quoted error is exactly the one in `withdrawalLimits.service.go`.
4. **unverified-seller-limits:** the ₦200,000 cap (`seller.unverifiedSalesCap` NGN 20,000,000 kobo) and both errors match `sellerVerification.service.go`.
5. **clip-player-controls:** double-tapping the left or right third skips ±10 seconds, the middle likes, and skipping is off under 5 seconds. Matches `utils/videoSeek.util.ts`.
6. **free-boost-with-premium:** one free boost a month and the FREE_BOOST_* errors match `ads/src` errors.
7. **usernames:** a 30-day cooldown, 3 changes a year and a 120-day hold match `users.config.go`.
8. **live-rankings:** the rank ring on the host avatar opens the ranking sheet with the category label, per `liveHostRankAvatar.tsx`.
9. **step-up-codes:** the "Confirm it's you" sheet matches `components/wallet/stepUpSheet.tsx`.
10. **two-factor-authentication:** matches the refusal in `updateMySettings.handler.go`.

Two cross-checks also changed articles:
- buy-coins and app-store-purchases had the iPhone price wrong; corrected from `regionPricing.catalogue.go`.
- website-embed is now marked "coming soon", because there is no embed code anywhere.

## Gaps: product behaviour unclear, or code that disagrees with the decisions

**Money**
- No **Add money** button, wallet account number or pay-from-wallet option exists in either app, though the backend has GET/POST `/api/v1/payments/wallet/me` and pay-with-wallet. The articles say so honestly.
- The code has no buyer-wallet escrow lock yet, and refunds go "to your original payment method". The articles follow the owner's model (locked in your own wallet) and also mention card refunds.
- `apps/mobile/src/screens/checkout/payment.screen.tsx` says "Your money goes into Zudomart escrow". That conflicts with the rule that Zudomart never holds money.
- `apps/mobile/src/screens/settings/settingsPaymentMethods.screen.tsx` and the webapp boost button ("Continue to Paystack") still name the provider.
- The `payoutAccount.added` event has no consumer, so no email or push notice is sent. The mobile Payout accounts screen doesn't mention the 48-hour wait.
- Other missing UI:
  - there is no way to cancel a withdrawal;
  - the mobile app has no screen for the bank_validation step;
  - coin activity is only reachable from Creator Studio.
- The coin transfer fee defaults to 25% (`COIN_TRANSFER_FEE_BPS`).
- There is no 7-day hold on creator subscription money in code; earnings move to Available daily. The articles follow the code.
- There is no "card refund if under 90 days" rule for ad credit; a rejected boost refunds to the ad balance.
- Boosts paid by card need no verification. Only Ads Manager and paying from balance or earnings do.
- **Disputes:** the 48-hour seller response is UI copy only. There is no backend timer or automatic outcome.
- **Seller plans:**
  - Seat and location limits differ: the admin defaults (Pro 3/1, Business 15) vs what `sellerPlans.resolver.go` enforces (5/3, 25/10). The articles use the enforced numbers.
  - Prices live in `regionPricing.plans.go`, not `plans.constant.go`.
- **Direct payment:** mobile allows it when `store.verified`, while the webapp requires an active Gold checkmark.
- **Confirm receipt:** mobile shows the button on shipped orders, but the backend only accepts delivered ones.

**Accounts and verification**
- Email can't be changed ("Email addresses cannot be changed here.").
- Usernames can be up to 20 characters in the apps but 30 in the Go validator.
- When Blue Verified is rejected, the app copy says "full refund", while the owner rule refunds only the checkmark share. Both cases are documented.
- The content preferences screen says "Add your birthday under Settings, Account", but no birthday screen exists.
- Subscription grace-period UI is unknown; only retry days 1, 3 and 5 and a 7-day grace are in code.

**Social**
- **E2EE is partial:** locations, polls and votes, reactions, and references to items shared in chat are stored unencrypted. The articles say so.
- "Not spam" moves a chat to Requests, not Chats.
- **Missing features:**
  - There is no account mute.
  - No post or story delete button exists in mobile or web, though the backend has the endpoint.
  - Captions can't be edited.
  - There is no Remove follower, QR code or Block on the web.
  - Removing yourself from a tag is server-only, although the tag sheet says people can remove themselves.
- **Possible bug:** post analytics shows the engagement-rate fraction followed by a % sign (`utils/postAnalytics.util.ts`).
- **Stories:** a failed story upload shows no error.
- **Live:** chat moderation is backend-only. Live viewers can't see the pinned product, and there's no buy button inside a live.

**Creators and ads**
- The creator review time copy is inconsistent: "2 working days" in one place, "3–5 working days" in another.
- It's unclear which plan gives the "Gold Premium ad credit".

**Safety**
- Strike length: the code defaults to 12 months for strikes and 6 months for warnings; the web guidelines say 90 days. Restrictions can run 1–90 days in code vs 1–30 days in the guidelines.
- A copyright restriction pauses only earning and going live; the policy page says it pauses selling too.
- There is no in-app screen to appeal a content removal, though the backend endpoint exists.
- The mobile post and profile report sheets lack Impersonation, Child safety and Self-harm reasons.
- There are no closed captions and no alt text anywhere.
- The report confirmation says "We won't tell the person who reported it." This is probably meant to say "the person you reported".
- The prohibited-items drafts still have "[Team to confirm]" notes on live animals and alcohol. The minimum age of 13 is also still marked to confirm.

**Widgets and embeds**
- There is no mobile widget UI or Settings > Widgets row yet; the widgets agent is building it. The backend has only the order-tracking, sales-today and live-now widgets.
- The website embed has no code at all; its article says coming soon.

**legal-and-data (gaps for the legal agent):** no help article covers consent and marketing preferences, cookie choices, or the retention periods for suspended accounts. The new `your-data-rights` exists; nothing else links to it yet.

**Mobile mock data:** `apps/mobile/src/mocks/helpCenterContent.mock.ts` is a hand-written subset of older articles, used only for offline development. It was left unchanged.
