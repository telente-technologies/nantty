# AWS infrastructure (Terraform)

Written, formatted and validated, never applied. Nothing here talks to AWS until someone runs `terraform apply` in an
environment account. One AWS account per environment (`zudomart-dev`, `zudomart-staging`, `zudomart-prod`), one state per
environment. Architecture rationale: `docs/architecture/devops.md` and `docs/architecture/disaster-recovery.md`.

```
infra/aws/
  modules/
    platform/       composition: wires every module below from a handful of variables, owns the service catalog
    network/        VPC, public/private/data subnets, NAT (single or per AZ), S3 gateway + interface endpoints, REJECT flow logs
    kms/            one rotated key per purpose: data, secrets, logs, kyc, ecr, backup, sns
    storage/        S3 media, private KYC (Object Lock, KMS, TLS only), logs; CloudFront + OAC (+ signed URLs); CRR to the DR region
    dns/            Route 53 zone, ACM certs (regional + us-east-1), alias records, API health check
    edge/           public ALB + WAF (managed rules, auth/global rate rules, Flutterwave webhook hash + rate rules, /internal block), internal ALB + private zone
    ecs-cluster/    Fargate cluster, Container Insights, Cloud Map namespace
    ecs-service/    task def, roles, log group, target group + rules, autoscaling, ECS rolling or CodeDeploy blue/green
    aurora/         Aurora PostgreSQL cluster, RDS Proxy (writer + reader endpoints), AWS Backup with cross-region copy
    valkey/         ElastiCache Valkey replication group (TLS + AUTH), URL secret
    messaging/      Amazon MQ for RabbitMQ (cluster or single instance), admin + per-service user secrets
    ses/            domain identity, DKIM, MAIL FROM, DMARC, configuration set, SNS -> SQS feedback queue
    livekit/        LiveKit credentials secret; optional self-hosted LiveKit on EC2-backed ECS
    observability/  SNS alarm topic, ALB/ECS/Aurora/Valkey/MQ/SES/ledger alarms, dashboard
    github-oidc/    GitHub OIDC provider, ECR push role (main only), deploy role (environment claim only)
  envs/{dev,staging,prod}/   backend.tf, providers.tf, main.tf (one module call), variables.tf, terraform.tfvars
```

## What gets deployed

Fourteen Fargate services, all private, no public IPs: `gateway`, `go-identity`, `go-commerce`, `go-money`, `go-live`,
`go-ads`, `go-trust`, `social`, `notifications`, `media`, `search`, `support`, `realtime`, `intelligence`. ECR repositories are
`zudomart/<service>` (immutable tags, scan on push, KMS, lifecycle, replicated to the DR region in prod) plus
`zudomart/migrate` for the pre-deploy migration task.

| Path | Target |
| --- | --- |
| public ALB `/ws*` (priority 20) | `realtime` |
| public ALB `/*` (priority 100) | `gateway` |
| internal ALB, host `<service>.svc.<env>.zudomart.internal` | each service (HTTP inside the VPC), health checks per target group |

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

LiveKit: `livekit_mode = "cloud"` (default) creates `zudomart/<env>/livekit` with placeholders to replace with your
LiveKit Cloud project URL, key and secret. `self_hosted` runs LiveKit on EC2-backed ECS with host networking behind
`livekit.<app_domain>` (signaling via the ALB, media on 7881/tcp and 7882/udp straight to the instance).

## Variables (envs/*/variables.tf, values in terraform.tfvars)

| Variable | Default | Meaning |
| --- | --- | --- |
| `environment` | required | `dev`, `staging` or `prod` |
| `region` / `dr_region` | required / `eu-central-1` | primary and DR regions |
| `enable_dr` | `false` (true in prod) | AWS Backup cross-region copy, S3 CRR, ECR replication, secret replicas, DR KMS keys |
| `zone_name`, `create_zone` | required, `false` | Route 53 zone; dev and staging own delegated sub-zones, prod owns `zudomart.com` |
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

1. Create the remote state backend by hand, in the environment account (the bucket and table are intentionally not
   managed by this stack):
   ```
   aws s3api create-bucket --bucket zudomart-terraform-state-<env> --region eu-west-1 \
     --create-bucket-configuration LocationConstraint=eu-west-1
   aws s3api put-bucket-versioning --bucket zudomart-terraform-state-<env> --versioning-configuration Status=Enabled
   aws s3api put-bucket-encryption --bucket zudomart-terraform-state-<env> \
     --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'
   aws s3api put-public-access-block --bucket zudomart-terraform-state-<env> \
     --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   aws dynamodb create-table --table-name zudomart-terraform-locks --billing-mode PAY_PER_REQUEST \
     --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH
   ```
2. `cd infra/aws/envs/<env>`, edit `terraform.tfvars`, then `terraform init`, `terraform plan`, review with a second
   person, `terraform apply`. Prod applies run from a protected machine or the approved pipeline only.
3. Delegate DNS: copy the `name_servers` output of dev and staging into NS records in the prod zone
   (`dev.zudomart.com`, `staging.zudomart.com`), and point the registrar at prod's name servers.
4. Verify SES: DKIM and MAIL FROM records are created automatically; request production access (out of the sandbox).
5. Database roles: for each secret `zudomart/<env>/db/svc_*` create the Postgres role with that password, the schema it
   owns, PostGIS (`CREATE EXTENSION postgis`) and grants, using the Aurora master secret (output
   `aurora_master_secret_arn`) from a bastion via SSM. `svc_migrator` owns schemas for the pre-deploy migrate task.
6. RabbitMQ: create one user per `zudomart/<env>/mq/<service>` secret and import
   `infra/local/rabbitmq/topology.json` through the management API using `zudomart/<env>/mq/admin`.
7. Fill the placeholders `CHANGE_ME` in `zudomart/<env>/<service>/app` (JWT/OTP keys, internal tokens, and for go-money
   `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` (32+ characters) and `FLUTTERWAVE_MERCHANT_ID` for that environment;
   go-money refuses to start in production without them). Register `terraform output nat_public_ips` in Flutterwave's IP whitelist. Replace the LiveKit credentials when using LiveKit Cloud.
8. In GitHub, create environments `staging` and `production` (required reviewers on production) and add repository
   variables `AWS_ACCOUNT_ID_STAGING`, `AWS_ACCOUNT_ID_PROD`, `AWS_REGION`, `STAGING_API_URL`, `PROD_API_URL` (optional pre-deploy migration: `MIGRATE_TASK_DEFINITION[_PROD]`, `*_PRIVATE_SUBNETS`, `*_TASKS_SECURITY_GROUP`).
   The roles are the outputs `github_ecr_push_role_arn` and `github_deploy_role_arn`.
9. Push the first images (the CI `images` job does it on merge to main), then CI deploys; autoscaling minimums start tasks.

## Known caveats to confirm on the first staging apply

- Amazon MQ RabbitMQ cluster networking (one subnet, endpoint inside the VPC) and the `Broker` dimension of MQ alarms.
- CodeDeploy rewriting the listener rule of `go-money` on the internal listener.
- Go images are distroless, so they have no container health check; the internal ALB target group is the health gate.
- Every module-specific name the Go services read (`AUTH_DATABASE_URL`, `ORDERS_DATABASE_URL`, `*_REDIS_URL`, `*_DATABASE_SCHEMA`) is mapped in `modules/platform/deploy.tf`, all to the one `svc_<service>` role of that deployable; grant that role the schemas it serves. `DATABASE_URL`, `RABBITMQ_URL` and `VALKEY_URL` stay for the TypeScript services.
- Passwords generated by Terraform live in state; keep the state bucket private, encrypted and access-logged.
