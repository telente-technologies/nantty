"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ArrowRightIcon,
  CheckCircleIcon,
  ChatCircleTextIcon,
  LightningIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
  SignInIcon,
  TerminalWindowIcon,
  TestTubeIcon,
} from "@/components/ui/icons";
import { readDeveloperPortalUrl } from "@/config/site.config";

import { useSandboxContext } from "./useSandboxContext";
import styles from "./sandboxOverview.module.css";

const quickActions = [
  {
    title: "Test Applications",
    description: "Issue, rotate, and revoke isolated ntsb_test_ credentials scoped to your Sandbox app.",
    href: "/test-apps",
    badge: "ntsb_test_",
    icon: TestTubeIcon,
  },
  {
    title: "API Explorer",
    description: "Build and run live Business Messaging HTTP calls with generated cURL snippets.",
    href: "/explorer",
    badge: "Live HTTP",
    icon: TerminalWindowIcon,
  },
  {
    title: "Messaging Scenarios",
    description: "Simulate synthetic customers, inbound threads, and delivery transitions.",
    href: "/messaging",
    badge: "Simulator",
    icon: ChatCircleTextIcon,
  },
  {
    title: "Webhook Events & Logs",
    description: "Inspect HMAC-signed webhook deliveries, retries, and redacted API request logs.",
    href: "/events",
    badge: "HMAC",
    icon: LightningIcon,
  },
] as const;

const sandboxServices = [
  { label: "Test applications and credentials", status: "Active (ntsb_test_)", href: "/test-apps" },
  { label: "Isolated API data plane", status: "Active (synthetic store)", href: "/explorer" },
  { label: "Messaging test environment", status: "Active (synthetic customers)", href: "/messaging" },
  { label: "Scenario runner", status: "Active (deterministic fixtures)", href: "/scenarios" },
  { label: "Request and event inspection", status: "Active (redacted & signed)", href: "/requests" },
] as const;

const sandboxSteps = [
  { title: "Create a test application", detail: "Issue environment-bound ntsb_test_ credentials that cannot access production resources.", href: "/test-apps", status: "Step 01" },
  { title: "Build a documented request", detail: "Select a Business Messaging operation, inspect its cURL command, and execute it with an ntsb_test_ key.", href: "/explorer", status: "Step 02" },
  { title: "Run a reproducible scenario", detail: "Exercise deterministic conversations, delivery transitions, and clean state resets using synthetic data.", href: "/scenarios", status: "Step 03" },
  { title: "Inspect the result", detail: "Correlate redacted API responses, HMAC webhook attempts, and gateway request IDs.", href: "/events", status: "Step 04" },
] as const;

export function SandboxOverview() {
  const ctx = useSandboxContext();
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

  const connectionLabel = connectionState === "checking" ? "Checking…" : connectionState === "ready" ? "Gateway ready" : connectionState === "unavailable" ? "Unavailable" : "Not configured";
  const statusToneClass = connectionState === "ready"
    ? styles.statusReady
    : connectionState === "checking"
      ? styles.statusMuted
      : connectionState === "not_configured"
        ? styles.statusWarn
        : styles.statusDanger;
  const activeOrg = ctx.organizations.find((o) => o.id === ctx.organizationId);
  const activeApp = ctx.applications.find((a) => a.id === ctx.applicationId);
  const developerPortalUrl = readDeveloperPortalUrl();

  const connectionDescription = connectionState === "ready"
    ? "The Sandbox gateway readiness check passed. Authenticated organization members with application grants can manage test credentials, run scenarios, and inspect logs."
    : connectionState === "unavailable"
      ? "The configured Sandbox gateway did not return a ready response. Verify SANDBOX_API_BASE_URL and service health."
      : connectionState === "not_configured"
        ? "No dedicated Sandbox API gateway is configured. The portal never contacts the production API."
        : "Checking Sandbox gateway readiness…";

  return (
    <section className={styles.page} aria-labelledby="sandbox-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Nantty Isolated Sandbox</p>
          <h1 id="sandbox-title">Sandbox Console</h1>
          <p>Validate consented Business Messaging integrations, synthetic customers, and HMAC webhooks safely before connecting production services.</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/explorer" className={styles.primaryAction}>
            <TerminalWindowIcon size={16} />
            <span>Launch API Explorer</span>
          </Link>
          <Link href="/docs" className={styles.docsLink}>Sandbox guide</Link>
        </div>
      </header>

      {!ctx.loadingOrgs && (ctx.contextError || ctx.organizations.length === 0) ? (
        <section className={styles.authPrompt} aria-labelledby="sandbox-auth-title">
          <div className={styles.authPromptCopy}>
            <span className={styles.authPromptBadge}>Developer SSO required</span>
            <h2 id="sandbox-auth-title">Sign in &amp; select an organization to run Sandbox tests</h2>
            <p>{ctx.contextError || "Create an organization and application in the Developer Console, then issue isolated ntsb_test_ credentials here."}</p>
          </div>
          <div className={styles.authPromptActions}>
            <a href={`${developerPortalUrl}/login`} className={styles.primaryAction}>
              <SignInIcon size={16} />
              <span>Sign in via Developer Portal</span>
            </a>
            <a href={`${developerPortalUrl}/organization`} className={styles.docsLink}>
              Manage Organizations ↗
            </a>
          </div>
        </section>
      ) : null}

      <dl className={styles.environmentSummary} aria-label="Sandbox availability">
        <div>
          <dt>Isolation Boundary</dt>
          <dd>Test only · ntsb_test_</dd>
        </div>
        <div>
          <dt>Gateway Connection</dt>
          <dd><span className={`${styles.statusMark} ${statusToneClass}`} aria-hidden="true" />{connectionLabel}</dd>
        </div>
        <div>
          <dt>Active Organization</dt>
          <dd>{ctx.loadingOrgs ? "Loading…" : activeOrg?.name ?? "None selected"}</dd>
        </div>
        <div>
          <dt>Active Application</dt>
          <dd>{activeApp ? `${activeApp.name}` : "None selected"}</dd>
        </div>
      </dl>

      <section className={styles.quickCardsGrid} aria-label="Sandbox workspaces">
        {quickActions.map(({ title, description, href, badge, icon: Icon }) => (
          <Link key={href} href={href} className={styles.quickCard}>
            <div className={styles.quickCardTop}>
              <span className={styles.quickCardIcon}><Icon size={18} /></span>
              <span className={styles.quickCardBadge}>{badge}</span>
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className={styles.quickCardLink}>Open tool <ArrowRightIcon size={14} /></span>
          </Link>
        ))}
      </section>

      <div className={styles.splitGrid}>
        <section className={styles.panel} aria-labelledby="services-title">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="services-title">Sandbox Services</h2>
              <p>{connectionDescription}</p>
            </div>
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.serviceTable}>
              <thead><tr><th scope="col">Service</th><th scope="col">State</th><th scope="col"><span className={styles.srOnly}>Open workspace</span></th></tr></thead>
              <tbody>
                {sandboxServices.map((service) => (
                  <tr key={service.href}>
                    <th scope="row"><Link href={service.href}>{service.label}</Link></th>
                    <td data-label="State"><span className={styles.availability}><span className={`${styles.statusMark} ${statusToneClass}`} aria-hidden="true" />{service.status}</span></td>
                    <td data-label="Action"><Link href={service.href} className={styles.rowLink}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className={styles.nightHighlight} aria-labelledby="sandbox-quickstart-card">
          <div className={styles.nightTop}>
            <PlayCircleIcon size={18} />
            <span>Quick verification</span>
          </div>
          <h2 id="sandbox-quickstart-card">Synthetic data, real contracts</h2>
          <p>Run reproducible scenarios, inspect idempotent replays, and validate HMAC-SHA256 webhook signatures without touching customer data.</p>
          <ul className={styles.nightList}>
            <li><CheckCircleIcon size={16} /><span><code>ntsb_test_</code> tokens only</span></li>
            <li><CheckCircleIcon size={16} /><span>Deterministic delivery transitions</span></li>
            <li><CheckCircleIcon size={16} /><span>Usage-preserving clean reset</span></li>
          </ul>
          <Link href="/scenarios" className={styles.nightCta}>
            <span>Run a scenario</span>
            <ArrowRightIcon size={15} />
          </Link>
        </aside>
      </div>

      <section className={styles.panel} aria-labelledby="lifecycle-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="lifecycle-title">Sandbox test workflow</h2>
            <p>Follow these four steps to issue isolated credentials, send synthetic messages, and verify webhook deliveries.</p>
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
              <span className={styles.stepStatus}>{step.status}</span>
            </li>
          ))}
        </ol>
      </section>

      <aside className={styles.securityNote} aria-label="Credential safety">
        <div className={styles.securityNoteTitle}>
          <ShieldCheckIcon size={19} />
          <div>
            <h2>Credential safety boundary</h2>
            <p>Keep production credentials out of the Sandbox.</p>
          </div>
        </div>
        <span>Environment separation is enforced strictly at the service boundary. This portal rejects production <code>ntlive_</code> keys.</span>
      </aside>
    </section>
  );
}
