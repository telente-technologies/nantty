import Link from "next/link";

import styles from "./developerOverview.module.css";

const capabilityAreas = [
  { title: "Applications", detail: "Manage environments, scopes, business grants, and review status.", href: "/applications" },
  { title: "Credentials", detail: "Issue and rotate scoped credentials through a secure, audited flow.", href: "/credentials" },
  { title: "Webhooks", detail: "Inspect signed events, delivery attempts, retries, and endpoint health.", href: "/webhooks" },
  { title: "Usage", detail: "View server-recorded request usage, quotas, and billing status.", href: "/usage" },
] as const;

export function DeveloperOverview() {
  return (
    <section className={styles.page} aria-labelledby="overview-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Public business integrations</p>
        <h1 id="overview-title">Build with Nantty</h1>
        <p>Connect your authorized business systems to Nantty through scoped APIs and signed webhooks. Your team supplies its own integrations and automation.</p>
      </header>
      <div className={styles.statusPanel}>
        <div className={styles.statusHeading}><span className={styles.statusMark} aria-hidden="true" /><h2>Developer API is not enabled</h2></div>
        <p>The public API, developer identity, organization authorization, and webhook services are not connected yet. Production traffic and credentials remain unavailable.</p>
        <Link href="/docs" className={styles.textLink}>Review the implementation boundary</Link>
      </div>
      <div className={styles.grid} aria-label="Developer platform areas">
        {capabilityAreas.map((area) => (
          <Link key={area.href} href={area.href} className={styles.area}>
            <h2>{area.title}</h2>
            <p>{area.detail}</p>
            <span>View status <span aria-hidden="true">→</span></span>
          </Link>
        ))}
      </div>
      <p className={styles.securityNote}>Personal messages and user credentials are not exposed by this portal. Business access must be explicitly granted and scoped on the server.</p>
    </section>
  );
}
