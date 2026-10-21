# Owner actions and deployment notes

What is left after the handoff was completed on 12 October 2026. Engineering work from the handoff is finished and verified:
- full API smoke 109/109 with every dead-letter queue empty;
- browser e2e: seller 11/11, ads 6/6, admin 8/8, web 7/7, webapp 37 passed;
- all app type checks and builds pass.

The handoff work has since been committed; this page is kept as the owner-action checklist. Rechecked 2026-10-21.

## Waiting on the owner

1. **Post screen top cut off** (the screen opened by the + button). It couldn't be reproduced from the code. Send:
   - iPhone or Android;
   - Expo Go or a development build;
   - whether it happens at rest or only with the keyboard open;
   - a screenshot.
2. **Confirm the daily withdrawal caps.** Set in `services/go/modules/wallet/src/configs/withdrawalLimits.config.go`; override with env. Any currency without a cap is refused.

   | Currency | Level 1 | Level 2 |
   |---|---|---|
   | NGN | ₦500,000 | ₦5,000,000 |
   | GHS | GH₵5,000 | GH₵50,000 |
   | KES | KSh 50,000 | KSh 500,000 |
   | ZAR | R10,000 | R100,000 |

   The amounts outside Nigeria are placeholders.
3. **Flutterwave:**
   - test keys in `.env`;
   - written sign-off on the escrow setup (funds stay in each buyer's own account);
   - register 3 fixed IP addresses per environment (see `flutterwaveMigration.md` §7.1).
4. **Widgets (EAS):**
   - Apple Team ID;
   - app group `group.com.zudomart.app`;
   - APNs key;
   - FCM `google-services.json`.
   Then run `eas build`.
5. **LiveKit:** LiveKit Cloud, or local LiveKit with the ingress service (needed for browser go-live over WHIP; see `docs/runningLocally.md`).
6. **Legal:** NDPC and ARCON registration.
7. **Product decisions (optional):**
   - Repost/Quote buttons on clips;
   - colour swatches for product options (needs a new backend field).

## Deployment settings (must be set before production)

- **Admin token:** copy go-identity's `ADMIN_INTERNAL_API_TOKEN` into the go-live and gateway app secrets. Without it, staff routes fail closed with 503.
- **Social token:** `SOCIAL_INTERNAL_API_TOKEN` for go-money and go-identity must equal the social service's `SOCIAL_INTERNAL_TOKEN`. Otherwise affiliate commissions stop.
- **Allowed origins:** the realtime service's `ALLOWED_ORIGINS` must include the webapp, studio and seller origins.
- **Realtime URLs:**
  - Set `WEBAPP_REALTIME_URL` and `STUDIO_REALTIME_URL` to the public `wss://` URL if the API URL the apps use is internal.
  - Studio's CSP is fixed at build time, so set `STUDIO_REALTIME_URL` / `STUDIO_API_URL` and `STUDIO_WHIP_CONNECT_ORIGINS` when building studio.
- **Local-only setting:** `UPSTREAM_REALTIME_URL` (the gateway's local `/ws` proxy) must stay unset in production. The load balancer routes `/ws*` to realtime.
- **Database migrations:**
  - The social migration `20261011170000_comment_hiding` adds a foreign key from replies to their parent comment. Before applying it to production, check that no reply points to a missing parent.
  - Apply the new migrations through the normal path:
    - users and catalog: profile rule;
    - creators: affiliate retry schedule;
    - escrow: scheduled refunds;
    - live: scheduled lives and host defaults;
    - notifications: hidden notifications;
    - social: comment hiding.

## Known small follow-ups (engineering)

- **Notifications:**
  - `escrow.clawedBack` (a refund after release, into the buyer's wallet) sends the buyer no notification.
  - The order-cancelled and seller-rejected emails use general refund wording until the escrow refund event arrives.
- **Live and comments:**
  - Studio guest *requests* need a backend event first. Guests on stage already update live.
  - Post comments have no realtime event; the studio comments hub refreshes from comment notifications.
- **Seller app:** the seller realtime client doesn't honour `Retry-After` on 429. It backs off normally.
- **Test coverage:** the notifications `hiddenAt` Postgres integration test file is skipped; the filter is only type-checked.
