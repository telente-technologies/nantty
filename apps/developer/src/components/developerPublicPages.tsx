import Link from "next/link";

import { readDeveloperDocsHref, readDeveloperSupportUrl, readSandboxPortalUrl } from "@/config/site.config";
import { buildBusinessMessagingOpenApiSpec } from "@/lib/businessMessagingOpenApi";

import styles from "./developerLanding.module.css";

export const docGuideSlugs = [
  "business-messaging",
  "messaging",
  "quickstart",
  "api-reference",
  "authentication",
  "webhooks",
  "sandbox",
  "errors",
  "rate-limits",
  "billing",
] as const;

export type DocGuideSlug = (typeof docGuideSlugs)[number];

const docGuides: Record<Exclude<DocGuideSlug, "business-messaging" | "messaging">, {
  readonly title: string;
  readonly summary: string;
  readonly sections: readonly { readonly heading: string; readonly body: string; readonly code?: string }[];
}> = {
  quickstart: {
    title: "Quickstart",
    summary: "Sign in with Nantty PKCE SSO, create an organization, register an application, and issue your first ntsb_test_ Sandbox credential.",
    sections: [
      {
        heading: "1. Authenticate and create an organization",
        body: "Use your existing Nantty account at /api/auth/login. Create an organization and application in the Developer Console; idempotent retries never create duplicates.",
      },
      {
        heading: "2. Call Sandbox Business Messaging",
        body: "Issue an ntsb_test_ token from API credentials (Sandbox environment), create a synthetic customer and conversation, then send a message with an Idempotency-Key header.",
        code: `curl -X POST https://sandbox-api.nantty.com/v1/customers \\\n  -H "Authorization: Bearer ntsb_test_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"externalReference":"cust-01","displayName":"Ada Obi"}'`,
      },
    ],
  },
  "api-reference": {
    title: "API Reference",
    summary: "Live Sandbox HTTP routes and consent-scoped Production conversation reads.",
    sections: [
      {
        heading: "OpenAPI 3.1 Schema",
        body: "Download the machine-readable OpenAPI 3.1 specification at /docs/openapi.json or /api/openapi.json.",
      },
      {
        heading: "Production Business Messaging is limited",
        body: "Approved applications with an active recipient consent and the conversations:read scope can list consented conversations. Sending remains unavailable and returns 503 BUSINESS_MESSAGING_UNAVAILABLE until secure dispatch and canonical consent management are connected. Use synthetic Sandbox data to test sending.",
      },
    ],
  },
  authentication: {
    title: "Authentication & SSO",
    summary: "Centralized Nantty Identity PKCE S256 SSO for portal sessions and environment-isolated bearer tokens for APIs.",
    sections: [
      {
        heading: "Cross-domain Developer SSO",
        body: "The Developer Portal authenticates via OAuth 2.0 Authorization Code + PKCE S256 against Identity (/api/v1/auth/sso/authorize and /api/v1/auth/sso/token) and stores a host-only HttpOnly BFF cookie.",
      },
      {
        heading: "Environment-bound API tokens",
        body: "Sandbox tokens begin with ntsb_test_ and are rejected on production routes. Approval-gated ntlive_ credentials can be managed in the portal and are stored as SHA-256 digests, but Production Business Messaging itself remains unavailable (503).",
      },
    ],
  },
  webhooks: {
    title: "Webhooks & Signatures",
    summary: "HTTPS-only webhook delivery with DNS/connect-time SSRF protection, challenge verification, and HMAC-SHA256 signatures.",
    sections: [
      {
        heading: "Ownership verification",
        body: "Production endpoints must respond 2xx with {\"challenge\":\"<value>\"} when triggered via POST .../webhooks/{webhookID}/verify.",
      },
      {
        heading: "Verifying Nantty-Signature",
        body: "Compute HMAC-SHA256 using your whsec_ signing secret over `${t}.${rawBody}` and compare in constant time against v1= in the nantty-signature header.",
        code: `nantty-signature: t=1763337600,v1=<hmac_sha256_hex>\nnantty-event-id: <uuid>`,
      },
    ],
  },
  sandbox: {
    title: "Sandbox Guide",
    summary: "Isolated synthetic testing environment for customer consent, inbound simulation, delivery failures, and scenario validation.",
    sections: [
      {
        heading: "Strict isolation",
        body: "Sandbox uses a dedicated data store and synthetic customer IDs. Resetting Sandbox data preserves your monthly Sandbox usage ledger.",
      },
      {
        heading: "Interactive console",
        body: "Launch the Sandbox console for test businesses, conversation simulation, webhook event simulator, and API explorer.",
      },
    ],
  },
  errors: {
    title: "Error Reference",
    summary: "Standard machine-readable error codes returned across Identity, Gateway, and Sandbox APIs.",
    sections: [
      {
        heading: "Standard envelope",
        body: "Errors return JSON with code, message, and optional details. Common codes include UNAUTHORIZED (401), APPLICATION_NOT_APPROVED (403), INSUFFICIENT_SCOPE (403), IDEMPOTENCY_CONFLICT (409), and MONTHLY_QUOTA_EXCEEDED / SANDBOX_QUOTA_EXCEEDED (429).",
      },
    ],
  },
  "rate-limits": {
    title: "Rate Limits & Quotas",
    summary: "Organization-scoped monthly allowances and Gateway per-route rate limiting.",
    sections: [
      {
        heading: "Monthly allowances",
        body: "Sandbox starts at 10,000 requests/month. Production tiers configure 10,000 (Sandbox), 100,000 (Starter), 1,000,000 (Growth), and 10,000,000 (Enterprise) requests/month enforced server-side.",
      },
    ],
  },
  billing: {
    title: "Billing & Usage Rules",
    summary: "Independent metering for Sandbox and Production environments with server-owned entitlements.",
    sections: [
      {
        heading: "Quota enforcement & upgrades",
        body: "Tier upgrades never bypass application approval. When a monthly quota is exhausted, affected API requests return HTTP 429 while portal access remains open.",
      },
    ],
  },
};

export function DeveloperGuidePageView({ slug }: { readonly slug: Exclude<DocGuideSlug, "business-messaging" | "messaging"> }) {
  const guide = docGuides[slug];
  const spec = buildBusinessMessagingOpenApiSpec();
  const routeCount = Object.keys(spec.paths).length;

  return (
    <article className={styles.heroCopy} style={{ maxWidth: "820px" }}>
      <p className={styles.eyebrow}>Nantty Developers / Documentation</p>
      <h1 style={{ fontSize: "clamp(1.9rem, 3.2vw, 2.75rem)", letterSpacing: "-0.04em", margin: "0 0 var(--space-3)" }}>{guide.title}</h1>
      <p className={styles.intro} style={{ marginTop: 0 }}>{guide.summary}</p>
      <p style={{ marginTop: "var(--space-3)", color: "var(--color-text-subtle)", fontSize: "var(--fs-12)" }}>
        OpenAPI {spec.info.version} · {routeCount} documented route paths · <Link href="/docs/openapi.json">Download OpenAPI JSON</Link>
      </p>
      <div style={{ display: "grid", gap: "var(--space-5)", marginTop: "var(--space-6)" }}>
        {guide.sections.map((section) => (
          <section key={section.heading} style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
            <h2 style={{ fontSize: "var(--fs-16)", margin: "0 0 var(--space-2)" }}>{section.heading}</h2>
            <p style={{ margin: 0, color: "var(--color-text-muted)", lineHeight: 1.65 }}>{section.body}</p>
            {section.code ? (
              <pre className={styles.codeBlock} style={{ marginTop: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-sunken)" }}>
                <code>{section.code}</code>
              </pre>
            ) : null}
          </section>
        ))}
      </div>
      <div className={styles.actions}>
        <Link className={styles.primaryAction} href="/dashboard">Open Developer Console</Link>
        <a className={styles.secondaryAction} href={readSandboxPortalUrl()} target="_blank" rel="noopener noreferrer">Open Sandbox Console ↗</a>
      </div>
    </article>
  );
}

export function DeveloperPublicArticle({
  eyebrow,
  title,
  summary,
  items,
  notice,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly summary: string;
  readonly items: readonly { readonly heading: string; readonly detail: string; readonly meta?: string }[];
  readonly notice?: string;
}) {
  return (
    <article style={{ maxWidth: "880px" }}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 style={{ fontSize: "clamp(1.9rem, 3.2vw, 2.75rem)", letterSpacing: "-0.04em", margin: "0 0 var(--space-3)" }}>{title}</h1>
      <p className={styles.intro} style={{ marginTop: 0 }}>{summary}</p>
      {notice ? (
        <p style={{ marginTop: "var(--space-4)", padding: "var(--space-3) var(--space-4)", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sm)", background: "var(--color-sunken)", fontSize: "var(--fs-13)" }}>
          {notice}
        </p>
      ) : null}
      <div style={{ display: "grid", gap: "var(--space-4)", marginTop: "var(--space-6)" }}>
        {items.map((item) => (
          <section key={item.heading} style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "var(--fs-16)", margin: "0 0 var(--space-1)" }}>{item.heading}</h2>
              {item.meta ? <span style={{ fontSize: "var(--fs-12)", color: "var(--color-text-subtle)" }}>{item.meta}</span> : null}
            </div>
            <p style={{ margin: 0, color: "var(--color-text-muted)", lineHeight: 1.65 }}>{item.detail}</p>
          </section>
        ))}
      </div>
      <div className={styles.actions}>
        <Link className={styles.primaryAction} href={readDeveloperDocsHref()}>Read documentation</Link>
        <a className={styles.secondaryAction} href={readDeveloperSupportUrl()}>Contact developer support</a>
      </div>
    </article>
  );
}
