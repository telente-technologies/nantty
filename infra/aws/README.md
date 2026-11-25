# AWS infrastructure (Terraform)

Nantty uses the existing `nantty` infrastructure identifiers in this configuration. Keep resource names, DNS records,
state bucket names, IAM policies, and secret paths aligned with deployed environments until they have a planned migration.

Written, formatted and validated, never applied. Nothing here talks to AWS until someone runs `terraform apply` in an
environment account. One AWS account per environment (`nantty-dev`, `nantty-staging`, `nantty-prod`), one state per
environment. Architecture rationale: `docs/architecture/devops.md` and `docs/architecture/disaster-recovery.md`.

```
infra/aws/
  modules/
    platform/       composition: wires every module below from a handful of variables, owns the service catalog
    network/        VPC, public/private/data subnets, NAT (single or per AZ), S3 gateway + interface endpoints, REJECT flow logs
    kms/            one rotated key per purpose: data, secrets, logs, kyc, ecr, backup, sns
    storage/        S3 media, private KYC (Object Lock, KMS, TLS only), logs; CloudFront + OAC (+ signed URLs); CRR to the DR region
    dns/            Cloudflare authoritative app/API records and ACM validation; Route 53 shadow zone remains for state compatibility
    edge/           public ALB + WAF (managed rules, auth/global rate rules, Flutterwave webhook hash + rate rules, /internal block), internal ALB + private zone
    ecs-cluster/    Fargate cluster, Container Insights, Cloud Map namespace
    ecs-service/    task def, roles, log group, target group + rules, autoscaling, ECS rolling or CodeDeploy blue/green
    aurora/         Aurora PostgreSQL cluster, RDS Proxy (writer + reader endpoints), AWS Backup with cross-region copy
    valkey/         ElastiCache Valkey replication group (TLS + AUTH), URL secret
    messaging/      Amazon MQ for RabbitMQ (cluster or single instance), admin + per-service user secrets
    ses/            domain identity, DKIM, MAIL FROM, DMARC, configuration set, SNS -> SQS feedback queue
  livekit/        LiveKit credentials secret; optional self-hosted LiveKit on EC2-backed ECS
  clamav/         pinned official ClamAV image and media scan limits (built into ECR, run as a private media-task sidecar)
    observability/  SNS alarm topic, ALB/ECS/Aurora/Valkey/MQ/SES/ledger alarms, dashboard
    github-oidc/    GitHub OIDC provider, ECR push role (main only), deploy role (environment claim only)
  envs/{dev,staging,prod}/   backend.tf, providers.tf, main.tf (one module call), variables.tf, terraform.tfvars
```

## What gets deployed

Fourteen Fargate services, all private, no public IPs: `gateway`, `go-identity`, `go-commerce`, `go-money`, `go-live`,
`go-ads`, `go-trust`, `social`, `notifications`, `media`, `search`, `support`, `realtime`, `intelligence`. ECR repositories are
`nantty/<service>` (immutable tags, scan on push, KMS, lifecycle, replicated to the DR region in prod) plus
`nantty/migrate` for the pre-deploy migration task and `nantty/clamav` for the optional media malware-scanning sidecar.

| Path | Target |
| --- | --- |
| public ALB `/ws*` (priority 20) | `realtime` |
| public ALB `/*` (priority 100) | `gateway` |
| internal ALB, host `<service>.svc.<env>.nantty.internal` | each service (HTTP inside the VPC), health checks per target group |

Provider webhooks (`/webhooks/*`) enter through the gateway, which routes them only to `go-money` and passes the raw
request bytes and the `verif-hash` header through untouched (gateway test `webhook passthrough`). Flutterwave is the only
payment provider. The WAF refuses `/webhooks/flutterwave` requests without a `verif-hash` header, rate-limits that path
(`flutterwave_webhook_rate_limit_per_five_minutes`), redacts the header from WAF logs, and blocks any `/internal` path. This replaces the older plan of
an ALB rule straight to go-money, which cannot coexist with CodeDeploy blue/green on the money service.

`go-money` uses CodeDeploy blue/green (10 percent canary for 5 minutes) with automatic rollback on the ledger
imbalance alarm and the ALB 5xx alarm. Every other service uses ECS rolling deploys (100/200 percent, circuit breaker with
rollback). Terraform ignores `task_definition` and `desired_count` after creation; CI registers new task definitions.

Security groups: one task group, data stores accept only that group, ALB groups accept the internet only on 80/443.
Task roles are per service and least privilege (S3 prefixes, KMS keys, SES identity, SQS feedback queue); execution roles
read only their own secrets. ECS Exec is off unless `enable_execute_command = true`.

LiveKit: `livekit_mode = "cloud"` (default) creates `nantty/<env>/livekit` with placeholders to replace with your
LiveKit Cloud project URL, key and secret. `self_hosted` runs LiveKit on EC2-backed ECS with host networking behind
`livekit.<app_domain>` (signaling via the ALB, media on 7881/tcp and 7882/udp straight to the instance).

## Variables (envs/*/variables.tf, values in terraform.tfvars)

| Variable | Default | Meaning |
| --- | --- | --- |
| `environment` | required | `dev`, `staging` or `prod` |
| `region` / `dr_region` | required / `eu-central-1` | primary and DR regions |
| `enable_dr` | `false` (true in prod) | AWS Backup cross-region copy, S3 CRR, ECR replication, secret replicas, DR KMS keys |
| `zone_name`, `create_zone` | required, `false` | Legacy Route 53 zone kept for state compatibility; public app/API DNS is managed in the authoritative Cloudflare zone |
| `cloudflare_zone_id` | required | Active Cloudflare zone ID (use the `nantty.com` zone for prod and its dev/staging subdomains) |
| `app_domain` | required | environment domain; services get `api.`, `media.`, `livekit.` prefixes |
| `mail_domain` | required | SES sending domain |
| `vpc_cidr`, `az_count`, `nat_per_az` | required, `3`, `false` | network shape, one NAT per AZ in prod |
| `app_origins` | required | exact browser origin per frontend (gateway CORS, S3 upload CORS) |
| `github_repository`, `create_github_oidc_provider` | required, `true` | OIDC trust; set the second to `false` if the account already has the provider |
| `image_tag` | `bootstrap` | first task definition image tag; CI deploys real tags |
| `min_tasks`, `max_tasks_cap`, `service_overrides` | `2`, `10`, `{}` | autoscaling bounds and per-service cpu/memory/min/max |
| `aurora` | required | `instance_class`, `reader_count`, `backup_retention_days` (PITR, max 35), `engine_version` |
| `valkey` | required | `node_type`, `node_count` (2+ gives Multi-AZ failover) |
| `mq` | required | `deployment_mode` (`CLUSTER_MULTI_AZ` or `SINGLE_INSTANCE`), `instance_type` |
| `livekit_mode`, `livekit_node_count` | `cloud`, `2` | LiveKit Cloud or self-hosted |
| `deletion_protection` | `true` | ALBs and Aurora |
| `log_retention_days` | `90` | all log groups |
| `alarm_email` | empty | SNS subscription for alarms (confirm the email) |
| `dmarc_report_address` | required | DMARC `rua` mailbox |
| `media_signing_public_key_pem` | `null` | CloudFront key group for signed `/paid/*` URLs |
| `enable_execute_command` | `false` | ECS Exec for break-glass |

## Bootstrap (once per account)

1. Create the remote state backend by hand in the environment project’s selected Region (the bucket and table are
   intentionally not managed by this stack). For this Nantty project, confirm the Region in AWS Settings and use
   `eu-north-1`; never create the backend in another Region:
   ```
   aws s3api create-bucket --bucket nantty-terraform-state-<env> --region eu-north-1 \
     --create-bucket-configuration LocationConstraint=eu-north-1
   aws s3api put-bucket-versioning --bucket nantty-terraform-state-<env> --versioning-configuration Status=Enabled
   aws s3api put-bucket-encryption --bucket nantty-terraform-state-<env> \
     --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'
   aws s3api put-public-access-block --bucket nantty-terraform-state-<env> \
     --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   aws dynamodb create-table --table-name nantty-terraform-locks --billing-mode PAY_PER_REQUEST \
     --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH
   ```
2. Set `CLOUDFLARE_API_TOKEN` in the shell or approved pipeline secret store. The token must be limited to DNS Read/Edit on the Nantty zone; never put the token in `terraform.tfvars`. Then `cd infra/aws/envs/<env>`, edit `terraform.tfvars`, run `terraform init`, `terraform plan`, and review with a second
   person, `terraform apply`. Prod applies run from a protected machine or the approved pipeline only.
3. Cloudflare is authoritative for `nantty.com`; do not delegate the domain to the legacy Route 53 zones. Terraform creates proxied API and optional LiveKit records, DNS-only CloudFront media records, and DNS-only ACM validation records in the Cloudflare zone. Verify resolution and certificate issuance after an approved apply. Route 53 records remain in the shadow zones until a separate state migration is reviewed.
4. Verify SES: Terraform creates the SES identity in the selected Region and publishes its DKIM, custom MAIL FROM, and sending-subdomain DMARC records in the authoritative Cloudflare zone. Staging uses `staging.nantty.com`; these records are DNS-only and do not replace the root `nantty.com` Cloudflare Email Routing MX/SPF records. Verify the SES identity status and DNS propagation after an approved apply. SES starts in the sandbox; request production access only when the sending use case, recipient handling, and bounce/complaint operations are ready.
5. Database roles: use the Aurora master secret (output `aurora_master_secret_arn`) from a bastion via SSM to create
   each `svc_*` login from its matching Secrets Manager secret. `svc_migrator` owns the `payments`, `wallet`, `ledger`,
   `escrow`, `subscriptions`, and `creators` schemas; create `svc_money` before applying money migrations because the
   three narrowly scoped cleanup grants are conditional on that role existing. Grant it schema USAGE, default
   SELECT/INSERT/UPDATE and sequence access, plus DELETE only on `payments.provider_payout_destinations`,
   `creators.creator_brand_deals`, and `ledger.step_up_consumptions`. It must not be a member of `svc_migrator` or any
   money schema-owner role. The normal go-money ECS
   task receives only `MONEY_DATABASE_URL`. The separate pre-deploy task definition must receive exactly
   `MONEY_MIGRATION_DATABASE_URL` from the `svc_migrator` secret and run `--migrate-money`; it must not receive the
   runtime database URL. Create PostGIS as required by the other service schemas and apply the reviewed grants before
   rollout.
6. RabbitMQ definitions are **not applied by Terraform**. Do not upload
   `infra/local/rabbitmq/topology.json` to the RabbitMQ definitions API: it is
   Nantty's custom topology model, not RabbitMQ's definitions format. Do not
   upload `infra/local/rabbitmq/definitions.json` either: its generated user
   hashes are intentionally local-only. The reviewed converter/importer is
   `infra/aws/modules/messaging/bootstrapTopology.mjs`; it converts the custom
   manifest, reads environment-scoped admin and per-service credentials from
   `nantty/<env>/mq/*`, creates service users, applies grants, imports vhost
   definitions, then verifies expected exchanges, queues, bindings and
   permissions. It is additive and does not delete definitions absent from the
   manifest. RabbitMQ can partially apply imports on failure, so inspect broker
   state before retrying a failed write.
   First run the no-write plan from a checkout of the reviewed revision:
   ```bash
   node infra/aws/modules/messaging/bootstrapTopology.mjs --environment staging
   ```
   For an actual staging import, use an approved operator host with private VPC
   reachability to the broker HTTPS management endpoint and AWS credentials
   limited to reading `nantty/staging/mq/admin` and each
   `nantty/staging/mq/<service>` secret (plus their KMS decrypt permission):
   ```bash
   node infra/aws/modules/messaging/bootstrapTopology.mjs --environment staging --apply
   ```
   Production additionally requires `--confirm-prod` and the protected
   production change procedure. Do not put secret values in arguments, shell
   history, or logs. This checkout has only run mocked importer tests and the
   no-write dry run; no AWS secrets were read and no broker was changed. Broker
   management ingress is limited to the ECS tasks security group; use only an
   approved network path with that source identity and never widen it to public
   CIDRs. Terraform creating the broker and secrets alone does not install the
   topology or prove recommendation-event delivery.
   The event-operations queue endpoint also requires a separate monitoring-only
   RabbitMQ account. After broker creation, run
   `infra/aws/modules/messaging/bootstrapMonitoringUser.mjs` from a trusted
   machine with private VPC access, using the admin and monitoring values from
   `nantty/<env>/mq/admin` and `nantty/<env>/mq/monitoring`. The script creates
   or updates the `monitoring`-tagged user, grants empty configure/write/read
   permissions on the `nantty` vhost, then authenticates as that user and
   verifies the queue-list API. It does not import topology or modify queues.
   RabbitMQ requires monitoring users to retain normal resource permissions;
   empty permissions provide monitoring-only access. See the [RabbitMQ
   management access guide](https://www.rabbitmq.com/docs/management#monitoring-only-read-only-access).
   Run from a trusted host with private VPC access; the following keeps secret
   values out of shell history and does not print them:
   ```bash
   environment=staging # use dev, staging, or prod deliberately
   admin_secret="$(aws secretsmanager get-secret-value --secret-id "nantty/${environment}/mq/admin" --query SecretString --output text)"
   monitoring_secret="$(aws secretsmanager get-secret-value --secret-id "nantty/${environment}/mq/monitoring" --query SecretString --output text)"
   export RABBITMQ_MANAGEMENT_URL="$(jq -er '.management_url' <<<"$monitoring_secret")"
   export RABBITMQ_MANAGEMENT_ADMIN_USERNAME="$(jq -er '.username' <<<"$admin_secret")"
   export RABBITMQ_MANAGEMENT_ADMIN_PASSWORD="$(jq -er '.password' <<<"$admin_secret")"
   export RABBITMQ_MONITORING_USERNAME="$(jq -er '.username' <<<"$monitoring_secret")"
   export RABBITMQ_MONITORING_PASSWORD="$(jq -er '.password' <<<"$monitoring_secret")"
   export RABBITMQ_VHOST="$(jq -er '.vhost' <<<"$monitoring_secret")"
   node infra/aws/modules/messaging/bootstrapMonitoringUser.mjs
   unset admin_secret monitoring_secret RABBITMQ_MANAGEMENT_ADMIN_PASSWORD RABBITMQ_MONITORING_PASSWORD
   ```
   Do not run it from an untrusted host or pass credentials as command-line
   arguments. The script does not contact AWS itself and must never be pointed
   at a production broker without the approved change procedure.
7. Fill the placeholders `CHANGE_ME` in `nantty/<env>/<service>/app` (JWT/OTP keys, internal tokens, and for go-money
   `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` (32+ characters) and `FLUTTERWAVE_MERCHANT_ID` for that environment;
   go-money refuses to start in production without them). Register `terraform output nat_public_ips` in Flutterwave's IP whitelist. Replace the LiveKit credentials when using LiveKit Cloud.
8. In GitHub, create environments `staging` and `production` (required reviewers on production) and add repository
   variables `AWS_ACCOUNT_ID_STAGING`, `AWS_ACCOUNT_ID_PROD`, `AWS_REGION`, `STAGING_API_URL`, `PROD_API_URL`,
   `MIGRATE_TASK_DEFINITION[_PROD]`, `*_PRIVATE_SUBNETS`, `*_TASKS_SECURITY_GROUP`, and the snapshot/restore gate
   variables. The deploy workflow runs the migration task before each rollout and stops if it does not succeed.
   The roles are the outputs `github_ecr_push_role_arn` and `github_deploy_role_arn`.
9. Push the first images (the CI `images` job does it on merge to main), then CI deploys to staging and runs the staging
   smoke test. Production promotion is not automatic: it requires manually dispatching the deploy workflow with
   `deploy_production=true` and passing the protected `production` environment approval. Autoscaling minimums start tasks.
   The staging media task includes the private ClamAV sidecar when `enable_media_malware_scanning=true`; its 4 GiB memory reservation increases staging cost. After the first successful Terraform apply and media rollout, set the repository variable `CLAMAV_REFRESH_ENABLED_STAGING=true` to enable the daily signature-refresh workflow. That workflow tests a clean payload and the EICAR test signature, scans the image, then rolls only the ClamAV container. Keep the variable unset until the staging ECS family has the sidecar and the staging ECR/deploy OIDC roles exist.

## SES-only staging (without deploying the platform stack)

Use `envs/email-staging` to verify the staging sending identity and feedback path without applying the full platform
stack. It owns a separate Terraform state key and creates only the existing SES module resources: the
`staging.nantty.com` identity, Easy DKIM/custom MAIL FROM/DMARC records in Cloudflare, an SES configuration set, and
SNS/SQS feedback resources. The SNS topic uses a narrowly scoped customer-managed KMS key (required for the SES event
publisher policy) and the queues use SQS-managed encryption. The key adds a fixed monthly KMS charge plus applicable
request charges; consult the current [AWS KMS pricing](https://aws.amazon.com/kms/pricing/) before applying. This root
creates no VPC, NAT gateway, database, ECS service, or application deployment.

Before applying, confirm the selected Region is `eu-north-1` and that AWS Settings has a hard spend limit appropriate to
the project. The state bucket and DynamoDB lock table in `envs/email-staging/backend.tf` must already exist; bootstrap
them using step 1 above, then provide a Cloudflare API token limited to DNS Read/Edit on the `nantty.com` zone through
`CLOUDFLARE_API_TOKEN`. Never save the token in a tfvars file. Review the entire plan and confirm it contains only SES,
SNS/SQS, their policies/subscription, and staging sending-subdomain DNS records before applying:

```bash
cd infra/aws/envs/email-staging
terraform init
terraform plan -var-file=staging.tfvars
terraform apply -var-file=staging.tfvars
```

After apply, verify the domain identity, DKIM, and custom MAIL FROM statuses with
`aws sesv2 get-email-identity --region eu-north-1 --email-identity staging.nantty.com`. SES staging remains in the
sandbox: test only with verified identities or the SES mailbox simulator until AWS grants production access. A
simulator message verifies SES acceptance/event plumbing, not inbox rendering or delivery to ordinary recipients. The
Nantty template renderer and notifications service are not deployed by this SES-only root; existing package and service
tests cover rendering until the notification runtime is deployed with its application dependencies.

Current workspace checks (2026-11-25): AWS CLI browser login succeeded; SES account reports sandbox access enabled,
200 messages per 24 hours, 1 message/second, and zero sent in the prior 24 hours. No SES identity is listed in
`eu-north-1`. The staging state bucket and lock table are absent, and `CLOUDFLARE_API_TOKEN` is not configured in this
shell. No AWS or Cloudflare resources were created or changed. Do not use the shared `envs/staging` root for email-only
verification; it composes the full fourteen-service platform.

## Known caveats to confirm on the first staging apply

- The AWS new-experience service list includes AWS WAF in its Free Tier; CloudFront is also included. The stack's
  `CLOUDFRONT`-scope ACL must be managed through the global WAF endpoint in `us-east-1`, while regional resources
  remain in the selected `eu-north-1` project Region. AWS WAF is not a reason to move the project to another Region.
- Amazon Rekognition is listed as a new-experience service, but the AWS regional-availability catalog returned
  `Not Found` for `Rekognition+DetectModerationLabels` in `eu-north-1` on 2026-11-24. Do not apply with the
  expectation that this API is usable from Stockholm. Keep the existing child-safety upload path fail-closed and
  resolve the moderation provider/Region dependency before claiming those scans work; do not disable the safety gate.
- The staging Terraform backend bucket and lock table were not present in the selected project when checked on
  2026-11-24. Remote state bootstrap remains a prerequisite; no backend resources have been created by this checkout.
- The project plan could not be read through `GetAccountPlanState` on 2026-11-24 (`ResourceNotFoundException: Missing
  data for account`). Confirm Free/Paid plan, spend limit, and billing status in AWS Settings before creating any
  billable staging resources.
- The owner has removed the USD 110/month architecture target but wants the AWS project hard spend cap retained.
  The configured hard-cap amount has not been verified or changed. Do not interpret removal of the design target as
  authorization for unlimited spend. AWS Price List API on-demand rates for
  EU (Stockholm) on 2026-11-24 are USD 0.285/hour for each configured Aurora `db.r7g.large`, USD 0.046/hour
  for each NAT Gateway, USD 0.0624/hour for each Valkey `cache.t4g.medium`, and USD 0.0312/hour for Valkey
  `cache.t4g.small`. With the checked-in two Aurora instances, three NAT gateways, two medium Valkey nodes, and
  one small Valkey node, those four categories alone cost about USD 630.72 per 730-hour month. This excludes
  Aurora storage/I/O, ECS/Fargate, MQ, load balancers, logs, and network transfer. Do not apply the full profile
  at any previously discussed target. The project owner must verify the actual hard spend limit in AWS Settings >
  Billing; cost and architecture require review before provisioning.

- Amazon MQ RabbitMQ cluster networking (one subnet, endpoint inside the VPC) and the `Broker` dimension of MQ alarms.
- CodeDeploy rewriting the listener rule of `go-money` on the internal listener.
- Go images are distroless, so they have no container health check; the internal ALB target group is the health gate.
- Every module-specific name the Go services read (`AUTH_DATABASE_URL`, `ORDERS_DATABASE_URL`, `*_REDIS_URL`, `*_DATABASE_SCHEMA`) is mapped in `modules/platform/deploy.tf`, all to the one `svc_<service>` role of that deployable; grant that role the schemas it serves. `DATABASE_URL`, `RABBITMQ_URL` and `VALKEY_URL` stay for the TypeScript services.
- Passwords generated by Terraform live in state; keep the state bucket private, encrypted and access-logged.
