"use client";

import { PlanLockedNotice } from "@/components/billing/planGate";
import { permissionsReservedForOwner, staffPermissionGroups } from "@/components/staff/staffPermissionGroups.constant";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { permissionsByStaffRole, sellerPermissionLabels, type SellerPermission } from "@/config/rolePermissions.config";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import type { StaffRole } from "@/types/sellerAccess.type";

import styles from "./staff.module.css";

export function readEffectiveStaffPermissions(role: StaffRole, customPermissions: readonly SellerPermission[] | null): ReadonlySet<SellerPermission> {
  return customPermissions ? new Set(customPermissions) : permissionsByStaffRole[role];
}

interface StaffPermissionEditorProps {
  readonly role: StaffRole;
  readonly customPermissions: SellerPermission[] | null;
  readonly canManageMember: boolean;
  readonly onCustomPermissionsChange: (customPermissions: SellerPermission[] | null) => void;
}

export function StaffPermissionEditor({ role, customPermissions, canManageMember, onCustomPermissionsChange }: StaffPermissionEditorProps) {
  const { hasFeature } = usePlanFeatures();
  const canCustomise = hasFeature("advanced_permissions") && canManageMember && role !== "owner";
  const effectivePermissions = readEffectiveStaffPermissions(role, customPermissions);

  function toggleStaffPermission(permission: SellerPermission, isGranted: boolean) {
    const nextPermissions = new Set(effectivePermissions);
    if (isGranted) nextPermissions.add(permission);
    else nextPermissions.delete(permission);
    onCustomPermissionsChange([...nextPermissions]);
  }

  return (
    <div className={styles.stack}>
      <div className={styles.permissionHeader}>
        <p className={styles.sectionTitle}>Permissions</p>
        {customPermissions ? <StatusBadge tone="highlight">Custom</StatusBadge> : <StatusBadge>Role defaults</StatusBadge>}
        {customPermissions && canCustomise ? (
          <Button size="small" variant="ghost" onClick={() => onCustomPermissionsChange(null)}>
            Reset to role defaults
          </Button>
        ) : null}
      </div>
      {!hasFeature("advanced_permissions") && role !== "owner" ? <PlanLockedNotice feature="advanced_permissions" compact description="Switch individual permissions on or off for this person instead of using the role defaults." /> : null}
      {staffPermissionGroups.map((group) => (
        <fieldset key={group.title} className={styles.permissionGroup}>
          <legend className={styles.permissionGroupTitle}>{group.title}</legend>
          <div className={styles.permissionGrid}>
            {group.permissions.map((permission) => (
              <CheckboxField
                key={permission}
                label={permissionsReservedForOwner.has(permission) ? `${sellerPermissionLabels[permission]} (owner only)` : sellerPermissionLabels[permission]}
                checked={role === "owner" || effectivePermissions.has(permission)}
                disabled={!canCustomise || permissionsReservedForOwner.has(permission)}
                onCheckedChange={(isGranted) => toggleStaffPermission(permission, isGranted)}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
