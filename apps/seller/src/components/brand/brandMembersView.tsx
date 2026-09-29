"use client";

import { useState } from "react";

import { useBrandWorkspace } from "@/components/brand/brandWorkspace";
import { Button, IconButton } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout } from "@/components/ui/feedback";
import { FormErrorSummary, SelectField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { BrandMember, BrandMemberRole } from "@/types/brand.type";
import { brandMemberRoleDescriptions, brandMemberRoleLabels, canBrandRoleManage } from "@/utils/brandPresentation.util";
import { fieldChecks, validateObjectAgainstChecks } from "@/utils/formValidation.util";

type AssignableRole = Exclude<BrandMemberRole, "owner">;
const assignableRoles: AssignableRole[] = ["admin", "editor", "viewer"];

function InviteBrandMemberDialog({ isOpen, onClose, allowAdmin }: { readonly isOpen: boolean; readonly onClose: () => void; readonly allowAdmin: boolean }) {
  const { brand, reloadBrand } = useBrandWorkspace();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("editor");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  async function sendBrandInvitation() {
    const issues = validateObjectAgainstChecks({ name, email, role }, { name: fieldChecks.text({ label: "Name", min: 2, max: 80 }), email: fieldChecks.email(), role: fieldChecks.oneOf("Role", assignableRoles) });
    setErrors(issues.map((issue) => issue.message));
    if (issues.length > 0) return;
    setIsSending(true);
    try {
      await sendSellerApiRequest(`/seller/brands/${encodeURIComponent(brand.id)}/members`, { method: "POST", body: { name: name.trim(), email: email.trim(), role } });
      showToast(`Invitation sent to ${email.trim()}.`);
      setName("");
      setEmail("");
      reloadBrand();
      onClose();
    } catch (error) {
      setErrors([readErrorMessageForDisplay(error)]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} title="Add someone to the brand" description="They get an email to join with their Zudomart account." width="small" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" isBusy={isSending} onClick={() => void sendBrandInvitation()}>Send invitation</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormErrorSummary messages={errors} />
        <TextField label="Name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        <TextField label="Email" type="email" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} />
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
    if (!window.confirm(`Remove ${member.name} from ${brand.name}? They lose access to the brand straight away.`)) return;
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
          { key: "name", header: "Name", render: (member) => <div><strong>{member.name}</strong><div style={{ color: "var(--ink-faint)", fontSize: 12 }}>{member.email}</div></div> },
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
