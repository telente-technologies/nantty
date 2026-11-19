# Nantty Developer Portal

Standalone Next.js workspace (`apps/developer`, port `3700`) for Nantty public API documentation, developer onboarding, Sandbox integration testing, and approval-gated Production Business Messaging management.

Run locally with `pnpm --filter @nantty/developer dev`.

## Implemented Capabilities (`IMPLEMENTED_UNVERIFIED`)

- **Centralized PKCE S256 Cross-Domain SSO (`/api/auth/{login,callback,logout,session}`)**: Source code provides an Identity handoff and host-only `HttpOnly` session cookie. Production configuration, session security and the full browser workflow require verification before use.
- **Organization & Team RBAC (`/organization`, `/onboarding`, `/invitations/[token]`, `/audit-logs`)**: Supports idempotent organization creation, role management, member removal, step-up-protected ownership transfer, owner audit logs, and invitations that emit transactional `developerOrganization.invitationCreated` outbox events (`packages/emailTemplates` + `services/typescript/notifications`).
- **Applications, Credentials & Webhooks (`/applications`, `/credentials`, `/webhooks`, `/requests`, `/usage`)**:
  - **Sandbox mode (`ntsb_test_`)**: Integrated with Identity effective capabilities and `services/typescript/sandbox` (`apps/sandbox` bridge at `/sandbox`).
  - **Production mode (`ntlive_`)**: Approval-gated (`developer_applications.status = 'approved'`) production credentials, challenge-verified webhooks (`POST .../verify`), secret rotation (`POST .../rotate-secret`), DNS + connect-time SSRF-safe signed delivery worker (`developerProduction`), redacted request logs, and organization billing tiers (`/billing`: `sandbox`, `starter`, `growth`, `enterprise`).
- **Public Website & OpenAPI 3.1 Docs (`/`, `/products`, `/pricing`, `/changelog`, `/security`, `/support`, `/legal/*`, `/docs/*`, `/docs/openapi.json`)**: Describes Sandbox and proposed production Business Messaging routes alongside preview legal notices. Production access is not verified.

For local development, sign in at the Nantty web app on `localhost:3500`; its host-only cookie is shared across local ports. Organization, audit-log and invitation tables are defined by Identity migrations; do not run migrations as part of a UI build. The [master matrix](../../docs/master/NANTTY_REQUIREMENTS_MATRIX.md) records earlier disposable fresh-schema tests. Persistent migration application, upgraded-schema replay and the signed-in browser workflow remain unverified.

See [`docs/master/README.md`](../../docs/master/README.md) and [`docs/developer-platform/IMPLEMENTATION_STATUS.md`](../../docs/developer-platform/IMPLEMENTATION_STATUS.md) for current verification status and remaining runtime/migration/PSP gates.
