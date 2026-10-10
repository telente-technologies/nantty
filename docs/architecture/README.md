# Zudomart architecture docs

As of 2026-10-03. Start with [inventory.md](inventory.md): it is the factual audit of what exists and the source every other document cites. Everything else describes the target, and labels each item by status.

## Status legend

| Label | Meaning | Rule |
| --- | --- | --- |
| **EXISTING** | Implemented code in this repo | Always cites a path. "WIP" means present in the working tree but uncommitted or without routes |
| **MOCK-ONLY** | A frontend works against in-process mocks (`apps/*/src/mocks`); no real backend serves it | Mock shapes are contracts to converge on, not proof of behaviour |
| **PROPOSED** | Only in `docs/backendPlan.md`, `microservicesPlan.json`, `infra/aws/README.md` or these docs | Not built. Never read as available |
| **OPTIONAL FUTURE** | Deliberately deferred | Each comes with the trigger metric that would justify it |

Fixed owner decisions (not up for debate in these docs): one Aurora PostgreSQL + PostGIS cluster with a schema per owner; outbox -> SNS/SQS, no Kafka on day one; ECS/Fargate, no Kubernetes or mesh; 6 Go deployables (ent + Atlas), TS gateway and social/IO services, Phoenix realtime, Python scores only; LiveKit; S3 + CloudFront; ledger owned by go-money is the single financial truth; sellers ship per order group; points are never money; consents versioned, no compliance claims. Code layout: [services/zudojsStructure.md](../../services/zudojsStructure.md).

## Index

| Document | Summary |
| --- | --- |
| [inventory.md](inventory.md) | Factual audit: apps, services, data models, events, infra, security, tests, doc-vs-code gaps |
| [system.md](system.md) | Whole-system view: current vs recommended architecture in edge, services/data, async/external diagrams |
| [backend.md](backend.md) | Go deployables and modules, TS/Elixir/Python services, Zudojs code layout, ownership matrix, API design audit, sync/async classification |
| [database.md](database.md) | Domain ERDs (identity, social, marketplace, payments, live, gifts/points, ads, shipping, privacy), schema ownership matrix, DB reliability |
| [events.md](events.md) | Outbox flow, event catalog, financial event guarantees, queue technology comparison, background jobs |
| [frontend.md](frontend.md) | Frontend apps, BFF pattern, data layer and mock switching |
| [marketplace.md](marketplace.md) | Catalog, inventory, carts by seller, checkout, orders, shipping |
| [payments.md](payments.md) | Payments, ledger, escrow, wallets, coins, payouts, reconciliation |
| [realtime.md](realtime.md) | Phoenix realtime and the livestream stack (LiveKit, guests, battles, gifts fan-out) |
| [liveSafety.md](liveSafety.md) | Live reports, frame sampling, Rekognition/Transcribe scoring, safety holds, Live incidents queue, CSAM hook (LEGAL REVIEW) |
| [media.md](media.md) | Uploads, processing, storage and delivery |
| [search.md](search.md) | Search now (Postgres) and later (OpenSearch) |
| [recommendations.md](recommendations.md) | Ranking and personalization; Python scores, deterministic fallbacks |
| [analytics.md](analytics.md) | Product and seller/creator analytics pipelines |
| [fraud.md](fraud.md) | Fraud, trust and moderation |
| [privacy.md](privacy.md) | Consent, data rights, retention (no compliance claims) |
| [security.md](security.md) | Security controls mapped to services |
| [observability.md](observability.md) | Traces, logs, metrics, SLOs, alerts |
| [devops.md](devops.md) | CI/CD, environments, AWS layout |
| [disaster-recovery.md](disaster-recovery.md) | Backup, restore, failover targets |
| [microservicesPlan.json](microservicesPlan.json) | Proposed service map (commands, queries, events per module) |

Related plans outside this folder: `docs/backendPlan.md` (backend contracts and wiring order), `docs/plans.md` (frontend mock contracts), `SECURITY.md` (baseline rules, written against the old monolith's paths).

- [improvementReport.md](./improvementReport.md) — prioritised P0–P3 findings, current vs recommended architecture, migration plan and phases
