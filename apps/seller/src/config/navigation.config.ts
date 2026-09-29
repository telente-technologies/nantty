import type { SellerPermission } from "@/config/rolePermissions.config";
import type { ZudoIconName } from "@/components/ui/zudoIcon";

export interface NavigationItem {
  readonly label: string;
  readonly href: string;
  readonly iconName: ZudoIconName;
  readonly permission: SellerPermission;
  readonly external?: boolean;
  readonly keywords?: string;
}

export interface NavigationGroup {
  readonly label: string | null;
  readonly items: NavigationItem[];
}

export function buildNavigationGroups(adsManagerUrl: string): NavigationGroup[] {
  return [
    { label: null, items: [{ label: "Dashboard", href: "/dashboard", iconName: "speedometer24", permission: "dashboard:view", keywords: "home overview" }] },
    {
      label: "Sell",
      items: [
        { label: "Point of sale", href: "/pos", iconName: "shoppingCart24", permission: "pos:sell", keywords: "register till checkout cashier" },
        { label: "Sales history", href: "/sales", iconName: "textIndent24", permission: "pos:sell", keywords: "receipts refunds returns in-store" },
      ],
    },
    {
      label: "Catalog",
      items: [
        { label: "Products", href: "/products", iconName: "tag24", permission: "products:manage", keywords: "items variants barcodes" },
        { label: "Inventory", href: "/inventory", iconName: "boxArrowDown24", permission: "inventory:manage", keywords: "stock adjustments transfers" },
      ],
    },
    {
      label: "Online",
      items: [
        { label: "Orders", href: "/orders", iconName: "truck24", permission: "orders:view", keywords: "marketplace escrow shipping returns disputes" },
        { label: "Customers", href: "/customers", iconName: "userCircle24", permission: "customers:manage", keywords: "crm loyalty" },
      ],
    },
    {
      label: "Grow",
      items: [
        { label: "Promotions", href: "/promotions", iconName: "star16", permission: "promotions:manage", keywords: "coupons discounts sales" },
        { label: "Affiliates & creators", href: "/affiliates", iconName: "videoCamera24", permission: "affiliates:manage", keywords: "commission creator live" },
        { label: "Advertise", href: adsManagerUrl, iconName: "speakerHigh24", permission: "settings:manage", external: true, keywords: "ads campaigns" },
      ],
    },
    {
      label: "Money",
      items: [
        { label: "Wallet & payouts", href: "/wallet", iconName: "creditCard24", permission: "wallet:view", keywords: "balance withdraw bank" },
        { label: "Reports", href: "/reports", iconName: "squaresFour24", permission: "reports:view", keywords: "analytics tax export" },
      ],
    },
    {
      label: "Team",
      items: [
        { label: "Staff", href: "/staff", iconName: "shield24", permission: "staff:manage", keywords: "roles pin audit" },
        { label: "Settings", href: "/settings", iconName: "slidersHorizontal24", permission: "settings:view", keywords: "store locations taxes receipt billing" },
      ],
    },
  ];
}
