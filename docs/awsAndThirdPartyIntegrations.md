# AWS services and third-party integrations

As of 2026-10-06 (merged with the former `docs/architecture/awsServicesAndIntegrations.md` on 2026-10-11). Sources: `infra/aws/` (Terraform, written and validated but never applied), every `.env.example`,
`infra/local/docker-compose.yml`, `docs/architecture/*` and `docs/integrations/*`.

Status:
- **In Terraform:** defined in `infra/aws/modules/*`; created by `terraform apply`.
- **Needed, not in Terraform:** the code or the docs need it, but no Terraform exists yet.
- **Local only:** a local stand-in in compose; production uses the AWS or managed equivalent.

One AWS account per environment (`zudomart-dev`, `zudomart-staging`, `zudomart-prod`), each with its own Terraform state.
Production replicates to a disaster-recovery (DR) region.

## 1. AWS services

### Compute and delivery

| Service | Used for | Status |
| --- | --- | --- |
| **ECS on Fargate** | 12 private services: gateway, go-identity, go-commerce, go-money, go-live, go-ads, go-trust, social, notifications, media, realtime, intelligence. Also `support` and `search`; check that they're in the service catalog. Container Insights is on. | In Terraform (`ecs-cluster`, `ecs-service`) |
| **ECS on EC2** (Auto Scaling group + launch template) | Only when LiveKit is self-hosted (`livekit_mode = "self_hosted"`) | In Terraform (`livekit`) |
| **ECR** | One repository per service (`zudomart/<service>`) plus `zudomart/migrate`. Tags are immutable; images are scanned on push, KMS-encrypted, kept under a lifecycle policy, and replicated to the DR region in prod. | In Terraform (`ecr`) |
| **Application Auto Scaling** | Scales each service on CPU, memory or request count | In Terraform |
| **CodeDeploy** | Blue/green deploys for `go-money`: a 10% canary for 5 minutes, rolled back automatically on the ledger-imbalance or 5xx alarm | In Terraform (`ecs-service`) |
| **Cloud Map** | Private service discovery (`*.svc.<env>.zudomart.internal`) | In Terraform |

### Networking and edge

| Service | Used for | Status |
| --- | --- | --- |
| **VPC** (subnets, IGW, NAT, route tables, endpoints) | Public, private and data subnets. NAT is a single gateway, or one per AZ in prod. S3 gateway endpoint plus interface endpoints. | In Terraform (`network`) |
| **VPC Flow Logs** | Logs rejected traffic | In Terraform |
| **Application Load Balancer** (public + internal) | Public: `/ws*` → realtime, `/*` → gateway. Internal: host-based routing to each service. | In Terraform (`edge`) |
| **AWS WAF v2** | ALB (regional): managed rule sets, rate rules for auth and global traffic, Paystack source IPs only on `/webhooks/paystack`, `/internal` blocked. The admin IP allow-list can also be an IP set. CloudFront (us-east-1): IP reputation, anonymous IP (count mode until tuned), common, known bad inputs and SQLi rule groups, plus a per-IP rate limit (`cdn_rate_limit_per_five_minutes`, default 10,000). Both log to KMS-encrypted `aws-waf-logs-*` groups with `authorization`, `cookie` and `x-step-up-token` redacted (the CloudFront ACL logs only blocked and counted requests). | In Terraform (`edge`, `cloudfront-waf`) |
| **Route 53** | Public zone, private zone, alias records, API health check | In Terraform (`dns`) |
| **ACM** | TLS certificates: regional for the ALB, plus us-east-1 for CloudFront | In Terraform (`dns`) |
| **CloudFront** | Public media CDN with Origin Access Control and the CloudFront WAF web ACL. Signed URLs (key group + public key) for private media. OAC decrypts KMS-encrypted media through a key-policy grant scoped to the distribution ARN. | In Terraform (`storage`) |
| **Shield Standard** | DDoS protection (free with CloudFront and ALB). Shield Advanced is optional later. | Automatic |

### Data

| Service | Used for | Status |
| --- | --- | --- |
| **Aurora PostgreSQL** (+ **RDS Proxy**) | One cluster where each service owns its own schema. RDS Proxy gives writer and reader endpoints. | In Terraform (`aurora`) |
| **ElastiCache for Valkey** | Rate limits, sessions and the session denylist, caches, and Python feature state. TLS and AUTH are on. | In Terraform (`valkey`) |
| **Amazon MQ for RabbitMQ** | Domain events between services (outbox → broker → queues). Admin user plus one user per service. | In Terraform (`messaging`) |
| **S3** | Public media, a private KYC bucket (Object Lock, KMS, TLS only), logs, live recordings, live-safety frames and evidence, user data exports, model artefacts, encrypted chat blobs. Cross-region replication to DR. CORS for browser uploads from the dashboards. | In Terraform (`storage`). **Check that the live-recording, live-safety, export and ads-creative buckets exist, and that the dashboard origins have CORS.** |
| **Amazon OpenSearch Service** | Full-text and people search (`ts-search`). Postgres full-text is the MVP fallback. | **Needed, not in Terraform.** Local: OpenSearch 3 in compose. |
| **ClickHouse** (self-run or ClickHouse Cloud), or Athena + S3 | Analytics and reporting pipeline | **Needed, not in Terraform.** Local: compose profile `analytics`. The analytics module is still a skeleton. |

### Messaging, email and queues

| Service | Used for | Status |
| --- | --- | --- |
| **Amazon SES** | All transactional and marketing email. Sets up the domain identity, DKIM, MAIL FROM, DMARC (starts at `p=none`) and a configuration set. | In Terraform (`ses`). You must request production access to leave the SES sandbox. |
| **SNS + SQS** | SES bounce and complaint feedback goes SNS → SQS → the notifications service. There's also an SNS alarm topic. | In Terraform (`ses`, `observability`) |
| **SQS** (outbox and worker queues, per the architecture) | Async workers, e.g. payout onboarding retries and dead-letter queues | Partly. The architecture names SQS/SNS for the outbox, but RabbitMQ carries most events today. |

### Security and secrets

| Service | Used for | Status |
| --- | --- | --- |
| **KMS** | One rotated key per purpose: data, secrets, logs, kyc, ecr, backup, sns. A media key (plus a DR-region one) encrypts the media buckets, and a us-east-1 key encrypts the CloudFront WAF logs. The kyc and media keys only let the task roles that use those buckets call them through S3. The logs bucket stays SSE-S3, because S3 access logs and ALB access logs can't be delivered to an SSE-KMS bucket. | In Terraform (`kms`, `storage`, `cloudfront-waf`) |
| **Secrets Manager** | Every service secret: DB URLs, Paystack keys, internal tokens, signing keys, LiveKit, Apple and Google keys, and more. Each service reads only its own secrets. | In Terraform |
| **IAM** (+ **GitHub OIDC**) | One task role per service (least privilege), execution roles, a CI push role (main branch only) and a deploy role (per environment) | In Terraform (`github-oidc`) |
| **AWS Backup** | Aurora backups, with a cross-region copy | In Terraform (`aurora`) |
| **GuardDuty, Security Hub, CloudTrail, AWS Config** | Threat detection, audit trail, compliance posture | **Needed, not in Terraform.** Turn on per account; Organizations-level is best. |
| **Amazon Inspector** | Container and package vulnerability scanning beyond ECR basic scanning | Optional |

### Media, live and AI

| Service | Used for | Status |
| --- | --- | --- |
| **Amazon Rekognition** | Live-stream moderation through frame sampling: nudity and violence. A high-confidence severe hit blurs or pauses the stream and alerts a moderator. | Wired in code (intelligence + go-live, behind flags). **Enable the IAM permissions.** |
| **Amazon Transcribe** | Live-stream audio moderation | Wired in code behind a flag, with an output bucket. **Enable the IAM permissions.** |
| **Malware scanning** (ClamAV container or GuardDuty Malware Protection for S3) | Scans every upload before it's processed or published | Code expects `CLAMAV_HOST`/`CLAMAV_PORT`. **Deploy ClamAV as a service, or switch to GuardDuty for S3.** |
| **Media processing** (sharp + ffmpeg inside the `media` task) | Image variants, video variants and HLS, metadata stripping | Runs in ECS. Consider **MediaConvert** later for heavy video. |

### Observability

| Service | Used for | Status |
| --- | --- | --- |
| **CloudWatch Logs, Metrics, Alarms, Dashboard** | JSON logs from every service. Alarms for ALB, ECS, Aurora, Valkey, MQ, SES and ledger imbalance. | In Terraform (`observability`) |
| **AWS X-Ray** (or Amazon Managed Grafana / Tempo) via an OpenTelemetry collector sidecar | Distributed tracing (`OTEL_EXPORTER_OTLP_ENDPOINT`) | **Needed, not in Terraform.** Local: OTel collector + Jaeger. |
| **AWS Budgets / Cost Anomaly Detection** | Cost alerts | Recommended |

### Later or not planned

Documented in `docs/architecture` with a trigger; none is built or in Terraform.

| Service | Used for | When |
| --- | --- | --- |
| **EventBridge** | Replace or complement the SNS fan-out | Later |
| **Step Functions** | Multi-step payout runs and dispute timelines | Only if real orchestration is needed |
| **Amazon Managed Prometheus and Grafana** | Metrics at higher cardinality | Only past CloudWatch limits |
| **Athena + Glue** | Event analytics on Parquet in S3 | Before ClickHouse |
| **SSM Parameter Store** | Read-only lookups (the ECS-optimised AMI id) | Only for self-hosted LiveKit |
| **MediaConvert / IVS** | Managed transcoding or streaming | Not planned (ffmpeg in `media`, LiveKit for live) |

## 2. Third-party integrations

### Payments and money

| Provider | Used for | What you need | Docs |
| --- | --- | --- | --- |
| **Flutterwave** (target provider, owner decision 2026-10-10) | Per-user payout subaccounts (wallets), card and transfer checkout, escrow locks, payouts, BVN and bank verification, webhooks | Live and test keys, the webhook secret, payout subaccounts enabled on the account | `docs/integrations/flutterwaveMigration.md` |
| **Paystack** (current code, being replaced by Flutterwave) | Card and bank-transfer checkout, saved cards, subscriptions and trials, transfers and payouts, bank account verification, webhooks, split payments. A USD account is needed for UK/EU/US buyers. | Live secret and public keys, the webhook URL, plan codes, transfer setup, plus a USD (domiciliary) account | `docs/integrations/flutterwaveMigration.md` Appendix B |
| **Apple App Store** (in-app purchase) | Creator subscriptions (70 slot products); coins and Premium later | Paid Apps agreement, the products, an In-App Purchase API key (`.p8`), the Server Notifications V2 URL | `docs/integrations/appStoreProducts.md` |
| **Google Play Billing** | The same products on Android | Play payments profile, the products, a service account with the Android Publisher API, Pub/Sub real-time notifications with authenticated push | `docs/integrations/appStoreProducts.md` |
| **Google Cloud Pub/Sub** | Delivers Google Play's real-time developer notifications to our webhook | A topic with an authenticated push subscription | same |

### Identity, verification and anti-abuse

| Provider | Used for | What you need | Docs |
| --- | --- | --- | --- |
| **Smile ID** | Checkmark identity verification (liveness selfie, ID document, face match, NIN lookup), seller business verification (KYB), and the ID-document step for payouts (still to be wired) | Partner id, API key, the callback URL, production approval | `docs/integrations/smileId.md` |
| **Sign in with Apple** | Social login on iOS and web | Apple Services ID, key, client ids (`AUTH_APPLE_CLIENT_IDS`) | — |
| **Google Sign-In** | Social login | OAuth client ids for web, iOS and Android (`AUTH_GOOGLE_CLIENT_IDS`) | — |
| **Cloudflare Turnstile** | Human verification on sign-up and other sensitive forms (web and mobile) | Site key and secret key | — |

### Live streaming and realtime

| Provider | Used for | What you need |
| --- | --- | --- |
| **LiveKit** (LiveKit Cloud by default, or self-hosted on ECS/EC2) | Live video (WebRTC), guest stages, recording to S3 | Project URL, API key and secret, stored in the `zudomart/<env>/livekit` secret |
| **RTMP/HLS ingest** for OBS streaming in Studio (`RTMP_INGEST_URL`, `HLS_PLAYBACK_URL`) | Creators streaming from OBS | Through LiveKit ingress, or a separate ingest service |

### Notifications

| Provider | Used for | What you need |
| --- | --- | --- |
| **Expo Push Service** (`exp.host`) | Mobile push notifications; it forwards to APNs and FCM | Expo project plus an Expo access token. Set `PUSH_PROVIDER` (currently `log` in local). |
| **Apple Push Notification service (APNs)** | iOS delivery, through Expo | An APNs key uploaded to EAS |
| **Firebase Cloud Messaging (FCM)** | Android delivery, through Expo | A Firebase project plus FCM v1 credentials uploaded to EAS |
| **Amazon SES** | Email (see AWS above) | — |

### Mobile build and distribution

| Provider | Used for | What you need |
| --- | --- | --- |
| **Expo / EAS** (Build, Submit, Updates) | APK and AAB, iOS builds, the development client (`expo-dev-client`), store submission | An EAS project; Android keystore and iOS credentials are already managed remotely |
| **Apple Developer Program + App Store Connect** | iOS distribution, IAP, Sign in with Apple, APNs | A paid membership |
| **Google Play Console** | Android distribution and billing | A developer account |

### Engineering

| Provider | Used for | What you need |
| --- | --- | --- |
| **GitHub** (Actions + OIDC to AWS, Dependabot) | CI, image builds and pushes to ECR, deploys, dependency updates | The repo, plus the environments `dev`/`staging`/`prod` with protection rules |
| **Error tracking: Sentry or similar** (optional) | Crash and error reports for the mobile and web apps (jest is already set up to transform `@sentry/react-native`) | Decide whether to add it |
| **Exchange-rate feed** | Live FX for display prices (`EXCHANGE_RATE_PROVIDER` is `static` today) | Choose a provider |
| **Domain registrar + DNS** | `zudomart.com` delegated to Route 53. Subdomains: api, dashboard, ads, studio, admin, app/web, livekit, media CDN. | Registrar access |

## 3. Local stand-ins (development only)

| Local | Stands in for |
| --- | --- |
| Postgres/PostGIS 17 (compose) | Aurora PostgreSQL |
| Valkey | ElastiCache Valkey |
| RabbitMQ | Amazon MQ |
| SeaweedFS (S3 API on `localhost:18333`) | S3 |
| LocalStack | SES, SNS, SQS, Secrets Manager |
| OpenSearch 3 | Amazon OpenSearch Service |
| ClickHouse (`analytics` profile) | Analytics store |
| LiveKit server | LiveKit Cloud |
| OTel collector + Jaeger | X-Ray or another tracing backend |
| Fake Paystack (`127.0.0.1:18999`, Go test server) | Paystack |

## 4. Before the first production deploy

1. **Add the missing Terraform:**
   - OpenSearch (or ship Postgres full-text first)
   - ClamAV or GuardDuty malware scanning
   - the OTel collector sidecar and its X-Ray or Grafana target
   - GuardDuty, Security Hub, CloudTrail and AWS Config
   - Budgets
   - Rekognition and Transcribe IAM
   - the missing S3 buckets and CORS rules
2. **Request SES production access,** then move DMARC from `p=none` to `quarantine` and then `reject` once the reports are clean.
3. **Fill every Secrets Manager placeholder:**
   - Paystack live keys
   - Smile ID, LiveKit
   - Apple: IAP key and root certificates, Sign in with Apple
   - Google: Play service account, OAuth client ids
   - Turnstile, the Expo access token
   - all `*_INTERNAL_TOKEN` values and signing keys
4. **Set the environment settings:**
   - `SUPPORT_NOTIFICATION_EMAILS`: staging currently falls back to the real helpdesk address.
   - `PAYMENT_ADS_RETURN_ORIGINS` and the CORS origins.
   - `ADMIN_IP_ALLOWLIST`.
5. **Finish the store setup:** create the IAP products and notification URLs in App Store Connect and the Play Console (see `appStoreProducts.md`).
6. **Get Paystack ready for production:** go live with the business account, add the USD account, register the webhook URL, and allow-list Paystack's IPs in WAF (already in Terraform).
