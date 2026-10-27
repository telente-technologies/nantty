# AWS sales call prep

Prepared 2026-10-10 for the call on 2026-10-11. The architecture and services are in
[awsAndThirdPartyIntegrations.md](awsAndThirdPartyIntegrations.md), and the Terraform is in `infra/aws`. Nothing has been deployed yet.

## 1. Your 60-second pitch

> Nantty is a Nigerian social marketplace: a short-video and live-streaming social app where people can buy
> directly from the stores and creators they follow. It covers escrow-protected checkout, creator subscriptions,
> gifts, live shopping and an ads platform. We have six web apps, a React Native app, and a backend of Go,
> TypeScript, Elixir and Python microservices on one Postgres. It's built and tested, with infrastructure as code,
> and launches in Nigeria first, then GH, KE, ZA, the UK, the EU and the US. We want AWS as our only cloud from
> day one, and we're looking for credits, architecture guidance, and a path to the right Region for Nigerian users.

Have ready: launch date, team size, funding stage and investors (or none), expected users at months 3/6/12, and
whether you're in an accelerator. **Credits depend on these.**

## 2. What we'll run on AWS

| Area | Services |
| --- | --- |
| Compute | ECS on Fargate (about 14 services), ECR, Application Auto Scaling, CodeDeploy (blue/green for the money service), Cloud Map |
| Network and edge | VPC with NAT and endpoints, ALB (public and internal), WAF v2, Route 53, ACM, CloudFront (signed URLs), Shield Standard |
| Data | Aurora PostgreSQL + RDS Proxy, ElastiCache (Valkey), Amazon MQ (RabbitMQ), S3 (incl. Object Lock for KYC), OpenSearch (planned) |
| Messaging | SES (email), SNS, SQS |
| Security | KMS, Secrets Manager, IAM + GitHub OIDC, AWS Backup (cross-region), GuardDuty / Security Hub / CloudTrail / Config (planned) |
| Media and AI | Rekognition (live-stream moderation), Transcribe (live audio moderation), possibly MediaConvert later, Bedrock maybe later |
| Observability | CloudWatch (logs, metrics, alarms, dashboards), X-Ray via OpenTelemetry |
| Accounts | 3 accounts (dev, staging, prod) under AWS Organizations, plus a DR region for prod backups and replication |

Rough early monthly estimate (prod plus a small dev/staging, before real traffic). This is my estimate, so ask them to
check it in the Pricing Calculator:

| Item | Range (USD/month) |
| --- | --- |
| Fargate (about 14 small services, 2 tasks each in prod) | 400–900 |
| Aurora PostgreSQL (2 small instances + RDS Proxy) | 300–700 |
| Amazon MQ (RabbitMQ; single instance in dev, cluster in prod) | 100–700 |
| ElastiCache Valkey | 60–200 |
| NAT gateways, ALBs, WAF, endpoints | 200–450 |
| S3, CloudFront, data transfer (grows with video) | 100–1,000+ |
| SES, SNS/SQS, KMS, Secrets Manager, CloudWatch | 100–300 |
| Rekognition and Transcribe (live moderation, per minute or frame) | usage-based, can grow fast |
| **Total, early stage** | **roughly 1,500–4,500**, before video traffic scales |

## 3. Credits and programmes to ask for

Ask for **all** of these. Different teams own different pots.

1. **AWS Activate.**
   - Founders: self-serve, about $1,000, sometimes up to $5,000 over time.
   - Portfolio: up to $200,000 (AWS's current official figure), but only through an **Activate Provider** (accelerator, VC or incubator), using their Organizational ID.
   - Ask: *"Which Activate Providers do you work with in Nigeria or West Africa, and can you introduce us?"*
2. **Proof-of-concept or migration credits from the account team.** Account managers and startup SAs can often approve POC credits for a defined build, separately from Activate. Ask: *"Can you sponsor POC credits for our first production rollout, e.g. 3–6 months of the stack above?"*
3. **AI credits.** AWS says credits above $200,000 exist for AI startups "ready to scale", through the account manager. We use Rekognition and Transcribe for live-stream safety, plus recommendation and ranking ML, so ask whether that qualifies, or whether Bedrock or SageMaker usage would.
4. **Support plan credits.** Ask for Business Support to be covered by credits, or for a free trial period.
5. **Training and certification vouchers** for the team.
6. **Marketplace or partner introductions:** a Nigeria-based AWS partner for setup help, and the AWS Startups Africa community.

**How to ask for more credits:**
- Tie them to milestones: *"We'll launch in Nigeria in [month]; with credits for 12 months we can commit to AWS-only and grow to [X] users. At [Y] monthly spend we'd move to a Savings Plan or EDP with you."*
- Show the Terraform and architecture. It proves you'll actually consume credits on AWS, which makes the request credible.
- Ask for credits **in tranches** (e.g. $X now, more at launch, more at a user milestone). It's easier for them to approve.
- Ask the expiry date of each credit pot (usually 1–2 years) and which services they **don't** cover (often Marketplace, some AI services, Support, and upfront Savings Plans or Reserved Instances).
- Ask for everything in writing (email) with the amounts, expiry and conditions.

## 4. Questions to ask, and what to expect

| # | Question | Expected answer | What to watch for |
| --- | --- | --- | --- |
| 1 | **Which Region for Nigerian users: Cape Town (af-south-1) or Europe (eu-west-1/2)?** | Cape Town is the only African Region. Europe often has lower latency to Lagos over undersea cables, and more services at lower prices. | Ask for real latency numbers from Lagos to both. Cape Town is an opt-in Region, usually priced higher, and **may lack some services** (see 2). |
| 2 | **Are Rekognition, Transcribe, Amazon MQ, OpenSearch, SES and RDS Proxy all available in the Region you recommend?** | Some AI services aren't in af-south-1. | If not, plan a hybrid: core in one Region, AI calls to another. Ask about the cross-region data-transfer cost and the data-protection implications. |
| 3 | **What runs in the Lagos Local Zone?** | It launched in 2023 to put compute, storage and databases close to Lagos. Local Zones usually support EC2/EBS-type workloads, **not** the full set of managed services. | Useful for latency-sensitive pieces (realtime, LiveKit, media edge) only if Fargate or ECS on EC2 runs there. Get the exact service list. |
| 4 | **Data protection: does the NDPA (Nigeria Data Protection Act 2023) require Nigerian data in Nigeria, and what does AWS offer?** | AWS supplies the Data Processing Addendum, its compliance reports (Artifact) and encryption; legal residency is your call. | Ask for the DPA and the cross-border transfer documentation. Have your lawyer confirm NDPC requirements. |
| 5 | **Billing: can we pay in USD from a Nigerian card or account, or by invoice? Are there billing entities for Nigeria?** | Card payment in USD is common; invoicing comes with higher spend. | Ask about FX or card limits (Nigerian cards often have USD caps). Ask whether **AWS Nigeria** or a reseller can bill locally. |
| 6 | **Can a Solutions Architect review our architecture (a Well-Architected Review) before launch?** | Usually yes, free for startups. | Book it. Ask whether completing it unlocks extra credits; sometimes it does. |
| 7 | **SES: how fast is production access, and are there sending limits for a new account?** | Request it through the console; approval takes about 24 hours with a good use case. | Ask them to flag the account so it isn't stuck in the sandbox. |
| 8 | **Amazon MQ for RabbitMQ vs SNS/SQS: is MQ the right call for us at small scale?** | MQ has a fixed cost per broker. | Ask about the cheapest production-grade MQ size, or whether SQS/SNS would cut cost. |
| 9 | **Fargate vs ECS on EC2 vs App Runner for cost at our scale; Graviton (ARM) savings?** | Fargate Spot and Graviton can save 20–50%. | Our Go and Node images can be built for ARM. Ask about Fargate Spot for workers. |
| 10 | **Savings Plans, and when an Enterprise Discount Program (EDP) makes sense** | Savings Plans from about 1 year of commitment; EDP usually at roughly $100k+ yearly spend. | Don't commit before you've seen real usage for 2–3 months. |
| 11 | **Video and live streaming: should we use IVS, or keep LiveKit (self-hosted or LiveKit Cloud)?** | They may pitch Amazon IVS. | Compare per-minute cost and latency in Africa. IVS might reduce what you build yourself; ask whether credits cover it. |
| 12 | **Security: GuardDuty, Security Hub and malware scanning for S3 uploads; are there startup bundles or free trials?** | Most offer 30-day free trials; malware protection for S3 is per-GB. | Ask about including them in credits. |
| 13 | **Support: what's included with credits, and how fast is Business Support in our time zone?** | Business Support gives a 1-hour response for production-down cases. | Ask whether credits cover it. |
| 14 | **Startup programmes in Africa: AWS Startups Africa, accelerator partners, events, co-marketing** | Programmes and community events. | Get names and introductions, and follow up with an email. |
| 15 | **Who is our dedicated account manager and SA, and how do we escalate?** | Names and emails. | Get both in writing. |

## 5. Things NOT to agree to on the call

- Upfront commitments (EDP, 3-year Reserved Instances or Savings Plans) before launch.
- Moving off LiveKit or Flutterwave because a sales rep suggests it. Evaluate first.
- Sharing customer data or exact revenue figures you're not comfortable with; ranges are fine.
- Any Marketplace purchase "paid with credits" without checking whether credits actually apply.

## 6. Follow-up email template (send the same day)

> Thanks for today's call. Summary of what we discussed: (1) credits: [amount/pots/expiry]; (2) Region guidance:
> [answer]; (3) Solutions Architect review booked for [date]; (4) introductions to [Activate Provider/partner];
> (5) SES production access request [case id]. Our account IDs: dev [..], staging [..], prod [..]. Please confirm the
> credit amounts and conditions in writing. Best, Oluwayemi (Nantty).

## Sources

- [Everything you need to know about AWS Activate credits (AWS)](https://aws.amazon.com/aws-startups/learn/everything-you-need-to-know-about-aws-activate-credits/)
- [Applying for AWS Activate credits, step by step (AWS)](https://aws.amazon.com/aws-startups/learn/applying-for-aws-activate-credits-a-step-by-step-guide/)
- [Lagos launches first AWS Local Zone in Africa (Connecting Africa)](https://www.connectingafrica.com/cloud-networking/lagos-launches-first-aws-local-zone-in-africa)
- [AWS launches Local Zone edge locations in Lagos, Lima and Querétaro (DCD)](https://datacenterdynamics.com/en/news/aws-launches-local-zone-edge-locations-in-lagos-lima-and-quer%C3%A9taro)
