# Nantty Sandbox Portal

Standalone Next.js workspace for the isolated public API test environment.

Run locally with `pnpm --filter @nantty/sandbox dev` (port 3800).

This is a separately branded and labeled portal foundation. Its server-side `/api/sandbox/readiness` route probes only `SANDBOX_API_BASE_URL/readyz`; it never proxies API calls or sends user data. In production, configure `https://sandbox-api.nantty.com` or a dedicated HTTPS host ending `.sandbox.nantty.com`. A ready gateway does not mean that synthetic tenants, test credentials, request inspection, or scenario runners are implemented. The UI therefore does not execute API requests or fabricate results. Do not deploy it as an interactive API sandbox until environment isolation is enforced server-side.
