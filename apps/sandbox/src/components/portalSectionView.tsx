import Link from "next/link";

import styles from "./portalSectionView.module.css";

export interface PortalSectionContent {
  readonly title: string;
  readonly description: string;
  readonly availability: string;
  readonly detail: string;
  readonly releaseGates: readonly string[];
}

function EmptyTable({ columns, message }: { readonly columns: readonly string[]; readonly message: string }) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.dataTable}>
        <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody><tr><td colSpan={columns.length} className={styles.emptyCell}>
          <strong>{message}</strong>
          <span>This view is temporarily unavailable, so records cannot be loaded right now.</span>
        </td></tr></tbody>
      </table>
    </div>
  );
}

function Requirements({ items, title = "Service requirements", subtitle = "Enforced isolation and security controls for the Sandbox environment." }: { readonly items: readonly string[]; readonly title?: string; readonly subtitle?: string }) {
  return (
    <section className={styles.section} aria-labelledby="requirements-title">
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="requirements-title">{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <ol className={styles.requirements}>
        {items.map((item, index) => (
          <li key={item}>
            <span className={styles.requirementIndex} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span>{item}</span>
            <span className={styles.requirementState}>Enforced</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RouteContent({ section, isDocumentationPage }: { readonly section: PortalSectionContent; readonly isDocumentationPage: boolean }) {
  if (section.title === "Test applications") {
    return (
      <>
        <section className={styles.section} aria-labelledby="applications-title">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="applications-title">Applications</h2>
              <p>Sandbox-scoped applications and credentials only.</p>
            </div>
          </div>
          <EmptyTable columns={["Application", "Environment", "Credentials", "Last activity"]} message="Application listing unavailable" />
        </section>
        <Requirements items={section.releaseGates} title="Before creating an application" />
      </>
    );
  }

  if (section.title === "API explorer") {
    return (
      <>
        <section className={styles.section} aria-labelledby="request-inspector-title">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="request-inspector-title">Request inspector</h2>
              <p>Request execution is unavailable until a sandbox API and test credential issuer are connected.</p>
            </div>
          </div>
          <div className={styles.inspector}>
            <div className={styles.inspectorPane}>
              <h3>Request</h3>
              <div className={styles.inspectorEmpty}>No operation selected</div>
            </div>
            <div className={styles.inspectorPane}>
              <h3>Response</h3>
              <div className={styles.inspectorEmpty}>No request has been sent</div>
            </div>
          </div>
        </section>
        <Requirements items={section.releaseGates} title="Execution prerequisites" />
      </>
    );
  }

  if (section.title === "Messaging scenarios" || section.title === "Scenarios") {
    return (
      <>
        <section className={styles.section} aria-labelledby="scenario-flow-title">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="scenario-flow-title">Scenario workflow</h2>
              <p>Workflow stages are shown as implementation requirements—not as simulated delivery states.</p>
            </div>
          </div>
          <ol className={styles.requirements}>
            {section.releaseGates.map((item, index) => (
              <li key={item}>
                <span className={styles.requirementIndex} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span>{item}</span>
                <span className={styles.requirementState}>Not available</span>
              </li>
            ))}
          </ol>
        </section>
        {section.title === "Messaging scenarios" && (
          <section className={styles.section} aria-labelledby="message-log-title">
            <div className={styles.sectionHeading}>
              <div>
                <h2 id="message-log-title">Messages</h2>
                <p>Only synthetic sandbox conversations will appear here after the messaging service is connected.</p>
              </div>
            </div>
            <EmptyTable columns={["Conversation", "Message", "State", "Updated"]} message="Message history unavailable" />
          </section>
        )}
      </>
    );
  }

  if (section.title === "Webhook events") {
    return (
      <>
        <section className={styles.section} aria-labelledby="events-title">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="events-title">Event deliveries</h2>
              <p>Signed sandbox events and delivery attempts will be listed here when the event service is connected.</p>
            </div>
          </div>
          <EmptyTable columns={["Event", "Delivery", "Attempt", "Created"]} message="Delivery history unavailable" />
        </section>
        <Requirements items={section.releaseGates} title="Delivery prerequisites" />
      </>
    );
  }

  if (section.title === "Request log") {
    return (
      <>
        <section className={styles.section} aria-labelledby="request-log-title">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="request-log-title">API requests</h2>
              <p>Only gateway-captured, redacted sandbox traffic will appear here.</p>
            </div>
          </div>
          <EmptyTable columns={["Request ID", "Method", "Endpoint", "Status", "Duration"]} message="Request history unavailable" />
        </section>
        <Requirements items={section.releaseGates} title="Logging prerequisites" />
      </>
    );
  }

  if (isDocumentationPage) {
    return (
      <>
        <section className={styles.contractNotice} role="note">
          <div>
            <p className={styles.eyebrow}>Isolation guarantee</p>
            <h2>Test-only execution boundary</h2>
          </div>
          <p>{section.detail}</p>
        </section>
        <Requirements items={section.releaseGates} title="Enforced sandbox safeguards" />
      </>
    );
  }

  return <Requirements items={section.releaseGates} />;
}

export function PortalSectionView({ section, isDocumentationPage = false }: { readonly section: PortalSectionContent; readonly isDocumentationPage?: boolean }) {
  return (
    <section className={styles.page} aria-labelledby="section-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Sandbox <span aria-hidden="true">/</span> {section.title}</p>
        <h1 id="section-title" className={styles.title}>{section.title}</h1>
        <p className={styles.description}>{section.description}</p>
      </header>

      <section className={styles.connection} aria-labelledby="connection-title" role="note">
        <div className={styles.connectionHeading}>
          <h2 id="connection-title">{section.availability}</h2>
          <span className={styles.connectionState}><span aria-hidden="true" />{isDocumentationPage ? "Active contract" : "Isolated"}</span>
        </div>
        <p>{section.detail}</p>
      </section>

      <RouteContent section={section} isDocumentationPage={isDocumentationPage} />

      <p className={styles.nextStep}>
        {isDocumentationPage
          ? <>Start by issuing an isolated key in <Link href="/test-apps">Test applications</Link>, then send scoped requests in the <Link href="/explorer">API explorer</Link>.</>
          : <>See the <Link href="/docs">sandbox guide</Link> for the environment boundary and isolation guarantees.</>}
      </p>
    </section>
  );
}
