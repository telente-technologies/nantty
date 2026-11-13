# Nantty Sandbox Portal

Standalone Next.js workspace for the isolated public API test environment.

Run locally with `pnpm --filter @nantty/sandbox dev` (port 3800).

This is a separately branded and labeled portal foundation. No sandbox API, synthetic-tenant data store, test credential service, request inspector, or deterministic event runner is connected. The UI therefore does not issue requests or fabricate simulation results. Do not deploy it as an interactive API sandbox until environment isolation is enforced server-side.
