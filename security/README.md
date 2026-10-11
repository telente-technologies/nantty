# Security workspace

Sandbox red-team and static review material for Zudomart. Nothing here may touch production, live payment keys, real AWS resources, or the `betng-*` containers.

## Layout

| Folder | Holds |
|---|---|
| `audit/ENVIRONMENT_BOUNDARY.md` | What may be attacked, what may not, and which credentials exist (redacted) |
| `audit/reports/` | `VERIFICATION_SUMMARY.md` (start here: status of every deep-scan finding, 2026-10-10), the deep scans (`GO_BACKEND_DEEP_SCAN.md`, `PYTHON_BACKEND_DEEP_SCAN.md`), `ATTACK_SURFACE.md`, `FINDINGS.md` (SEC-XXXX), `REMEDIATIONS.md`, `ACTIVE_TEST_PLAN.md`, `ATTACK_COVERAGE.md`, `FINAL_SECURITY_AUDIT.md`, `FINANCIAL_INTEGRITY.md` |
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

## Status of the 4 Oct 2026 static review (SEC-0001 to SEC-0022)

- Fixed: SEC-0001–0007, 0009, 0010, 0012, 0014–0018. SEC-0011 is fixed and owner approved. SEC-0008 and SEC-0013 are fixed (money agent).
- SEC-0019–0022 are accepted risks. For SEC-0022, a separate migration-owner role is recommended.
- The earlier deep scans (`DEEPSCAN_REPORT.md`, `GO_DEEPSCAN_REPORT.md`, `GO_FINANCIAL_AUDIT_REPORT.md`) are tracked in `audit/reports/VERIFICATION_SUMMARY.md`.

## Script header contract

Every script starts with this header; a script without it must not be run.

```
# Test name:
# Target:              (host:port or "source tree only")
# Expected behavior:
# Dangerous behavior:  (what a failure would look like)
# Cleanup:
# Financial safety:    SAFE (no money moves) | SANDBOX-ONLY (fake Flutterwave / FLWSECK_TEST- only) | FORBIDDEN
```

## Rules

- Only `127.0.0.1` targets from `infra/local/docker-compose.yml` and locally started services. Never `betng-*`, never a public hostname.
- The payment provider (Flutterwave, the only provider) must be the fake server or a test key. A script refuses to start if it sees a live key (`FLWSECK-` without `_TEST`).
- Snapshot ledger, wallet and payment tables before and after every financial run (`audit/snapshots/`).
- Append-only ledger controls are never weakened, even temporarily.
- One heavy run at a time (15 GB RAM machine).
