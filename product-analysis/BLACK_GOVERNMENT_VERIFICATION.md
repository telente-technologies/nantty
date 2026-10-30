# Black government verification

> **Updated 2026-10-29:** This file’s earlier “noncommercial” recommendation is superseded. Black Government is now a paid, manually approved, web-only subscription under the new founder direction. USD 300/month is the latest working assumption but remains unresolved against USD 500/month; do not enable or publicly expose either amount until confirmed. Black annual billing is separately gated and off by default.

Current source: `black` maps to government profiles, is not self-serve (`services/go/modules/subscriptions/src/constants/plans.constant.go`), and the plan catalogue forces Black non-purchasable. Regional price defaults nevertheless contain an obsolete NGN ₦50,000 row, which must not be treated as approved public pricing. The current working web-only proposal is USD 300/month versus a previously mentioned USD 500; founder confirmation is still pending. Ad-load defaults are 20% of normal load.

## Current direction and verification recommendation

- Keep Black as one government verification category with a single Black badge color. Payment is a separate subscription state; approval alone does not activate paid benefits, and payment alone never grants the badge.
- Verify institution legal status, official domain/contact, authorized representative and the account’s actual authority to speak for the institution. Require independent reviewer approval and auditable evidence; elevate scrutiny for high-impact government identities.
- Separate institution verification from account role grants. Black must not confer admin privileges, special financial treatment, moderation immunity, ad targeting access or trusted-user bypass.
- Set revalidation cadence and revocation/appeal processes for a government affiliation change. The code/docs currently mention manual checks and renewal windows; align this into one policy.
- Preserve the current 20% of normal ad-load setting unless the founder explicitly changes it; define exactly which platform-controlled inventory this covers.
- Keep public self-serve checkout disabled. After manual application approval and representative-authority verification, staff may send an account-bound, single-use, expiring checkout invitation. Use provider tokenization, verified idempotent payment events and explicit recurring consent.
- Seeded regional Black prices are legacy data, not approved USD subscription pricing. Keep them out of public checkout and never overwrite historical purchase records.

## Current risks / decisions

1. A region price row exists for Black despite non-self-serve plan status; verify API/UI never exposes a payable checkout path.
2. `government` profile type and staff verification do not automatically prove an official account is authorized.
3. Confirm whether Black accounts should be eligible for any commercial Blue/Gold functionality; recommendation is no automatic cross-entitlement.
4. Approve the exact evidence standard and re-verification interval with Trust/legal before launch.
