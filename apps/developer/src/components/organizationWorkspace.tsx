"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { readNanttyWebUrl } from "@/config/site.config";

import styles from "./organizationWorkspace.module.css";

type Organization = { id: string; name: string; slug: string; role: string; createdAt: string };
type OrganizationAccess = { organizationId: string; role: string; organizationCapabilities: string[]; applicationCapabilities: string[]; applicationGrantRequired: boolean };
type OrganizationRole = { name: string; organizationCapabilities: string[]; applicationCapabilities: string[] };
type OrganizationMember = { membershipId: string; accountId: string; username: string; name: string; role: string; status: string; joinedAt: string };
type MemberDetail = OrganizationMember & { organizationAccess: OrganizationRole };
type OrganizationState = { organization: Organization; access: OrganizationAccess; roles: OrganizationRole[]; members: OrganizationMember[] };

class OrganizationRequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function organizationRequest<T>(path = "", options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/developer/organizations${path}`, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `The request failed (${response.status}).`;
    throw new OrganizationRequestError(response.status, message);
  }
  return payload as T;
}

function slugify(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function OrganizationWorkspace() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [workspace, setWorkspace] = useState<OrganizationState | null>(null);
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<OrganizationRequestError | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [search, setSearch] = useState("");

  const loadOrganizations = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await organizationRequest<{ organizations: Organization[] }>();
      if (signal?.aborted) return;
      setOrganizations(result.organizations);
      setSelectedId((current) => result.organizations.some((organization) => organization.id === current) ? current : result.organizations[0]?.id ?? "");
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof OrganizationRequestError ? cause : new OrganizationRequestError(0, "The organization service could not be reached."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadOrganizations(controller.signal);
    return () => controller.abort();
  }, [loadOrganizations]);

  useEffect(() => {
    if (!selectedId) { setWorkspace(null); setMemberDetail(null); return; }
    const controller = new AbortController();
    setWorkspace(null);
    setMemberDetail(null);
    setError(null);
    void Promise.all([
      organizationRequest<Organization>(`/${selectedId}`, { signal: controller.signal }),
      organizationRequest<OrganizationAccess>(`/${selectedId}/access`, { signal: controller.signal }),
      organizationRequest<{ roles: OrganizationRole[] }>(`/${selectedId}/roles`, { signal: controller.signal }),
      organizationRequest<{ members: OrganizationMember[] }>(`/${selectedId}/members`, { signal: controller.signal }),
    ]).then(([organization, access, roleResponse, memberResponse]) => {
      if (!controller.signal.aborted) setWorkspace({ organization, access, roles: roleResponse.roles, members: memberResponse.members });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof OrganizationRequestError ? cause : new OrganizationRequestError(0, "Could not load the organization workspace."));
    });
    return () => controller.abort();
  }, [selectedId]);

  const filteredMembers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return workspace?.members ?? [];
    return (workspace?.members ?? []).filter((member) => `${member.name} ${member.username} ${member.role}`.toLowerCase().includes(normalized));
  }, [search, workspace?.members]);

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await organizationRequest<Organization>("", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ name: organizationName.trim(), slug: organizationSlug.trim() }),
      });
      setOrganizationName("");
      setOrganizationSlug("");
      const refreshed = await organizationRequest<{ organizations: Organization[] }>();
      setOrganizations(refreshed.organizations);
      setSelectedId(created.id);
    } catch (cause) {
      setError(cause instanceof OrganizationRequestError ? cause : new OrganizationRequestError(0, "Could not create the organization."));
    } finally { setSaving(false); }
  }

  async function loadMember(memberId: string) {
    if (!selectedId) return;
    setError(null);
    try {
      const detail = await organizationRequest<MemberDetail>(`/${selectedId}/members/${memberId}`);
      setMemberDetail(detail);
    } catch (cause) { setError(cause instanceof OrganizationRequestError ? cause : new OrganizationRequestError(0, "Could not load this member.")); }
  }

  async function updateMemberRole(member: OrganizationMember, role: string) {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const detail = await organizationRequest<MemberDetail>(`/${selectedId}/members/${member.membershipId}`, { method: "PATCH", body: JSON.stringify({ role }) });
      setWorkspace((current) => current ? { ...current, members: current.members.map((item) => item.membershipId === detail.membershipId ? detail : item) } : current);
      setMemberDetail(detail);
    } catch (cause) { setError(cause instanceof OrganizationRequestError ? cause : new OrganizationRequestError(0, "Could not update this member.")); }
    finally { setSaving(false); }
  }

  async function removeMember(member: OrganizationMember) {
    if (!selectedId || !window.confirm(`Remove ${member.name || member.username} from this organization?`)) return;
    setSaving(true);
    setError(null);
    try {
      await organizationRequest<null>(`/${selectedId}/members/${member.membershipId}`, { method: "DELETE" });
      setWorkspace((current) => current ? { ...current, members: current.members.filter((item) => item.membershipId !== member.membershipId) } : current);
      setMemberDetail(null);
    } catch (cause) { setError(cause instanceof OrganizationRequestError ? cause : new OrganizationRequestError(0, "Could not remove this member.")); }
    finally { setSaving(false); }
  }

  const canManageMembers = workspace?.access.organizationCapabilities.includes("members.manage") ?? false;
  const loginHref = `${readNanttyWebUrl()}/login`;

  return (
    <section className={styles.page} aria-labelledby="organization-title">
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>DEVELOPER WORKSPACE / ORGANIZATION</p><h1 id="organization-title">Organization</h1><p>Manage your Nantty developer organization and its member access.</p></div>
        {organizations.length > 1 ? <label className={styles.orgSelectLabel}>Current organization<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label> : null}
      </header>

      {error ? <div className={styles.error} role="alert"><strong>{error.message}</strong>{error.status === 401 ? <a href={loginHref} target="_blank" rel="noreferrer">Open Nantty sign-in in a new tab</a> : <button type="button" onClick={() => void loadOrganizations()}>Retry</button>}</div> : null}

      {loading ? <div className={styles.skeleton} aria-label="Loading organizations"><span /><span /><span /></div> : null}

      {!loading && !error && organizations.length === 0 ? (
        <div className={styles.emptyState}><h2>Create your developer organization</h2><p>Your organization owns applications, credentials, and environment access. Create the organization record to begin; application and credential services remain separately gated until available.</p>
          <form onSubmit={createOrganization} className={styles.createForm}>
            <label>Organization name<input required minLength={2} maxLength={80} value={organizationName} onChange={(event) => { setOrganizationName(event.target.value); setOrganizationSlug(slugify(event.target.value)); }} autoComplete="organization" /></label>
            <label>Organization URL<input required minLength={3} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={organizationSlug} onChange={(event) => setOrganizationSlug(event.target.value)} autoCapitalize="none" autoCorrect="off" /><span>Lowercase letters, numbers and single hyphens.</span></label>
            <button type="submit" disabled={saving}>{saving ? "Creating…" : "Create organization"}</button>
          </form>
        </div>
      ) : null}

      {workspace ? <>
        <div className={styles.organizationHeading}><div><span className={styles.organizationName}>{workspace.organization.name}</span><span className={styles.organizationSlug}>nantty.com/org/{workspace.organization.slug}</span></div><span className={styles.roleLabel}>{workspace.organization.role}</span></div>
        <div className={styles.summaryGrid}>
          <section className={styles.summary}><span>Organization ID</span><strong>{workspace.organization.id}</strong></section>
          <section className={styles.summary}><span>Your role</span><strong>{workspace.access.role}</strong></section>
          <section className={styles.summary}><span>Created</span><strong>{formatDate(workspace.organization.createdAt)}</strong></section>
        </div>
        <section className={styles.capabilities} aria-labelledby="access-title"><div><h2 id="access-title">Access</h2><p>Organization access is enforced by the Identity service. Application capabilities require a separate application grant.</p></div><div className={styles.capabilityLists}><div><h3>Organization</h3><ul>{workspace.access.organizationCapabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul></div><div><h3>Application</h3><ul>{workspace.access.applicationCapabilities.length ? workspace.access.applicationCapabilities.map((capability) => <li key={capability}>{capability}</li>) : <li>No application capabilities</li>}</ul></div></div></section>
        <section className={styles.members} aria-labelledby="members-title"><div className={styles.sectionHeading}><div><h2 id="members-title">Members</h2><p>{workspace.members.length} member{workspace.members.length === 1 ? "" : "s"} · {canManageMembers ? "Role changes and removal are available to your role." : "Your role can view organization access only."}</p></div><label className={styles.searchLabel}><span className={styles.visuallyHidden}>Search members</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members" /></label></div>
          <div className={styles.tableScroll}><table><thead><tr><th scope="col">Member</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col"><span className={styles.visuallyHidden}>Member actions</span></th></tr></thead><tbody>
            {filteredMembers.map((member) => <tr key={member.membershipId}><th scope="row"><button type="button" className={styles.memberLink} onClick={() => void loadMember(member.membershipId)}>{member.name || member.username}<span>@{member.username}</span></button></th><td>{canManageMembers && member.role !== "owner" ? <select value={member.role} disabled={saving} aria-label={`Role for ${member.name || member.username}`} onChange={(event) => void updateMemberRole(member, event.target.value)}>{workspace.roles.filter((role) => role.name !== "owner").map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}</select> : <span className={styles.memberRole}>{member.role}</span>}</td><td>{member.status}</td><td>{formatDate(member.joinedAt)}</td><td className={styles.actions}>{canManageMembers && member.role !== "owner" ? <button type="button" disabled={saving} onClick={() => void removeMember(member)}>Remove</button> : null}</td></tr>)}
            {!filteredMembers.length ? <tr><td colSpan={5} className={styles.noMembers}>No members match this search.</td></tr> : null}
          </tbody></table></div>
          <p className={styles.invitationsNote}>Member invitations and ownership transfer are not part of the current Identity API. No invite action is simulated.</p>
        </section>
        {memberDetail ? <aside className={styles.memberDetail} aria-live="polite"><div><h2>{memberDetail.name || memberDetail.username}</h2><button type="button" onClick={() => setMemberDetail(null)} aria-label="Close member details">Close</button></div><p>@{memberDetail.username} · {memberDetail.status}</p><strong>{memberDetail.organizationAccess.name}</strong><p>{memberDetail.organizationAccess.organizationCapabilities.join(" · ") || "No organization-level capabilities"}</p></aside> : null}
      </> : null}
    </section>
  );
}
