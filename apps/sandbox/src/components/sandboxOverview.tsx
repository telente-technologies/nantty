"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./sandboxOverview.module.css";

const sandboxServices = [
  { label: "Test applications and credentials", status: "Available (requires Identity + Sandbox env)", href: "/test-apps" },
  { label: "Isolated API data plane", status: "Available (ntsb_test_ keys only)", href: "/explorer" },
  { label: "Messaging test environment", status: "Available (synthetic customers)", href: "/messaging" },
  { label: "Scenario runner", status: "Available (deterministic fixtures)", href: "/scenarios" },
  { label: "Request and event inspection", status: "Available (redacted & signed)", href: "/requests" },
] as const;

const sandboxSteps = [
  { title: "Create a test application", detail: "Use environment-bound credentials that cannot access production resources.", href: "/test-apps" },
  { title: "Build a documented request", detail: "Choose a versioned operation and confirm its test-only scopes.", href: "/explorer" },
  { title: "Run a reproducible scenario", detail: "Exercise deterministic conversations and events using synthetic data.", href: "/scenarios" },
  { title: "Inspect the result", detail: "Correlate redacted responses, webhook attempts, and request IDs.", href: "/events" },
] as const;

export function SandboxOverview() {
  const [connectionState, setConnectionState] = useState<"checking" | "ready" | "unavailable" | "not_configured">("checking");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/sandbox/readiness", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("readiness unavailable");
        const payload: unknown = await response.json();
        if (typeof payload === "object" && payload !== null && "state" in payload && ["ready", "unavailable", "not_configured"].includes(String(payload.state))) {
          setConnectionState(payload.state as "ready" | "unavailable" | "not_configured");
        } else setConnectionState("unavailable");
      })
      .catch(() => { if (!controller.signal.aborted) setConnectionState("unavailable"); });
    return () => controller.abort();
  }, []);

  const connectionLabel = connectionState === "checking" ? "Checking" : connectionState === "ready" ? "Gateway ready" : connectionState === "unavailable" ? "Unavailable" : "Not configured";
  const connectionDescription = connectionState === "ready"
    ? "The Sandbox gateway readiness check passed. Authenticated organization members with application grants can manage test credentials, run scenarios, and inspect logs."
    : connectionState === "unavailable"
      ? "The configured Sandbox gateway did not return a ready response. No test data or API request was sent."
      : "No dedicated Sandbox API gateway is configured. The portal does not contact the production API.";

  return (
    <section className={styles.page} aria-labelledby="sandbox-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Sandbox environment</p>
          <h1 id="sandbox-title">Sandbox</h1>
          <p>Use an isolated environment to validate integrations before connecting production services.</p>
        </div>
        <Link href="/docs" className={styles.docsLink}>Sandbox guide</Link>
      </header>

      <dl className={styles.environmentSummary} aria-label="Sandbox availability">
        <div>
          <dt>Environment</dt>
          <dd>Test only</dd>
        </div>
        <div>
          <dt>Service connection</dt>
          <dd><span className={styles.statusMark} aria-hidden="true" />{connectionLabel}</dd>
        </div>
        <div>
          <dt>Test data</dt>
          <dd>Not available</dd>
        </div>
      </dl>

      <section className={styles.panel} aria-labelledby="services-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="services-title">Services</h2>
            <p>{connectionDescription} This page does not create credentials or test records.</p>
          </div>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.serviceTable}>
            <thead><tr><th scope="col">Service</th><th scope="col">State</th><th scope="col"><span className={styles.srOnly}>Requirements</span></th></tr></thead>
            <tbody>
              {sandboxServices.map((service) => (
                <tr key={service.href}>
                  <th scope="row"><Link href={service.href}>{service.label}</Link></th>
                  <td data-label="State"><span className={styles.availability}><span className={styles.statusMark} aria-hidden="true" />{service.status}</span></td>
                  <td data-label="Requirements"><Link href={service.href} className={styles.rowLink}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="lifecycle-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="lifecycle-title">Planned test lifecycle</h2>
            <p>These steps describe the intended workflow; execution is unavailable until the services above are connected.</p>
          </div>
        </div>
        <ol className={styles.stepList}>
          {sandboxSteps.map((step, index) => (
            <li key={step.href}>
              <span className={styles.stepIndex} aria-hidden="true">{index + 1}</span>
              <div className={styles.stepCopy}>
                <Link href={step.href}>{step.title}</Link>
                <p>{step.detail}</p>
              </div>
              <span className={styles.stepStatus}>Planned</span>
            </li>
          ))}
        </ol>
      </section>

      <aside className={styles.securityNote} aria-label="Credential safety">
        <div>
          <h2>Credential safety</h2>
          <p>Keep production credentials out of the sandbox.</p>
        </div>
        <span>Environment separation must be enforced by the service boundary. This portal does not accept or validate production credentials.</span>
      </aside>
    </section>
  );
}
