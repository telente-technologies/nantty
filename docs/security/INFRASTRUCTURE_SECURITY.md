# Nantty Infrastructure & CI/CD Security Assessment

- **Scope**: `infra/aws/` (Terraform modules & environments), `infra/aws/SECURITY_DEPLOYMENT.md`, and `.github/workflows/*.yml`.
- **Verification Basis**: Static HCL/YAML inspection & CI workflow audit. **Live AWS account/state, Terraform `plan`/`apply`, and Trivy/govulncheck network scans were NOT run in this sandbox.**

---

## 1. AWS Infrastructure Posture (`infra/aws/`)

| Module | Security Controls Observed | Notes / Status |
| --- | --- | --- |
| `storage` (`S3`) | `logs`, `media`, and `kyc` buckets enforce `aws_s3_bucket_public_access_block` (all 4 flags `true`), `DenyInsecureTransport` (`aws:SecureTransport=false`), bucket-owner-preferred/enforced ACLs, KMS/AES-256 encryption, and lifecycle expiry. | **Sound in HCL** |
| `kms`, `aurora`, `valkey`, `messaging` | Dedicated KMS CMKs, encrypted Aurora PostgreSQL and Valkey/RabbitMQ in private subnets, non-edge security groups scoped to internal VPC/service SGs. | **Sound in HCL** |
| `cloudfront-waf`, `edge`, `platform` | CloudFront + AWS WAF at edge; Smile ID webhook ingress constrained to documented `/32` IPv4 CIDRs per environment (`sandbox` vs `prod`). | **Sound in HCL** |
| `livekit` | Exposes `0.0.0.0/0` media/TURN ports intentionally for WebRTC media transport while keeping control APIs behind internal boundaries. | **Intentional / Documented** |
| `SECURITY_DEPLOYMENT.md` (`SEC-2026-011`) | Defines HAProxy 3.2 LTS edge/service mesh + AWS Private CA mTLS + ECS Fargate runtime architecture. | **BLOCKED_EXTERNAL** (awaiting AWS rollout) |

---

## 2. CI/CD & Supply-Chain Pipeline Audit (`.github/workflows/`)

### Strengths (`security.yml`)
- Full-history secret scanning via `gitleaks` (SHA-256 verified binary download + `.gitleaks.toml` + `.gitleaks-baseline.json`).
- Multi-ecosystem vulnerability auditing: `pnpm audit --prod --audit-level=high`, per-module Go `govulncheck`, Python `uv` + `pip-audit`, and Elixir `mix hex.audit`.
- Trivy filesystem (`vuln,secret,misconfig`) & Terraform (`fmt`, `validate`, `trivy-action` config scan) pinned to immutable SHA `ed142fd0673e97e23eac54620cfb913e5ce36c25`.

### Open Gaps
1. **`SEC-2026-008` (Medium — OPEN)**: `deploy.yml` builds and rolls out `gateway`, 6 Go deployables (`go-identity`, `go-money`, `go-commerce`, `go-ads`, `go-live`, `go-trust`), `social`, `media`, `notifications`, `support`, `search`, `realtime`, and `intelligence` — **`services/typescript/sandbox` is missing** from `deploy.yml` and has no Dockerfile/ECS target yet.
2. **`SEC-2026-009` (Medium — OPEN)**: Non-Trivy actions (`actions/checkout@v7.0.1`, `pnpm/action-setup@v6.1.0`, `actions/setup-node@v7.1.0`, `actions/setup-go@v7`, `astral-sh/setup-uv@v10.3.0`, `erlef/setup-beam@v1`, `hashicorp/setup-terraform@v4`, `aws-actions/*`) use version tags instead of immutable 40-char commit SHAs.
