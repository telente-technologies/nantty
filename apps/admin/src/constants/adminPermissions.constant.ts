export const adminPermissionGroups = [
  {
    area: "Overview",
    permissions: [{ key: "metrics:read", label: "View platform health and KPIs" }],
  },
  {
    area: "Users",
    permissions: [
      { key: "users:read", label: "Search and view users" },
      { key: "users:read-pii", label: "Reveal personal data (email, phone, legal name)" },
      { key: "users:moderate", label: "Warn, suspend and force-logout users" },
      { key: "users:ban", label: "Ban users" },
      { key: "usernames:manage", label: "Withhold and reclaim usernames" },
      { key: "reserved-usernames:manage", label: "Manage the reserved usernames list" },
    ],
  },
  {
    area: "Verification",
    permissions: [
      { key: "verification:review", label: "Approve and reject verification requests" },
      { key: "verification:documents", label: "Open identity and business documents" },
      { key: "verification:revoke", label: "Suspend and revoke verification" },
    ],
  },
  {
    area: "Applications",
    permissions: [
      { key: "applications:sellers", label: "Review seller applications" },
      { key: "applications:creators", label: "Review Creator Program applications" },
    ],
  },
  {
    area: "Moderation",
    permissions: [
      { key: "moderation:reports", label: "Work the reports queue" },
      { key: "moderation:appeals", label: "Decide appeals" },
      { key: "copyright:review", label: "Decide copyright claims and counter-notices" },
    ],
  },
  {
    area: "Commerce",
    permissions: [
      { key: "orders:read", label: "Look up orders and escrow timelines" },
      { key: "disputes:resolve", label: "Resolve disputes" },
      { key: "refunds:issue", label: "Issue refunds" },
      { key: "payouts:approve", label: "Approve or hold withdrawals" },
      { key: "coins:review", label: "Review coin purchases and transfers" },
      { key: "ledger:read", label: "Explore the ledger" },
    ],
  },
  {
    area: "Ads",
    permissions: [
      { key: "ads:review", label: "Approve and reject ads" },
      { key: "advertisers:manage", label: "Manage advertiser accounts and policy categories" },
    ],
  },
  {
    area: "Catalog",
    permissions: [{ key: "catalog:manage", label: "Manage categories, topics and Mart home features" }],
  },
  {
    area: "Configuration",
    permissions: [
      { key: "config:read", label: "View plans, prices and platform rules" },
      { key: "config:plans", label: "Change plans, perks and prices" },
      { key: "config:revenue", label: "Change revenue and fee rules" },
      { key: "config:rules", label: "Change creator eligibility and username rules" },
      { key: "flags:manage", label: "Change feature flags and experiments" },
      { key: "automation:manage", label: "Change automation rules" },
      { key: "templates:manage", label: "Change notification templates" },
    ],
  },
  {
    area: "Support",
    permissions: [
      { key: "support:tickets", label: "Reply to support tickets" },
      { key: "support:assign", label: "Assign tickets and manage macros" },
    ],
  },
  {
    area: "Audit",
    permissions: [
      { key: "audit:read", label: "Read the audit log" },
      { key: "audit:export", label: "Export the audit log" },
    ],
  },
] as const;

export type AdminPermission = (typeof adminPermissionGroups)[number]["permissions"][number]["key"];

export const everyAdminPermission: readonly AdminPermission[] = adminPermissionGroups.flatMap((group) => group.permissions.map((permission) => permission.key));

export function isKnownAdminPermission(candidate: string): candidate is AdminPermission {
  return (everyAdminPermission as readonly string[]).includes(candidate);
}
