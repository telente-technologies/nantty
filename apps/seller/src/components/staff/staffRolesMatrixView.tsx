"use client";

import { FeaturePlanBadge } from "@/components/billing/planGate";
import { staffPermissionGroups } from "@/components/staff/staffPermissionGroups.constant";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { permissionsByStaffRole, sellerPermissionLabels } from "@/config/rolePermissions.config";
import { staffRoleDescriptions, staffRoleLabels, staffRoles } from "@/constants/roles.constant";

import tableStyles from "@/components/ui/dataTable.module.css";
import styles from "./staff.module.css";
import { NanttyIcon } from "@/components/ui/nanttyIcon";

export function StaffRolesMatrixView() {
  return (
    <PageStack>
      <PageHeader
        title="Roles & permissions"
        description="What each role can do by default. On Business you can switch individual permissions on or off for each person from the team list."
        actions={<ButtonLink href="/staff">Back to team</ButtonLink>}
      />
      <div className={styles.roleCards}>
        {staffRoles.map((role) => (
          <article key={role} className={styles.roleCard}>
            <strong>{staffRoleLabels[role]}</strong>
            <span className={styles.muted}>{staffRoleDescriptions[role]}</span>
            <span className={styles.memberContact}>{permissionsByStaffRole[role].size} permissions</span>
          </article>
        ))}
      </div>
      <Panel title="Permission matrix" description={<>Custom permissions per person <FeaturePlanBadge feature="advanced_permissions" /></>} padded={false}>
        <div className={tableStyles.scroller}>
          <table className={tableStyles.table}>
            <caption className="visuallyHidden">Default permissions for each role</caption>
            <thead>
              <tr>
                <th scope="col">Permission</th>
                {staffRoles.map((role) => (
                  <th key={role} scope="col" style={{ textAlign: "center" }}>
                    {staffRoleLabels[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffPermissionGroups.flatMap((group) => [
                <tr key={group.title}>
                  <th scope="rowgroup" colSpan={staffRoles.length + 1} style={{ textAlign: "left", position: "static" }}>
                    {group.title}
                  </th>
                </tr>,
                ...group.permissions.map((permission) => (
                  <tr key={permission}>
                    <td>{sellerPermissionLabels[permission]}</td>
                    {staffRoles.map((role) => (
                      <td key={role} style={{ textAlign: "center" }}>
                        {permissionsByStaffRole[role].has(permission) ? <span className={styles.matrixCheck} aria-label="Included"><NanttyIcon name="check16" size={14} /></span> : <span className={styles.matrixDash} aria-label="Not included"><NanttyIcon name="minus16" size={14} /></span>}
                      </td>
                    ))}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </Panel>
    </PageStack>
  );
}
