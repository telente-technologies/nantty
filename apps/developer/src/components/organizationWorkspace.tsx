"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { readNanttyWebUrl } from "@/config/site.config";

import styles from "./organizationWorkspace.module.css";

type Organization = { id: string; name: string; slug: string; role: string; createdAt: string };
type OrganizationAccess = { organizationId: string; role: string; organizationCapabilities: string[]; applicationCapabilities: string[]; eligibleApplicationCapabilities: string[]; applicationGrantRequired: boolean };
type OrganizationRole = { name: string; organizationCapabilities: string[]; applicationCapabilities: string[] };
type OrganizationMember = { membershipId: string; accountId: string; username: string; name: string; role: string; status: string; joinedAt: string };
type OrganizationInvitation = { id: string; organizationId: string; organizationName: string; organizationSlug: string; inviteeEmail?: string; inviterName?: string; role: string; status: string; createdAt: string; expiresAt: string };
type MemberDetail = OrganizationMember & { organizationAccess: OrganizationRole };
type AuditEntry = { id: string; actorAccountId: string; actorRole: string; action: string; subjectType: string; subjectId: string; beforeState: unknown; afterState: unknown; createdAt: string };
type OrganizationState = { organization: Organization; access: OrganizationAccess; roles: OrganizationRole[]; members: OrganizationMember[] };

class OrganizationRequestError extends Error {
  constructor(readonly status: number, message: string, readonly code = "") { super(message); }
}

async function portalRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
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
    const code = typeof payload === "object" && payload !== null && "code" in payload && typeof payload.code === "string" ? payload.code : "";
    throw new OrganizationRequestError(response.status, message, code);
  }
  return payload as T;
}

function organizationRequest<T>(path = "", options: RequestInit = {}) { return portalRequest<T>(`/api/developer/organizations${path}`, options); }
function invitationRequest<T>(path = "", options: RequestInit = {}) { return portalRequest<T>(`/api/developer/invitations${path}`, options); }

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
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<OrganizationInvitation[]>([]);
  const [myInvitations, setMyInvitations] = useState<OrganizationInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("developer");
  const [invitationError, setInvitationError] = useState("");
  const [invitationNotice, setInvitationNotice] = useState("");
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null);
  const [memberDetailOrganizationId, setMemberDetailOrganizationId] = useState("");
  const [error, setError] = useState<OrganizationRequestError | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [editingName, setEditingName] = useState("");
  const [editingSlug, setEditingSlug] = useState("");
  const [search, setSearch] = useState("");
  const [transferTarget, setTransferTarget] = useState<OrganizationMember | null>(null);
  const [transferPassword, setTransferPassword] = useState("");
  const [transferPhrase, setTransferPhrase] = useState("");
  const [transferError, setTransferError] = useState("");
  const [notice, setNotice] = useState("");
  const activeWorkspace = workspace?.organization.id === selectedId ? workspace : null;

  useEffect(() => {
    let active = true;
    void organizationRequest<{ organizations: Organization[] }>().then((result) => {
      if (!active) return;
      setOrganizations(result.organizations);
      setSelectedId(result.organizations[0]?.id ?? "");
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof OrganizationRequestError ? cause : new OrganizationRequestError(0, "The organization service could not be reached."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void invitationRequest<{ invitations: OrganizationInvitation[] }>().then((result) => {
      if (active) setMyInvitations(result.invitations);
    }).catch((cause: unknown) => {
      if (active && cause instanceof OrganizationRequestError && cause.status !== 401) setInvitationError(cause.message);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    void Promise.all([
      organizationRequest<Organization>(`/${selectedId}`, { signal: controller.signal }),
      organizationRequest<OrganizationAccess>(`/${selectedId}/access`, { signal: controller.signal }),
      organizationRequest<{ roles: OrganizationRole[] }>(`/${selectedId}/roles`, { signal: controller.signal }),
      organizationRequest<{ members: OrganizationMember[] }>(`/${selectedId}/members`, { signal: controller.signal }),
    ]).then(async ([organization, access, roleResponse, memberResponse]) => {
      if (controller.signal.aborted) return;
      const nextWorkspace = { organization, access, roles: roleResponse.roles, members: memberResponse.members };
      setWorkspace(nextWorkspace);
      setEditingName(organization.name);
      setEditingSlug(organization.slug);
      if (access.organizationCapabilities.includes("members.manage")) {
        const invitationResult = await organizationRequest<{ invitations: OrganizationInvitation[] }>(`/${selectedId}/invitations`, { signal: controller.signal });
        if (!controller.signal.aborted) setPendingInvitations(invitationResult.invitations);
      } else setPendingInvitations([]);
      if (access.organizationCapabilities.includes("security.manage")) {
        const result = await organizationRequest<{ entries: AuditEntry[] }>(`/${selectedId}/audit-log?limit=30`, { signal: controller.signal });
        if (!controller.signal.aborted) setAuditEntries(result.entries);
      } else setAuditEntries([]);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof OrganizationRequestError ? cause : new OrganizationRequestError(0, "Could not load the organization workspace."));
    });
    return () => controller.abort();
  }, [selectedId]);

  const filteredMembers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return activeWorkspace?.members ?? [];
    return (activeWorkspace?.members ?? []).filter((member) => `${member.name} ${member.username} ${member.role}`.toLowerCase().includes(normalized));
  }, [search, activeWorkspace?.members]);

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

  async function updateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await organizationRequest<Organization>(`/${selectedId}`, { method: "PATCH", body: JSON.stringify({ name: editingName.trim(), slug: editingSlug.trim() }) });
      setOrganizations((current) => current.map((organization) => organization.id === updated.id ? updated : organization));
      setWorkspace((current) => current ? { ...current, organization: updated } : current);
    } catch (cause) { setError(cause instanceof OrganizationRequestError ? cause : new OrganizationRequestError(0, "Could not update the organization.")); }
    finally { setSaving(false); }
  }

  async function loadMember(memberId: string) {
    if (!selectedId) return;
    setError(null);
    try {
      const detail = await organizationRequest<MemberDetail>(`/${selectedId}/members/${memberId}`);
      setMemberDetail(detail);
      setMemberDetailOrganizationId(selectedId);
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
      setMemberDetailOrganizationId(selectedId);
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
      setMemberDetailOrganizationId("");
    } catch (cause) { setError(cause instanceof OrganizationRequestError ? cause : new OrganizationRequestError(0, "Could not remove this member.")); }
    finally { setSaving(false); }
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setInvitationError("");
    setInvitationNotice("");
    try {
      const created = await organizationRequest<OrganizationInvitation>(`/${selectedId}/invitations`, {
        method: "POST", body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setPendingInvitations((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setInviteEmail("");
      setInvitationNotice(`Invitation sent to ${created.inviteeEmail}. An email invitation has been queued and it will also appear in that account’s Developer portal inbox.`);
    } catch (cause) { setInvitationError(cause instanceof OrganizationRequestError ? cause.message : "Could not create the invitation."); }
    finally { setSaving(false); }
  }

  async function resendInvitation(invitation: OrganizationInvitation) {
    if (!selectedId) return;
    setSaving(true);
    setInvitationError("");
    setInvitationNotice("");
    try {
      const updated = await organizationRequest<OrganizationInvitation>(`/${selectedId}/invitations/${invitation.id}/resend`, { method: "POST" });
      setPendingInvitations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setInvitationNotice(`Invitation resent to ${updated.inviteeEmail}.`);
    } catch (cause) { setInvitationError(cause instanceof OrganizationRequestError ? cause.message : "Could not resend the invitation."); }
    finally { setSaving(false); }
  }

  async function revokeInvitation(invitation: OrganizationInvitation) {
    if (!selectedId || !window.confirm(`Revoke the invitation for ${invitation.inviteeEmail}?`)) return;
    setSaving(true);
    setInvitationError("");
    try {
      await organizationRequest<null>(`/${selectedId}/invitations/${invitation.id}`, { method: "DELETE" });
      setPendingInvitations((current) => current.filter((item) => item.id !== invitation.id));
      setInvitationNotice(`Invitation for ${invitation.inviteeEmail} was revoked.`);
    } catch (cause) { setInvitationError(cause instanceof OrganizationRequestError ? cause.message : "Could not revoke the invitation."); }
    finally { setSaving(false); }
  }

  async function respondToInvitation(invitation: OrganizationInvitation, response: "accept" | "decline") {
    setSaving(true);
    setInvitationError("");
    try {
      await invitationRequest<null>(`/${invitation.id}`, { method: "POST", body: JSON.stringify({ response }) });
      setMyInvitations((current) => current.filter((item) => item.id !== invitation.id));
      setInvitationNotice(response === "accept" ? `You joined ${invitation.organizationName}.` : `Invitation to ${invitation.organizationName} declined.`);
      if (response === "accept") {
        const refreshed = await organizationRequest<{ organizations: Organization[] }>();
        setOrganizations(refreshed.organizations);
        setSelectedId(invitation.organizationId);
      }
    } catch (cause) { setInvitationError(cause instanceof OrganizationRequestError ? cause.message : "Could not respond to this invitation."); }
    finally { setSaving(false); }
  }

  async function transferOwnership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !transferTarget || !activeWorkspace) return;
    if (transferPhrase !== "TRANSFER OWNERSHIP") {
      setTransferError("Type TRANSFER OWNERSHIP exactly to confirm.");
      return;
    }
    setSaving(true);
    setTransferError("");
    setError(null);
    try {
      const stepUpResponse = await fetch("/api/developer/step-up", {
        method: "POST", cache: "no-store", credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ password: transferPassword }),
      });
      const stepUpPayload: unknown = await stepUpResponse.json().catch(() => null);
      const stepUpMessage = typeof stepUpPayload === "object" && stepUpPayload !== null && "message" in stepUpPayload && typeof stepUpPayload.message === "string" ? stepUpPayload.message : "Identity confirmation failed.";
      const stepUpToken = typeof stepUpPayload === "object" && stepUpPayload !== null && "stepUpToken" in stepUpPayload && typeof stepUpPayload.stepUpToken === "string" ? stepUpPayload.stepUpToken : "";
      setTransferPassword("");
      if (!stepUpResponse.ok || !stepUpToken) throw new Error(stepUpMessage);

      const result = await organizationRequest<{ previousOwnerMembershipId: string; newOwnerMembershipId: string }>(`/${selectedId}/ownership-transfer`, {
        method: "POST", headers: { "X-Step-Up-Token": stepUpToken },
        body: JSON.stringify({ memberId: transferTarget.membershipId, confirmation: "TRANSFER OWNERSHIP" }),
      });
      const adminRole = activeWorkspace.roles.find((role) => role.name === "admin");
      setWorkspace((current) => current ? {
        ...current,
        organization: { ...current.organization, role: "admin" },
        access: {
          ...current.access,
          role: "admin",
          organizationCapabilities: adminRole?.organizationCapabilities ?? [],
          applicationCapabilities: [],
          eligibleApplicationCapabilities: adminRole?.applicationCapabilities ?? [],
          applicationGrantRequired: (adminRole?.applicationCapabilities.length ?? 0) > 0,
        },
        members: current.members.map((member) => member.membershipId === result.newOwnerMembershipId
          ? { ...member, role: "owner" }
          : member.membershipId === result.previousOwnerMembershipId ? { ...member, role: "admin" } : member),
      } : current);
      setOrganizations((current) => current.map((organization) => organization.id === selectedId ? { ...organization, role: "admin" } : organization));
      setAuditEntries([]);
      setMemberDetail(null);
      setTransferTarget(null);
      setTransferPhrase("");
      setNotice(`Ownership transferred to ${transferTarget.name || transferTarget.username}. Your role is now admin.`);
    } catch (cause) {
      setTransferError(cause instanceof Error ? cause.message : "Could not transfer organization ownership.");
    } finally { setSaving(false); }
  }

  function cancelOwnershipTransfer() {
    setTransferTarget(null);
    setTransferPassword("");
    setTransferPhrase("");
    setTransferError("");
  }

  const canManageMembers = workspace?.access.organizationCapabilities.includes("members.manage") ?? false;
  const canManageOrganization = workspace?.access.organizationCapabilities.includes("organization.manage") ?? false;
  const loginHref = `${readNanttyWebUrl()}/login`;
  const assignableRoles = activeWorkspace?.roles.filter((role) => role.name !== "owner" && (activeWorkspace.access.role === "owner" || role.name !== "billing")) ?? [];

  return (
    <section className={styles.page} aria-labelledby="organization-title">
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>DEVELOPER WORKSPACE / ORGANIZATION</p><h1 id="organization-title">Organization</h1><p>Manage your Nantty developer organization and its member access.</p></div>
        {organizations.length > 1 ? <label className={styles.orgSelectLabel}>Current organization<select value={selectedId} onChange={(event) => { setError(null); cancelOwnershipTransfer(); setSelectedId(event.target.value); }}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label> : null}
      </header>

      {error ? <div className={styles.error} role="alert"><strong>{error.message}</strong>{error.status === 401 ? <><a href={loginHref} target="_blank" rel="noreferrer">Open Nantty sign-in in a new tab</a><button type="button" onClick={() => window.location.reload()}>I’ve signed in · Retry</button></> : error.code === "PORTAL_SSO_NOT_CONFIGURED" ? null : <button type="button" onClick={() => window.location.reload()}>Retry</button>}</div> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      {invitationError ? <p className={styles.invitationError} role="alert">{invitationError}</p> : null}
      {invitationNotice ? <p className={styles.notice} role="status">{invitationNotice}</p> : null}
      {myInvitations.length ? <section className={styles.invitationPanel} aria-labelledby="my-invitations-title"><div><h2 id="my-invitations-title">Invitations for you</h2><p>Accept to join the organization with the assigned role, or decline. Invitations expire after seven days.</p></div>{myInvitations.map((invitation) => <article className={styles.invitationRow} key={invitation.id}><div><strong>{invitation.organizationName}</strong><span>Invited by {invitation.inviterName || "an organization member"} · {invitation.role} · Expires {formatDate(invitation.expiresAt)}</span></div><div className={styles.invitationActions}><button type="button" disabled={saving} onClick={() => void respondToInvitation(invitation, "decline")}>Decline</button><button type="button" disabled={saving} onClick={() => void respondToInvitation(invitation, "accept")}>Accept</button></div></article>)}</section> : null}

      {loading ? <div className={styles.skeleton} aria-label="Loading organizations"><span /><span /><span /></div> : null}
      {!loading && selectedId && !activeWorkspace && !error ? <div className={styles.skeleton} aria-label="Loading organization details"><span /><span /><span /></div> : null}

      {!loading && !error && organizations.length === 0 ? (
        <div className={styles.emptyState}><h2>Create your developer organization</h2><p>Your organization owns applications, credentials, and environment access. Create the organization record to begin; application and credential services remain separately gated until available.</p>
          <form onSubmit={createOrganization} className={styles.createForm}>
            <label>Organization name<input required minLength={2} maxLength={80} value={organizationName} onChange={(event) => { setOrganizationName(event.target.value); setOrganizationSlug(slugify(event.target.value)); }} autoComplete="organization" /></label>
            <label>Organization URL<input required minLength={3} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={organizationSlug} onChange={(event) => setOrganizationSlug(event.target.value)} autoCapitalize="none" autoCorrect="off" /><span>Lowercase letters, numbers and single hyphens.</span></label>
            <button type="submit" disabled={saving}>{saving ? "Creating…" : "Create organization"}</button>
          </form>
        </div>
      ) : null}

      {activeWorkspace ? <>
        <div className={styles.organizationHeading}><div><span className={styles.organizationName}>{activeWorkspace.organization.name}</span><span className={styles.organizationSlug}>Organization slug · {activeWorkspace.organization.slug}</span></div><span className={styles.roleLabel}>{activeWorkspace.organization.role}</span></div>
        <div className={styles.summaryGrid}>
          <section className={styles.summary}><span>Organization ID</span><strong>{activeWorkspace.organization.id}</strong></section>
          <section className={styles.summary}><span>Your role</span><strong>{activeWorkspace.access.role}</strong></section>
          <section className={styles.summary}><span>Created</span><strong>{formatDate(activeWorkspace.organization.createdAt)}</strong></section>
        </div>
        {canManageOrganization ? <form className={styles.settingsForm} onSubmit={updateOrganization}><div><h2>Organization details</h2><p>Changes are checked by the Identity service and recorded in the audit log.</p></div><label>Name<input required minLength={2} maxLength={80} value={editingName} onChange={(event) => setEditingName(event.target.value)} /></label><label>URL slug<input required minLength={3} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={editingSlug} onChange={(event) => setEditingSlug(event.target.value)} /><span>Lowercase letters, numbers and single hyphens.</span></label><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save organization"}</button></form> : null}
        <section className={styles.capabilities} aria-labelledby="access-title"><div><h2 id="access-title">Access</h2><p>Active application permissions come from explicit application grants; organization roles alone do not grant access to an application.</p></div><div className={styles.capabilityLists}><div><h3>Organization capabilities</h3><ul>{activeWorkspace.access.organizationCapabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul></div><div><h3>Active application grants</h3><ul>{activeWorkspace.access.applicationCapabilities.length ? activeWorkspace.access.applicationCapabilities.map((capability) => <li key={capability}>{capability}</li>) : <li>No application grants are active.</li>}</ul></div><div><h3>Eligible by your role</h3><ul>{activeWorkspace.access.eligibleApplicationCapabilities.length ? activeWorkspace.access.eligibleApplicationCapabilities.map((capability) => <li key={capability}>{capability}</li>) : <li>Your role has no application capabilities.</li>}</ul>{activeWorkspace.access.applicationGrantRequired ? <p>Eligibility is not an active grant. An organization owner must assign access after the application service is connected.</p> : null}</div></div></section>
        <section className={styles.members} aria-labelledby="members-title"><div className={styles.sectionHeading}><div><h2 id="members-title">Members</h2><p>{activeWorkspace.members.length} member{activeWorkspace.members.length === 1 ? "" : "s"} · {canManageMembers ? "Role changes and removal are available to your role." : "Your role can view organization access only."}</p></div><label className={styles.searchLabel}><span className={styles.visuallyHidden}>Search members</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members" /></label></div>
          <div className={styles.tableScroll}><table><thead><tr><th scope="col">Member</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col"><span className={styles.visuallyHidden}>Member actions</span></th></tr></thead><tbody>
            {filteredMembers.map((member) => <tr key={member.membershipId}><th scope="row"><button type="button" className={styles.memberLink} onClick={() => void loadMember(member.membershipId)}>{member.name || member.username}<span>@{member.username}</span></button></th><td>{canManageMembers && member.role !== "owner" && (activeWorkspace.access.role === "owner" || member.role !== "billing") ? <select value={member.role} disabled={saving} aria-label={`Role for ${member.name || member.username}`} onChange={(event) => void updateMemberRole(member, event.target.value)}>{assignableRoles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}</select> : <span className={styles.memberRole}>{member.role}</span>}</td><td>{member.status}</td><td>{formatDate(member.joinedAt)}</td><td className={styles.actions}>{activeWorkspace.access.role === "owner" && member.role !== "owner" ? <button type="button" disabled={saving} onClick={() => { setTransferTarget(member); setTransferError(""); setTransferPassword(""); setTransferPhrase(""); }}>Transfer ownership</button> : null}{canManageMembers && member.role !== "owner" && (activeWorkspace.access.role === "owner" || member.role !== "billing") ? <button type="button" disabled={saving} onClick={() => void removeMember(member)}>Remove</button> : null}</td></tr>)}
            {!filteredMembers.length ? <tr><td colSpan={5} className={styles.noMembers}>No members match this search.</td></tr> : null}
          </tbody></table></div>
          {transferTarget && activeWorkspace.access.role === "owner" ? <form className={styles.transferForm} onSubmit={transferOwnership} aria-labelledby="transfer-ownership-title"><div><h3 id="transfer-ownership-title">Transfer ownership to {transferTarget.name || transferTarget.username}</h3><p>This is a permanent role change. You will become an admin and lose owner-only security controls. Confirm with your Nantty password and the phrase below.</p></div><label>Password<input type="password" autoComplete="current-password" required value={transferPassword} onChange={(event) => setTransferPassword(event.target.value)} /></label><label>Type TRANSFER OWNERSHIP<input required value={transferPhrase} onChange={(event) => setTransferPhrase(event.target.value)} autoCapitalize="characters" /></label>{transferError ? <p className={styles.transferError} role="alert">{transferError}</p> : null}<div className={styles.transferActions}><button type="button" disabled={saving} onClick={cancelOwnershipTransfer}>Cancel</button><button type="submit" disabled={saving || transferPhrase !== "TRANSFER OWNERSHIP"}>{saving ? "Confirming…" : "Confirm transfer"}</button></div></form> : null}
          {canManageMembers ? <section className={styles.invitationPanel} aria-labelledby="organization-invitations-title"><div><h3 id="organization-invitations-title">Invite a member</h3><p>Invite an existing Nantty account using its verified email. They’ll receive an email invitation and can also accept it from their Developer portal inbox.</p></div><form className={styles.inviteForm} onSubmit={createInvitation}><label>Verified Nantty account email<input type="email" required maxLength={254} autoComplete="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></label><label>Organization role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>{assignableRoles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}</select></label><button type="submit" disabled={saving}>{saving ? "Sending…" : "Send invitation"}</button></form><div className={styles.invitationList} aria-label="Pending organization invitations">{pendingInvitations.map((invitation) => <article className={styles.invitationRow} key={invitation.id}><div><strong>{invitation.inviteeEmail}</strong><span>{invitation.role} · Expires {formatDate(invitation.expiresAt)}</span></div><div className={styles.invitationActions}><button type="button" disabled={saving} onClick={() => void resendInvitation(invitation)}>Resend</button><button type="button" disabled={saving} onClick={() => void revokeInvitation(invitation)}>Revoke</button></div></article>)}{pendingInvitations.length === 0 ? <p className={styles.invitationsNote}>No pending invitations.</p> : null}</div></section> : null}
        </section>
        {activeWorkspace.access.organizationCapabilities.includes("security.manage") ? <section className={styles.audit} aria-labelledby="audit-title"><div><h2 id="audit-title">Organization audit log</h2><p>Recent organization and membership changes recorded by Identity.</p></div><div className={styles.tableScroll}><table><thead><tr><th scope="col">Action</th><th scope="col">Actor role</th><th scope="col">Subject</th><th scope="col">Time</th></tr></thead><tbody>{auditEntries.map((entry) => <tr key={entry.id}><td>{entry.action}</td><td>{entry.actorRole}</td><td>{entry.subjectType}</td><td>{formatDate(entry.createdAt)}</td></tr>)}{auditEntries.length === 0 ? <tr><td colSpan={4} className={styles.noMembers}>No organization events have been recorded.</td></tr> : null}</tbody></table></div></section> : null}
        {memberDetail && memberDetailOrganizationId === selectedId ? <aside className={styles.memberDetail} aria-live="polite"><div><h2>{memberDetail.name || memberDetail.username}</h2><button type="button" onClick={() => { setMemberDetail(null); setMemberDetailOrganizationId(""); }} aria-label="Close member details">Close</button></div><p>@{memberDetail.username} · {memberDetail.status}</p><strong>{memberDetail.organizationAccess.name}</strong><p>{memberDetail.organizationAccess.organizationCapabilities.join(" · ") || "No organization-level capabilities"}</p></aside> : null}
      </> : null}
    </section>
  );
}
