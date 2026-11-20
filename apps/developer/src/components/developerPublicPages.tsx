"use client";

import Link from "next/link";
import { useState } from "react";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CopyIcon } from "@/components/ui/icons";
import { readDeveloperDocsHref, readDeveloperSupportUrl, readSandboxPortalUrl } from "@/config/site.config";

import { ApiReferenceExplorer } from "./apiReferenceExplorer";
import { type DocGuideSlug } from "@/config/docs.config";
import styles from "./developerPublicPages.module.css";

export { docGuideSlugs, type DocGuideSlug } from "@/config/docs.config";

const guideOrder: readonly Exclude<DocGuideSlug, "business-messaging" | "messaging">[] = [
  "quickstart",
  "api-reference",
  "authentication",
  "webhooks",
  "sandbox",
  "errors",
  "rate-limits",
  "billing",
];

const errorCatalog = [
  { status: 400, code: "IDEMPOTENCY_KEY_REQUIRED", category: "4xx", meaning: "Include a valid Idempotency-Key header on message sends." },
  { status: 400, code: "INVALID_REQUEST", category: "4xx", meaning: "Request JSON failed schema or length validation." },
  { status: 401, code: "INVALID_SANDBOX_CREDENTIAL", category: "4xx", meaning: "Missing, expired, revoked, or wrong-environment ntsb_test_ key." },
  { status: 403, code: "APPLICATION_NOT_APPROVED", category: "4xx", meaning: "Production credentials require administrative application approval." },
  { status: 403, code: "INSUFFICIENT_SCOPE", category: "4xx", meaning: "Credential lacks required scope such as conversations:read or messages:send." },
  { status: 404, code: "CONVERSATION_NOT_FOUND", category: "4xx", meaning: "Target conversation or customer does not belong to this application." },
  { status: 409, code: "IDEMPOTENCY_CONFLICT", category: "4xx", meaning: "Idempotency-Key reused with a different message payload." },
  { status: 429, code: "SANDBOX_QUOTA_EXCEEDED", category: "4xx", meaning: "Monthly Sandbox message allowance reached; inspect details.resetAt." },
  { status: 429, code: "MONTHLY_QUOTA_EXCEEDED", category: "4xx", meaning: "Organization monthly production allowance reached." },
  { status: 503, code: "BUSINESS_MESSAGING_UNAVAILABLE", category: "5xx", meaning: "Production message dispatch remains gated pending canonical consent rollout." },
] as const;

const docGuides: Record<Exclude<DocGuideSlug, "business-messaging" | "messaging" | "api-reference">, {
  readonly title: string;
  readonly summary: string;
  readonly badge: string;
  readonly sections: readonly { readonly heading: string; readonly body: string; readonly code?: string }[];
}> = {
  quickstart: {
    title: "Quickstart",
    badge: "Getting Started",
    summary: "Sign in with Nantty PKCE SSO, create an organization, register an application, and issue your first ntsb_test_ Sandbox credential.",
    sections: [
      {
        heading: "1. Authenticate and create an organization",
        body: "Sign in via OAuth 2.0 PKCE S256 at /login (which initiates /api/auth/login). Create an organization and register an application in the Developer Console; idempotent headers ensure retries never duplicate records.",
      },
      {
        heading: "2. Issue a Sandbox credential & create a customer",
        body: "Generate an ntsb_test_ credential under API credentials (Sandbox mode), create a synthetic customer, open a conversation, and send an idempotent message.",
        code: `curl -X POST "https://sandbox-api.nantty.com/v1/customers" \\
  -H "Authorization: Bearer <ntsb_test_key>" \\
  -H "Content-Type: application/json" \\
  -d '{"externalReference":"cust-01","displayName":"Ada Obi"}'`,
      },
      {
        heading: "3. Send a message & inspect webhooks",
        body: "Include a unique Idempotency-Key on every send. Retrying with the same key returns 200 Idempotent-Replayed without double-sending.",
        code: `curl -X POST "https://sandbox-api.nantty.com/v1/conversations/<conversation-id>/messages" \\
  -H "Authorization: Bearer <ntsb_test_key>" \\
  -H "Idempotency-Key: idem-001" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Hello from Nantty Sandbox!"}'`,
      },
    ],
  },
  authentication: {
    title: "Authentication, SSO & OTP Step-Up",
    badge: "Security",
    summary: "Centralized Nantty Identity PKCE S256 SSO for portal sessions, 6-digit OTP / password step-up for privileged actions, and environment-isolated bearer tokens for APIs.",
    sections: [
      {
        heading: "Cross-domain Developer SSO (PKCE S256)",
        body: "The Developer Portal authenticates via OAuth 2.0 Authorization Code + PKCE S256 against Identity (/api/v1/auth/sso/authorize and /api/v1/auth/sso/token) and stores a host-only HttpOnly BFF cookie.",
      },
      {
        heading: "6-digit Email OTP & Step-Up Verification",
        body: "Sensitive operations such as organization ownership transfer require fresh step-up verification via POST /api/developer/otp/send, POST /api/developer/otp/verify, and POST /api/developer/step-up, issuing a single-use X-Step-Up-Token.",
      },
      {
        heading: "Environment-bound API tokens",
        body: "Sandbox tokens begin with ntsb_test_ and are rejected on production routes. Approval-gated ntlive_ keys are stored as SHA-256 digests and authorize consented conversation reads.",
      },
    ],
  },
  webhooks: {
    title: "Webhooks & Signatures",
    badge: "Operations",
    summary: "HTTPS-only webhook delivery with DNS/connect-time SSRF protection, challenge verification, and HMAC-SHA256 signatures.",
    sections: [
      {
        heading: "Ownership verification",
        body: "Production endpoints must respond 2xx with {\"challenge\":\"<value>\"} when triggered via POST .../webhooks/{webhookID}/verify. Private, loopback, and link-local IPs are rejected at both validation and socket connect time.",
      },
      {
        heading: "Verifying Nantty-Signature",
        body: "Compute HMAC-SHA256 using your whsec_ signing secret over `${t}.${rawBody}`, enforce a replay window (e.g. 300s), and compare digests in constant time.",
        code: `// Headers received:
// nantty-signature: t=1763337600,v1=<hmac_sha256_hex>
// nantty-event-id: <uuid>

const signedPayload = \`\${timestamp}.\${rawRequestBody}\`;
const expected = createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");`,
      },
    ],
  },
  sandbox: {
    title: "Sandbox Guide",
    badge: "Testing",
    summary: "Isolated synthetic testing environment for customer consent, inbound simulation, delivery failures, and deterministic scenario validation.",
    sections: [
      {
        heading: "Strict data & credential isolation",
        body: "Sandbox uses a dedicated data store and synthetic customer IDs. Resetting Sandbox data clears synthetic conversations while preserving your monthly Sandbox usage ledger.",
      },
      {
        heading: "Interactive Sandbox Console",
        body: "Launch the isolated Sandbox console to run deterministic delivery/read/failure scenarios, inspect redacted API requests, and trigger test webhook deliveries.",
      },
    ],
  },
  errors: {
    title: "Error Reference",
    badge: "Reference",
    summary: "Standard machine-readable error codes returned across Identity, Gateway, and Sandbox APIs.",
    sections: [
      {
        heading: "Standard error envelope",
        body: "Every error response uses a consistent JSON structure containing error.code, error.message, and optional error.details (such as remaining quota and resetAt).",
        code: `{
  "error": {
    "code": "SANDBOX_QUOTA_EXCEEDED",
    "message": "Monthly Sandbox message allowance reached.",
    "details": {
      "limit": 10000,
      "remaining": 0,
      "resetAt": "2026-12-01T00:00:00Z"
    }
  }
}`,
      },
    ],
  },
  "rate-limits": {
    title: "Rate Limits & Quotas",
    badge: "Operations",
    summary: "Organization-scoped monthly allowances and Gateway per-route rate limiting.",
    sections: [
      {
        heading: "Monthly allowances",
        body: "Sandbox starts at 10,000 requests/month. Production tiers configure 10,000 (Sandbox), 100,000 (Starter), 1,000,000 (Growth), and 10,000,000 (Enterprise) requests/month enforced atomically server-side.",
      },
    ],
  },
  billing: {
    title: "Billing & Plans",
    badge: "Organization",
    summary: "Organization subscription tiers, server-enforced quota ceilings, and admin custom overrides.",
    sections: [
      {
        heading: "Quota tiers",
        body: "All new organizations start on the free Sandbox tier. Paid checkout remains gated until merchant PSP billing connects; custom enterprise overrides are managed by platform administrators.",
      },
    ],
  },
};

function CopyCodeBlock({ code }: { readonly code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure.
    }
  }

  return (
    <div className={styles.codeBoxWrap}>
      <button type="button" className={styles.codeCopyBtn} onClick={() => void copy()}>
        {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <pre className={styles.codeBlock}><code>{code}</code></pre>
    </div>
  );
}

export function DeveloperGuideArticle({ slug }: { readonly slug: Exclude<DocGuideSlug, "business-messaging" | "messaging"> }) {
  const [errorFilter, setErrorFilter] = useState<"ALL" | "4xx" | "5xx">("ALL");
  const [helpful, setHelpful] = useState<"" | "yes" | "no">("");

  if (slug === "api-reference") {
    return (
      <article className={styles.guidePage} aria-labelledby="guide-title">
        <header className={styles.guideHeader}>
          <p className={styles.eyebrow}>API Reference</p>
          <h1 id="guide-title">Nantty HTTP API Reference</h1>
          <p>Explore live Sandbox routes, consent-scoped Production conversation reads, request schemas, multi-language snippets, and HTTP status samples.</p>
        </header>
        <ApiReferenceExplorer />
      </article>
    );
  }

  const guide = docGuides[slug];
  const idx = guideOrder.indexOf(slug);
  const prevSlug = idx > 0 ? guideOrder[idx - 1] : null;
  const nextSlug = idx >= 0 && idx < guideOrder.length - 1 ? guideOrder[idx + 1] : null;
  const filteredErrors = errorFilter === "ALL" ? errorCatalog : errorCatalog.filter((e) => e.category === errorFilter);

  return (
    <article className={styles.guidePage} aria-labelledby="guide-title">
      <header className={styles.guideHeader}>
        <div className={styles.eyebrowRow}>
          <span className={styles.eyebrow}>{guide.badge}</span>
          <span className={styles.updatedPill}>Updated Nov 2026</span>
        </div>
        <h1 id="guide-title">{guide.title}</h1>
        <p>{guide.summary}</p>
        <div className={styles.guideHeaderActions}>
          <Link href={readDeveloperDocsHref("api-reference")} className={styles.primaryAction}>Open API Reference</Link>
          <a href={readSandboxPortalUrl()} className={styles.secondaryAction}>Open Sandbox Console ↗</a>
          <Link href="/login" className={styles.secondaryAction}>Sign in &amp; OTP</Link>
        </div>
      </header>

      <div className={styles.sectionsGrid}>
        {guide.sections.map((section) => (
          <section key={section.heading} className={styles.sectionCard}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
            {section.code ? <CopyCodeBlock code={section.code} /> : null}
          </section>
        ))}

        {slug === "errors" ? (
          <section className={styles.sectionCard} aria-labelledby="error-matrix-title">
            <div className={styles.matrixHeader}>
              <div>
                <h2 id="error-matrix-title">Status &amp; Error Code Matrix</h2>
                <p>Filter machine-readable error codes returned across Gateway, Identity, and Sandbox.</p>
              </div>
              <div className={styles.filterPills}>
                {(["ALL", "4xx", "5xx"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`${styles.filterPill} ${errorFilter === cat ? styles.filterPillActive : ""}`}
                    onClick={() => setErrorFilter(cat)}
                  >
                    {cat === "ALL" ? "All codes" : cat}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr><th scope="col">Status</th><th scope="col">Error Code</th><th scope="col">Meaning</th></tr>
                </thead>
                <tbody>
                  {filteredErrors.map((item) => (
                    <tr key={`${item.status}-${item.code}`}>
                      <td><span className={`${styles.statusCode} ${item.category === "5xx" ? styles.codeDanger : styles.codeWarn}`}>{item.status}</span></td>
                      <td><code>{item.code}</code></td>
                      <td>{item.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>

      <section className={styles.feedbackBar} aria-label="Documentation feedback">
        <span>Was this guide helpful?</span>
        <div className={styles.feedbackActions}>
          <button type="button" aria-pressed={helpful === "yes"} className={helpful === "yes" ? styles.feedbackActive : undefined} onClick={() => setHelpful("yes")}>Yes</button>
          <button type="button" aria-pressed={helpful === "no"} className={helpful === "no" ? styles.feedbackActive : undefined} onClick={() => setHelpful("no")}>Needs detail</button>
          {helpful ? <small>{helpful === "yes" ? "Thanks for the feedback!" : <>Tell us what’s missing via <a href={readDeveloperSupportUrl()}>Developer Support</a>.</>}</small> : null}
        </div>
      </section>

      <nav className={styles.guidePager} aria-label="Guide pagination">
        {prevSlug ? (
          <Link href={readDeveloperDocsHref(prevSlug)} className={styles.pagerLink}>
            <span><ArrowLeftIcon size={14} /> Previous</span>
            <strong>{prevSlug === "api-reference" ? "API Reference" : docGuides[prevSlug].title}</strong>
          </Link>
        ) : <span />}
        {nextSlug ? (
          <Link href={readDeveloperDocsHref(nextSlug)} className={`${styles.pagerLink} ${styles.pagerNext}`}>
            <span>Next <ArrowRightIcon size={14} /></span>
            <strong>{nextSlug === "api-reference" ? "API Reference" : docGuides[nextSlug].title}</strong>
          </Link>
        ) : null}
      </nav>
    </article>
  );
}

export function DeveloperPublicArticle({
  eyebrow,
  title,
  summary,
  notice,
  items,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly summary: string;
  readonly notice?: string;
  readonly items: readonly { readonly heading: string; readonly detail: string; readonly meta?: string }[];
}) {
  return (
    <article className={styles.guidePage} aria-labelledby="public-page-title">
      <header className={styles.guideHeader}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 id="public-page-title">{title}</h1>
        <p>{summary}</p>
      </header>
      {notice ? <div className={styles.noticeBox} role="note">{notice}</div> : null}
      <div className={styles.sectionsGrid}>
        {items.map((item) => (
          <section key={item.heading} className={styles.sectionCard}>
            <h2>{item.heading}</h2>
            {item.meta ? <p className={styles.itemMeta}>{item.meta}</p> : null}
            <p>{item.detail}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
