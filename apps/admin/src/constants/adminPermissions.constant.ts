export const adminPermissionGroups = [
  {
    area: "Overview",
    permissions: [{ key: "metrics:read", label: "View platform health and KPIs" }],
  },
  {
    area: "Operations",
    permissions: [{ key: "events:read", label: "View event broker queue health" }],
  },
  {
    area: "Users",
    permissions: [
      { key: "users:read", label: "Search and view users" },
      { key: "users:read-pii", label: "Reveal personal data (email, phone, legal name)" },
      { key: "users:moderate", label: "Warn and force-logout users" },
      { key: "users:restrict", label: "Restrict features (posting, messaging, selling) for a time" },
      { key: "users:suspend", label: "Suspend users and decide suspension cases" },
      { key: "users:ban", label: "Ban users" },
      { key: "users:delete", label: "Delete accounts (anonymising financial records)" },
      { key: "usernames:reassign", label: "Move a username from one account to another" },
      { key: "usernames:manage", label: "Withhold and reclaim usernames" },
      { key: "reserved-usernames:manage", label: "Manage the reserved usernames list" },
    ],
  },
  {
    area: "Verification",
    permissions: [
      { key: "verification:review", label: "Approve and reject verification requests" },
      { key: "verification:documents", label: "Open identity and business documents" },
      { key: "verification:grant", label: "Grant lifetime free checkmarks" },
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
    area: "Brands",
    permissions: [
      { key: "brands:review", label: "Review brands and Official Store requests" },
      { key: "brands:revoke", label: "Revoke Official Store status" },
      { key: "ip-claims:review", label: "Decide trademark and counterfeit claims" },
    ],
  },
  {
    area: "Moderation",
    permissions: [
      { key: "moderation:reports", label: "Work the reports queue" },
      { key: "moderation:appeals", label: "Decide appeals" },
      { key: "chat-reports:review", label: "Review chat reports and the messages reporters submit" },
      { key: "chat-reports:legal", label: "Escalate chat reports to legal and change evidence retention" },
      { key: "copyright:review", label: "Decide copyright claims and counter-notices" },
      { key: "security:cases", label: "Work security cases (probing and suspected bots) and clear flags" },
    ],
  },
  {
    area: "Commerce",
    permissions: [
      { key: "orders:read", label: "Look up orders and escrow timelines" },
      { key: "logistics:read", label: "View delivery operations and shipment exceptions" },
      { key: "disputes:resolve", label: "Resolve disputes" },
      { key: "refunds:issue", label: "Issue refunds" },
      { key: "payouts:approve", label: "Approve or hold withdrawals" },
      { key: "coins:review", label: "Review coin purchases and transfers" },
      { key: "ledger:read", label: "Explore the ledger" },
      { key: "payments:webhooks", label: "Inspect and replay failed payment webhooks" },
      { key: "payments:wallets", label: "Reject deposits, unfreeze wallets and run wallet reconciliation" },
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
      { key: "support:chat", label: "Answer live chats" },
      { key: "support:email", label: "Email a user or segment" },
      { key: "support:helpContent", label: "Edit Help Centre categories and topics" },
    ],
  },
  {
    area: "Growth",
    permissions: [
      { key: "marketing:campaigns", label: "Run marketing campaigns" },
      { key: "marketing:email", label: "Send marketing emails" },
      { key: "sales:leads", label: "Work seller and brand sales leads" },
      { key: "content:review", label: "Review content and creator submissions" },
    ],
  },
  {
    area: "Legal",
    permissions: [
      { key: "legal.documents.view", label: "Read legal documents, versions and notices" },
      { key: "legal.documents.edit", label: "Draft and submit legal document versions" },
      { key: "legal.documents.publish", label: "Approve and publish legal document versions (second person)" },
      { key: "legal.notices.send", label: "Send and resend Policy updated emails to users" },
    ],
  },
  {
    area: "Finance",
    permissions: [{ key: "finance:reports", label: "Open financial reports and exports" }],
  },
  {
    area: "Platform",
    permissions: [
      { key: "settings:edit", label: "Edit platform settings" },
      { key: "staff:manage", label: "Create and manage admins and roles" },
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
