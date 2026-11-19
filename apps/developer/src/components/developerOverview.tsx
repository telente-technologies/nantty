import Link from "next/link";
import { readDeveloperDocsHref } from "@/config/site.config";
import { GatewayReadiness } from "./gatewayReadiness";

import styles from "./developerOverview.module.css";

const platformServices = [
  { label: "Organizations & applications", status: "Active", tone: "ready", href: "/organization", detail: "Create organizations, manage role-based members and invitations, register applications, and configure per-member grants." },
  { label: "Sandbox credentials", status: "Active (Sandbox)", tone: "ready", href: "/credentials", detail: "Issue, rotate, expire, and revoke ntsb_test_ credentials scoped to authorized applications." },
  { label: "Sandbox webhooks", status: "Active (Sandbox)", tone: "ready", href: "/webhooks", detail: "Manage HTTPS endpoints, signing secrets, queued deliveries, and retries for isolated Sandbox events." },
  { label: "Request logs & usage", status: "Active (Sandbox)", tone: "ready", href: "/requests", detail: "Inspect redacted Sandbox API requests and track monthly Sandbox quota utilization." },
  { label: "Production Business API & billing", status: "Contract preview", tone: "muted", href: readDeveloperDocsHref("business-messaging"), detail: "Production Business Messaging endpoints and paid billing plans remain disabled pending production release gates." },
] as const;

const onboardingSteps = [
  { title: "Create an organization & application", detail: "Register your organization, invite teammates, and declare your application scopes and callback origins.", href: "/organization" },
  { title: "Configure member access grants", detail: "Assign per-application Sandbox grants (credentials, webhooks, request logs, usage) to team members.", href: "/applications" },
  { title: "Issue Sandbox credentials", detail: "Generate environment-bound ntsb_test_ credentials with optional expiration and one-time secret reveal.", href: "/credentials" },
  { title: "Verify Business Messaging contract", detail: "Review consented customer conversations, idempotency, and privacy boundaries; personal chats remain end-to-end encrypted.", href: readDeveloperDocsHref("business-messaging") },
  { title: "Configure signed webhooks & inspect logs", detail: "Verify HTTPS endpoints, test signed deliveries, and trace request IDs across Sandbox traffic.", href: "/webhooks" },
] as const;

export function DeveloperOverview() {
  return (
    <section className={styles.page} aria-labelledby="overview-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>NANTTY DEVELOPER PLATFORM</p>
          <h1 id="overview-title">Developers</h1>
          <p>Build, authorize, and monitor Sandbox business integrations with Nantty.</p>
        </div>
        <Link href={readDeveloperDocsHref()} className={styles.docsLink}>Read API documentation <span aria-hidden="true">↗</span></Link>
      </header>

      <div className={styles.previewNotice} role="note">
        <div><strong>Sandbox is open — production access requires application approval</strong><span>Signed-in organization members can manage apps, issue <code>ntsb_test_</code> credentials, configure Sandbox webhooks, and apply for approval to unlock <code>ntlive_</code> keys, verified production webhooks, and usage tiers.</span></div>
        <Link href={readDeveloperDocsHref()}>Review API contract</Link>
      </div>

      <div className={styles.workspaceGrid}>
        <section className={styles.servicePanel} aria-labelledby="service-status-title">
          <div className={styles.sectionHeading}>
            <div><h2 id="service-status-title">Platform services</h2><p>Current availability across Developer and Sandbox controls</p></div>
          </div>
          <GatewayReadiness />
          <div className={styles.tableScroll}>
            <table aria-label="Developer platform service availability">
              <thead><tr><th scope="col">Service</th><th scope="col">State</th><th scope="col">Details</th></tr></thead>
              <tbody>{platformServices.map(({ label, status, tone, href, detail }) => (
                <tr key={label}>
                  <th scope="row"><Link href={href}>{label}</Link></th>
                  <td data-label="State"><span className={`${styles.statusBadge} ${tone === "ready" ? styles.statusReady : styles.statusMuted}`}>{status}</span></td>
                  <td data-label="Details">{detail}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className={styles.panelIntro}>Gateway readiness above is queried live from <code>/api/platform-readiness</code>.</p>
        </section>

        <aside className={styles.workspaceDetail} aria-labelledby="workspace-detail-title">
          <div className={styles.detailTopline}><span className={styles.detailMark} aria-hidden="true" />Environment status</div>
          <h2 id="workspace-detail-title">Start in the isolated Sandbox</h2>
          <p>Validate consented Business Messaging flows, idempotent sends, and signed webhook consumers before production launch.</p>
          <div className={styles.detailFacts}>
            <div><span>Sandbox API & keys</span><strong>Active (ntsb_test_)</strong></div>
            <div><span>Production traffic</span><strong>Closed (preview)</strong></div>
            <div><span>Personal chats</span><strong>End-to-end encrypted</strong></div>
          </div>
          <Link href={readDeveloperDocsHref("business-messaging")} className={styles.detailAction}>Review Business Messaging <span aria-hidden="true">→</span></Link>
        </aside>
      </div>

      <section className={styles.integrationSection} aria-labelledby="integration-steps-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="integration-steps-title">Integration path</h2><p>Recommended sequence for setting up your organization, Sandbox keys, and webhook consumers.</p></div>
        </div>
        <ol className={styles.stepList}>
          {onboardingSteps.map((step, index) => (
            <li key={step.title}>
              <div className={styles.stepCopy}>
                <span className={styles.stepIndex}>{String(index + 1).padStart(2, "0")}</span>
                <Link href={step.href}>{step.title}</Link>
                <p>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <aside className={styles.securityNote}>
        <strong>Business messaging boundary</strong>
        <span>Public business integration endpoints are not yet available. Personal end-to-end encrypted conversations remain outside this developer platform.</span>
      </aside>
    </section>
  );
}
