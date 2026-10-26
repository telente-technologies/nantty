"use client";

import { useState } from "react";

import { requestConfirmation } from "@nantty/web-kit";

import { useBrandWorkspace } from "@/components/brand/brandWorkspace";
import { Button, IconButton } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout } from "@/components/ui/feedback";
import { FormErrorSummary, SelectField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { BrandMember, BrandMemberRole } from "@/types/brand.type";
import { brandMemberRoleDescriptions, brandMemberRoleLabels, canBrandRoleManage } from "@/utils/brandPresentation.util";
import { fieldChecks, validateObjectAgainstChecks } from "@/utils/formValidation.util";
import { NanttyUserPicker } from "@/components/staff/nanttyUserPicker";
import type { NanttyUserCandidate } from "@/types/staff.type";

type AssignableRole = Exclude<BrandMemberRole, "owner">;
const assignableRoles: AssignableRole[] = ["admin", "editor", "viewer"];

function InviteBrandMemberDialog({ isOpen, onClose, allowAdmin }: { readonly isOpen: boolean; readonly onClose: () => void; readonly allowAdmin: boolean }) {
  const { brand, reloadBrand } = useBrandWorkspace();
  const { showToast } = useToast();
  const [selectedUser, setSelectedUser] = useState<NanttyUserCandidate | null>(null);
  const [role, setRole] = useState<AssignableRole>("editor");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  async function sendBrandInvitation() {
    const issues = validateObjectAgainstChecks({ role }, { role: fieldChecks.oneOf("Role", assignableRoles) });
    if (!selectedUser) issues.push({ path: "userId", message: "Search for the person's Nantty username and select them." });
    setErrors(issues.map((issue) => issue.message));
    if (issues.length > 0 || !selectedUser) return;
    setIsSending(true);
    try {
      await sendSellerApiRequest(`/seller/brands/${encodeURIComponent(brand.id)}/members`, { method: "POST", body: { userId: selectedUser.userId, role } });
      showToast(`Brand team request sent to @${selectedUser.username}. They accept it in the Nantty app.`);
      setSelectedUser(null);
      reloadBrand();
      onClose();
    } catch (error) {
      setErrors([readErrorMessageForDisplay(error)]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <ModalDialog intent="addMember" isOpen={isOpen} onClose={onClose} title="Add someone to the brand" description="Add someone who already uses the Nantty app. They accept in the app and sign in with their own account." width="small" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" isBusy={isSending} onClick={() => void sendBrandInvitation()}>Send invitation</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormErrorSummary messages={errors} />
        <NanttyUserPicker selectedUser={selectedUser} onSelectUser={setSelectedUser} />
        <SelectField label="Role" value={role} onChange={(event) => setRole(event.target.value as AssignableRole)} options={assignableRoles.filter((candidate) => allowAdmin || candidate !== "admin").map((candidate) => ({ value: candidate, label: brandMemberRoleLabels[candidate] }))} hint={brandMemberRoleDescriptions[role]} />
      </div>
    </ModalDialog>
  );
}

export function BrandMembersView() {
  const { brand, myRole, canEditDashboardSettings, reloadBrand } = useBrandWorkspace();
  const { showToast } = useToast();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const canManage = canEditDashboardSettings && canBrandRoleManage(myRole);
  const isOwner = myRole === "owner";

  function canEditMember(member: BrandMember): boolean {
    if (!canManage || member.role === "owner") return false;
    if (member.role === "admin" && !isOwner) return false;
    return myRole !== member.role || isOwner;
  }

  async function changeMemberRole(member: BrandMember, role: AssignableRole) {
    setBusyMemberId(member.id);
    try {
      await sendSellerApiRequest(`/seller/brands/${encodeURIComponent(brand.id)}/members/${encodeURIComponent(member.id)}`, { method: "PATCH", body: { role } });
      showToast(`${member.name} is now ${brandMemberRoleLabels[role].toLowerCase()}.`);
      reloadBrand();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyMemberId(null);
    }
  }

  async function removeMember(member: BrandMember) {
    if (!(await requestConfirmation({ title: `Remove ${member.name} from ${brand.name}?`, description: "They lose access to the brand straight away.", confirmLabel: "Remove", tone: "danger", intent: "removeMember" }))) return;
    setBusyMemberId(member.id);
    try {
      await sendSellerApiRequest(`/seller/brands/${encodeURIComponent(brand.id)}/members/${encodeURIComponent(member.id)}`, { method: "DELETE" });
      showToast(`${member.name} was removed.`);
      reloadBrand();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyMemberId(null);
    }
  }

  return (
    <Panel title="Members & roles" description="The brand team is separate from store staff: it controls the brand profile, linked stores and brand claims." padded={false} actions={canManage ? <Button variant="primary" size="small" iconName="plus16" onClick={() => setIsInviteOpen(true)}>Add member</Button> : null}>
      {!canManage ? <div style={{ padding: 16 }}><Callout tone="info">Only brand owners and admins can change the team.</Callout></div> : null}
      <DataTable
        caption="Brand team"
        rows={brand.members}
        readRowKey={(member) => member.id}
        columns={[
          { key: "name", header: "Name", render: (member) => <div><strong>{member.name}</strong><div style={{ color: "var(--ink-faint)", fontSize: 12 }}>@{member.username}</div></div> },
          {
            key: "role",
            header: "Role",
            render: (member) =>
              canEditMember(member) ? (
                <SelectField label={`Role for ${member.name}`} hideLabel value={member.role} disabled={busyMemberId === member.id} onChange={(event) => void changeMemberRole(member, event.target.value as AssignableRole)} options={assignableRoles.filter((candidate) => isOwner || candidate !== "admin").map((candidate) => ({ value: candidate, label: brandMemberRoleLabels[candidate] }))} />
              ) : (
                brandMemberRoleLabels[member.role]
              ),
          },
          { key: "status", header: "Status", render: (member) => <StatusBadge tone={member.status === "active" ? "success" : "info"}>{member.status === "active" ? "Active" : "Invited"}</StatusBadge> },
          { key: "actions", header: <span className="visuallyHidden">Actions</span>, align: "end", render: (member) => (canEditMember(member) ? <IconButton iconName="trash24" label={`Remove ${member.name}`} size="small" disabled={busyMemberId === member.id} onClick={() => void removeMember(member)} /> : null) },
        ]}
      />
      <InviteBrandMemberDialog isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} allowAdmin={isOwner} />
    </Panel>
  );
}
