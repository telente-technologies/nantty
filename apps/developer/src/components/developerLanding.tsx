import Link from "next/link";

import {
  ActivityIcon,
  ArrowRightIcon,
  BookOpenIcon,
  ChatCircleTextIcon,
  LockIcon,
  PlugsConnectedIcon,
  ShieldCheckIcon,
  TerminalWindowIcon,
  WarningCircleIcon,
} from "@/components/ui/icons";
import { readDeveloperDocsHref, readSandboxPortalUrl } from "@/config/site.config";

import { PublicDocsShell } from "./publicDocsShell";
import { SsoSignInButton } from "./ssoSignInButton";
import styles from "./developerLanding.module.css";

const serviceReadiness = [
  { label: "Business Messaging Sandbox", state: "Live — ntsb_test_ credentials, synthetic conversations & scenarios", tone: "ready", icon: ChatCircleTextIcon },
  { label: "Production Conversation Reads", state: "Consent-scoped GET /api/v1/business/conversations (ntlive_)", tone: "ready", icon: ShieldCheckIcon },
  { label: "Production Message Dispatch", state: "Gated (503) — pending canonical consent & dispatch rollout", tone: "warn", icon: WarningCircleIcon },
  { label: "Commerce, Social & Logistics APIs", state: "Planned — staged for future developer releases", tone: "muted", icon: ActivityIcon },
] as const;

const productCards = [
  {
    title: "API Reference",
    description: "Inspect request headers, parameter schemas, multi-language code snippets, and live 200–503 HTTP status samples.",
    href: readDeveloperDocsHref("api-reference"),
    badge: "OpenAPI 3.1",
    icon: TerminalWindowIcon,
  },
  {
    title: "Isolated Sandbox",
    description: "Create synthetic customers, simulate inbound messages, trigger deterministic scenarios, and verify HMAC webhooks.",
    href: readSandboxPortalUrl(),
    badge: "ntsb_test_",
    icon: PlugsConnectedIcon,
  },
  {
    title: "SSO & 6-Digit OTP Auth",
    description: "Authenticate via OAuth 2.0 PKCE S256 SSO and protect ownership & security actions with Email OTP step-up.",
    href: "/login",
    badge: "PKCE + OTP",
    icon: LockIcon,
  },
] as const;

const integrationSteps = [
  { title: "Sign in with Nantty SSO", description: "Authenticate with your existing Nantty account over OAuth 2.0 Authorization Code + PKCE S256 and create an organization." },
  { title: "Build in the isolated Sandbox", description: "Issue ntsb_test_ credentials, create synthetic customers, simulate conversations, and test signed HMAC webhooks." },
  { title: "Prepare for Production review", description: "Submit your application for admin review to manage ntlive_ keys and consent-scoped conversation reads." },
] as const;

const requestExample = `POST /v1/conversations/<conversation-id>/messages HTTP/1.1
Host: sandbox-api.nantty.com
Authorization: Bearer ntsb_test_<credential>
Content-Type: application/json
Idempotency-Key: sandbox-message-0001

{
  "text": "Your parcel #8421 is ready for pickup."
}`;

const responseExample = `HTTP/1.1 201 Created
Content-Type: application/json
X-Request-Id: req_01JCYAC99E04

{
  "id": "msg_01JCYAC99D8P7Q",
  "conversationId": "3a81e70d-9c52-4a2b-8f13-0e5c8b4e1190",
  "direction": "outbound",
  "status": "queued",
  "createdAt": "2026-11-16T10:18:04Z"
}`;

const tierSummary = [
  { tier: "Sandbox", quota: "10,000 req / mo", access: "Isolated ntsb_test_ sandbox & simulators", price: "Free evaluation" },
  { tier: "Starter", quota: "100,000 req / mo", access: "Approval-gated ntlive_ production reads & webhooks", price: "Managed tier" },
  { tier: "Growth", quota: "1,000,000 req / mo", access: "Multi-app production pipelines & RBAC", price: "Managed tier" },
  { tier: "Enterprise", quota: "10,000,000 req / mo", access: "Custom admin-provisioned organization overrides", price: "Contact sales" },
] as const;

const faqs = [
  { q: "Do I need a separate developer account?", a: "No. Nantty Developers uses centralized Nantty Identity SSO (PKCE S256). Once signed in, you create or join a developer organization with explicit RBAC permissions." },
  { q: "Can Sandbox credentials reach real Nantty users?", a: "Never. Sandbox ntsb_test_ credentials only talk to synthetic test businesses and customers in the isolated Sandbox environment." },
  { q: "How are webhooks verified and secured?", a: "Production webhooks require HTTPS, pass DNS and connect-time public-IP SSRF checks, complete an ownership challenge (/verify), and sign payloads with HMAC-SHA256 in the nantty-signature header." },
] as const;

export function DeveloperLanding() {
  return (
    <PublicDocsShell>
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="developer-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Nantty Developer Platform</p>
            <h1 id="developer-title">Build trusted business integrations on Nantty.</h1>
            <p className={styles.intro}>
              Explore the interactive OpenAPI 3.1 reference, test Business Messaging flows in the isolated Sandbox, and manage organization RBAC, PKCE SSO, and signed webhooks in one unified portal.
            </p>
            <div className={styles.actions}>
              <SsoSignInButton className={styles.primaryAction}>Sign in with Nantty SSO</SsoSignInButton>
              <Link className={styles.secondaryAction} href={readDeveloperDocsHref("api-reference")}>
                <span>Explore API Reference</span>
                <ArrowRightIcon size={15} />
              </Link>
              <Link className={styles.secondaryAction} href="/dashboard">Open Console</Link>
              <Link className={styles.ghostAction} href="/login">Sign-in &amp; OTP</Link>
            </div>
          </div>

          <aside className={styles.statusPanel} aria-labelledby="readiness-title">
            <div className={styles.statusHeading}>
              <span className={styles.statusPulse} aria-hidden="true" />
              <div>
                <h2 id="readiness-title">Platform availability</h2>
                <p>Live service capabilities</p>
              </div>
            </div>
            <ul className={styles.statusList}>
              {serviceReadiness.map(({ label, state, tone, icon: Icon }) => (
                <li key={label}>
                  <Icon size={18} className={tone === "ready" ? styles.iconReady : tone === "warn" ? styles.iconWarn : styles.iconMuted} />
                  <span>
                    <strong>{label}</strong>
                    <small>{state}</small>
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.pricingNote}>Every application begins in the isolated Sandbox. Production sends remain gated (503) while consent reads are live for approved apps.</p>
          </aside>
        </section>

        <section className={styles.quickCards} aria-label="Core developer surfaces">
          {productCards.map(({ title, description, href, badge, icon: Icon }) => (
            <Link key={title} href={href} className={styles.quickCard}>
              <div className={styles.quickCardTop}>
                <span className={styles.quickCardIcon}><Icon size={19} /></span>
                <span className={styles.quickCardBadge}>{badge}</span>
              </div>
              <h2>{title}</h2>
              <p>{description}</p>
            </Link>
          ))}
        </section>

        <section className={styles.section} aria-labelledby="contract-preview-title">
          <div className={styles.sectionHeaderRow}>
            <div>
              <p className={styles.eyebrow}>Developer Experience</p>
              <h2 id="contract-preview-title">Idempotent requests &amp; deterministic responses</h2>
              <p>Every endpoint documents exact request headers, parameter schemas, and status samples (`200`, `201`, `400`, `401`, `409`, `429`, `503`).</p>
            </div>
            <Link href={readDeveloperDocsHref("api-reference")} className={styles.inlineLink}>
              Open interactive API studio <ArrowRightIcon size={14} />
            </Link>
          </div>
          <div className={styles.codeGrid}>
            <div className={styles.codeCard}>
              <div className={styles.codeCardHeader}><span>Request · Sandbox Send</span><code>POST /v1/conversations/…/messages</code></div>
              <pre className={styles.codeBlock}><code>{requestExample}</code></pre>
            </div>
            <div className={styles.codeCard}>
              <div className={styles.codeCardHeader}><span>Response · 201 Created</span><code>X-Request-Id</code></div>
              <pre className={styles.codeBlock}><code>{responseExample}</code></pre>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="start-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Workflow</p>
            <h2 id="start-title">From Sandbox evaluation to approved production</h2>
          </div>
          <ol className={styles.steps}>
            {integrationSteps.map((step, index) => (
              <li key={step.title}>
                <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
                <div><h3>{step.title}</h3><p>{step.description}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="tiers-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Quotas &amp; Tiers</p>
            <h2 id="tiers-title">Predictable organization allowances</h2>
          </div>
          <div className={styles.tierTableWrap}>
            <table className={styles.tierTable}>
              <thead><tr><th scope="col">Tier</th><th scope="col">Monthly allowance</th><th scope="col">Access</th><th scope="col">Availability</th></tr></thead>
              <tbody>
                {tierSummary.map((row) => (
                  <tr key={row.tier}><td><strong>{row.tier}</strong></td><td>{row.quota}</td><td>{row.access}</td><td>{row.price}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="faq-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>FAQ</p>
            <h2 id="faq-title">Security, isolation &amp; onboarding</h2>
          </div>
          <ul className={styles.faqList}>
            {faqs.map((item) => (
              <li key={item.q}>
                <details className={styles.faqItem}><summary>{item.q}</summary><p>{item.a}</p></details>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.privacy} aria-labelledby="privacy-title">
          <BookOpenIcon size={22} />
          <div>
            <h2 id="privacy-title">Personal Nantty conversations stay private</h2>
            <p>The Business Messaging API is a separate, consented integration surface. It never exposes personal conversations or bypasses Messenger end-to-end encryption.</p>
          </div>
          <Link href="/security">Security architecture</Link>
        </section>
      </div>
    </PublicDocsShell>
  );
}
