"use client";

import Link from "next/link";
import { useState } from "react";

import {
  ArrowRightIcon,
  CheckCircleIcon,
  KeyIcon,
  LockKeyIcon,
  ShieldCheckIcon,
  SignInIcon,
  TerminalWindowIcon,
} from "@/components/ui/icons";
import { readDeveloperDocsHref, readSandboxPortalUrl } from "@/config/site.config";

import { useDeveloperContext } from "./developerContextProvider";
import { GatewayReadiness } from "./gatewayReadiness";
import { SsoSignInButton } from "./ssoSignInButton";
import { StepUpVerificationPanel } from "./stepUpVerification";
import styles from "./developerOverview.module.css";

const platformServices = [
  { label: "Organizations & applications", status: "Active", tone: "ready", href: "/organization", detail: "Create organizations, manage role-based members and invitations, register applications, and configure per-member grants." },
  { label: "Sandbox credentials", status: "Active (Sandbox)", tone: "ready", href: "/credentials", detail: "Issue, rotate, expire, and revoke ntsb_test_ credentials scoped to authorized applications." },
  { label: "Sandbox webhooks", status: "Active (Sandbox)", tone: "ready", href: "/webhooks", detail: "Manage HTTPS endpoints, signing secrets, queued deliveries, and retries for isolated Sandbox events." },
  { label: "Request logs & usage", status: "Active (Sandbox)", tone: "ready", href: "/requests", detail: "Inspect redacted Sandbox API requests and track monthly Sandbox quota utilization." },
  { label: "Production Business API & billing", status: "Consent reads active · Send 503", tone: "muted", href: readDeveloperDocsHref("api-reference"), detail: "Consent-scoped conversation reads are available for approved apps; sending remains disabled (503) pending dispatch launch." },
] as const;

export function DeveloperOverview() {
  const { environment, session, organizations, organizationId, applications, loading } = useDeveloperContext();
  const [showStepUp, setShowStepUp] = useState(false);

  const activeOrg = organizations.find((o) => o.id === organizationId);

  const onboardingSteps = [
    {
      title: "Sign in with Nantty SSO",
      detail: "Authenticate via OAuth 2.0 PKCE S256 and protect privileged actions with 6-digit Email OTP step-up.",
      href: "/login?next=/dashboard",
      done: session.authenticated,
    },
    {
      title: "Create an organization & invite teammates",
      detail: "Register your organization workspace, assign RBAC roles, and manage invitations.",
      href: "/organization",
      done: organizations.length > 0,
    },
    {
      title: "Register an application & member grants",
      detail: "Declare application scopes, callback origins, and per-member Sandbox/Production capabilities.",
      href: "/applications",
      done: applications.length > 0,
    },
    {
      title: "Issue Sandbox credentials",
      detail: "Generate environment-bound ntsb_test_ credentials with optional expiration and one-time secret reveal.",
      href: "/credentials",
      done: false,
    },
    {
      title: "Configure signed webhooks & inspect logs",
      detail: "Verify HTTPS endpoints, test HMAC-SHA256 deliveries, and trace request IDs across traffic.",
      href: "/webhooks",
      done: false,
    },
  ] as const;

  return (
    <section className={styles.page} aria-labelledby="overview-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Nantty Developer Console</p>
          <h1 id="overview-title">Developers</h1>
          <p>Build, authorize, and monitor Business Messaging integrations across Sandbox and Production.</p>
        </div>
        <div className={styles.headerActions}>
          <Link href={readDeveloperDocsHref("api-reference")} className={styles.secondaryHeaderBtn}>
            <TerminalWindowIcon size={16} />
            <span>API Reference</span>
          </Link>
          <Link href="/credentials" className={styles.docsLink}>
            <KeyIcon size={16} />
            <span>API Credentials</span>
          </Link>
        </div>
      </header>

      {!loading && !session.authenticated ? (
        <section className={styles.authGateBanner} aria-labelledby="auth-gate-title">
          <div className={styles.authGateCopy}>
            <span className={styles.authGateBadge}>Sign-in required for workspace actions</span>
            <h2 id="auth-gate-title">Connect your Nantty account to manage keys &amp; apps</h2>
            <p>Sign in via PKCE S256 SSO to create organizations, issue <code>ntsb_test_</code> credentials, verify OTP step-up actions, and access the isolated Sandbox.</p>
          </div>
          <div className={styles.authGateActions}>
            <SsoSignInButton className={styles.authPrimaryBtn}>
              <SignInIcon size={16} />
              <span>Continue with Nantty SSO</span>
            </SsoSignInButton>
            <Link href="/login?next=/dashboard" className={styles.authSecondaryBtn}>
              <LockKeyIcon size={16} />
              <span>Sign-in &amp; OTP options</span>
            </Link>
          </div>
        </section>
      ) : null}

      {session.authenticated ? (
        <section className={styles.sessionBar} aria-label="Active session and security verification">
          <div className={styles.sessionInfo}>
            <CheckCircleIcon size={20} className={styles.sessionIcon} />
            <div>
              <strong>Authenticated Developer Session</strong>
              <span>
                Active organization: <strong>{activeOrg?.name ?? "None yet"}</strong> · Mode:{" "}
                <strong>{environment === "production" ? "Production" : "Sandbox (isolated)"}</strong>
              </span>
            </div>
          </div>
          <div className={styles.sessionActions}>
            <button type="button" className={styles.stepUpToggleBtn} onClick={() => setShowStepUp((prev) => !prev)}>
              <ShieldCheckIcon size={16} />
              <span>{showStepUp ? "Hide OTP / Step-Up" : "Verify Identity (OTP)"}</span>
            </button>
            <a href={readSandboxPortalUrl()} className={styles.sandboxLinkBtn}>
              Open Sandbox ↗
            </a>
          </div>
        </section>
      ) : null}

      {showStepUp ? (
        <StepUpVerificationPanel
          title="Session Step-Up & 6-Digit Email OTP"
          description="Verify your identity with a 6-digit one-time code or your password before performing privileged organization or security actions."
          submitLabel="Verify identity"
          onCancel={() => setShowStepUp(false)}
        />
      ) : null}

      <dl className={styles.kpiRow} aria-label="Workspace telemetry">
        <div className={styles.kpiCard}>
          <dt>Organizations</dt>
          <dd>{loading ? "…" : organizations.length}</dd>
          <Link href="/organization">Manage teams →</Link>
        </div>
        <div className={styles.kpiCard}>
          <dt>Applications</dt>
          <dd>{loading ? "…" : applications.length}</dd>
          <Link href="/applications">View registry →</Link>
        </div>
        <div className={styles.kpiCard}>
          <dt>Active Environment</dt>
          <dd className={environment === "production" ? styles.kpiProd : styles.kpiSandbox}>
            {environment === "production" ? "Production" : "Sandbox"}
          </dd>
          <Link href="/credentials">Manage keys →</Link>
        </div>
        <div className={styles.kpiCard}>
          <dt>Auth &amp; Security</dt>
          <dd>PKCE + OTP</dd>
          <Link href="/login">Security &amp; sign-in →</Link>
        </div>
      </dl>

      <div className={styles.workspaceGrid}>
        <section className={styles.servicePanel} aria-labelledby="service-status-title">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="service-status-title">Platform services</h2>
              <p>Live availability across Developer and Sandbox controls</p>
            </div>
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
          <p>Validate consented Business Messaging flows, idempotent sends, and signed HMAC webhook consumers before production launch.</p>
          <div className={styles.detailFacts}>
            <div><span>Sandbox API &amp; keys</span><strong>Active (ntsb_test_)</strong></div>
            <div><span>Production reads</span><strong>Consented apps only</strong></div>
            <div><span>Production sends</span><strong>Gated (503 preview)</strong></div>
            <div><span>Personal chats</span><strong>End-to-end encrypted</strong></div>
          </div>
          <Link href={readDeveloperDocsHref("api-reference")} className={styles.detailAction}>
            <span>Explore API Reference</span>
            <ArrowRightIcon size={16} />
          </Link>
        </aside>
      </div>

      <section className={styles.integrationSection} aria-labelledby="integration-steps-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="integration-steps-title">Integration path</h2>
            <p>Recommended sequence for setting up your organization, Sandbox keys, and webhook consumers.</p>
          </div>
        </div>
        <ol className={styles.stepList}>
          {onboardingSteps.map((step, index) => (
            <li key={step.title}>
              <div className={styles.stepCopy}>
                <span className={`${styles.stepIndex} ${step.done ? styles.stepIndexDone : ""}`}>
                  {step.done ? "✓" : String(index + 1).padStart(2, "0")}
                </span>
                <Link href={step.href}>{step.title}</Link>
                <p>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <aside className={styles.securityNote}>
        <strong>Business messaging boundary</strong>
        <span>Personal end-to-end encrypted Nantty Messenger conversations remain strictly outside this developer platform.</span>
      </aside>
    </section>
  );
}
