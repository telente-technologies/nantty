# Nantty Developer Portal

Standalone Next.js workspace for the future public API and business-integration console.

Run locally with `pnpm --filter @nantty/developer dev` (port 3700).

The organization workspace connects to Go Identity through a same-origin server proxy. It supports organization list/create/detail/access/roles, member list/detail, role changes, member removal, organization detail updates, a step-up-protected ownership transfer to an existing member, owner-only audit log, and invitations to existing active accounts with verified email. Invitees accept or decline from their authenticated Developer portal inbox; no invitation email is sent. It sends no long-lived access token to browser JavaScript and renders no fabricated organization records. Ownership transfer currently prompts for the account password; passwordless email-code confirmation is not yet wired into this portal.

For local development, sign in at the Nantty web app on `localhost:3500`; its host-only cookie is shared across local ports. Production cross-domain SSO is not implemented, and the organization proxy intentionally returns `PORTAL_SSO_NOT_CONFIGURED` rather than widening cookie scope. Organization, audit-log and invitation tables are defined by pending Identity migrations; do not run migrations as part of a UI build. The invitation migration has not been applied, and database integration verification remains outstanding until the local Postgres test service is available.

The public Business API, application and credential services, webhooks, usage ledger, and billing APIs are still unavailable. This portal must not claim those services are operational or create keys, API traffic, or sample production data. See [`docs/master`](../../docs/master/README.md) for ecosystem status and implementation gates.
