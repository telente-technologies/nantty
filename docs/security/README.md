# Nantty Security Audit & Blue-Team Hardening (November 2026)

This directory contains the end-to-end offensive security review, Blue Team remediations, and regression test verification conducted across the `telente-technologies/nantty` monorepo on branch `arena/341bf572-nantty`.

## Documents

- [`AUDIT_REPORT_2026-11-20.md`](./AUDIT_REPORT_2026-11-20.md): Full-stack architectural security review, domain-by-domain control verification, attack-surface findings, and test execution matrix.
- [`REMEDIATION_CHANGELOG.md`](./REMEDIATION_CHANGELOG.md): Detailed ledger of newly discovered findings (`SEC-0025`–`SEC-0032`), implemented Blue Team fixes, cleared non-issues, and permanent regression tests.

## Related Security Documentation

- [`../../SECURITY.md`](../../SECURITY.md) — Vulnerability disclosure policy and supported surfaces.
- [`../../docs/architecture/security.md`](../architecture/security.md) — Platform security architecture.
- [`../../infra/aws/SECURITY_DEPLOYMENT.md`](../../infra/aws/SECURITY_DEPLOYMENT.md) — AWS ECS/HAProxy 3.2 LTS mTLS mesh and network controls.
- [`../../security/audit/reports/FINDINGS.md`](../../security/audit/reports/FINDINGS.md) — Baseline `SEC-0001`–`SEC-0024` audit ledger.
