import Link from "next/link";
import { NanttyWordmark, ThemeSwitcher } from "@nantty/web-kit";

import { ActivityIcon, BookOpenIcon, ChatCircleTextIcon, PlugsConnectedIcon, WarningCircleIcon } from "@/components/ui/icons";
import { readDeveloperDocsHref, readDeveloperSupportUrl, readNanttyWebUrl } from "@/config/site.config";

import { SsoSignInButton } from "./ssoSignInButton";
import styles from "./developerLanding.module.css";

const serviceReadiness = [
  { label: "Business Messaging API", state: "Sandbox available; Production is not live (503)", icon: ChatCircleTextIcon },
  { label: "Sandbox control plane", state: "Active — ntsb_test_ credentials, scenarios, logs & HMAC webhooks", icon: PlugsConnectedIcon },
  { label: "Commerce, Social & Logistics APIs", state: "Planned — staged for future developer releases", icon: ActivityIcon },
] as const;

const integrationSteps = [
  { title: "Sign in with Nantty SSO", description: "Authenticate with your existing Nantty account over OAuth 2.0 Authorization Code + PKCE S256 and create an organization." },
  { title: "Build in the isolated Sandbox", description: "Issue ntsb_test_ credentials, create synthetic businesses and customers, simulate conversations, and test signed webhooks." },
  { title: "Prepare for Production review", description: "Production API access is not enabled yet; application review does not currently unlock live Business Messaging." },
] as const;

const requestExample = `POST /v1/conversations/<conversation-id>/messages HTTP/1.1
Host: sandbox-api.nantty.com
Authorization: Bearer ntsb_test_<credential>
Content-Type: application/json
Idempotency-Key: sandbox-message-0001

{
  "text": "This is a synthetic Sandbox message."
}`;

const webhookExample = `POST https://partner.example.com/webhooks/nantty HTTP/1.1
Content-Type: application/json
nantty-event-id: 9b4d7c1e-8c1a-4c6e-a0e1-7a9b2f10c312
nantty-signature: t=1763337600,v1=7f4b9c21...

{
  "id": "9b4d7c1e-8c1a-4c6e-a0e1-7a9b2f10c312",
  "event": "business.message.queued",
  "createdAt": "2026-11-17T08:00:00Z",
  "data": { "messageId": "msg_...", "status": "queued" }
}`;

const tierSummary = [
  { tier: "Sandbox", quota: "10,000 req / mo", access: "Isolated ntsb_test_ sandbox & simulators", price: "Free evaluation" },
  { tier: "Starter", quota: "100,000 req / mo", access: "Approval-gated ntlive_ production messaging", price: "Managed tier" },
  { tier: "Growth", quota: "1,000,000 req / mo", access: "Multi-app production pipelines & webhooks", price: "Managed tier" },
  { tier: "Enterprise", quota: "10,000,000 req / mo", access: "Custom admin-provisioned organization overrides", price: "Contact sales" },
] as const;

const faqs = [
  { q: "Do I need a separate developer account?", a: "No. Nantty Developers uses centralized Nantty Identity SSO (PKCE S256). Once signed in, you create or join a developer organization with explicit RBAC permissions." },
  { q: "Can Sandbox credentials reach real Nantty users?", a: "Never. Sandbox ntsb_test_ credentials only talk to synthetic test businesses and customers in the isolated Sandbox environment." },
  { q: "How are webhooks verified and secured?", a: "Production webhooks require HTTPS, pass DNS and connect-time public-IP SSRF checks, complete an ownership challenge (/verify), and sign payloads with HMAC-SHA256 in the nantty-signature header." },
] as const;

export function DeveloperLanding() {
  return (
    <div className={`${styles.site} nanttyPortalTheme`}>
      <a className={styles.skipLink} href="#main-content">Skip to content</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Nantty Developers home"><NanttyWordmark height={26} /></Link>
        <nav className={styles.nav} aria-label="Developer resources">
          <Link href="/products">Products</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href={readDeveloperDocsHref()}>Docs</Link>
          <Link href="/changelog">Changelog</Link>
          <Link href="/dashboard">Console</Link>
        </nav>
        <ThemeSwitcher iconOnly label="Colour theme" />
        <details className={styles.mobileNav}>
          <summary><span className={styles.srOnly}>Open developer navigation</span><span aria-hidden="true">Menu</span></summary>
          <nav aria-label="Developer resources">
            <Link href="/products">Products</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href={readDeveloperDocsHref()}>Docs</Link>
            <Link href="/changelog">Changelog</Link>
            <Link href="/dashboard">Console</Link>
            <SsoSignInButton className={styles.mobileAction}>Sign in</SsoSignInButton>
          </nav>
        </details>
      </header>

      <main id="main-content" className={styles.main} tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="developer-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Nantty for Developers</p>
            <h1 id="developer-title">Build trusted business integrations on Nantty.</h1>
            <p className={styles.intro}>Use the isolated Sandbox control plane, manage organization RBAC and PKCE SSO, and apply for approval to unlock production Business Messaging keys, verified webhooks, and metered quotas.</p>
            <div className={styles.actions}>
              <SsoSignInButton className={styles.primaryAction}>Sign in with Nantty SSO</SsoSignInButton>
              <Link className={styles.secondaryAction} href={readDeveloperDocsHref("quickstart")}>Read quickstart</Link>
              <Link className={styles.secondaryAction} href="/dashboard">Open console</Link>
            </div>
          </div>
          <aside className={styles.statusPanel} aria-labelledby="readiness-title">
            <div className={styles.statusHeading}>
              <WarningCircleIcon size={19} />
              <div><h2 id="readiness-title">Platform availability</h2><p>Actual implementation status</p></div>
            </div>
            <ul className={styles.statusList}>
              {serviceReadiness.map(({ label, state, icon: Icon }) => (
                <li key={label}>
                  <Icon size={19} className={styles.statusIcon} />
                  <span><strong>{label}</strong><small>{state}</small></span>
                </li>
              ))}
            </ul>
            <p className={styles.pricingNote}>Every application starts in the isolated Sandbox. Production Business Messaging remains unavailable even after application review.</p>
          </aside>
        </section>

        <section className={styles.section} aria-labelledby="contract-preview-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Developer experience</p>
            <h2 id="contract-preview-title">OpenAPI 3.1 requests &amp; HMAC webhooks</h2>
            <p>Grounded directly in the mounted Identity and Sandbox HTTP endpoints. Verify every webhook with timestamped HMAC-SHA256 signatures and deduplicate via <code>nantty-event-id</code>.</p>
          </div>
          <div className={styles.codeGrid}>
            <div className={styles.codeCard}>
              <div className={styles.codeCardHeader}><span>Sandbox Test Message</span><code>POST /v1/conversations/…/messages</code></div>
              <pre className={styles.codeBlock}><code>{requestExample}</code></pre>
            </div>
            <div className={styles.codeCard}>
              <div className={styles.codeCardHeader}><span>Signed Webhook Envelope</span><code>nantty-signature</code></div>
              <pre className={styles.codeBlock}><code>{webhookExample}</code></pre>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="start-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Workflow</p>
            <h2 id="start-title">From Sandbox evaluation to approved production</h2>
            <p>Each step uses real Identity permissions, isolated test storage, and auditable admin approvals.</p>
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
            <p className={styles.eyebrow}>Quotas &amp; tiers</p>
            <h2 id="tiers-title">Predictable organization allowances</h2>
            <p>Sandbox and Production usage are metered independently. Final commercial pricing is managed by Nantty billing configuration.</p>
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
            <p>Key architectural guarantees enforced across Identity, Gateway, and Sandbox.</p>
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
          <div><h2 id="privacy-title">Personal Nantty conversations stay private</h2><p>The Business Messaging API is a separate, consented integration surface. It never exposes personal conversations or bypasses Messenger end-to-end encryption.</p></div>
          <Link href="/security">Security architecture</Link>
        </section>
      </main>

      <footer className={`${styles.footer} nanttyPortalFooter`}>
        <div className={styles.footerMain}>
          <div className={styles.footerBrand}>
            <Link href="/" aria-label="Nantty Developers home"><NanttyWordmark height={26} tone="onDark" /></Link>
            <p>Build consented business messaging and commerce workflows with Nantty.</p>
          </div>
          <nav className={styles.footerGroups} aria-label="Developer footer">
            <div><h2>Platform</h2><Link href="/products">API products</Link><Link href="/pricing">Pricing &amp; quotas</Link><Link href={readDeveloperDocsHref()}>Documentation</Link><Link href="/changelog">Changelog</Link></div>
            <div><h2>Trust &amp; Legal</h2><Link href="/security">Security</Link><Link href="/support">Developer support</Link><Link href="/legal/developer-terms">Developer terms</Link><Link href="/legal/acceptable-use">Acceptable use</Link></div>
            <div><h2>Nantty</h2><a href={readDeveloperSupportUrl()}>Contact support</a><a href={new URL("/terms", readNanttyWebUrl()).toString()}>Terms</a><a href={new URL("/privacy", readNanttyWebUrl()).toString()}>Privacy</a><a href={readNanttyWebUrl()}>Nantty.com</a></div>
          </nav>
        </div>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} Nantty</span><span>Sandbox testing is active; production Business Messaging credentials require application approval.</span></div>
        <p className={`${styles.footerWordmark} nanttyPortalFooterWordmark`} aria-hidden="true">Nantty</p>
      </footer>
    </div>
  );
}
