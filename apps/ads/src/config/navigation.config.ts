import type { NanttyIconName } from "@/components/ui/nanttyIcon";
import type { AdsPermission } from "@/config/rolePermissions.config";

export interface AccountNavigationItem {
  readonly subPath: string;
  readonly label: string;
  readonly iconName: NanttyIconName;
  readonly permission: AdsPermission;
  readonly group: "manage" | "tools" | "account";
}

export const accountNavigationItems: readonly AccountNavigationItem[] = [
  { subPath: "/overview", label: "Overview", iconName: "speedometer24", permission: "account:view", group: "manage" },
  { subPath: "/campaigns", label: "Campaigns", iconName: "squaresFour24", permission: "campaigns:view", group: "manage" },
  { subPath: "/audiences", label: "Audiences", iconName: "userCircle24", permission: "campaigns:view", group: "manage" },
  { subPath: "/reports", label: "Reports", iconName: "arrowUpRight24", permission: "reports:view", group: "manage" },
  { subPath: "/billing", label: "Billing", iconName: "creditCard24", permission: "billing:view", group: "manage" },
  { subPath: "/tools/events", label: "Conversion events", iconName: "tag24", permission: "campaigns:view", group: "tools" },
  { subPath: "/tools/experiments", label: "A/B tests", iconName: "repeat24", permission: "campaigns:view", group: "tools" },
  { subPath: "/tools/rules", label: "Automated rules", iconName: "slidersHorizontal24", permission: "campaigns:view", group: "tools" },
  { subPath: "/activity", label: "Activity log", iconName: "textIndent24", permission: "account:view", group: "account" },
  { subPath: "/settings", label: "Settings & people", iconName: "shield24", permission: "account:view", group: "account" },
];
