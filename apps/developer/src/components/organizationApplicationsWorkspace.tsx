"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import styles from "./organizationApplicationsWorkspace.module.css";

type Organization = { id: string; name: string; role: string };
type DeveloperApplication = {
  id: string;
  organizationId: string;
  name: string;
  purpose: string;
  apiProduct: string;
  callbackOrigins: string[];
  redirectUris: string[];
  requestedScopes: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
};
type Input = { name: string; purpose: string; callbackOrigins: string; redirectUris: string; requestedScopes: string[] };
type ApplicationMemberGrant = { membershipId: string; accountId: string; name: string; username: string; role: string; capabilities: string[]; eligibleCapabilities: string[] };

const scopes = ["messages:send", "messages:read", "conversations:read", "conversations:write", "customers:read", "media:write", "media:read", "webhooks:manage", "analytics:read"];
const emptyInput: Input = { name: "", purpose: "", callbackOrigins: "", redirectUris: "", requestedScopes: [] };

class ApplicationRequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let message = "The application service could not complete the request.";
    try {
      const body = await response.json() as { message?: string };
      if (body.message) message = body.message;
    } catch { /* Keep the safe generic failure message. */ }
    throw new ApplicationRequestError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function inputFor(application?: DeveloperApplication): Input {
  return application ? {
    name: application.name,
    purpose: application.purpose,
    callbackOrigins: application.callbackOrigins.join("\n"),
    redirectUris: (application.redirectUris ?? []).join("\n"),
    requestedScopes: application.requestedScopes,
  } : emptyInput;
}

export function OrganizationApplicationsWorkspace() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [applications, setApplications] = useState<DeveloperApplication[]>([]);
  const [resolvedOrganizationId, setResolvedOrganizationId] = useState("");
  const [loadedOrganizationId, setLoadedOrganizationId] = useState("");
  const [input, setInput] = useState<Input>(emptyInput);
  const [editingId, setEditingId] = useState("");
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [grantApplicationId, setGrantApplicationId] = useState("");
  const [grantMembers, setGrantMembers] = useState<ApplicationMemberGrant[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [savingGrantMembershipId, setSavingGrantMembershipId] = useState("");

  const selectedOrganization = useMemo(() => organizations.find((item) => item.id === organizationId), [organizations, organizationId]);
  const canManage = selectedOrganization?.role === "owner" || selectedOrganization?.role === "admin";
  const loadingApplications = Boolean(organizationId) && resolvedOrganizationId !== organizationId;

  useEffect(() => {
    let active = true;
    request<{ organizations: Organization[] }>("/api/developer/organizations")
      .then((result) => { if (active) { setOrganizations(result.organizations); setOrganizationId(result.organizations[0]?.id ?? ""); } })
      .catch((cause) => { if (active) setError(cause instanceof ApplicationRequestError ? cause.message : "Sign in to load your organizations."); })
      .finally(() => { if (active) setLoadingOrganizations(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    request<{ applications: DeveloperApplication[] }>(`/api/developer/organizations/${encodeURIComponent(organizationId)}/applications`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setApplications(result.applications); setLoadedOrganizationId(organizationId); setResolvedOrganizationId(organizationId); } })
      .catch((cause) => { if (!controller.signal.aborted) { setError(cause instanceof ApplicationRequestError ? cause.message : "Could not load applications. Try again."); setResolvedOrganizationId(organizationId); } });
    return () => controller.abort();
  }, [organizationId]);

  function setField<K extends keyof Input>(field: K, value: Input[K]) {
    setInput((current) => ({ ...current, [field]: value }));
  }

  async function saveApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !canManage) return;
    setSaving(true); setError(""); setNotice("");
    const payload = {
      name: input.name.trim(),
      purpose: input.purpose.trim(),
      callbackOrigins: input.callbackOrigins.split("\n").map((origin) => origin.trim()).filter(Boolean),
      redirectUris: input.redirectUris.split("\n").map((uri) => uri.trim()).filter(Boolean),
      requestedScopes: input.requestedScopes,
    };
    try {
      if (editingId) {
        const updated = await request<DeveloperApplication>(`/api/developer/organizations/${organizationId}/applications/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
        setNotice("Draft application updated.");
      } else {
        const created = await request<DeveloperApplication>(`/api/developer/organizations/${organizationId}/applications`, {
          method: "POST",
          headers: { "idempotency-key": crypto.randomUUID() },
          body: JSON.stringify(payload),
        });
        setApplications((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        setNotice("Draft application created. No API credentials or access were activated.");
      }
      setInput(emptyInput); setEditingId("");
    } catch (cause) {
      setError(cause instanceof ApplicationRequestError ? cause.message : "Could not save this application. Your changes remain in the form.");
    } finally { setSaving(false); }
  }

  function editApplication(application: DeveloperApplication) {
    setEditingId(application.id); setInput(inputFor(application)); setNotice(""); setError("");
  }

  async function archiveApplication(application: DeveloperApplication) {
    if (!canManage || !window.confirm(`Archive “${application.name}”? This will not issue or revoke credentials.`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await request<void>(`/api/developer/organizations/${organizationId}/applications/${application.id}`, { method: "DELETE" });
      setApplications((current) => current.filter((item) => item.id !== application.id));
      if (grantApplicationId === application.id) { setGrantApplicationId(""); setGrantMembers([]); }
      if (editingId === application.id) { setEditingId(""); setInput(emptyInput); }
      setNotice("Application archived.");
    } catch (cause) { setError(cause instanceof ApplicationRequestError ? cause.message : "Could not archive this application."); }
    finally { setSaving(false); }
  }

  async function loadApplicationGrants(application: DeveloperApplication) {
    if (!organizationId || !canManage) return;
    setGrantApplicationId(application.id); setGrantMembers([]); setLoadingGrants(true); setError(""); setNotice("");
    try {
      const result = await request<{ members: ApplicationMemberGrant[] }>(`/api/developer/organizations/${organizationId}/applications/${application.id}/members`);
      setGrantMembers(result.members);
    } catch (cause) {
      setGrantApplicationId("");
      setError(cause instanceof ApplicationRequestError ? cause.message : "Could not load application access.");
    } finally { setLoadingGrants(false); }
  }

  function toggleGrant(membershipId: string, capability: string, checked: boolean) {
    setGrantMembers((current) => current.map((member) => member.membershipId === membershipId ? {
      ...member,
      capabilities: checked ? [...new Set([...member.capabilities, capability])].sort() : member.capabilities.filter((value) => value !== capability),
    } : member));
  }

  async function saveMemberGrants(member: ApplicationMemberGrant) {
    if (!organizationId || !grantApplicationId || !canManage) return;
    setSavingGrantMembershipId(member.membershipId); setError(""); setNotice("");
    try {
      const updated = await request<ApplicationMemberGrant>(`/api/developer/organizations/${organizationId}/applications/${grantApplicationId}/members/${member.membershipId}/grants`, {
        method: "PUT", body: JSON.stringify({ capabilities: member.capabilities }),
      });
      setGrantMembers((current) => current.map((item) => item.membershipId === updated.membershipId ? updated : item));
      setNotice(`Access updated for ${member.name || member.username}.`);
    } catch (cause) { setError(cause instanceof ApplicationRequestError ? cause.message : "Could not update application access."); }
    finally { setSavingGrantMembershipId(""); }
  }

  return (
    <section className={styles.page} aria-labelledby="application-title">
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Developer workspace / Build</p><h1 id="application-title">Applications</h1><p>Register a Business Messaging integration and request the access it needs.</p></div>
        <label className={styles.organizationSelect}>Organization
          <select aria-label="Organization" value={organizationId} disabled={loadingOrganizations || organizations.length === 0} onChange={(event) => { setError(""); setApplications([]); setLoadedOrganizationId(""); setResolvedOrganizationId(""); setOrganizationId(event.target.value); setEditingId(""); setInput(emptyInput); setGrantApplicationId(""); setGrantMembers([]); }}>
            {organizations.length === 0 ? <option value="">No organizations</option> : organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
        </label>
      </header>

      <div className={styles.callout} role="note"><strong>Draft registration only</strong><span>Requested scopes are not grants. Creating an application does not issue credentials, enable API traffic, or approve production access.</span></div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {canManage ? <form className={styles.form} onSubmit={saveApplication}>
        <div className={styles.formHeading}><div><h2>{editingId ? "Edit draft" : "Register an application"}</h2><p>Only organization owners and admins can make changes.</p></div></div>
        <div className={styles.fields}>
          <label>Application name<input required minLength={2} maxLength={80} value={input.name} onChange={(event) => setField("name", event.target.value)} /></label>
          <label>Purpose<textarea required minLength={10} maxLength={1000} rows={3} value={input.purpose} onChange={(event) => setField("purpose", event.target.value)} /></label>
          <label>Callback origins <span>HTTPS only; localhost is allowed for development. Enter one origin per line.</span><textarea rows={3} value={input.callbackOrigins} onChange={(event) => setField("callbackOrigins", event.target.value)} placeholder="https://integration.example.com" /></label>
          <label>OAuth redirect URIs <span>Register each complete callback URL (maximum 10). HTTPS is required except for localhost development. Query parameters are fixed; fragments and wildcards are not allowed. Authorization will require an exact registered URI.</span><textarea rows={3} value={input.redirectUris} onChange={(event) => setField("redirectUris", event.target.value)} placeholder="https://integration.example.com/oauth/callback" autoCapitalize="none" autoComplete="url" spellCheck={false} /></label>
          <fieldset><legend>Requested permissions</legend><p>Candidate Business Messaging scopes. Final availability remains subject to product review.</p><div className={styles.scopeList}>{scopes.map((scope) => <label key={scope}><input type="checkbox" checked={input.requestedScopes.includes(scope)} onChange={(event) => setField("requestedScopes", event.target.checked ? [...input.requestedScopes, scope] : input.requestedScopes.filter((value) => value !== scope))} /><code>{scope}</code></label>)}</div></fieldset>
        </div>
        <div className={styles.formActions}><button type="submit" disabled={saving || loadingOrganizations || !organizationId || input.requestedScopes.length === 0}>{saving ? "Saving…" : editingId ? "Save draft" : "Create draft"}</button>{editingId ? <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => { setEditingId(""); setInput(emptyInput); }}>Cancel edit</button> : null}</div>
      </form> : selectedOrganization ? <p className={styles.readOnly}>Your organization role limits which applications and controls are available. An owner or admin can assign access for individual applications.</p> : null}

      <section className={styles.records} aria-labelledby="registered-applications-title">
        <div className={styles.recordsHeading}><h2 id="registered-applications-title">Registered applications</h2><span>{loadingApplications ? "Loading…" : `${applications.length} ${applications.length === 1 ? "application" : "applications"}`}</span></div>
        {loadingOrganizations || loadingApplications ? <p className={styles.empty}>Loading organization applications…</p> : loadedOrganizationId !== organizationId ? null : applications.length === 0 ? <p className={styles.empty}>{!organizations.length ? "Create or join an organization to register an application." : canManage ? "No applications have been registered for this organization." : "No applications have been shared with this account."}</p> : <div className={styles.tableScroll}><table><thead><tr><th>Application</th><th>Product</th><th>State</th><th>Requested scopes</th><th>Updated</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead><tbody>{applications.map((application) => <tr key={application.id}><td><strong>{application.name}</strong><span>{application.purpose}</span></td><td>Business Messaging</td><td><span className={styles.status}>{application.status.replaceAll("_", " ")}</span></td><td>{application.requestedScopes.length} requested</td><td>{new Date(application.updatedAt).toLocaleDateString()}</td><td><div className={styles.actions}><button type="button" disabled={!canManage || saving || application.status !== "draft"} onClick={() => editApplication(application)}>Edit</button><button type="button" disabled={!canManage || saving} onClick={() => void loadApplicationGrants(application)}>Manage access</button><button type="button" disabled={!canManage || saving} onClick={() => void archiveApplication(application)}>Archive</button></div></td></tr>)}</tbody></table></div>}
      </section>
      {grantApplicationId ? <section className={styles.grantPanel} aria-labelledby="application-access-title">
        <div className={styles.grantHeading}><div><h2 id="application-access-title">Application access</h2><p>Grants are per application and constrained by each member’s organization role. They do not approve requested API scopes.</p></div><button type="button" className={styles.closeButton} onClick={() => { setGrantApplicationId(""); setGrantMembers([]); }}>Close</button></div>
        {loadingGrants ? <p className={styles.empty}>Loading organization members…</p> : <div className={styles.grantList}>{grantMembers.map((member) => {
          const eligible = member.eligibleCapabilities ?? [];
          return <fieldset className={styles.grantMember} key={member.membershipId}>
            <legend><strong>{member.name || member.username}</strong><span>{member.username} · {member.role}</span></legend>
            {eligible.length ? <div className={styles.grantOptions}>{eligible.map((capability) => <label key={capability}><input type="checkbox" checked={member.capabilities.includes(capability)} disabled={savingGrantMembershipId === member.membershipId} onChange={(event) => toggleGrant(member.membershipId, capability, event.target.checked)} /><code>{capability}</code></label>)}</div> : <p>This organization role has no application capabilities to grant.</p>}
            <button type="button" disabled={savingGrantMembershipId === member.membershipId} onClick={() => void saveMemberGrants(member)}>{savingGrantMembershipId === member.membershipId ? "Saving…" : "Save access"}</button>
          </fieldset>;
        })}</div>}
      </section> : null}
    </section>
  );
}
