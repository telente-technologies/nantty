import Link from "next/link";
import { readDeveloperDocsHref } from "@/config/site.config";
import { GatewayReadiness } from "./gatewayReadiness";

import styles from "./developerOverview.module.css";

const platformServices = [
  { label: "Organization access", status: "Not available", href: "/applications", detail: "Organization and role APIs are not mounted." },
  { label: "Business API", status: "Contract only", href: readDeveloperDocsHref(), detail: "No public business API routes are mounted." },
  { label: "Credentials", status: "Not available", href: "/credentials", detail: "Credential issuance and rotation are not connected." },
  { label: "Request logs and usage", status: "Not available", href: "/requests", detail: "No developer traffic or usage ledger is recorded." },
] as const;

const onboardingSteps = [
  { title: "Register your integration", detail: "Identify your organization, callback origins, purpose, and requested scopes.", href: "/applications" },
  { title: "Review access", detail: "Nantty reviews ownership and grants the minimum permissions required.", href: "/applications" },
  { title: "Issue environment credentials", detail: "Create separate test and production credentials after approval.", href: "/credentials" },
  { title: "Connect Business Messaging", detail: "Use customer-authorized conversations, scoped requests, and human handover; personal encrypted chats stay private.", href: readDeveloperDocsHref("business-messaging") },
  { title: "Configure signed webhooks", detail: "Verify an HTTPS endpoint, subscribe to approved events, and inspect delivery health.", href: "/webhooks" },
] as const;

export function DeveloperOverview() {
  return (
    <section className={styles.page} aria-labelledby="overview-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>NANTTY DEVELOPER PLATFORM</p>
          <h1 id="overview-title">Developers</h1>
          <p>Build and monitor business integrations with Nantty.</p>
        </div>
        <Link href={readDeveloperDocsHref()} className={styles.docsLink}>Read API documentation <span aria-hidden="true">↗</span></Link>
      </header>

      <nav className={styles.pageTabs} aria-label="Developer workspace sections">
        <Link href="/dashboard" aria-current="page">Overview</Link>
        <Link href="/applications">Applications</Link>
        <Link href="/webhooks">Webhooks</Link>
        <Link href="/requests">Request logs</Link>
        <Link href="/credentials">Credentials</Link>
      </nav>

      <div className={styles.previewNotice} role="status">
        <span className={styles.noticeMark} aria-hidden="true" />
        <div><strong>Workspace preview</strong><span>Developer organization, credential, webhook, billing, and request-log services are not connected.</span></div>
        <Link href={readDeveloperDocsHref()}>See what is available</Link>
      </div>

      <div className={styles.workspaceGrid}>
        <section className={styles.servicePanel} aria-labelledby="service-status-title">
          <div className={styles.sectionHeading}>
            <div><h2 id="service-status-title">Platform services</h2><p>Current availability for this workspace</p></div>
          </div>
          <GatewayReadiness />
          <div className={styles.tableScroll}>
            <table aria-label="Developer platform service availability">
              <thead><tr><th scope="col">Service</th><th scope="col">State</th><th scope="col">Details</th></tr></thead>
              <tbody>{platformServices.map(({ label, status, href, detail }) => (
                <tr key={label}>
                  <th scope="row"><Link href={href}>{label}</Link></th>
                  <td data-label="State"><span className={styles.statusText}>{status}</span></td>
                  <td data-label="Details">{detail}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className={styles.panelIntro}>Only the gateway status above is read from a live readiness endpoint. No sample traffic, credentials, or usage figures are shown.</p>
        </section>

        <aside className={styles.workspaceDetail} aria-labelledby="workspace-detail-title">
          <div className={styles.detailTopline}><span className={styles.detailMark} aria-hidden="true" />Test environment</div>
          <h2 id="workspace-detail-title">Start with the API contract</h2>
          <p>Review the proposed Business Messaging surface, approval requirements, and privacy boundaries before planning an integration.</p>
          <div className={styles.detailFacts}>
            <div><span>API access</span><strong>Not available</strong></div>
            <div><span>Test credentials</span><strong>Not issued</strong></div>
            <div><span>Personal chats</span><strong>End-to-end encrypted</strong></div>
          </div>
          <Link href={readDeveloperDocsHref("business-messaging")} className={styles.detailAction}>Review Business Messaging <span aria-hidden="true">→</span></Link>
        </aside>
      </div>

      <section className={styles.integrationSection} aria-labelledby="integration-steps-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="integration-steps-title">Integration path</h2><p>These are planned steps, not actions currently available in this preview.</p></div>
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
