# Zudomart architecture docs

Start with [system.md](system.md): the current system, checked against the code on 2026-10-11 (services, data ownership, events, money flow, auth, realtime, deployment).

The topic documents below go deeper. Most were written as design notes on 2026-10-03, when little of the backend existed, so their **EXISTING / PROPOSED / ABSENT** labels are dated: many items marked PROPOSED have since been built. Each dated document says so at the top. Where one disagrees with `system.md` or the code, the code wins.

## Fixed decisions

- One PostgreSQL database (Aurora + PostGIS in AWS) with a schema per owning service; only the owner writes it.
- Transactional outbox into RabbitMQ (Amazon MQ in AWS). No Kafka. The SNS/SQS adapters remain in the code behind `EVENT_BUS=sqs` but are not used.
- ECS on Fargate via Terraform; no Kubernetes or service mesh.
- Six Go deployables (ent + Atlas), a TypeScript gateway and five TypeScript services (Prisma), Phoenix realtime, and Python intelligence that returns scores only.
- Flutterwave is the only payment provider. Zudomart never holds customer money: in Nigeria each user's money is in their own payout subaccount and escrow is a lock on the buyer's balance; outside Nigeria payment is direct, with no escrow, and sellers must be identity-verified.
- go-money's ledger is the single financial truth. Points are never money.
- LiveKit for live video; chat is end-to-end encrypted with no plaintext fallback.
- One store or one business page per personal account, plus one brand.
- Consents are versioned; the docs make no compliance claims.
- Code layout: [services/zudojsStructure.md](../../services/zudojsStructure.md).

## Index

| Document | Summary | State |
| --- | --- | --- |
| [system.md](system.md) | Whole-system overview | Current (2026-10-11) |
| [payments.md](payments.md) | Two economies, ledger, escrow, wallets, coins, payouts, reconciliation | Current (2026-10-11); flows in [flutterwaveMigration.md](../integrations/flutterwaveMigration.md) |
| [widgetsApiContract.md](widgetsApiContract.md) | Home-screen widgets and the embeddable web widget API | Current |
| [liveSafety.md](liveSafety.md) | Live reports, frame sampling, safety holds, Live incidents queue | Design (2026-10-04) |
| [events.md](events.md) | Outbox, event catalogue, queue choice, background jobs | Dated (2026-10-03) |
| [realtime.md](realtime.md) | Phoenix realtime and the livestream stack | Sections 1 and 2 current; the rest is the 2026-10-03 design |
| [backend.md](backend.md) | Deployables, ownership matrix, API design audit, findings | Dated (2026-10-03) |
| [database.md](database.md) | Domain ERDs, schema ownership matrix, DB reliability | Dated (2026-10-03) |
| [frontend.md](frontend.md) | Front-end apps, BFF pattern, data layer | Dated (2026-10-03); mode switching is in [runningLocally.md](../runningLocally.md) |
| [marketplace.md](marketplace.md) | Catalog, inventory, carts by seller, checkout, orders, shipping | Dated (2026-10-03) |
| [logisticsV2.md](logisticsV2.md) | V2 logistics: provider quotes, Chowdeck Relay first, delivery cost allocation, insurance, redelivery | Planned (2026-10-20); seller delivery remains current |
| [media.md](media.md) | Uploads, processing, storage and delivery | Dated (2026-10-03) |
| [search.md](search.md) | Postgres search now, OpenSearch only on a trigger | Dated (2026-10-03, with a 2026-10-04 MVP section) |
| [recommendations.md](recommendations.md) | Ranking and personalisation; Python scores, deterministic fallbacks | Dated (2026-10-04) |
| [analytics.md](analytics.md) | Product, seller and creator analytics | Dated (2026-10-03) |
| [fraud.md](fraud.md) | Fraud, trust and moderation | Dated (2026-10-03) |
| [privacy.md](privacy.md) | Consent, data rights, retention | Dated (2026-10-03) |
| [security.md](security.md) | Security controls mapped to services | Dated (2026-10-03) |
| [observability.md](observability.md) | Traces, logs, metrics, SLOs, alerts | Dated (2026-10-03) |
| [devops.md](devops.md) | CI/CD, environments, AWS layout, scale triggers | Dated (2026-10-03); Terraform facts in [infra/aws/README.md](../../infra/aws/README.md) |
| [disaster-recovery.md](disaster-recovery.md) | Backup, restore, failover targets | Proposed; nothing is applied |
| [inventory.md](inventory.md) | Factual audit of the repo on 2026-10-03 | Historical snapshot, superseded by `system.md` |
| [microservicesPlan.json](microservicesPlan.json) | Early proposed service map (commands, queries, events per module) | Historical; its Kafka, MSK and EKS parts were overruled |

Related: [../runningLocally.md](../runningLocally.md) (local stack and mode switch), [../backendPlan.md](../backendPlan.md) (backend contracts and wiring order, 3 Oct draft, partly built), [../database/README.md](../database/README.md), [../../SECURITY.md](../../SECURITY.md).
