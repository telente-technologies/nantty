import Link from "next/link";

import {
  ArrowRightIcon,
  BookOpenIcon,
  ChatCircleTextIcon,
  KeyIcon,
  LockIcon,
  ShieldCheckIcon,
  TerminalWindowIcon,
  WarningCircleIcon,
} from "@/components/ui/icons";
import { readDeveloperDocsHref, readDeveloperSupportUrl, readSandboxPortalUrl } from "@/config/site.config";

import { ApiReferenceExplorer } from "./apiReferenceExplorer";
import styles from "./businessMessagingDocs.module.css";

const quickNavCards = [
  {
    title: "Quickstart",
    description: "Authenticate via PKCE S256 SSO, create an organization, and issue your first ntsb_test_ key.",
    href: readDeveloperDocsHref("quickstart"),
    icon: TerminalWindowIcon,
    badge: "5 min",
  },
  {
    title: "Authentication & OTP",
    description: "Cross-domain SSO, environment-isolated keys, and 6-digit email OTP step-up verification.",
    href: readDeveloperDocsHref("authentication"),
    icon: KeyIcon,
    badge: "PKCE + OTP",
  },
  {
    title: "Webhooks & Signatures",
    description: "Verify ownership challenges, SSRF protections, and constant-time HMAC-SHA256 signatures.",
    href: readDeveloperDocsHref("webhooks"),
    icon: ShieldCheckIcon,
    badge: "HMAC-SHA256",
  },
  {
    title: "Isolated Sandbox",
    description: "Simulate synthetic customers, conversations, delivery receipts, and quota resets safely.",
    href: readSandboxPortalUrl(),
    icon: ChatCircleTextIcon,
    badge: "ntsb_test_",
  },
] as const;

const scopes = [
  "messages:send",
  "messages:read",
  "conversations:read",
  "conversations:write",
  "customers:read",
  "media:write",
  "media:read",
  "webhooks:manage",
  "analytics:read",
] as const;

const lifecycleStates = ["queued", "sent", "delivered", "read", "failed"] as const;

const webhookEvents = [
  "message.received",
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "conversation.started",
  "conversation.updated",
  "conversation.closed",
  "customer.opted_in",
  "customer.opted_out",
] as const;

export function BusinessMessagingDocs() {
  return (
    <article className={styles.page} aria-labelledby="messaging-title">
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <BookOpenIcon size={15} />
            <span>Nantty Developer Documentation</span>
          </p>
          <h1 id="messaging-title">Business Messaging API &amp; Reference</h1>
          <p>
            Build consented business conversations, idempotent message workflows, and verified HMAC webhook consumers on Nantty.
            Inspect live Sandbox endpoints, multi-language request samples, and every HTTP response status code below.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link href={readDeveloperDocsHref("quickstart")} className={styles.primaryBtn}>
            <span>Start Quickstart</span>
            <ArrowRightIcon size={16} />
          </Link>
          <Link href={readDeveloperDocsHref("openapi.json")} className={styles.secondaryBtn}>
            OpenAPI 3.1 JSON
          </Link>
        </div>
      </header>

      <section className={styles.statusBanner} role="status" aria-labelledby="contract-state-title">
        <span className={styles.statusIcon}><WarningCircleIcon size={20} /></span>
        <div className={styles.statusBody}>
          <div className={styles.statusHeader}>
            <span className={styles.statusPill}>Sandbox Send Live</span>
            <span className={styles.statusPillRead}>Production Consent-Scoped Reads</span>
            <span className={styles.statusPillWarn}>Production Send 503 Preview</span>
          </div>
          <h2 id="contract-state-title">Environment availability &amp; production boundary</h2>
          <p>
            <code>POST /v1/conversations/&#123;conversationId&#125;/messages</code> and all synthetic Sandbox routes are live with <code>ntsb_test_</code> tokens.
            In Production, <code>GET /api/v1/business/conversations</code> lists conversations only when the app has an active grant for the requested store and the customer consented to that same store, with <code>conversations:read</code> scope,
            and the <code>messages:read</code>-scoped history and status routes expose only messages persisted by this API while matching store consent remains active. Customers can approve store-scoped consent using a registered callback and S256 PKCE; the app redeems a short-lived code with its own <code>ntlive_</code> credential to receive the exact consent receipt. This is not a Nantty user access token. Inbound message synchronization and delivery/read receipts are not connected yet.
            <code>POST /api/v1/business/messages</code> remains unavailable until canonical encrypted message dispatch is connected.
          </p>
        </div>
      </section>

      <section className={styles.cardsGrid} aria-label="Documentation guides">
        {quickNavCards.map(({ title, description, href, icon: Icon, badge }) => (
          <Link key={title} href={href} className={styles.navCard}>
            <div className={styles.navCardTop}>
              <span className={styles.navCardIcon}><Icon size={18} /></span>
              <span className={styles.navCardBadge}>{badge}</span>
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
          </Link>
        ))}
      </section>

      <section className={styles.referenceSection} aria-labelledby="interactive-ref-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Interactive Endpoint Studio</p>
            <h2 id="interactive-ref-title">Endpoints, parameters &amp; status samples</h2>
            <p>Select any endpoint, switch between cURL / Node.js / Python / Go, and inspect live HTTP response samples (200, 201, 400, 401, 403, 404, 409, 429, 503).</p>
          </div>
        </div>
        <ApiReferenceExplorer initialEndpointId="send-sandbox-message" />
      </section>

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="trust-title">
          <div className={styles.panelHeading}>
            <LockIcon size={18} />
            <div>
              <p className={styles.eyebrow}>Trust boundary</p>
              <h2 id="trust-title">Business access vs. personal chats</h2>
            </div>
          </div>
          <p className={styles.panelCopy}>
            Integrations can only access business conversations where the business is an authorized participant and customer consent is active.
            Personal end-to-end encrypted Nantty Messenger conversations are strictly isolated and unreachable by developer credentials.
          </p>
          <div className={styles.subBlock}>
            <h3>Message lifecycle</h3>
            <ol className={styles.lifecycle}>
              {lifecycleStates.map((state) => <li key={state}><code>{state}</code></li>)}
            </ol>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="scopes-title">
          <div className={styles.panelHeading}>
            <ShieldCheckIcon size={18} />
            <div>
              <p className={styles.eyebrow}>Authorization</p>
              <h2 id="scopes-title">OAuth scopes &amp; webhook events</h2>
            </div>
          </div>
          <div className={styles.subBlock}>
            <h3>Application scopes</h3>
            <ul className={styles.tagList}>
              {scopes.map((scope) => <li key={scope}><code>{scope}</code></li>)}
            </ul>
            <p className={styles.panelCopy}>For customer consent, generate a 43–128 character PKCE verifier and S256 challenge, then direct the customer to <code>https://nantty.com/connect/business-messaging</code> with <code>applicationId</code>, <code>storeId</code>, <code>redirect_uri</code>, <code>code_challenge</code>, <code>code_challenge_method=S256</code>, and fresh <code>state</code> query parameters. Approval returns a code that expires in 60 seconds, is single-use, and must be exchanged server-to-server with the same application&apos;s live credential. If the customer declines, the callback receives <code>error=access_denied</code> and the original state, without a code. Keep the verifier server-side; the receipt does not authenticate a Nantty user.</p>
          </div>
          <div className={styles.subBlock}>
            <h3>Webhook event types</h3>
            <ul className={styles.tagList}>
              {webhookEvents.map((ev) => <li key={ev}><code>{ev}</code></li>)}
            </ul>
          </div>
        </section>
      </div>

      <footer className={styles.docFooter}>
        <ChatCircleTextIcon size={19} />
        <p>
          Need help debugging an integration or requesting production review? Include your organization ID and <code>X-Request-Id</code> when contacting{" "}
          <a href={readDeveloperSupportUrl()}>Nantty Developer Support</a>.
        </p>
      </footer>
    </article>
  );
}
