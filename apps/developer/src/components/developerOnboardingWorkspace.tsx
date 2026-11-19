"use client";

import Link from "next/link";
import { useDeveloperContext } from "./developerContextProvider";
import { SsoSignInButton } from "./ssoSignInButton";
import { readSandboxPortalUrl } from "@/config/site.config";
import styles from "./developerCredentialsWorkspace.module.css";

export function DeveloperOnboardingWorkspace() {
  const { session, organizations, applications, loading, refreshOrganizations } = useDeveloperContext();

  const steps = [
    {
      title: "1. Authenticate with Nantty SSO",
      done: session.authenticated,
      detail: session.authenticated ? "Your Nantty Developer session is active." : "Sign in via PKCE S256 SSO using your Nantty account.",
      action: session.authenticated ? null : <SsoSignInButton className={styles.secondaryButton}>Sign in with Nantty SSO</SsoSignInButton>,
    },
    {
      title: "2. Create or join a Developer Organization",
      done: organizations.length > 0,
      detail: organizations.length > 0 ? `${organizations.length} organization(s) available.` : "Create an organization workspace for teammates, apps, and billing.",
      action: <Link className={styles.secondaryButton} href="/organization">{organizations.length > 0 ? "Manage organization" : "Create organization"}</Link>,
    },
    {
      title: "3. Register an application",
      done: applications.length > 0,
      detail: applications.length > 0 ? `${applications.length} application(s) registered.` : "Register an application to unlock Sandbox and production review.",
      action: <Link className={styles.secondaryButton} href="/applications">{applications.length > 0 ? "View applications" : "Register application"}</Link>,
    },
    {
      title: "4. Issue a Sandbox credential & test webhooks",
      done: false,
      detail: "Generate an ntsb_test_ key and simulate conversations in the isolated Sandbox.",
      action: <Link className={styles.secondaryButton} href="/credentials">Open API credentials</Link>,
    },
  ] as const;

  return (
    <section className={styles.page} aria-labelledby="onboarding-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace / Onboarding</p>
          <h1 id="onboarding-title">Developer onboarding</h1>
          <p>Resume setup from any completed step. Idempotent organization and application endpoints prevent duplicates on retry.</p>
        </div>
        <div className={styles.listTools}>
          <button type="button" disabled={loading} onClick={() => void refreshOrganizations()}>
            {loading ? "Checking…" : "Refresh status"}
          </button>
        </div>
      </header>

      <section className={styles.records} aria-label="Onboarding checklist">
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr><th scope="col">Step</th><th scope="col">Status</th><th scope="col">Details</th><th scope="col">Action</th></tr>
            </thead>
            <tbody>
              {steps.map((step) => (
                <tr key={step.title}>
                  <td><strong>{step.title}</strong></td>
                  <td><span className={`${styles.badge} ${step.done ? styles.badgeSuccess : styles.badgeNeutral}`}>{step.done ? "Complete" : "Next"}</span></td>
                  <td>{step.detail}</td>
                  <td>{step.action ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.callout} role="note">
        <strong>Sandbox quickstart</strong>
        <span>Need synthetic customers and conversation simulation? <a href={readSandboxPortalUrl()} target="_blank" rel="noopener noreferrer">Open the isolated Sandbox console ↗</a></span>
      </div>
    </section>
  );
}
