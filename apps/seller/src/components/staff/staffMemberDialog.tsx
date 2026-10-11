"use client";

import { useState } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { StaffLocationChecklist } from "@/components/staff/staffLocationChecklist";
import { StaffPermissionEditor } from "@/components/staff/staffPermissionEditor";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { staffRoleLabels } from "@/constants/roles.constant";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { SellerPermission } from "@/config/rolePermissions.config";
import type { StaffRole } from "@/types/sellerAccess.type";
import type { StaffMember } from "@/types/staff.type";
import { canActorManageStaffMember, isStaffMemberTheSignedInActor, listRolesActorMayAssign } from "@/utils/staffEditingRules.util";

import styles from "./staff.module.css";

interface StaffMemberDialogProps {
  readonly member: StaffMember;
  readonly hasFreeSeat: boolean;
  readonly onClose: () => void;
  readonly onMemberChanged: () => void;
}

export function StaffMemberDialog({ member: initialMember, hasFreeSeat, onClose, onMemberChanged }: StaffMemberDialogProps) {
  const { sessionView } = useSellerSession();
  const { locations } = useStoreContext();
  const { showToast } = useToast();
  const [member, setMember] = useState(initialMember);
  const [role, setRole] = useState<StaffRole>(initialMember.role);
  const [locationIds, setLocationIds] = useState<string[]>(initialMember.locationIds);
  const [customPermissions, setCustomPermissions] = useState<SellerPermission[] | null>(initialMember.permissions);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | "status" | "remove" | null>(null);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const canManage = canActorManageStaffMember(member, sessionView);
  const isSelf = isStaffMemberTheSignedInActor(member, sessionView);
  const assignableRoles = listRolesActorMayAssign(sessionView?.effectiveRole ?? null);

  async function sendStaffChange(busyKey: "save" | "status" | "remove", request: () => Promise<StaffMember | undefined>, successMessage: string): Promise<boolean> {
    setBusyAction(busyKey);
    try {
      const updated = await request();
      if (updated) setMember(updated);
      showToast(successMessage);
      onMemberChanged();
      return true;
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function saveRoleAndLocations() {
    if (locationIds.length === 0) {
      setLocationError("Pick at least one location.");
      return;
    }
    setLocationError(null);
    const havePermissionsChanged = JSON.stringify(customPermissions) !== JSON.stringify(member.permissions);
    const body = havePermissionsChanged ? { role, locationIds, permissions: customPermissions } : { role, locationIds };
    await sendStaffChange("save", () => sendSellerApiRequest<StaffMember>(`/seller/staff/${encodeURIComponent(member.id)}`, { method: "PATCH", body }), `Saved ${member.name}.`);
  }

  async function toggleSuspension() {
    const nextStatus = member.status === "suspended" ? "active" : "suspended";
    await sendStaffChange("status", () => sendSellerApiRequest<StaffMember>(`/seller/staff/${encodeURIComponent(member.id)}`, { method: "PATCH", body: { status: nextStatus } }), nextStatus === "suspended" ? `${member.name} is suspended.` : `${member.name} can work again.`);
  }

  async function removeStaffMember() {
    const isRemoved = await sendStaffChange("remove", async () => {
      await sendSellerApiRequest(`/seller/staff/${encodeURIComponent(member.id)}`, { method: "DELETE" });
      return undefined;
    }, `${member.name} was removed from your team.`);
    if (isRemoved) onClose();
  }

  const roleOptions = (assignableRoles.includes(member.role) ? assignableRoles : [member.role, ...assignableRoles]).map((assignableRole) => ({ value: assignableRole, label: staffRoleLabels[assignableRole] }));

  return (
    <ModalDialog intent="team"
      isOpen
      onClose={onClose}
      width="large"
      title={member.name}
      description={`@${member.username}`}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" isBusy={busyAction === "save"} disabled={busyAction !== null || !canManage} onClick={() => void saveRoleAndLocations()}>
            Save changes
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        {member.role === "owner" ? <Callout tone="info">The owner&apos;s role and access cannot be changed.</Callout> : null}
        {isSelf && member.role !== "owner" ? <Callout tone="info">You cannot change your own role or status. Ask the store owner.</Callout> : null}
        {!canManage && !isSelf && member.role !== "owner" ? <Callout tone="info">Only the store owner can change a manager.</Callout> : null}
        <div className={styles.twoColumns}>
          <SelectField label="Role" value={role} disabled={!canManage} onChange={(event) => setRole(event.target.value as StaffRole)} options={roleOptions} />
        </div>
        <StaffLocationChecklist locations={locations} selectedLocationIds={locationIds} onChange={setLocationIds} errorMessage={locationError} />
        <hr className={styles.divider} />
        <StaffPermissionEditor role={role} customPermissions={customPermissions} canManageMember={canManage} onCustomPermissionsChange={setCustomPermissions} />
        {canManage ? (
          <>
            <hr className={styles.divider} />
            <p className={styles.sectionTitle}>Access</p>
            <div className={styles.actionsRow}>
              <Button isBusy={busyAction === "status"} disabled={busyAction !== null || (member.status === "suspended" && !hasFreeSeat)} onClick={() => void toggleSuspension()}>
                {member.status === "suspended" ? "Reactivate" : "Suspend"}
              </Button>
              {isConfirmingRemoval ? (
                <>
                  <Button variant="danger" isBusy={busyAction === "remove"} onClick={() => void removeStaffMember()}>
                    Yes, remove {member.name}
                  </Button>
                  <Button variant="ghost" onClick={() => setIsConfirmingRemoval(false)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => setIsConfirmingRemoval(true)}>
                  Remove from team
                </Button>
              )}
            </div>
            {member.status === "suspended" && !hasFreeSeat ? <p className={styles.muted}>Every seat on your plan is in use, so this person cannot be reactivated yet.</p> : null}
          </>
        ) : null}
      </div>
    </ModalDialog>
  );
}
