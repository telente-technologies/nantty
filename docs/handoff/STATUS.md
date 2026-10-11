# Zudomart: status and what's left

Written 11 October 2026, when the machine was turned off. Nothing has been committed; all work is in the working tree (`git status` shows it).

## 1. Work that was in progress at shutdown

Each of these was stopped part-way. Its own handoff file says exactly what's done, what's partial and the next steps.

| Area | Handoff file | Summary |
|---|---|---|
| Profile rule (one Store **or** one Business page, plus one Brand) | `docs/handoff/profileEntityRule.md` | **Mostly built and tested.** Go users and catalog tests pass, tsc passes, contract tests pass. Still to do:<br>• a full mobile jest run and the 5 Next builds;<br>• end-to-end testing against the real backend;<br>• apply the 2 migrations to the dev database;<br>• other users' profiles: the Mart tab still follows the seller role;<br>• the "post as" row label;<br>• seller applications already pending at deploy.<br>The plan is in `docs/plans/profileEntityRulePlan.pdf`. |
| Payments follow-ups | `docs/handoff/payments.md` | **Mostly done.** Fixed:<br>• affiliate commissions now go to the creator's own Flutterwave wallet, with clawback and debt (the live money bug);<br>• the posts 500 is now a 400;<br>• the intelligence DLQ (it was `content.saved` events).<br>Contract fixtures: partial; the code is written, but it hasn't been run against the stack.<br>Still to do:<br>• rerun `-race`, `go vet`, the deployable builds and atlas lint for the creators migration;<br>• purge the old DLQ messages;<br>• run the full smoke. The exact commands are in the handoff. |
| Creator studio completion | `docs/handoff/studio.md` | **Partly built and not yet verified.** Studio tsc and builds haven't been run, so expect type errors.<br>Partly built:<br>• the new sidebar (its Analytics, Comments and Settings links 404 for now);<br>• go live from the browser over WHIP, blocked until `next.config.ts` allows the camera, mic and WHIP origin;<br>• the stream health panel;<br>• scheduled lives (the follower reminder isn't delivered yet);<br>• the moderation defaults form.<br>Not started: the replays page, comments hub, analytics, settings pages and old-route redirects.<br>New live-module endpoints and migration `20261011160000_add_scheduled_lives_and_host_defaults`: build and vet pass, `go test` not yet run.<br>A pre-change backup of the live screens is in `~/Desktop/zudomart-backups/`. |

If a handoff file is missing, that agent was stopped before it could write one. Check `git status` for the area.

Separate from the payments handoff: affiliate commissions are fixed and their flow tests pass, but the other payments packages weren't rerun after the last one-file change.

## 2. Finished today (verified)

- **Payments:**
  - Flutterwave is the only provider. Paystack is removed.
  - Wallet, seller dashboard and studio balances read the Flutterwave wallet ledger, which fixes the ₦0 balances.
  - Debt blocks ads spend and withdrawals.
  - Ads payments above ₦50,000 need a step-up check.
  - Withdrawals are refused in any currency that has no daily cap.
  - Staff routes are protected by an IP policy in every service and the gateway.
  - The old pre-Flutterwave code is deleted.
  - Smoke tests: 93 pass, 2 fail. Details are in `reports/pay-fixes.md`.
- **Auth bugs:**
  - "Sign in to reply" no longer shows when you're logged in.
  - Guests see a plain profile icon, not a photo.
  - Logging out clears the profile photo.
- **Product options:** sellers now add options as chips in the mobile app and the seller dashboard.
- **Design:**
  - Decorative accent bars are removed from admin, seller, ads, studio, web, webapp and emails.
  - Admin table colour strips are replaced with text labels.
- **Pitch deck:** https://claude.ai/artifact/AuRk28NUTRqPNEfRdDtShV, with a PDF copy at `~/Downloads/ZudomartPitchDeck.pdf`.
  - 14 main slides plus an appendix, with claims checked against current sources.
  - It asks for $250K over 18 months and states 25 committed sellers and 500+ buyers.
  - It includes projections and the founder photo.
- **Disk:** the Go build cache was cleared (75% used afterwards). It refills over time; clear it again above 20 GB.

## 3. Waiting on you (owner)

1. **Post screen top cut off** (the screen opened by the + button). It couldn't be reproduced from the code. To fix it, I need:
   - iPhone or Android;
   - Expo Go or the development build;
   - whether it happens as soon as the screen opens, or only when the keyboard appears;
   - a screenshot.
2. **Confirm the daily withdrawal caps.** The ones outside Nigeria are guesses:

   | Currency | Level 1 | Level 2 |
   |---|---|---|
   | NGN | ₦500,000 | ₦5,000,000 |
   | GHS | GH₵5,000 | GH₵50,000 |
   | KES | KSh 50,000 | KSh 500,000 |
   | ZAR | R10,000 | R100,000 |

3. **Pitch deck inputs:**
   - your co-founder's photo;
   - proof of the 25 committed sellers and the 500+ buyers (a list or the messages);
   - customer interviews, advisors, accelerators or cloud credits, if you have any.
4. **Clips:** should they get Repost and Quote buttons? At the moment a clip can only be quoted by sharing its link.
5. **Colour swatches for product options?** This needs a new backend field.
6. **Flutterwave:**
   - test keys in `.env`;
   - their written reply to our questions;
   - registering 3 fixed IP addresses per environment (`flutterwaveMigration.md` §7.1).
7. **Widgets:** in EAS, set up the Apple Team ID, the app group `group.com.zudomart.app`, an APNs key and `google-services.json`. Then run `eas build`.
8. **LiveKit:** set up LiveKit Cloud, or run it locally (`docs/runningLocally.md`).
9. **Legal:** NDPC and ARCON registrations.
10. **Deploying:** copy go-identity's `ADMIN_INTERNAL_API_TOKEN` into the go-live and gateway secrets.

## 4. Engineering still to do, after the in-progress work

- Finish and QA the three in-progress areas (section 1). Then run full QA one step at a time:
  - Go tests for all modules;
  - tsc for every app;
  - mobile jest;
  - contract tests;
  - every Next build;
  - the API smoke suite against the real backend.
- Fix the 2 remaining smoke failures: leftover DLQ messages, and the webapp and studio contract fixtures.
- Run browser tests against the real backend for the apps other than webapp (webapp passed 37).
- Rewrite the README and architecture docs.
- Clean up the payments test harnesses, which assumed missing caps were fine (PAY-7 notes).
- Go-live path:
  1. Flutterwave live keys and sign-off
  2. Deploy the Terraform to AWS staging, then production
  3. Penetration test
  4. App Store and Play review
  5. Closed beta with the 25 sellers
  6. Public beta, targeted for March 2027

## 5. How to resume

- Start the backend: `pnpm backend:up`. Switch the apps with `mode:backend` / `mode:mock`. Details are in `docs/runningLocally.md`.
- **Rules carried over:**
  - Don't commit unless you say so.
  - Run heavy builds and tests one at a time (the machine has 15 GB RAM).
  - Clear the Go cache when it goes above 20 GB.
  - No decorative accent bars.
  - Zudomart never holds customer money.
  - QA every task adversarially, and check the apps against the backend APIs.
- Detailed reports for every area are in `docs/handoff/reports/`. The profile rule plan is there too, as an HTML copy.
