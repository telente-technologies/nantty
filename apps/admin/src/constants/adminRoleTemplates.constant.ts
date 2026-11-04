import type { AdminPermission } from "@/constants/adminPermissions.constant";

export interface AdminRoleTemplate {
  readonly id: string;
  readonly name: string;
  readonly department: string;
  readonly permissions: readonly AdminPermission[];
}

export const adminRoleTemplates: readonly AdminRoleTemplate[] = [
	{ id: "tpl_support", name: "Support Agent", department: "Support", permissions: ["users:read", "orders:read", "support:tickets", "support:chat", "support:email", "support:assign", "support:helpContent"] },
  { id: "tpl_marketing", name: "Marketing", department: "Marketing", permissions: ["metrics:read", "marketing:campaigns", "marketing:email", "catalog:manage"] },
  { id: "tpl_sales", name: "Sales", department: "Sales", permissions: ["metrics:read", "users:read", "sales:leads", "applications:sellers", "brands:review"] },
	{ id: "tpl_finance", name: "Finance Admin", department: "Finance", permissions: ["metrics:read", "orders:read", "payouts:approve", "refunds:issue", "coins:review", "ledger:read", "finance:reports", "audit:read", "payments:webhooks", "payments:wallets"] },
  { id: "tpl_trust", name: "Trust & Safety", department: "Trust & Safety", permissions: ["users:read", "users:moderate", "users:restrict", "users:suspend", "moderation:reports", "moderation:appeals", "chat-reports:review", "copyright:review", "ip-claims:review", "security:cases"] },
  { id: "tpl_verification", name: "Verification", department: "Verification", permissions: ["users:read", "verification:review", "verification:documents", "verification:grant", "applications:sellers", "applications:creators"] },
	{ id: "tpl_trust_verification", name: "Trust & Verification", department: "Trust & Verification", permissions: ["users:read", "verification:review", "verification:documents", "verification:grant", "verification:revoke", "applications:sellers", "applications:creators", "brands:review", "brands:revoke"] },
	{ id: "tpl_moderation", name: "Moderation Admin", department: "Moderation", permissions: ["users:read", "users:moderate", "users:restrict", "users:suspend", "moderation:reports", "moderation:appeals", "chat-reports:review", "copyright:review", "ip-claims:review", "security:cases"] },
  { id: "tpl_content", name: "Content", department: "Content", permissions: ["content:review", "catalog:manage", "applications:creators", "moderation:reports"] },
  { id: "tpl_ads", name: "Ads", department: "Ads", permissions: ["ads:review", "advertisers:manage", "metrics:read"] },
  { id: "tpl_legal", name: "Legal", department: "Legal", permissions: ["legal.documents.view", "legal.documents.edit", "legal.documents.publish", "legal.notices.send"] },
  { id: "tpl_engineering", name: "Engineering (read-only)", department: "Engineering", permissions: ["metrics:read", "users:read", "orders:read", "ledger:read", "config:read", "audit:read"] },
	{ id: "tpl_subscription_manager", name: "Subscription Manager", department: "Subscriptions", permissions: ["config:plans"] },
	{ id: "tpl_operations_analyst", name: "Operations Analyst", department: "Operations", permissions: ["metrics:read", "logistics:read", "events:read"] },
	{ id: "tpl_auditor", name: "Auditor", department: "Audit", permissions: ["audit:read"] },
];
