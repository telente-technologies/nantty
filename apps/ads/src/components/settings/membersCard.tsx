"use client";

import { useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { useAdsSession } from "@/components/session/adsSessionProvider";
import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { roleDescriptions, roleLabels } from "@/config/rolePermissions.config";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { accountsApi } from "@/services/accountsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { AdAccountInvite, AdAccountMember, AdAccountRole } from "@/types/adAccount.type";
import { formatDateWithYear, formatRelativeTimeFromNow } from "@/utils/dateRange.util";
import { isValidEmailAddress } from "@/utils/formValidation.util";

import styles from "./settingsPage.module.css";

const roleOptions = (Object.keys(roleLabels) as AdAccountRole[]).map((role) => ({ value: role, label: roleLabels[role] }));

export function MembersCard() {
  const { accountId, canPerform } = useAdAccount();
  const session = useAdsSession();
  const { showToast } = useToast();
  const canManageMembers = canPerform("members:manage");
  const membersQuery = useAdsQuery(() => accountsApi.listMembers(accountId), accountId);
  const invitesQuery = useAdsQuery(() => accountsApi.listInvites(accountId), accountId);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AdAccountRole>("advertiser");
  const [inviteError, setInviteError] = useState<string | undefined>();
  const [isInviting, setIsInviting] = useState(false);

  async function runMemberChange(change: () => Promise<unknown>, successMessage: string, reload: () => void) {
    try {
      await change();
      showToast(successMessage);
      reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  async function sendInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!isValidEmailAddress(email)) {
      setInviteError("Enter a valid email address.");
      return;
    }
    setInviteError(undefined);
    setIsInviting(true);
    try {
      await accountsApi.sendInvite(accountId, email, inviteRole);
      showToast(`Invite sent to ${email}`);
      setInviteEmail("");
      invitesQuery.reload();
    } catch (error) {
      setInviteError(readErrorMessageForDisplay(error));
    } finally {
      setIsInviting(false);
    }
  }

  const memberColumns: DataTableColumn<AdAccountMember>[] = [
    {
      key: "person",
      header: "Person",
      isAlwaysVisible: true,
      render: (member) => (
        <div className={styles.memberCell}>
          <span className={styles.memberAvatar} aria-hidden>{member.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <p><strong>{member.name}</strong>{member.userId === session?.user.id ? <span className={styles.muted}> (you)</span> : null}</p>
            <p className={styles.muted}>@{member.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (member) => {
        if (member.isOwner) return <StatusBadge tone="info">Owner · Admin</StatusBadge>;
        if (!canManageMembers || member.userId === session?.user.id) return roleLabels[member.role];
        return (
          <select className={styles.roleSelect} aria-label={`Role for ${member.name}`} value={member.role} onChange={(event) => runMemberChange(() => accountsApi.changeMemberRole(accountId, member.userId, event.target.value as AdAccountRole), `${member.name} is now ${roleLabels[event.target.value as AdAccountRole]}`, membersQuery.reload)}>
            {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        );
      },
    },
    { key: "added", header: "Added", render: (member) => formatDateWithYear(member.addedAt) },
    { key: "active", header: "Last active", render: (member) => (member.lastActiveAt ? formatRelativeTimeFromNow(member.lastActiveAt) : "Never") },
    ...(canManageMembers
      ? [{
          key: "actions",
          header: "Actions",
          isAlwaysVisible: true,
          render: (member: AdAccountMember) =>
            member.isOwner || member.userId === session?.user.id ? null : (
              <Button size="small" variant="ghost" onClick={async () => {
                if (await requestConfirmation({ title: `Remove ${member.name}?`, description: "They lose access to this ad account straight away.", confirmLabel: "Remove", tone: "danger", intent: "removeMember" })) void runMemberChange(() => accountsApi.removeMember(accountId, member.userId), `${member.name} removed`, membersQuery.reload);
              }}>Remove</Button>
            ),
        }]
      : []),
  ];

  const inviteColumns: DataTableColumn<AdAccountInvite>[] = [
    { key: "invitee", header: "Invitee", isAlwaysVisible: true, render: (invite) => (invite.username ? `@${invite.username}` : invite.email ?? "") },
    { key: "role", header: "Role", render: (invite) => roleLabels[invite.role] },
    { key: "by", header: "Invited by", render: (invite) => invite.invitedBy },
    { key: "expires", header: "Expires", render: (invite) => formatDateWithYear(invite.expiresAt) },
    ...(canManageMembers
      ? [{ key: "actions", header: "Actions", isAlwaysVisible: true, render: (invite: AdAccountInvite) => <Button size="small" variant="ghost" onClick={() => runMemberChange(() => accountsApi.revokeInvite(accountId, invite.id), "Invite revoked", invitesQuery.reload)}>Revoke</Button> }]
      : []),
  ];

  const pendingInvites = invitesQuery.data?.items ?? [];

  return (
    <>
      <Card title="People" description="Everyone who can open this ad account, and what they can do." padded={false}>
        {membersQuery.errorMessage ? <ErrorState error={membersQuery.error} message={membersQuery.errorMessage} onRetry={membersQuery.reload} /> : null}
        {membersQuery.isLoading && !membersQuery.data ? <LoadingBlock /> : <DataTable caption="People on this ad account" columns={memberColumns} rows={membersQuery.data?.items ?? []} readRowId={(member) => member.userId} />}
        {canManageMembers ? (
          <div className={styles.inviteForm}>
            <TextField label="Invite by email" type="email" autoComplete="off" value={inviteEmail} onValueChange={setInviteEmail} error={inviteError} placeholder="name@business.com" />
            <SelectField label="Role" value={inviteRole} onValueChange={setInviteRole} options={roleOptions} />
            <Button variant="primary" isLoading={isInviting} onClick={sendInvite}>Send invite</Button>
          </div>
        ) : null}
      </Card>
      {pendingInvites.length > 0 ? (
        <Card title="Pending invites" description="Invites expire after 7 days." padded={false}>
          <DataTable caption="Pending invites" columns={inviteColumns} rows={pendingInvites} readRowId={(invite) => invite.id} />
        </Card>
      ) : null}
      <Card title="What each role can do">
        <ul className={styles.roleGuide}>
          {roleOptions.map((option) => (
            <li key={option.value} className={styles.roleGuideItem}>
              <strong>{option.label}</strong>
              <p className={styles.muted}>{roleDescriptions[option.value]}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
