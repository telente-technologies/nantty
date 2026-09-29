"use client";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { LinkTabs } from "@/components/ui/navigationTabs";
import type { SellerPermission } from "@/config/rolePermissions.config";

const settingsSections: { href: string; label: string; exact?: boolean; permission: SellerPermission }[] = [
  { href: "/settings", label: "Store profile", exact: true, permission: "settings:view" },
  { href: "/settings/locations", label: "Locations & registers", permission: "settings:view" },
  { href: "/settings/taxes", label: "Taxes", permission: "settings:view" },
  { href: "/settings/receipt", label: "Receipt", permission: "settings:view" },
  { href: "/settings/payments", label: "Payment methods", permission: "settings:view" },
  { href: "/settings/loyalty", label: "Loyalty & discounts", permission: "settings:view" },
  { href: "/settings/notifications", label: "Notifications", permission: "settings:view" },
  { href: "/settings/billing", label: "Billing & Gold plan", permission: "billing:manage" },
  { href: "/settings/verification", label: "Verification", permission: "settings:view" },
];

export function SettingsSectionTabs() {
  const { can } = useSellerSession();
  return <LinkTabs label="Settings sections" tabs={settingsSections.filter((section) => can(section.permission))} />;
}
