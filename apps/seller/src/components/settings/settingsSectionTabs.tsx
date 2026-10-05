"use client";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { LinkTabs } from "@/components/ui/navigationTabs";
import type { SellerPermission } from "@/config/rolePermissions.config";

const settingsSections: { href: string; label: string; exact?: boolean; permission: SellerPermission }[] = [
  { href: "/settings", label: "Store", exact: true, permission: "settings:view" },
  { href: "/settings/account", label: "Account", permission: "settings:view" },
  { href: "/settings/security", label: "Security", permission: "settings:view" },
  { href: "/settings/notifications", label: "Notifications", permission: "settings:view" },
  { href: "/settings/payouts", label: "Payment & withdrawal", permission: "wallet:view" },
  { href: "/settings/delivery", label: "Delivery", permission: "delivery:manage" },
  { href: "/settings/shipping", label: "Shipping", permission: "delivery:manage" },
  { href: "/settings/locations", label: "Locations", permission: "settings:view" },
  { href: "/settings/taxes", label: "Taxes", permission: "settings:view" },
  { href: "/settings/team", label: "Team", permission: "staff:manage" },
  { href: "/settings/developers", label: "API keys & webhooks", permission: "developer:manage" },
  { href: "/settings/integrations", label: "Integrations", permission: "settings:view" },
  { href: "/settings/billing", label: "Plan & billing", permission: "billing:manage" },
  { href: "/settings/business-documents", label: "Business documents", permission: "billing:manage" },
  { href: "/settings/verification", label: "Verification", permission: "settings:view" },
];

export function SettingsSectionTabs() {
  const { can } = useSellerSession();
  return <LinkTabs label="Settings sections" tabs={settingsSections.filter((section) => can(section.permission))} />;
}
