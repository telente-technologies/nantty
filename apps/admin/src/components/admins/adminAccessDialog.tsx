"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { CheckboxField, SelectField, TextAreaField, TextField, readIssueMessageForField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import type { AdminPermission } from "@/constants/adminPermissions.constant";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { createAdminAccount, fetchAdminRoles, replaceAdminPermissions } from "@/services/platformApi.service";
import type { AdminAccountSummary } from "@/types/admin.type";

import styles from "./adminAccessDialog.module.css";
import { PermissionChecklist } from "./permissionChecklist";

type ManageableRole = "ADMIN" | "SUPPORT" | "SUPERADMIN";

const roleOptions = [
  { value: "ADMIN", label: "Admin — works queues within granted permissions" },
  { value: "SUPPORT", label: "Support agent — tickets and read-only lookups" },
];
const superadminOption = { value: "SUPERADMIN", label: "Superadmin — every permission, can manage staff" };

interface AdminAccessDialogProps {
  readonly existingAdmin: AdminAccountSummary | null;
  readonly onClose: () => void;
  readonly onSaved: (admin: AdminAccountSummary) => void;
}

export function AdminAccessDialog({ existingAdmin, onClose, onSaved }: AdminAccessDialogProps) {
  const { showToast } = useToast();
  const [name, setName] = useState(existingAdmin?.name ?? "");
  const [email, setEmail] = useState(existingAdmin?.email ?? "");
  const [role, setRole] = useState<ManageableRole>(existingAdmin?.role === "SUPPORT" ? "SUPPORT" : "ADMIN");
  const [permissions, setPermissions] = useState<AdminPermission[]>(existingAdmin ? [...existingAdmin.permissions] : []);
  const [reason, setReason] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>(existingAdmin ? [...existingAdmin.roleIds] : []);
  const roles = useAdminQuery((signal) => fetchAdminRoles(signal), "roles");
  const { isSuperadmin } = useAdminPermissions();
  const isEditing = existingAdmin !== null;

  const saveMutation = useAdminMutation(async () => {
    if (existingAdmin) return (await replaceAdminPermissions(existingAdmin.id, { role: role === "SUPPORT" ? "SUPPORT" : "ADMIN", roleIds, permissions, reason })).admin;
    const created = await createAdminAccount({ name, email, role, roleIds, permissions, reason });
    showToast(`Invitation sent to ${created.invitationSentTo}. It expires in ${created.invitationExpiresInHours} hours.`);
    return created.admin;
  });

  async function save() {
    const saved = await saveMutation.run(undefined);
    if (!saved) return;
    if (isEditing) showToast(`Permissions updated for ${saved.name}.`);
    onSaved(saved);
  }

  const canSave = (role === "SUPERADMIN" || permissions.length > 0) && reason.trim().length >= 5 && (isEditing || (name.trim().length >= 2 && email.includes("@")));
  return (
    <ModalDialog intent="team"
      isOpen
      width="wide"
      tone="secure"
      title={isEditing ? `Change access for ${existingAdmin.name}` : "Invite an admin"}
      description={isEditing ? "Changes apply on their next request. Their sessions pick up new permissions within 5 minutes." : "They get an email to set a password and turn on two-step verification. The first superadmin comes from the backend CLI. Admins can never create or edit superadmins."}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" iconName="shield24" onClick={save} isBusy={saveMutation.isRunning} disabled={!canSave}>
            {isEditing ? "Save access" : "Send invitation"}
          </Button>
        </>
      }
    >
      {!isEditing ? (
        <div className={styles.identityRow}>
          <TextField label="Full name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} error={readIssueMessageForField(saveMutation.validationIssues, "name")} />
          <TextField label="Work email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" error={readIssueMessageForField(saveMutation.validationIssues, "email")} />
        </div>
      ) : null}
      <SelectField label="Role" value={role} onChange={(event) => setRole(event.target.value as ManageableRole)} options={isSuperadmin && !isEditing ? [...roleOptions, superadminOption] : roleOptions} />
      {role === "SUPERADMIN" ? <p className={styles.stepUpNote}>A new superadmin may need a second superadmin to approve before they can sign in, depending on Staff settings.</p> : (
        <div>
          <p className={styles.sectionLabel}>Department roles</p>
          {(roles.data?.items ?? []).map((definition) => (
            <CheckboxField key={definition.id} label={`${definition.name}${definition.isTemplate ? "" : " (custom)"}`} description={`${definition.permissions.length} permissions`} checked={roleIds.includes(definition.id)} onChange={(event) => {
              const next = event.target.checked ? [...roleIds, definition.id] : roleIds.filter((id) => id !== definition.id);
              setRoleIds(next);
              if (event.target.checked) setPermissions([...new Set([...permissions, ...definition.permissions])]);
            }} />
          ))}
        </div>
      )}
      {role === "SUPERADMIN" ? null : <div>
        <p className={styles.sectionLabel}>
          Permissions <span className={styles.count}>{permissions.length} selected</span>
        </p>
        <PermissionChecklist selectedPermissions={permissions} onChange={setPermissions} />
      </div>}
      <TextAreaField label="Reason (saved to the audit log)" value={reason} onChange={(event) => setReason(event.target.value)} rows={2} placeholder="e.g. Joining the payouts desk" error={readIssueMessageForField(saveMutation.validationIssues, "reason")} />
      <p className={styles.stepUpNote}>You will confirm with your authenticator code before this is saved.</p>
      {saveMutation.errorMessage ? <InlineError message={saveMutation.errorMessage} /> : null}
    </ModalDialog>
  );
}
