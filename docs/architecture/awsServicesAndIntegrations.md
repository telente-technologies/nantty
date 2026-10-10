# AWS services and third-party integrations

What Zudomart needs to run in production, taken from `infra/aws` (Terraform, written but never applied), the service
`.env.example` files and the code. Status: **Required** = the code or Terraform uses it today; **Later** = documented in
`docs/architecture` with a trigger, not built yet; **Not wired** = keys or CSP entries exist but no backend code calls it.

One AWS account per environment (`zudomart-dev`, `zudomart-staging`, `zudomart-prod`). The primary region is `eu-west-1`, with a DR region for replicated backups, ECR and S3.

## AWS services

### Compute and delivery

| Service | Features used | Why | Status |
| --- | --- | --- | --- |
| ECS on Fargate | 12 private services (gateway, go-identity, go-commerce, go-money, go-live, go-ads, go-trust, social, notifications, media, realtime, intelligence), Container Insights, rolling deploys with circuit breaker, Application Auto Scaling, ECS Exec off by default | runs every backend service | Required |
| ECS on EC2 (capacity provider, launch template, Auto Scaling group) | host networking | self-hosted LiveKit only (`livekit_mode = "self_hosted"`) | Optional |
| ECR | immutable tags, scan on push, KMS encryption, lifecycle rules, cross-region replication, `zudomart/migrate` image | container images | Required |
| CodeDeploy | ECS blue/green, 10% canary for 5 min, automatic rollback on ledger-imbalance and 5xx alarms | safe deploys of go-money | Required |
| Cloud Map | private DNS namespace `svc.<env>.zudomart.internal` | service discovery | Required |
| Elastic Load Balancing (ALB) | public ALB (`/ws*` to realtime, `/*` to gateway), internal ALB with host routing, access logs | ingress | Required |

### Data

| Service | Features used | Why | Status |
| --- | --- | --- | --- |
| Aurora PostgreSQL | one cluster, schema per service, reader instance, cluster parameter group, PostGIS | all relational data | Required |
| RDS Proxy | writer and reader endpoints | connection pooling for many services | Required |
| ElastiCache for Valkey | replication group, TLS, AUTH, parameter group | sessions denylist, rate limits, caches, ads pacing | Required |
| Amazon MQ for RabbitMQ | cluster in prod, single instance in dev, per-service users | domain events between services | Required |
| S3 | media (public variants), private media, KYC bucket (Object Lock, KMS, TLS only), logs, exports, ads assets; versioning, lifecycle, CORS, presigned URLs, cross-region replication | uploads, chat attachments (encrypted), documents, reports | Required |
| AWS Backup | backup plan, vault, cross-region copy | Aurora and bucket recovery | Required |

### Messaging, email and AI

| Service | Features used | Why | Status |
| --- | --- | --- | --- |
| SES v2 | domain identity, DKIM, MAIL FROM, DMARC, configuration set, event destination | every transactional and marketing email (OTP, receipts, policy notices) | Required |
| SNS | SES feedback topic, alarm topic, outbox fan-out | bounces and complaints, alerts | Required |
| SQS | SES feedback queue, queue policy, DLQs | bounce and complaint handling, async jobs | Required |
| Rekognition | image moderation (`DetectModerationLabels`) | live-stream frame safety in `intelligence` | Required for live safety (disabled without credentials) |
| Transcribe | batch transcription | live-stream audio safety | Required for live safety |
| EventBridge | event bus | replace or complement SNS fan-out | Later |
| Step Functions | multi-step payout runs, dispute timelines | only if real orchestration is needed | Later |
| OpenSearch | catalog search, BM25 and vectors | when Postgres search p95 is above 300 ms at scale | Later |
| MediaConvert / IVS | managed transcoding or streaming | alternative to ffmpeg in `media` and to LiveKit | Not planned |

### Edge, DNS and security

| Service | Features used | Why | Status |
| --- | --- | --- | --- |
| CloudFront | media distribution, Origin Access Control, signed URLs (public key and key group) | fast media, private signed media | Required |
| Route 53 | public and private zones, alias records, API health check | DNS | Required |
| ACM | regional and `us-east-1` certificates | TLS for the ALB and CloudFront | Required |
| WAF v2 | managed rule groups, auth and global rate rules, Paystack source IP set on `/webhooks/paystack`, `/internal` block, logging | protect the public edge | Required |
| KMS | rotated keys per purpose: data, secrets, logs, KYC, ECR, backup, SNS; DR copies | encryption at rest | Required |
| Secrets Manager | service secrets, generated passwords, LiveKit credentials | secret storage | Required |
| SSM Parameter Store | read-only lookups (AMI id) | ECS-optimised AMI for self-hosted LiveKit | Optional |
| IAM | per-service task roles (least privilege), execution roles, GitHub OIDC provider, ECR push and deploy roles | access control | Required |
| VPC | public, private and data subnets, NAT gateway, internet gateway, S3 gateway and interface endpoints, REJECT flow logs | networking | Required |
| CloudWatch | log groups, metric alarms (ALB, ECS, Aurora, Valkey, MQ, SES, ledger), dashboard | monitoring | Required |
| X-Ray | traces from the OpenTelemetry collector | tracing | Later (proposed) |
| CloudTrail | organisation trail, Object Lock archive in a log-archive account | audit | Later (proposed) |
| GuardDuty, Security Hub | threat detection, posture | security alerting | Later (proposed) |
| Amazon Managed Prometheus and Grafana | metrics at higher cardinality | only past CloudWatch limits | Later |
| Athena, Glue | event analytics on Parquet | before ClickHouse | Later |

## Third-party integrations

### Payments and money

| Provider | Used for | Where | Keys and setup | Status |
| --- | --- | --- | --- | --- |
| Paystack | card, bank, USSD and transfer checkout; inline popup on web; subscriptions (plan codes); split payments and subaccounts for sellers; transfers for withdrawals; bank account verification; webhooks | go-money (`payments`, `wallet`, `escrow`), webapp, seller, ads | `PAYSTACK_SECRET_KEY`, plan codes, webhook IP allowlist, return URLs (`PAYMENT_RETURN_URLS`) | Required |
| Apple App Store (StoreKit 2, App Store Server API) | in-app purchases and creator subscriptions on iOS, receipt verification, server notifications | go-money `payments`, mobile (`expo-iap`) | `APPLE_IAP_*` (issuer, key id, private key, bundle id, root certificates) | Required for iOS IAP (dormant without keys) |
| Google Play Billing (Android Publisher API, RTDN via Pub/Sub push) | in-app purchases and subscriptions on Android, real-time notifications | go-money `payments`, mobile | `GOOGLE_PLAY_*` (service account JSON, package name, RTDN push audience and token) | Required for Android IAP (dormant without keys) |
| Flutterwave | alternative checkout | only CSP and env entries in the seller and ads apps | `FLUTTERWAVE_*` | Not wired |

### Identity, trust and safety

| Provider | Used for | Where | Keys | Status |
| --- | --- | --- | --- | --- |
| Smile ID | KYC: identity document plus selfie checks for seller and creator verification, web SDK on `/settings/verification`, callbacks | go-identity (`users` verification), webapp | `SMILE_ID_PARTNER_ID`, `SMILE_ID_API_KEY`, `SMILE_ID_ENVIRONMENT`, callback URL | Required |
| Sign in with Apple | social sign-in (ID token verification) | go-identity `auth`, mobile (`expo-apple-authentication`) | `AUTH_APPLE_CLIENT_IDS` | Required if social sign-in stays |
| Google Sign-In | social sign-in | go-identity `auth`, mobile (`expo-auth-session`) | `AUTH_GOOGLE_CLIENT_IDS` | Required if social sign-in stays |
| Cloudflare Turnstile | bot check on sign-up, login and sensitive guest actions (hCaptcha is a supported alternative) | gateway, webapp, mobile | `HUMAN_VERIFICATION_PROVIDER`, site and secret keys | Required |
| ClamAV | virus scanning of uploads before release from quarantine | media | `CLAMAV_HOST`, `CLAMAV_PORT` (run as a sidecar or service) | Required |

### Messaging, media and live

| Provider | Used for | Where | Keys | Status |
| --- | --- | --- | --- | --- |
| Expo Push Service (relays to FCM and APNs) | mobile push notifications | notifications (`PUSH_PROVIDER=expo`), mobile | Expo access token, FCM server key and APNs key uploaded to Expo | Required |
| LiveKit (Cloud or self-hosted) | live video rooms, RTMP or WHIP ingress for stream keys, guests on stage | go-live, studio, webapp, mobile | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`; the ingress service is required for stream keys | Required |
| ffmpeg, ffprobe, libheif | video variants, HLS, posters, HEIC conversion | media container | binaries in the image | Required (self-hosted) |

### Platform, delivery and tooling

| Provider | Used for | Status |
| --- | --- | --- |
| GitHub and GitHub Actions | source, CI, OIDC deploys to AWS (no long-lived keys) | Required |
| Expo EAS | mobile builds, submissions and over-the-air updates | Required |
| Apple Developer Program and App Store Connect | iOS distribution, IAP products, Sign in with Apple, APNs key | Required |
| Google Play Console and Google Cloud project | Android distribution, IAP products, Pub/Sub RTDN topic, service account | Required |
| Domain registrar | `zudomart.com` (DNS delegated to Route 53) | Required |
| OpenTelemetry | traces and metrics via the collector (to X-Ray or CloudWatch) | Required (vendor-neutral) |
| Exchange-rate feed | live FX for display prices (`EXCHANGE_RATE_PROVIDER` is `static` today) | Later: choose a provider |
| SMS provider | none needed: sign-in is email-only and phone OTP was removed (2026-10-05) | Not needed |
| ClickHouse | analytics past the Athena stage | Later |

## Keys to collect before go-live

1. Paystack live secret key, plan codes and the webhook URL registered in the Paystack dashboard.
2. Smile ID partner ID and API key (production), and the callback URL.
3. Apple: App Store Server API key, issuer and key ID, bundle ID, Sign in with Apple service ID, APNs key (for Expo).
4. Google: Play service account JSON, package name, Pub/Sub push subscription for RTDN, OAuth client IDs, FCM key (for Expo).
5. LiveKit Cloud project URL, API key and secret, with ingress enabled.
6. Cloudflare Turnstile site and secret keys for each app hostname.
7. Expo access token.
8. SES out of the sandbox, with DKIM, MAIL FROM and DMARC records in Route 53.
