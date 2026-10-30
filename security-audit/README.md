# Nantty preproduction security assessment

Assessment date: 2026-10-29. Scope: repository source, checked-in configuration, local test topology, safe static checks and bounded tests against a disposable local PostgreSQL instance. The initial discovery assessment was followed by controlled local remediations recorded in `REMEDIATION_CHANGELOG.md`. No commits, pushes, deployments, production credentials, real transactions, public service probes, destructive operations against persistent/user data, or unbounded load were used.

## Status

This report is a **repository-level, preproduction assessment**, not a production penetration-test certificate. Dynamic authenticated tests could not be safely run: the gateway and backend services are not running, the repository Postgres is the only active Nantty dependency, and the required `GATEWAY_IDENTITY_SECRET` is unavailable in the shell. The existing preflight confirms the local/fake boundary. Other running local apps and the BetNG containers were excluded.

See [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ATTACK_SURFACE.md](ATTACK_SURFACE.md), and [FINDINGS.md](FINDINGS.md). The machine-readable list is [findings.json](findings.json); status and coverage are recorded in [TEST_COVERAGE.md](TEST_COVERAGE.md).

## Safe reproductions

From the repository root:

```sh
python3 security/authorization/routeInventory.py
python3 -m unittest discover -s security-audit/tests -v
```

At the initial assessment, static contracts failed for the Spaces gateway route and local ledger schema ownership gaps. Source remediations now pass all five static contracts. AUD-DB-001 additionally passed the focused runtime-role transaction test on disposable PostGIS; actual AWS role/task integration is still unverified. These are bounded local tests, not a production penetration-test certificate. Current results and deployment prerequisites are in [REMEDIATION_PROGRESS.md](REMEDIATION_PROGRESS.md); remaining manual/authenticated regression cases are in [RETEST_CHECKLIST.md](RETEST_CHECKLIST.md).

The route inventory script is heuristic. Review its source and manually classify results before treating any count as a vulnerability. No scanner output should be used without the validation notes in this report.

## Scope rules for any follow-up dynamic test

Use only explicitly approved loopback services from `infra/local/docker-compose.yml`, synthetic accounts/data, fake providers, bounded timeouts and request rates. Do not touch public Nantty hosts, AWS, payment/identity providers, the BetNG containers, or other local applications. For money paths, snapshot/restore gates and append-only invariants must remain active. Do not start live-service testing until the missing local gateway identity secret and isolated synthetic test accounts are safely provided.
