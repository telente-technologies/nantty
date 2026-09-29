"use client";

import { adminPermissionGroups, type AdminPermission } from "@/constants/adminPermissions.constant";

import styles from "./permissionChecklist.module.css";

interface PermissionChecklistProps {
  readonly selectedPermissions: readonly AdminPermission[];
  readonly onChange: (permissions: AdminPermission[]) => void;
  readonly isDisabled?: boolean;
}

export function PermissionChecklist({ selectedPermissions, onChange, isDisabled = false }: PermissionChecklistProps) {
  const selected = new Set(selectedPermissions);

  function togglePermission(permission: AdminPermission) {
    const next = new Set(selected);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    onChange([...next]);
  }

  function toggleWholeArea(permissions: readonly AdminPermission[]) {
    const isEveryPermissionSelected = permissions.every((permission) => selected.has(permission));
    const next = new Set(selected);
    for (const permission of permissions) {
      if (isEveryPermissionSelected) next.delete(permission);
      else next.add(permission);
    }
    onChange([...next]);
  }

  return (
    <div className={styles.grid}>
      {adminPermissionGroups.map((group) => {
        const groupPermissions = group.permissions.map((permission) => permission.key);
        const selectedCount = groupPermissions.filter((permission) => selected.has(permission)).length;
        return (
          <fieldset key={group.area} className={styles.group} disabled={isDisabled}>
            <legend className={styles.legend}>
              <span>{group.area}</span>
              <button type="button" className={styles.toggleAll} onClick={() => toggleWholeArea(groupPermissions)}>
                {selectedCount === groupPermissions.length ? "Clear" : "All"}
              </button>
            </legend>
            {group.permissions.map((permission) => (
              <label key={permission.key} className={styles.option}>
                <input type="checkbox" checked={selected.has(permission.key)} onChange={() => togglePermission(permission.key)} />
                <span>
                  <span className={styles.optionLabel}>{permission.label}</span>
                  <code className={styles.optionKey}>{permission.key}</code>
                </span>
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

export function PermissionSummary({ permissions }: { readonly permissions: readonly AdminPermission[] }) {
  const granted = new Set(permissions);
  return (
    <dl className={styles.summary}>
      {adminPermissionGroups.map((group) => {
        const grantedInArea = group.permissions.filter((permission) => granted.has(permission.key));
        if (grantedInArea.length === 0) return null;
        return (
          <div key={group.area}>
            <dt>{group.area}</dt>
            <dd>{grantedInArea.map((permission) => permission.label).join(" · ")}</dd>
          </div>
        );
      })}
    </dl>
  );
}
