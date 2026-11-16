# Nantty repository and product inventory

Initial evidence-based inventory for the master implementation effort. Scope is the primary repository at `Desktop/zudomart`; this is not a claim that every route, table, screen, or service has been exhaustively audited.

## Repository boundaries

| Area | Evidence in this repository | Current ownership / note |
|---|---|---|
| Main Nantty web | `apps/web`, `apps/webapp`, `apps/mobile` | Social commerce and account surfaces; use existing contracts rather than creating parallel services. |
| Messenger | `apps/messenger`, `services/elixir/realtime`, Identity and messaging modules | Standalone Expo application; personal messaging and Stories. Chat Bubble requirements and device verification are tracked in Messenger docs. |
| Developer | `apps/developer`, `services/typescript/gateway`, Go Identity | Organization/account management is connected in source; application credentials, API traffic, webhook, usage and billing services are not established. |
| Sandbox | `apps/sandbox`, `services/typescript/sandbox`, Gateway readiness boundary | Separate portal and initial isolated Fastify synthetic messaging service exist. Service source has test-only credentials and a grouped SQL schema (unapplied); organization/grant authorization, webhooks, scenarios, quotas, gateway routing, deployment, and portal operations remain incomplete. |
| Platform administration | `apps/admin` and support services | Existing admin capabilities are not evidence of a Developer/Sandbox organization-operations console. |
| Business and seller products | `apps/seller`, `apps/studio`, `apps/ads` | Distinct product surfaces; inspect their service ownership before adding organization-facing capabilities. |
| Backend services | `services/go`, `services/typescript`, `services/python`, `services/elixir` | Multiple service boundaries. A frontend preview or gateway health response does not establish feature availability. |
| Shared contracts | `services/contracts` | Source for versioned HTTP/event contracts; update alongside owning implementation and tests. |
| Infrastructure | `infra`, `.github`, `compose.yml` | Blueprint/local orchestration only; no deployment or cloud change was made in this task. |
| Database changes | Atlas migration chains under service modules | Identity organization, audit, invitation, application registry and grant migrations remain pending. No SQL migration has been applied. |

## Related workspace repositories

Repository discovery found other folders under `~/Desktop`, including `zudomart-golang` (legacy Go monorepo) and `Zudo` (separate framework/tooling). They are not assumed to be part of the primary Nantty checkout and were not modified. The legacy repository already contains unrelated local work; preserve it.

## Source-of-truth documents to consult by workstream

| Workstream | Starting references |
|---|---|
| Messenger and Business Messaging | [`messenger-and-business-messaging.md`](../architecture/messenger-and-business-messaging.md), [`messenger-developer-page-inventory.md`](../architecture/messenger-developer-page-inventory.md), app-level Messenger docs |
| Sandbox boundary | [`sandbox-service-boundary.md`](../architecture/sandbox-service-boundary.md), `apps/sandbox/README.md` |
| Developer organization authorization | Go `developerOrganizations` module, its migration chain and tests; `apps/developer/README.md`; Gateway route allowlist/tests |
| API and async contracts | `services/contracts` (OpenAPI/AsyncAPI and generated contracts) |
| Build/deploy | root/app READMEs, `.github/workflows`, `infra` docs; verify current workflow before claiming deployment |

## Audit boundaries

This baseline is deliberately conservative. “Not found” is not a proof of non-existence outside this checkout. Before implementing a broad feature, search the owning app, backend, contracts, tests, migrations, jobs/events and infrastructure, then update the matrix with evidence paths and executed checks.
