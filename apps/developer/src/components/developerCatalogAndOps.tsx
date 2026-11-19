"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { readDeveloperDocsHref, readSandboxPortalUrl } from "@/config/site.config";
import { useDeveloperContext } from "./developerContextProvider";
import styles from "./developerCredentialsWorkspace.module.css";

const apiCatalog = [
  { id: "business-messaging", name: "Business Messaging API", status: "Sandbox available · Production unavailable", envs: "Sandbox; Production preview only", scopes: "messages:send, conversations:read", docs: readDeveloperDocsHref("business-messaging") },
  { id: "commerce", name: "Commerce API", status: "Planned", envs: "Future", scopes: "orders:read, catalog:read", docs: "" },
  { id: "social", name: "Social API", status: "Planned", envs: "Future", scopes: "stories:read", docs: "" },
  { id: "identity", name: "Identity & SSO Integrations", status: "Internal / Partner SSO", envs: "OAuth2 PKCE", scopes: "openid, profile", docs: readDeveloperDocsHref("authentication") },
  { id: "trust", name: "Trust & Verification API", status: "Planned", envs: "Future", scopes: "trust:read", docs: "" },
  { id: "logistics", name: "Logistics API", status: "Planned", envs: "Future", scopes: "deliveries:write", docs: "" },
] as const;

export function DeveloperProductsWorkspace() {
  return (
    <section className={styles.page} aria-labelledby="products-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace / Build</p>
          <h1 id="products-title">API products</h1>
          <p>Available and staged Nantty platform APIs. Unreleased APIs are marked clearly and do not expose mock endpoints.</p>
        </div>
      </header>
      <section className={styles.records} aria-label="API catalog">
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr><th scope="col">Product</th><th scope="col">Status</th><th scope="col">Environments</th><th scope="col">Scopes</th><th scope="col">Documentation</th></tr>
            </thead>
            <tbody>
              {apiCatalog.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td><span className={`${styles.badge} ${item.envs === "Future" ? styles.badgeNeutral : styles.badgeSuccess}`}>{item.status}</span></td>
                  <td>{item.envs}</td>
                  <td><code>{item.scopes}</code></td>
                  <td>{item.docs ? <Link href={item.docs}>Read docs</Link> : "Coming later"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

type AppMemberGrant = { readonly accountId: string; readonly displayName?: string; readonly role?: string; readonly capabilities?: readonly string[] };

export function DeveloperBusinessesWorkspace() {
  const { organizations, organizationId, setOrganizationId, applications, applicationId, setApplicationId, loading } = useDeveloperContext();
  const [members, setMembers] = useState<AppMemberGrant[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizationId || !applicationId) {
      setMembers([]);
      return;
    }
    let active = true;
    setError("");
    void fetch(`/api/developer/organizations/${encodeURIComponent(organizationId)}/applications/${encodeURIComponent(applicationId)}/members`, {
      credentials: "same-origin",
      cache: "no-store",
    }).then(async (res) => {
      const payload = (await res.json().catch(() => null)) as { members?: AppMemberGrant[]; message?: string };
      if (!res.ok) throw new Error(payload?.message ?? "Could not load application grants.");
      if (active) setMembers(payload.members ?? []);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load application grants.");
    });
    return () => { active = false; };
  }, [applicationId, organizationId]);

  return (
    <section className={styles.page} aria-labelledby="businesses-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace / Workspace</p>
          <h1 id="businesses-title">Connected businesses &amp; app grants</h1>
          <p>Review application-level member capability grants and business authorization boundaries.</p>
        </div>
        <div className={styles.selectors}>
          <label>Organization<select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} disabled={loading || !organizations.length}>{organizations.length ? organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>) : <option value="">No organizations</option>}</select></label>
          <label>Application<select value={applicationId} onChange={(e) => setApplicationId(e.target.value)} disabled={!applications.length}>{applications.length ? applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>) : <option value="">No applications</option>}</select></label>
        </div>
      </header>
      <div className={styles.callout} role="note">
        <strong>Independent business authorization required</strong>
        <span>Developers cannot self-approve access to unrelated Nantty businesses. Manage full member grants in <Link href="/applications">Applications</Link>.</span>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <section className={styles.records} aria-label="Application grants">
        {members.length === 0 ? <p className={styles.empty}>No application-level member grants returned for the selected application.</p> : (
          <div className={styles.tableScroll}>
            <table>
              <thead><tr><th scope="col">Member</th><th scope="col">Role</th><th scope="col">Capabilities</th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.accountId}>
                    <td>{m.displayName || m.accountId}</td>
                    <td>{m.role || "Member"}</td>
                    <td><code>{m.capabilities?.join(", ") || "None"}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

type AuditRow = { readonly id: string; readonly actorAccountId?: string; readonly actorRole?: string; readonly action: string; readonly subjectType?: string; readonly createdAt: string };

export function DeveloperAuditWorkspace() {
  const { organizations, organizationId, setOrganizationId, loading } = useDeveloperContext();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");

  const loadLogs = useCallback(async () => {
    if (!organizationId) { setLogs([]); return; }
    setError("");
    try {
      const res = await fetch(`/api/developer/organizations/${encodeURIComponent(organizationId)}/audit-log?limit=50`, { credentials: "same-origin", cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { entries?: AuditRow[]; auditLogs?: AuditRow[]; message?: string };
      if (!res.ok) throw new Error(data?.message ?? "Could not load organization audit logs.");
      setLogs(data.entries ?? data.auditLogs ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load organization audit logs.");
    }
  }, [organizationId]);

  useEffect(() => { void loadLogs(); }, [loadLogs]);

  return (
    <section className={styles.page} aria-labelledby="audit-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace / Operate</p>
          <h1 id="audit-title">Organization audit logs</h1>
          <p>Immutable security and configuration trail for organization memberships, invitations, and applications.</p>
        </div>
        <div className={styles.selectors}>
          <label>Organization<select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} disabled={loading || !organizations.length}>{organizations.length ? organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>) : <option value="">No organizations</option>}</select></label>
        </div>
      </header>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <section className={styles.records} aria-label="Audit trail">
        <div className={styles.recordsHeading}><div><h2>Recent events</h2><p>Newest 50 recorded events.</p></div><button type="button" onClick={() => void loadLogs()}>Refresh</button></div>
        {logs.length === 0 ? <p className={styles.empty}>No audit events recorded yet.</p> : (
          <div className={styles.tableScroll}>
            <table>
              <thead><tr><th scope="col">Action</th><th scope="col">Subject</th><th scope="col">Actor role</th><th scope="col">Time</th></tr></thead>
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry.id}>
                    <td><code>{entry.action}</code></td>
                    <td>{entry.subjectType ?? "—"}</td>
                    <td>{entry.actorRole ?? "—"}</td>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export function DeveloperSandboxBridge() {
  return (
    <section className={styles.page} aria-labelledby="sandbox-bridge-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace / Operate</p>
          <h1 id="sandbox-bridge-title">Sandbox console</h1>
          <p>Test synthetic businesses, synthetic customers, conversation simulation, webhook simulation, scenarios, and API explorer.</p>
        </div>
      </header>
      <div className={styles.callout} role="note">
        <strong>Isolated testing environment</strong>
        <span>All Sandbox operations use separate synthetic storage and <code>ntsb_test_</code> credentials. Production data is never modified.</span>
      </div>
      <section className={styles.records}>
        <div className={styles.recordsHeading}>
          <div><h2>Sandbox tools</h2><p>Launch the Sandbox workspace or manage Sandbox credentials and webhooks directly here.</p></div>
          <a className={styles.secondaryButton} href={readSandboxPortalUrl()} target="_blank" rel="noopener noreferrer">Open Sandbox console ↗</a>
        </div>
        <div className={styles.tableScroll}>
          <table>
            <thead><tr><th scope="col">Tool</th><th scope="col">Purpose</th><th scope="col">Link</th></tr></thead>
            <tbody>
              <tr><td><strong>Test businesses &amp; customers</strong></td><td>Manage synthetic identities and consent states</td><td><a href={`${readSandboxPortalUrl()}/test-apps`} target="_blank" rel="noopener noreferrer">Open ↗</a></td></tr>
              <tr><td><strong>Conversation simulator</strong></td><td>Simulate inbound messages, delivery, read, and failure states</td><td><a href={`${readSandboxPortalUrl()}/messaging`} target="_blank" rel="noopener noreferrer">Open ↗</a></td></tr>
              <tr><td><strong>Scenario runner</strong></td><td>Run deterministic support, opt-out, and error scenarios</td><td><a href={`${readSandboxPortalUrl()}/scenarios`} target="_blank" rel="noopener noreferrer">Open ↗</a></td></tr>
              <tr><td><strong>API explorer</strong></td><td>Execute signed requests against the Sandbox OpenAPI spec</td><td><a href={`${readSandboxPortalUrl()}/explorer`} target="_blank" rel="noopener noreferrer">Open ↗</a></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

export function DeveloperInvitationAcceptWorkspace({ token }: { readonly token: string }) {
  const [status, setStatus] = useState<"idle" | "busy" | "accepted" | "declined" | "error">("idle");
  const [message, setMessage] = useState("");

  async function respond(decision: "accept" | "decline") {
    setStatus("busy");
    setMessage("");
    try {
      const res = await fetch(`/api/developer/invitations/${encodeURIComponent(token)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ response: decision }),
      });
      const payload = (await res.json().catch(() => null)) as { message?: string };
      if (!res.ok) throw new Error(payload?.message ?? `Could not ${decision} invitation.`);
      if (decision === "accept") {
        setStatus("accepted");
        setMessage("Invitation accepted. You now have access to this developer organization.");
      } else {
        setStatus("declined");
        setMessage("Invitation declined.");
      }
    } catch (cause) {
      setStatus("error");
      setMessage(cause instanceof Error ? cause.message : `Could not ${decision} invitation.`);
    }
  }

  const resolved = status === "accepted" || status === "declined";

  return (
    <section className={styles.page} aria-labelledby="invite-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace / Invitation</p>
          <h1 id="invite-title">Organization invitation</h1>
          <p>Review and respond to your invitation to join a Nantty developer organization.</p>
        </div>
      </header>
      {status === "error" ? <p className={styles.error} role="alert">{message}</p> : null}
      {resolved ? <p className={styles.notice} role="status">{message}</p> : null}
      <section className={styles.records}>
        <p>Invitation ID: <code>{token}</code></p>
        <div className={styles.actions} style={{ marginTop: "var(--space-3)" }}>
          <button type="button" disabled={status === "busy" || resolved} onClick={() => void respond("accept")}>
            {status === "busy" ? "Submitting…" : status === "accepted" ? "Accepted" : "Accept invitation"}
          </button>
          <button type="button" className={styles.secondaryButton} disabled={status === "busy" || resolved} onClick={() => void respond("decline")}>
            {status === "declined" ? "Declined" : "Decline invitation"}
          </button>
          <Link className={styles.secondaryButton} href="/organization">Open organization inbox</Link>
        </div>
      </section>
    </section>
  );
}
