import Link from "next/link";

import styles from "./sandboxOverview.module.css";

const sandboxAreas = [
  { title: "Test applications", detail: "Separate test credentials and tenant-scoped access.", href: "/test-apps" },
  { title: "API explorer", detail: "Send requests only to an isolated sandbox API.", href: "/explorer" },
  { title: "Scenarios", detail: "Generate deterministic synthetic message and delivery flows.", href: "/scenarios" },
  { title: "Webhook events", detail: "Inspect signed test events and delivery attempts.", href: "/events" },
] as const;

export function SandboxOverview() {
  return (
    <section className={styles.page} aria-labelledby="sandbox-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Test safely before production</p>
        <h1 id="sandbox-title">Nantty API Sandbox</h1>
        <p>Use synthetic businesses, customers, messages, and webhook events once the isolated test services are available.</p>
      </header>
      <div className={styles.safetyPanel}>
        <div className={styles.safetyHeading}><span className={styles.safetyMark} aria-hidden="true" /><h2>Sandbox services are not connected</h2></div>
        <p>This portal has no test credentials or scenario runner yet. It cannot reach production services, and it does not claim to execute API requests.</p>
        <p className={styles.critical}>Never paste a production credential into a test environment.</p>
      </div>
      <div className={styles.grid} aria-label="Sandbox tools">
        {sandboxAreas.map((area) => <Link key={area.href} href={area.href} className={styles.area}><h2>{area.title}</h2><p>{area.detail}</p><span>View status <span aria-hidden="true">→</span></span></Link>)}
      </div>
    </section>
  );
}
