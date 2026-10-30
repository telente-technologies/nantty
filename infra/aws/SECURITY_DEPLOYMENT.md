# Secure ECS bootstrap

This is a fresh-bootstrap blueprint, not an AWS deployment. No apply was run.
Local Docker tests exercise HAProxy TLS, HTTP and gRPC transport, certificate
rotation and readiness. Terraform validation checks provider configuration.
Actual PCA issuance, IAM enforcement, Cloud Map and ECS replacement still need
staging acceptance after a future authorized deployment.

## Traffic and trust boundaries

```
internet --HTTPS--> public ALB --HTTPS:18443--> HAProxy --loopback--> app
app --loopback--> HAProxy --mTLS:19443--> peer HAProxy --loopback--> peer app
Go gRPC --loopback:29101/29103--> HAProxy --mTLS:19101/19103--> peer --loopback--> gRPC
```

HAProxy 3.2 LTS is an essential sidecar. Every remote listener requires TLS 1.2
or newer. Mesh listeners require a certificate from the environment's Private CA
and restrict its CN to configured caller identities. Clients verify the CA and
destination SAN using `verify required` and `verifyhost`. Cloud Map discovers
task IPs; HAProxy refreshes DNS and checks readiness. Thirty-two backend slots
cover the catalog's maximum rolling overlap of twenty-four tasks.

Only loopback carries plaintext within the task trust boundary; there is no
plaintext hop between task ENIs. Raw application, OTLP and debug ports have no SG
ingress. Service SGs allow mesh ports only from callers derived from Terraform
runtime wiring; gRPC callers are enumerated separately. Authorization tokens
remain required. Replicas share a service identity/key; this is service isolation,
not per-task or per-container identity.

The ALB-only TLS listener is admitted only from the public ALB SG. ALB does not
present a client certificate or validate backend chains. That leg is encrypted
with SG-based source isolation, not mutually authenticated TLS. Mesh callers
cannot access it. [AWS ALB target TLS behavior](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html).

The internal ALB and CodeDeploy canary were removed: direct mesh discovery would
bypass ALB canary weights. All services use ECS rolling deployment and circuit
breaker rollback; go-money also uses ledger-imbalance and public ALB error alarms.
Only public targets have ALB metrics; internal services retain task health, logs
and OTEL. The old weighted canary is not preserved.

The legacy self-hosted LiveKit host-network task has plaintext signaling and is
rejected by a Terraform precondition. This blueprint uses the existing default
`livekit_mode = "cloud"`; actual LiveKit Cloud credentials are required.
Aurora/RDS Proxy, Valkey and RabbitMQ retain their existing TLS settings.

## Certificate ownership, renewal and failure handling

Each environment owns one HSM-backed short-lived AWS Private CA. The root key
never enters Terraform state. Each service has a fixed-identity Lambda and one
Secrets Manager secret encrypted with the existing secrets CMK. Only its issuer
can write that secret or request certificates; event input cannot select a
different identity, SAN or secret. Task IAM only reads/decrypts its own certificate
secret and cannot issue or overwrite certificates. A compromised task remains
a compromised service identity; mTLS does not replace application authorization.

Terraform invokes each issuer at apply time, before creating ECS services, to
bootstrap certificates. Invocation results contain identity/expiry metadata, never
private keys. An issuer generates an EC P-256 key and CSR, obtains a seven-day
client/server certificate, verifies signature, SAN, matching key, EKUs and
lifetime, and atomically publishes it as AWSCURRENT. A daily EventBridge rule per
service renews when at most five days remain (about every two days), generating a
new key. Separate rules avoid EventBridge's per-rule target limit.

The proxy polls its own secret every sixty seconds, checks identity and its pinned
root, writes mode-0600 PEMs in a dedicated task volume, checks HAProxy config, and
gracefully reloads the master. Existing connections drain for at most one hour.
Rotation requires no ECS or application restart. Missing/bad initial certificates
prevent startup. Refresh failures retain the working certificate; readiness fails
six hours before expiry, and the supervisor exits before expiry. There is no
plaintext, verification-disabled or self-signed fallback.

ECS health performs an actual request through the mesh listener with mTLS,
checks the active certificate fingerprint, and exercises application readiness.
Public tasks also probe the ALB-facing TLS listener. ALB health checks use HTTPS
and the application's readiness endpoint. The gRPC servers have no standard
health RPC: HTTP readiness plus local gRPC TCP availability is the health
contract; the Docker test separately verifies the encrypted stream carries data.

Issuer errors and two days of missing successful renewal checks alarm to SNS.
Configure and confirm an operational recipient. The issuer checks the ten-year
root's expiry and fails ninety days before expiry to trigger that alarm. Leaf
rotation is automated; root rollover requires a coordinated deployment with
overlapping trust roots. Do not replace a live root using this single-root
bootstrap configuration without that overlap. Seven-day leaves use expiry rather
than CRL/OCSP revocation. [AWS short-lived CA guidance](https://aws.amazon.com/private-ca/faqs/).

The sidecar uses UID 0 to write its ECS volume, a read-only root filesystem and
all Linux capabilities dropped. Its certificate volume is not mounted into the
application or collector. The whole task/task role is the security boundary.

## Costs and bootstrap prerequisites

A short-lived CA costs **$50/month per environment**, plus **$0.058 per issued
leaf**. Fourteen services renewing about every two days produce roughly 210
leaves/month, about **$12.18** in issuance plus bootstrap/retries. Three
environments multiply the CA fixed cost by three.
[AWS Private CA pricing](https://aws.amazon.com/private-ca/pricing/).

Also budget for fourteen Secrets Manager secrets, reads at one per task per
minute, fourteen small Lambda functions/daily rules, twenty-eight renewal alarms,
custom metrics, KMS calls, logs, ECR storage/scanning and TLS CPU. Fargate task CPU
is doubled from the prior catalog; memory grows by at least 512 MiB and rounds to
a supported Fargate size. A 0.5-vCPU/1-GiB task becomes 1-vCPU/2-GiB; a
1-vCPU/2-GiB task becomes 2-vCPU/4-GiB. The proxy has 256 CPU units and a 512-MiB
limit. These are recurring compute increases, not a free sidecar. Removing the
internal ALB avoids its hourly/LCU charges. Obtain a regional estimate using the
actual replica count before provisioning.

Before a future bootstrap:

1. Confirm PCA/Lambda quotas and region support, account/DNS ownership, restricted
   admin CIDRs, alert recipients and service/LiveKit Cloud credentials. The
   provisioning principal needs PCA root activation, issuance and IAM/PassRole,
   Lambda invocation, EventBridge, Secrets Manager and existing ECS/KMS rights.
2. Run `bash infra/aws/tls-proxy/build-issuer.sh` on the Terraform host. It builds
   pinned Linux x86_64 wheels in a temporary directory and writes the ignored
   `infra/aws/tls-proxy/dist/issuer.zip`; host Python packages do not change.
   Rebuild after issuer changes. Missing artifacts fail the Terraform plan.
3. Provision registries/KMS prerequisites first, build/scan/push every service
   and `nantty/tls-proxy`, then start task services. ECS tasks are ARM64; image
   builds target `linux/arm64`. Review the full bootstrap plan and billing before
   separately authorizing an apply.
4. Complete isolated database migration and restore validation before deploying.
   If increasing task caps, also size proxy DNS slots for the rolling overlap.

The image script selects the latest active Terraform/CI task-family revision,
refuses definitions without an essential TLS proxy, and updates both app and
proxy image tags. Infrastructure/runtime changes must be applied to register the
new definitions before image deployment. The script cannot apply Terraform or
change service security groups. This work performed none of these AWS operations.

## Recovery gate and zero commission

Both environments require a migration definition, Aurora cluster ID and
`MIGRATION_RESTORE_JOB_ID_STAGING` / `MIGRATION_RESTORE_JOB_ID_PROD`. The mandatory
gate requires a completed, successfully validated AWS Backup restore within seven
days, an encrypted recovery point belonging to the exact source cluster, and a
distinct restored resource. It then verifies a fresh encrypted snapshot before
migration. A timestamp cannot satisfy this gate. An operational restore-validation
runner that checks representative schema/data invariants and reports to AWS
Backup remains a bootstrap prerequisite. The deploy role cannot mark restore
validation successful. Manual migration snapshots need a retention policy.

Go-money pins `ESCROW_FEE_BPS="0"` and `ESCROW_FEE_BUSINESS_PLAN_BPS="0"`.
Provider fees are not overridden.

## Local and future AWS acceptance checks

```
terraform fmt -check -recursive infra/aws
terraform -chdir=infra/aws/envs/dev validate
terraform -chdir=infra/aws/envs/staging validate
terraform -chdir=infra/aws/envs/prod validate
docker build -t nantty-tls-proxy:local infra/aws/tls-proxy
python3 infra/aws/tls-proxy/test_tls.py
bash .github/scripts/migrationSnapshotGate.test.sh
bash .github/scripts/runMigrationTask.test.sh
actionlint .github/workflows/deploy.yml
```

Docker tests use disposable local certificates and mock secret responses, never
AWS credentials. They cannot establish actual AWS issuance, IAM enforcement or
reachability. Staging acceptance must verify raw app ports are unreachable
between ENIs, allowed mesh calls succeed, disallowed identities fail, readiness
removes failed replicas, and real secret rotation reaches every task without a
restart. Test containers, their isolated network and temporary fixtures are
removed after the run.
