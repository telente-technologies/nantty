import type { PlanFeature } from "@/config/planFeatures.config";
import type { SellerPermission } from "@/config/rolePermissions.config";
import type { NanttyIconName } from "@/components/ui/nanttyIcon";

export interface NavigationItem {
  readonly label: string;
  readonly href: string;
  readonly iconName: NanttyIconName;
  readonly permission: SellerPermission;
  readonly feature?: PlanFeature;
  readonly external?: boolean;
  readonly keywords?: string;
}

export interface NavigationGroup {
  readonly label: string | null;
  readonly items: NavigationItem[];
}

export function buildNavigationGroups(): NavigationGroup[] {
  return [
    { label: null, items: [{ label: "Overview", href: "/dashboard", iconName: "speedometer24", permission: "dashboard:view", keywords: "home dashboard summary" }] },
    {
      label: "Sell",
      items: [
        { label: "Orders", href: "/orders", iconName: "shoppingCart24", permission: "orders:view", keywords: "marketplace app escrow returns disputes refunds invoice" },
        { label: "Delivery", href: "/delivery", iconName: "truck24", permission: "delivery:manage", keywords: "shipping courier pickup dispatch areas fees" },
        { label: "Messages", href: "/messages", iconName: "chatCircle24", permission: "messages:manage", keywords: "chat inbox conversations customers" },
        { label: "Customers", href: "/customers", iconName: "userCircle24", permission: "customers:view", keywords: "crm segments buyers" },
        { label: "Reviews", href: "/reviews", iconName: "star16", permission: "reviews:manage", keywords: "ratings reputation feedback" },
      ],
    },
    {
      label: "Catalog",
      items: [
        { label: "Products", href: "/products", iconName: "tag24", permission: "catalog:view", keywords: "items variants sku categories brands import export" },
        { label: "Inventory", href: "/inventory", iconName: "boxArrowDown24", permission: "inventory:manage", keywords: "stock adjustments transfers warehouses suppliers reorder" },
        { label: "Storefront", href: "/storefront", iconName: "buildingStore20", permission: "storefront:manage", keywords: "store page logo cover policies hours" },
        { label: "Embed on your site", href: "/storefront/embed", iconName: "code20", permission: "storefront:manage", keywords: "embed widget website snippet iframe buy button html code" },
      ],
    },
    {
      label: "Grow",
      items: [
        { label: "Analytics", href: "/analytics", iconName: "squaresFour24", permission: "analytics:view", keywords: "sales revenue conversion insights" },
        { label: "Marketing", href: "/marketing", iconName: "paperPlaneTilt24", permission: "promotions:manage", keywords: "discount codes coupons flash sales bundles featured campaigns" },
        { label: "Ad results", href: "/ads", iconName: "speakerHigh24", permission: "ads:view", feature: "ads_tools", keywords: "ads manager campaigns roas spend advertise create campaign" },
        { label: "Affiliates & creators", href: "/affiliates", iconName: "videoCamera24", permission: "affiliates:manage", keywords: "commission creator live" },
      ],
    },
    {
      label: "Money",
      items: [
        { label: "Payments & finance", href: "/wallet", iconName: "creditCard24", permission: "wallet:view", keywords: "balance escrow withdraw payouts settlements fees statements" },
        { label: "Reports", href: "/reports", iconName: "textIndent24", permission: "reports:view", keywords: "export csv excel pdf tax" },
      ],
    },
    {
      label: "Manage",
      items: [
        { label: "Team", href: "/staff", iconName: "shield24", permission: "staff:manage", feature: "team", keywords: "staff roles permissions activity" },
        { label: "Brand", href: "/brand", iconName: "sealCheck20", permission: "settings:view", keywords: "official store trademark counterfeit protection" },
        { label: "Settings", href: "/settings", iconName: "slidersHorizontal24", permission: "settings:view", keywords: "store account security notifications api webhooks integrations billing" },
      ],
    },
  ];
}
