import type { SellerPermission } from "@/config/rolePermissions.config";

export const staffPermissionGroups: readonly { readonly title: string; readonly permissions: readonly SellerPermission[] }[] = [
  { title: "Overview & insight", permissions: ["dashboard:view", "analytics:view", "reports:view"] },
  { title: "Catalog", permissions: ["catalog:view", "products:manage", "inventory:manage", "media:upload", "storefront:manage"] },
  { title: "Orders & customers", permissions: ["orders:view", "orders:manage", "delivery:manage", "customers:view", "customers:manage", "messages:manage", "reviews:manage"] },
  { title: "Growth", permissions: ["promotions:manage", "ads:view", "affiliates:manage"] },
  { title: "Money", permissions: ["wallet:view", "wallet:withdraw"] },
  { title: "Store administration", permissions: ["staff:manage", "audit:view", "settings:view", "settings:manage", "billing:manage", "developer:manage"] },
];

export const permissionsReservedForOwner: ReadonlySet<SellerPermission> = new Set<SellerPermission>(["billing:manage", "developer:manage", "wallet:withdraw"]);
