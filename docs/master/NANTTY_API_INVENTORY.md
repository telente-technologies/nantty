# Nantty API inventory — focused verified contract entries

This file records the API contract changes verified in the current implementation session. It is not a claim that the ecosystem-wide endpoint inventory is complete.

## Creator ad revenue policy

| Method and route | Owner | Authorization | Response fields added | Status |
|---|---|---|---|---|
| `GET /api/v1/creators/revenue-rules` | Go Creators / Creator Money | Authenticated Nantty user; policy is read-only | `adRevenuePolicy.baseShareBasisPoints`; `adRevenuePolicy.rules[]` (`contentType`, `multiplierBasisPoints`, `effectiveShareBasisPoints`); `adRevenuePolicy.calculationNote` | Implemented; Go API integration and Creator Studio contract tests pass locally; deployed contract/runtime unverified |

`contentType` currently supports `original` and `ai_generated`. Active Admin `monetization.policy` rows override defaults; absent, malformed, out-of-range, or inactive values use Ads runtime defaults. Multipliers are accepted only in the Admin-supported 0–30000 basis-point range. Effective share is `min(baseShareBps * multiplierBps / 10000, 10000)` using integer arithmetic, matching Ads settlement behavior. Effective share applies to eligible delivered and settled revenue, not a guaranteed amount per view.

The response is informational and contains no permission to change settings or initiate payouts. Current policy audit history remains owned by Admin platform settings; per-impression applied rates remain the immutable historical inputs for settlement.
