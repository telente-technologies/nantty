# AWS infrastructure (Terraform layout, not applied)

Nothing here is applied yet. This is the module layout the infra work will fill in, one module per concern, composed per
environment (`envs/staging`, `envs/production`). State in S3 with DynamoDB locking, one AWS account per environment.

```
infra/aws/
  modules/
    network/            VPC, private subnets per AZ, NAT, VPC endpoints (S3, SQS, SNS, Secrets Manager, ECR)
    ecs-cluster/        ECS cluster on Fargate, capacity providers, service discovery (Cloud Map)
    ecs-service/        reusable: task definition, service, autoscaling, ALB target group, IAM task role, log group
    alb/                public ALB for the gateway and realtime (WebSocket idle timeout raised), WAF, ACM certs
    aurora-postgres/    one Aurora PostgreSQL cluster (PostGIS), writer + reader, parameter groups, IAM auth,
                        bootstrap job that creates svc_<service> roles, schemas and zudomart_readers
    elasticache/        Valkey/Redis replication group for cache, rate limits, idempotency, presence
    messaging/          SNS topic zudomart-domain-events, per-consumer SQS queues + DLQs with eventType filter
                        policies, job queues (email, media, reports, payouts, search-indexing); EventBridge bus later
    step-functions/     only for real orchestration (payout runs, dispute timelines)
    media/              S3 buckets (uploads, processed, exports), CloudFront distributions with signed URLs/OAC
    livekit/            LiveKit Cloud project wiring or self-hosted LiveKit on ECS/EC2 with UDP
    secrets/            Secrets Manager entries + KMS keys (signing-key encryption, data encryption)
    observability/      OTel collector sidecar config, CloudWatch dashboards and alarms, X-Ray/AMP as needed
    opensearch/         later: search domain fed from domain events
    clickhouse/         later: ClickHouse Cloud or self-hosted, fed from domain events
  envs/
    staging/main.tf
    production/main.tf
```

Deployables on ECS: `gateway` (TS), `go-identity`, `go-commerce`, `go-money`, `go-live`, `go-ads`, `go-trust`,
`realtime` (Elixir, clustered with DNSCluster over Cloud Map), and `intelligence` (Python, internal only).
