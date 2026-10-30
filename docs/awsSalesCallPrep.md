# AWS Solutions Architect session brief — 4 November 2026

**Prepared:** 29 October 2026 (repository re-scan and AWS email research)
**Scope:** repository and publicly observable DNS/HTTP review; this is not an AWS account audit.
**Status:** AWS application infrastructure is a Terraform blueprint in this repository, not a verified live deployment. Do not present the planned stack, capacity, DR objectives, or compliance posture as already operating.

## First: confirm the meeting time

The email says **Wednesday, 4 November at 3:00 PM CEST**. Central Europe has returned to standard time by then: the European Commission’s published 2026 summer-time period ends on 25 October. On 4 November, **3:00 PM Europe/Berlin (CET) is 3:00 PM Lagos (WAT)**. If the sender means a literal fixed UTC+2 “CEST” time, it would instead be 2:00 PM in Lagos. Ask Maria to put the exact zone, preferably **15:00 Europe/Berlin**, on the calendar invite. [European Commission summer-time schedule](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A52021XC0427%2801%29)

## Executive brief

> Nantty is a Nigeria-first social-commerce product in active development; we are not ready for beta yet. The public marketing site is served through Cloudflare, while the application, mobile clients, and backend are being built in this repository. We have a substantial AWS design in Terraform, but it has not been applied and we cannot verify any AWS runtime from this machine. We would like your help choosing a region and DNS approach that work for Nigerian users, reducing initial operating cost without weakening payment or customer-data controls, and turning the proposed backup plan into a tested recovery process.

**Bring to the session:** expected beta scope and date (January is a target, not a commitment), 3/6/12-month active-user and traffic ranges, estimated video minutes/GB served, team/operator availability, known legal/data-residency advice, available AWS account IDs, and any existing AWS credits or Activate Provider details. Do not invent these figures if they are unknown; ask the SA which measurements they need.

## What I could and could not verify

| Claim | Evidence and status |
| --- | --- |
| Public main domain works | https://nantty.com returned HTTP 200 during this review on 28 October 2026. This proves only that the public site answered, not its hosting configuration or application health. |
| Cloudflare is authoritative for the root domain | A live NS lookup returned lewis.ns.cloudflare.com and rayne.ns.cloudflare.com. |
| Proposed AWS API/media endpoints are not currently live | api.nantty.com and media.nantty.com did not resolve during this review. |
| AWS resources exist | **Not verified.** aws sts get-caller-identity failed because no AWS credentials are configured in this environment. The repository’s [AWS README](../infra/aws/README.md) states the Terraform was written/formatted/validated and never applied. |
| Terraform state / deployed resource inventory | **Not verified.** The prod S3 backend is not initialized locally; terraform state list requires terraform init. I did not initialize it, access an AWS account, run a plan, or apply anything. |
| Static Terraform quality | `terraform fmt -check -recursive infra/aws` and `terraform validate -no-color` from `infra/aws/envs/prod` passed during the 29 October re-scan. No AWS-backed plan, state inspection, security assessment, or acceptance test was run. |

**Bottom line:** treat all AWS items below as *configured in source / proposed*. The live AWS account, quotas, DNS records, secrets, resource state, and billed costs remain unknown until the owner grants access and AWS confirms them.

## System as currently designed

**Current state vs. proposed AWS state:**

~~~text
OBSERVED NOW
People ──> nantty.com / marketing pages ──> Cloudflare DNS/CDN (HTTP 200 observed)
                   API hosting, AWS resources, and AWS DNS: not verified

PROPOSED IN TERRAFORM (not applied)
Web/mobile clients ── HTTPS ──> eu-west-1 ALB + WAF ──> Fastify gateway
                                       └─ /ws ──> Phoenix realtime
     Gateway ── private service mesh (TLS/mTLS sidecars) ──> Go / TypeScript / Python services
              ├── Aurora PostgreSQL via RDS Proxy
              ├── Valkey + Amazon MQ/RabbitMQ
              └── encrypted S3 ──> CloudFront media CDN
     External providers: Flutterwave · LiveKit Cloud · Smile ID · SES · Apple/Google IAP
     GitHub Actions ── OIDC ──> ECR ──> ECS/Fargate
     Proposed DR in eu-central-1: backups/replicas; no standby ECS stack is defined

DNS warning: Terraform proposes Route 53 for the root domain, while Cloudflare is authoritative today.
~~~

~~~text
Mobile (Expo) ─┐
Web clients ───┼── HTTPS ──> public ALB + WAF ──> gateway (Fastify/TypeScript)
Realtime ──────┘                  └─ /ws ───────> realtime (Phoenix/Elixir)
                                      │
                                      ├── Go: identity, commerce, money, live, ads, trust
                                      ├── TypeScript: social, notifications, media, search, support
                                      └── Python: intelligence / moderation scoring
                                                │
                         Aurora PostgreSQL (+ RDS Proxy), Valkey, RabbitMQ
                         private encrypted S3 buckets ──> CloudFront media CDN
                                                │
                   Flutterwave, SES, LiveKit Cloud, Apple/Google IAP, Smile ID

Public marketing pages / root DNS: Cloudflare (observed)
AWS Route 53, ALB, API/media hostnames: Terraform proposal (not live verified)
GitHub Actions ── OIDC ──> ECR / ECS (configured workflow; account variables required)
~~~

This is a multi-service design, not a deployed or load-tested system. Six TypeScript deployables declare the shared @nantty/fastify-platform package in their manifests. AWS configuration lists 14 ECS/Fargate deployables: gateway; six Go services; five other TypeScript services; realtime; and intelligence. Production Terraform sets a minimum of two tasks for every catalog service except intelligence, which starts at one: **27 minimum desired tasks if applied**, before autoscaling. Each task includes the application, an essential TLS proxy sidecar, and by default an OpenTelemetry collector sidecar. The production minimum is materially larger and costlier than “14 small services”; it is not a live task count.

### Launch traffic assumptions for AWS sizing (not a forecast)

No real traffic telemetry exists because AWS has not been deployed and Nantty is not yet in beta. Use these as **load-test envelopes** for a first Nigeria beta discussion, not investor or launch commitments. Replace them with the founder's invite list and product analytics before approving capacity:

| Scenario | Registered accounts | Daily active users | Peak concurrent users | API peak target | Concurrent Nantty Spaces (voice) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Small invite pilot | 500–1,000 | 100–250 | 25–60 | 10–25 requests/s | 2–5 × 20–30 listeners |
| Beta headroom test | 2,000–5,000 | 400–1,000 | 100–250 | 40–100 requests/s | 5–10 × 30–50 listeners |
| Stress test, not expected launch | 10,000 | 2,000 | 500 | 200 requests/s | 10–20 × 100 listeners |

For clip delivery, model CDN egress separately from API load: at 100 DAU × 10 minutes watched/day × 1 Mbps average delivered bitrate × 30 days, playback is about **225 GB/month**; at 1,000 DAU × 30 minutes × 1.5 Mbps it is about **10.1 TB/month**, before retries, caching misses, thumbnails, uploads, and other assets. This estimate uses 7.5 MB per minute per Mbps. Nantty Spaces are voice-only and use LiveKit Cloud in the current Terraform design; confirm whether its participant-minute/egress bill is separate from AWS credits. Live video should not be included in beta capacity unless product scope changes.

For the AWS SA, ask for a minimal-beta quote using the small-pilot envelope, then a 5× burst sensitivity case. Current production Terraform still starts **27 tasks across 14 services**, plus sidecars and managed data services; that is a configuration fact, not an empirically justified beta minimum. Ask whether to collapse/suspend non-critical services or reduce minima for beta, while keeping payment and identity paths highly available.

### Proposed AWS components

- **Primary/DR regions:** eu-west-1 (Ireland) primary and eu-central-1 (Frankfurt) DR in production variables. Dev and staging are also configured in Ireland. No Cape Town or Lagos workload is configured in the current environment files.
- **Compute and edge:** private ARM64 Fargate tasks, public ALB/WAF for gateway and WebSocket ingress, Cloud Map for internal discovery, per-service security groups, rolling ECS deploys with circuit-breaker rollback.
- **Internal transport:** essential HAProxy sidecar terminates TLS at the ALB and provides mTLS between tasks; plaintext is confined to loopback within a task. This is a significant additional moving part and capacity/cost load; validate it with AWS and a staging test before calling the design production-ready.
- **Database:** one Aurora PostgreSQL cluster per environment, in three data subnets; production specifies one db.r7g.xlarge writer plus two same-cluster readers, 35-day PITR, deletion protection, and a TLS-required RDS Proxy. Services use separate schema roles. The IaC enables IAM database authentication on Aurora but configures the proxy to authenticate using Secrets Manager passwords (IAM disabled); ask whether this is intentional and how runtime DB grants are created and rotated.
- **Cache and queues:** production Valkey cache.r7g.large with three nodes, plus a separate small Valkey group for intelligence; Amazon MQ RabbitMQ CLUSTER_MULTI_AZ using mq.m7g.large. Dev and staging also specify three NAT gateways each (three AZs, nat_per_az=true), so non-production networking has a potentially significant baseline cost.
- **Media and email:** versioned, encrypted S3 buckets for uploads/public/private content and KYC, CloudFront with OAC and WAF, S3 cross-region replication, SES with SNS/SQS feedback processing. LiveKit is configured as **LiveKit Cloud**, not AWS IVS or a self-hosted AWS media plane. Flutterwave is the only configured payment provider; external provider spend and availability remain separate dependencies.
- **Security/telemetry:** KMS keys by purpose, Secrets Manager, per-service task/execution roles, GitHub OIDC, WAF, CloudWatch metrics/logs/alarms/dashboard, OTel to X-Ray/EMF. alarm_email defaults empty and is not set in the checked-in environment tfvars, so the email subscription is absent until configured. Production tracing samples 10% per its environment wiring.
- **No Organization/bootstrap automation found:** Terraform has three environment roots and describes separate AWS accounts, but there is no aws_organizations or account-vending resource in infra/aws. Account creation, organizational guardrails, SSO, account IDs, and cross-account access therefore need confirmation outside this stack.

### What Maria's email does and does not establish

The Activate Provider intro is **in progress**, not a credit award or eligibility guarantee. AWS currently describes Founders as starting at $1,000 (select participants can qualify for up to $5,000) and Portfolio as up to $200,000 with a provider Org ID and approval. AWS lists broad eligibility including Pre-Series B, founded within 10 years, paid-tier AWS account, and new to credits or asking for more than previously received. Ask Maria for the provider-intro timeline; ask the provider for the correct Org ID, application package, amount, expiration, covered AWS line items, exclusions, and whether the credits attach to the intended billing account. Do not budget as if the maximum will be approved. [AWS Activate tiers](https://aws.amazon.com/startups/credits), [AWS Activate application guidance](https://aws.amazon.com/aws-startups/learn/applying-for-aws-activate-credits-a-step-by-step-guide/)

The linked AWS Nigeria compliance page says it is directed at **financial-institution customers** and still lists the 2022 Nigeria Data Protection Bill / NDPR implementation framework. Do not use that page as a current legal determination for Nantty. The NDPC identifies the Nigeria Data Protection Act 2023; ask AWS for its DPA, shared-responsibility mapping, and Artifact reports, then have Nigerian counsel assess Nantty's actual processing and international transfers. AWS certifications and reports evidence AWS controls, not Nantty's compliance. [AWS Nigeria compliance page](https://aws.amazon.com/financial-services/security-compliance/compliance-center/ng/), [NDPC NDP Act 2023](https://www.ndpc.gov.ng/ndp-act-2023/), [AWS Artifact](https://aws.amazon.com/artifact/)

## Findings to raise first

### P0 — DNS ownership conflicts with the proposed AWS deployment

Cloudflare currently answers for nantty.com. Production Terraform sets create_zone=true for a Route 53 **root nantty.com zone**, and the DNS module creates API/media records and ACM validation records inside that Route 53 zone. A newly created Route 53 zone is not authoritative while the registrar still delegates to Cloudflare. The current API and media hostnames also do not resolve.

**Do not apply the current DNS setup as if it will automatically publish API/media records.** Ask AWS to review one of these intentional designs:

1. Keep Cloudflare authoritative; manage api and media records plus ACM DNS validation in Cloudflare (with scoped automation), while AWS provides the ALB/CloudFront targets; or
2. Delegate only selected subdomains (for example api.nantty.com and media.nantty.com) to Route 53 and keep root and marketing on Cloudflare.

Confirm certificate validation, proxy/orange-cloud behavior versus DNS-only records, health checks, failover, and exactly one DNS source of truth. AWS Route 53 root takeover is not implied by current ownership.

### P0 — The Lagos Local Zone cannot host the present Fargate/Aurora architecture

The Lagos Local Zone is af-south-1-los-1a, attached to parent Region af-south-1 (Cape Town). AWS documents that ECS on **Fargate is not supported in Local Zones**; Aurora does not support Local Zones either. Regional Fargate is supported in Cape Town, and AWS lists RDS Proxy and Amazon MQ regional support there, but exact engine/version, service quota, capacity, and pricing still need checking. [Lagos Local Zone location](https://aws.amazon.com/about-aws/global-infrastructure/localzones/locations/), [ECS Local Zone/Fargate limitation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cluster-regions-zones.html), [Aurora Local Zone limitation](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.RegionsAndAvailabilityZones.html), [Fargate Region support](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate-Regions.html), [RDS Proxy support](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RDS_Fea_Regions_DB-eng.Feature.RDSProxy.html), [Amazon MQ Region endpoints](https://docs.aws.amazon.com/general/latest/gr/amazon-mq.html).

Ask for a measured comparison, not a blanket “Cape Town is closer” assumption:

- eu-west-1 current design vs a full af-south-1 regional stack;
- if meaningful, EC2-backed ECS in the Lagos Local Zone for selected stateless/latency-sensitive services, with databases/managed services in the parent Region;
- end-to-end p50/p95/p99 from Lagos and Abuja on major Nigerian mobile networks, including app → API → database round trips, not only client-to-edge ping;
- exact availability, quotas, instance classes, support and cost implications. A Local Zone application tier can lose its latency advantage if every request waits on a database in Cape Town.

AWS confirms the Lagos Local Zone and parent Region, but do **not** assume every service listed for the Local Zone means Fargate or Aurora is available there. [AWS Local Zone service features](https://aws.amazon.com/about-aws/global-infrastructure/localzones/features/).

### P0 — The checked-in multi-AZ RabbitMQ definition has a subnet mismatch

Production requests `CLUSTER_MULTI_AZ`, but `infra/aws/modules/messaging/main.tf` passes only `private_subnet_ids[0]` to the broker. AWS describes a RabbitMQ cluster as three nodes across three Availability Zones; the Terraform does not express the requested topology and may fail broker creation. Resolve the subnet configuration and run a provider-backed plan before applying. [Amazon MQ RabbitMQ cluster architecture](https://docs.aws.amazon.com/amazon-mq/latest/developer-guide/rabbitmq-broker-architecture.html), [Terraform Amazon MQ broker resource](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/mq_broker.html)

### P1 — Security-group egress remains broad despite the new per-service rules

The shared task security group permits HTTPS egress to `0.0.0.0/0` and is attached alongside service-specific groups. Security-group permissions are additive, so the narrower per-service groups cannot remove the shared group's broad HTTPS permission. `go-money` also defaults `payments_internet_egress_cidrs` to `0.0.0.0/0`. Treat this as an egress-control gap; ask AWS about VPC endpoints, an egress proxy/firewall, and provider destination allowlisting. Do not describe service-specific groups as complete outbound isolation yet.

### P1 — Regional DR does not cover every stateful dependency or provide a second account

The DR provider alias changes Region but uses the same environment credentials/account. Aurora backups, S3/ECR replication, and Secrets Manager replicas are configured, but I found no Organizations/account bootstrap, and Amazon MQ has no cross-region broker or replication configuration. Valkey is a rebuildable cache; queue durability/replay needs an explicit design if Frankfurt recovery is required. Confirm the recovery account boundary, MQ recovery/replay strategy, DNS cutover, and which services/data are deliberately excluded.

### P1 — DR is backup/restore, not a ready warm region; runbook and Terraform disagree

Production enables cross-region Aurora backups, S3 replication, ECR replication, secret replicas, and a DR KMS module in Frankfurt. The actual production module creates one primary ECS cluster; I found no separate DR ECS/service root under infra/aws/envs. The environment provider alias points to another Region, not a separately defined account. Thus the configured pattern is **backup/replication plus rebuild**, not active-active or a pre-running warm application stack.

The dated [DR design](architecture/disaster-recovery.md) says all its RPO/RTOs and restore drills are proposed, and calls for terraform apply envs/production-dr; no production-dr folder exists (the current roots are dev, staging, prod). Its table proposes a four-hour regional-loss RTO, but this has not been demonstrated. Meanwhile, the current deploy workflow requires an AWS Backup restore job marked ValidationStatus=SUCCESSFUL in the last seven days and a fresh encrypted snapshot before migrations. The current security guide says a separate operational runner must check representative schema/data invariants; the workflow itself validates AWS Backup status/resource metadata.

Ask the SA to agree a realistic RPO/RTO for payment ledger, orders, identity, media, and stateless services; define the actual Frankfurt recovery stack and DNS cutover; identify who owns restore validation and data-invariant checks; and schedule a timed restore exercise before launch. Do not describe proposed targets as achieved.

### P1 — Current checked-in variables deliberately block non-dev apply

- admin_ip_allow_list defaults empty. A Terraform precondition rejects staging and production without a trusted fixed CIDR. That is a good fail-closed guard, but both checked-in tfvars only have a commented example. Supply and verify the actual office/VPN egress CIDRs before planning/applying; never use 0.0.0.0/0.
- alarm_email is empty by default and no environment tfvars sets it, so alarms have no email subscription. Choose a monitored destination and test delivery.
- Production promotion_source_account_id is empty, while production is intended to promote exact images from the staging registry. The staging account ID and cross-account ECR permissions must be supplied.
- The TLS issuer ZIP is an apply prerequisite generated by infra/aws/tls-proxy/build-issuer.sh. The environment README also calls for remote S3 state/lock-table bootstrap, Secrets Manager values, database role/schema grants, RabbitMQ users/topology, PCA issuer package, Flutterwave and LiveKit credentials, DNS setup, and GitHub environment variables/reviewers. These are not evidenced as completed.
- The workflow can scan/build images without AWS account variables, but ECR push and staging deployment are gated on AWS_ACCOUNT_ID_STAGING. Production requires AWS OIDC, account IDs, migration definitions, VPC/subnet/security-group variables, API URLs, a recent validated restore job, and GitHub environment protections. Their live values are not inspectable here.

### P1 — There is no Terraform apply pipeline in the workflow inventory

The repository has a service deploy workflow, but .github/workflows has no infrastructure plan/apply workflow. That deployment workflow builds and rolls out application images; it is not an AWS Terraform apply. Terraform is currently a manual/bootstrap process in the [AWS README](../infra/aws/README.md). Ask whether the intended operating model is protected manual Terraform runs, or an approved IaC pipeline with plan review, state locking, drift detection, and tightly controlled apply.

### P1 — AWS architecture docs have drifted from current Terraform

The [AWS README](../infra/aws/README.md) says service-to-service traffic uses an internal ALB and go-money uses CodeDeploy blue/green canary deployment. The current Terraform wiring sets blue_green=false for every service, and [SECURITY_DEPLOYMENT.md](../infra/aws/SECURITY_DEPLOYMENT.md) says the internal ALB and CodeDeploy canary were removed; current deployments are ECS rolling with circuit-breaker rollback. The older [DevOps architecture page](architecture/devops.md) also describes old CI gaps and blue/green as proposed. Current code is stronger evidence; update conflicting docs before anyone uses them as an ops runbook.

### P1 — Cost estimate in the old meeting note is not safe to quote

The earlier rough $1,500–$4,500/month estimate predates the current sidecar design and is not an AWS quote. Cost drivers include 27 minimum production Fargate tasks with proxy/collector sidecars; three NAT gateways in each environment; Aurora writer/readers and RDS Proxy; multi-AZ RabbitMQ; Valkey; WAF/ALB/endpoints; CloudWatch/X-Ray; S3/CloudFront and video data transfer; and AWS Private CA issuance/rotation.

The current TLS design uses one short-lived CA per environment ($50/CA/month), plus $0.058 per issued leaf certificate. Its documented rough rotation is around 210 leaf certificates/month per environment (about $12.18 in issuance, before bootstrap/retries); three enabled environments would make the CA fixed charge $150/month, plus certificate issuance and other services. Treat this as only a component estimate, not total cloud spend. [AWS Private CA pricing](https://aws.amazon.com/private-ca/pricing/).

Ask the SA to prepare a **line-item estimate from Terraform inputs** with separate dev/staging/prod and low/base/high traffic cases. Include video minutes, CDN egress, image processing/moderation calls, NAT and inter-region transfer. Use actual AWS Pricing Calculator output and agreed assumptions before approving anything. AWS credits do not make an uneconomic architecture sustainable after they expire.

## Questions for the Solutions Architect

### Start with these five decisions

1. **Lagos latency:** Can AWS run an agreed end-to-end p50/p95/p99 test from Lagos and Abuja on major Nigerian mobile networks against Ireland, Cape Town, and (only if useful) selected EC2-backed compute in Lagos Local Zone? Include the app/API/database path and Cloudflare DNS/proxy path, not just an ICMP or edge ping.
2. **Service availability:** For the exact proposed versions, which components are supported in `af-south-1`—ECS/Fargate ARM64, Aurora PostgreSQL 17.4, RDS Proxy, Amazon MQ RabbitMQ `CLUSTER_MULTI_AZ`, Valkey, SES, ACM Private CA, WAF, Rekognition, and Transcribe? Which lack quotas, capacity, or feature parity, and what extra cross-region data transfer would a hybrid incur?
3. **Disaster recovery:** With no live AWS stack and no standby ECS environment in Terraform, what scoped pilot-light/rebuild design would meet an agreed RPO/RTO for ledger/orders/identity? Include Aurora restore time, missing MQ recovery, the separate AWS account question, validation of ledger/order invariants, and tested Cloudflare DNS cutover.
4. **Security:** How should we keep Cloudflare authoritative without breaking ALB certificate validation; avoid shared task-SG HTTPS egress bypassing service-level controls; restrict admin access safely; protect secrets/state; and prove restore and migration safety before production?
5. **Cost:** Price the small invite-pilot envelope below plus 5× burst, itemized by region and dev/staging/prod. Show Fargate+sidecars, Aurora/RDS Proxy, MQ, Valkey, NAT/endpoints, WAF/ALB, logs/PCA, S3/CloudFront video egress, cross-region copies, and separately identify LiveKit Cloud and charges Activate credits do not offset.

### Region, latency, and DNS

1. Which deployment do you recommend for Nigeria-first beta, and what end-to-end p50/p95/p99 latency evidence supports it: Ireland, Cape Town Region, or a hybrid with selected Lagos Local Zone compute?
2. Which exact services, instance types, AZs, quotas, and engine versions are available in af-south-1 today for this Terraform configuration (Aurora PostgreSQL 17.4, RDS Proxy, Fargate ARM64, Amazon MQ, Valkey, PCA, WAF, SES, Rekognition, Transcribe)?
3. Given that the root domain is currently on Cloudflare DNS, what DNS ownership/delegation pattern do you recommend for AWS API and media hostnames? How should ACM validation and health/failover records work without disrupting the Cloudflare-hosted marketing site?
4. Would EC2-backed ECS in af-south-1-los-1a be a reasonable isolated experiment for one latency-sensitive stateless service? What is the database RTT penalty and operational cost compared with regional Fargate?

### Data, resilience, and security

5. Is one shared Aurora cluster with separate schemas/roles appropriate for these 14 deployables at beta? What DB parameter, connection pool, RDS Proxy pinning, reader-routing and migration tests should be completed first?
6. Are IAM database authentication and proxy password authentication intentionally mixed? How should database service roles and schema grants be created, rotated, audited, and protected from Terraform-state exposure?
7. Does the proposed multi-AZ RabbitMQ cluster match our durability and cost needs, or should transactional outbox consumers use a managed alternative at beta? What is the migration and failure-mode cost?
8. What concrete, testable RPO/RTO can AWS support for Aurora, payments/ledger, orders, media and stateless compute with the current backup/restore design? What would a pilot light add in monthly cost?
9. How should we prove a restored database is logically sound (balanced trial balance, no orphan/negative balances, order-payment invariants) and make that a gate before migrations?
10. Is the task-level mTLS/TLS-proxy architecture a good fit for ECS/Fargate? Review certificate issuance/rotation rate, identity sharing among service replicas, PCA/Lambda quotas, task memory/CPU, monitoring and simpler alternatives.
11. What AWS account structure and guardrails should we set up before dev/staging/prod—Organizations, IAM Identity Center/SSO, CloudTrail organization trail, Security Hub, GuardDuty, Config, central log archive, SCPs, billing alerts and budget limits?
12. What changes are needed to restrict task internet egress? Current task security groups allow TCP 443 to 0.0.0.0/0; payment-provider egress is separately configurable but also defaults open. Which AWS endpoints and provider destinations can be safely allowlisted?
13. Is the current WAF, admin CIDR gate, KYC separation/Object Lock, KMS, and webhook verification design sufficient for beta? Which controls require separate AWS account evidence versus code/IaC evidence?

### Cost, operations, and programmes

14. Please provide a region-specific monthly estimate with line items and assumptions for a minimal beta, realistic growth, and video-heavy usage. Include costs that credits may not cover, egress, NAT, log ingestion/retention, PCA, and cross-region copies.
15. Which default quotas or account restrictions need requests before a pilot (Fargate vCPU, ENIs/IPs, ALB targets, Aurora, MQ, SES sending, Rekognition/Transcribe, PCA, CloudFront)?
16. What is required to get SES production access and verify sending reputation and complaint/bounce handling?
17. Which AWS Activate Provider introduction is being arranged; what are the application steps, credit amount, expiry/eligible services, account requirements, and whether Cloudflare/LiveKit/Flutterwave/non-AWS services are excluded?
18. Can AWS provide a Well-Architected startup review and follow-up written action list, with owners and target dates?

## Decisions to make in the meeting (not before)

- Primary AWS Region and whether Lagos Local Zone has any narrowly scoped role.
- Keep Cloudflare as authoritative DNS, or delegate specific subdomains; ownership of records and ACM validation.
- Beta scale profile and cost ceiling; do not commit to reserved capacity/Savings Plans or an EDP without measured usage.
- DR target and whether backup-and-restore is acceptable; who runs/validates the drill.
- Whether existing RabbitMQ, Valkey, LiveKit Cloud, and TLS sidecar decisions are right at beta scale.
- AWS account structure, access model, operations ownership, alarms/on-call destination, and IaC apply approval path.
- Activate Provider introduction, credit terms, SES production access, and named AWS technical/account contacts.

## What to avoid claiming or agreeing to

- Do not say AWS application infrastructure is deployed, the API/media endpoints are operational, or that a restore drill has met the written RPO/RTO.
- Do not say the Lagos Local Zone can run the current Fargate/Aurora stack.
- Do not repeat the old $1,500–$4,500 estimate as a quote.
- Do not claim NDPA/GDPR compliance from encryption or AWS certifications; have qualified Nigerian counsel decide applicable legal duties, transfer basis, retention, and processor terms.
- Do not accept a paid commitment, broad account access, or root-domain DNS takeover without costed scope, explicit review, rollback plan, and domain-owner approval.

## Pre-meeting checklist

- [ ] Ask Maria to confirm 15:00 Europe/Berlin (CET) on 4 November, which is 15:00 Africa/Lagos (WAT).
- [ ] Share this brief and current infra/aws Terraform only through an approved channel; do not email secrets, state files, customer records, or credentials.
- [ ] Prepare low/base/high user, request, upload, and video-usage ranges.
- [ ] Decide who owns Cloudflare DNS and provide the present delegation facts (nantty.com is Cloudflare-authoritative).
- [ ] Locate AWS account IDs, billing owner, current credits and Activate application status; if no accounts exist yet, say so.
- [ ] Ask the team for actual admin/VPN egress CIDRs and a monitored alarm/on-call address; do not guess.
- [ ] List outstanding dependencies: state bucket/lock bootstrap, Secrets Manager population, DB schema grants, RabbitMQ setup, PCA issuer package, GitHub OIDC/environment variables, restore validator, and SES production request.
- [ ] Capture meeting outcomes as named decisions, assumptions, owners, due dates, costs, and AWS follow-up links.

## Repository evidence to bring

- [AWS infrastructure README](../infra/aws/README.md) — account/bootstrap and proposed components; contains stale internal-ALB/CodeDeploy sections that conflict with current code.
- [Secure ECS bootstrap](../infra/aws/SECURITY_DEPLOYMENT.md) — current TLS sidecars, costs, prerequisites, and restore gate.
- [Production variables](../infra/aws/envs/prod/terraform.tfvars) — region, sizes, retention, DR, and missing admin CIDR/promotion account.
- [Service catalog and runtime wiring](../infra/aws/modules/platform/services.tf), [deployment wiring](../infra/aws/modules/platform/deploy.tf), and [task definition](../infra/aws/modules/ecs-service/main.tf).
- [DNS module](../infra/aws/modules/dns/main.tf) and [records](../infra/aws/modules/dns/records.tf) — Route 53 is configured to create a root zone and own API/media records.
- [DR architecture](architecture/disaster-recovery.md) — useful proposed targets, but it names a nonexistent production-dr environment and must not be treated as an executed runbook.
- [Service architecture](architecture/system.md) — product/data/service boundaries; dated and subordinate to current code.
- [Service deployment workflow](../.github/workflows/deploy.yml) and [restore snapshot gate](../.github/scripts/migrationSnapshotGate.sh).

## Official AWS references

- [AWS Local Zones locations — Lagos code and parent Region](https://aws.amazon.com/about-aws/global-infrastructure/localzones/locations/)
- [AWS Local Zones features/service availability](https://aws.amazon.com/about-aws/global-infrastructure/localzones/features/)
- [ECS in Local Zones — Fargate restriction](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cluster-regions-zones.html)
- [Aurora Regions/AZs — Local Zones unsupported](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.RegionsAndAvailabilityZones.html)
- [Fargate regional availability](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate-Regions.html)
- [RDS Proxy supported Regions/engines](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RDS_Fea_Regions_DB-eng.Feature.RDSProxy.html)
- [Amazon MQ endpoints/Regions](https://docs.aws.amazon.com/general/latest/gr/amazon-mq.html)
- [AWS Private CA pricing](https://aws.amazon.com/private-ca/pricing/)
- [AWS Activate credits overview](https://aws.amazon.com/startups/credits)
- [AWS Nigeria compliance resources](https://aws.amazon.com/financial-services/security-compliance/compliance-center/ng/)
- [AWS Data Privacy](https://aws.amazon.com/compliance/data-privacy/)
