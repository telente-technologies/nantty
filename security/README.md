# Security workspace

Sandbox red-team and static review material for Zudomart. Nothing here may touch production, live payment keys, real AWS resources, or the `betng-*` containers.

## Layout

| Folder | Holds |
|---|---|
| `audit/ENVIRONMENT_BOUNDARY.md` | What may be attacked, what may not, and which credentials exist (redacted) |
| `audit/reports/` | `ATTACK_SURFACE.md`, `FINDINGS.md` (SEC-XXXX), `REMEDIATIONS.md`, `ACTIVE_TEST_PLAN.md` |
| `audit/evidence/` | Tool output kept as proof (audits, scans), secrets redacted |
| `audit/logs/` | Run logs from active phases |
| `audit/findings/` | One file per finding when a finding needs a long write-up |
| `audit/snapshots/` | Before/after database snapshots for financial invariant runs |
| `authorization/` | AuthN/AuthZ/IDOR scripts; `routeInventory.py` builds the attack surface table |
| `attacks/` | Attack chains (multi-step scenarios) |
| `fuzz/` | Input fuzzers (JSON bodies, paths, headers) |
| `abuse/` | Rate limit and abuse-detection probes |
| `race/` | Concurrency probes against money paths |
| `business_logic/` | Refund caps, coupon/price tampering, state-machine skips |
| `resilience/` | Bounded chaos (upstream down, slow DB, queue backlog) |
| `dependency/` | Dependency audit commands and results |
| `infrastructure/` | Compose, Terraform, IAM review notes |
| `database/` | Grant, trigger and `search_path` checks (read-only SQL) |
| `regression/` | Re-runnable checks for fixed findings |

## Script header contract

Every script starts with this header; a script without it must not be run.

```
# Test name:
# Target:              (host:port or "source tree only")
# Expected behavior:
# Dangerous behavior:  (what a failure would look like)
# Cleanup:
# Financial safety:    SAFE (no money moves) | SANDBOX-ONLY (fake Paystack / sk_test_ only) | FORBIDDEN
```

## Rules

- Only `127.0.0.1` targets from `infra/local/docker-compose.yml` and locally started services. Never `betng-*`, never a public hostname.
- Paystack must be the fake server or an `sk_test_` key. A script refuses to start if it sees `sk_live_`.
- Snapshot ledger, wallet and payment tables before and after every financial run (`audit/snapshots/`).
- Append-only ledger controls are never weakened, even temporarily.
- One heavy run at a time (15 GB RAM machine).
