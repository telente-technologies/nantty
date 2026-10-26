"use client";

import { ThemeSwitcher } from "@nantty/web-kit";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { KeyValueList, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { convertAccessToSellerPlan, sellerPlanLabels } from "@/config/planFeatures.config";
import { permissionsByStaffRole, sellerPermissionLabels, sellerPermissions } from "@/config/rolePermissions.config";
import { staffRoleLabels } from "@/constants/roles.constant";

import styles from "./settings.module.css";
import { IconLabel } from "@/components/ui/zudoIcon";

export function AccountSettingsView() {
  const { sessionView, can } = useSellerSession();
  if (!sessionView) return null;
  const { user, access } = sessionView;
  const role = access.role;
  const grantedPermissions = sellerPermissions.filter((permission) => can(permission));
  const isUsingCustomPermissions = Boolean(access.permissions) && role !== "owner";
  return (
    <>
      <Panel title="Your Nantty account" description="You sign in to the dashboard with the same account you use in the Nantty app. Change your name, photo, email, phone or password in the app under Profile › Account.">
        <KeyValueList
          items={[
            { label: "Name", value: user.name ?? "—" },
            { label: "Username", value: user.username ? `@${user.username}` : "—" },
            { label: "Email", value: user.email ?? "—" },
            { label: "Store", value: access.storeName ?? "—" },
            { label: "Your role", value: role ? staffRoleLabels[role] : "—" },
            { label: "Store plan", value: sellerPlanLabels[convertAccessToSellerPlan(access)] },
          ]}
        />
      </Panel>
      <Panel title="Appearance" description="Choose light or dark, or follow your device. Your choice follows your account to every Nantty app.">
        <ThemeSwitcher label="Colour theme" />
      </Panel>
      <Panel
        title="What you can do here"
        description={role === "owner" ? "As the owner you can do everything." : isUsingCustomPermissions ? "The owner set custom permissions for you." : `The default permissions for ${role ? staffRoleLabels[role] : "your role"}.`}
        actions={isUsingCustomPermissions ? <StatusBadge tone="highlight">Custom</StatusBadge> : null}
      >
        <ul className={styles.checkboxGrid} aria-label="Your permissions">
          {(role && !isUsingCustomPermissions && role !== "owner" ? sellerPermissions.filter((permission) => permissionsByStaffRole[role].has(permission)) : grantedPermissions).map((permission) => (
            <li key={permission} className={styles.mutedText}>
              <IconLabel name="check16" size={14}>{sellerPermissionLabels[permission]}</IconLabel>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
