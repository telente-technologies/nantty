import type { AdminPermission } from "@/constants/adminPermissions.constant";

export type ApiRouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRouteDefinition {
  readonly method: ApiRouteMethod;
  readonly path: string;
  readonly access: readonly AdminPermission[] | "ownAccount" | "superadmin";
  readonly stepUp?: boolean;
  readonly reason?: boolean;
  readonly stepUpWhenBody?: (body: unknown) => boolean;
  readonly singleUseStepUp?: boolean;
}

type Access = ApiRouteDefinition["access"];
type Options = Pick<ApiRouteDefinition, "stepUp" | "reason" | "stepUpWhenBody" | "singleUseStepUp">;

const read = (path: string, access: Access): ApiRouteDefinition => ({ method: "GET", path, access });
const write = (method: ApiRouteMethod, path: string, access: Access, options: Options = {}): ApiRouteDefinition => ({ method, path, access, ...options });
const sensitive = { stepUp: true, reason: true } as const;
const moneyAction = { stepUp: true, reason: true, singleUseStepUp: true } as const;
const reasoned = { reason: true } as const;

const accountActionsInBody = new Set(["SUSPEND_USER", "BAN_USER", "REMOVE_GROUP"]);
const isAccountActionInBody = (body: unknown) => typeof body === "object" && body !== null && accountActionsInBody.has(String((body as { action?: unknown }).action));

const userReaders: AdminPermission[] = ["users:read", "support:tickets", "verification:review", "moderation:reports"];
const linkedProfileReaders: AdminPermission[] = ["users:read", "support:tickets", "users:moderate"];
const usernameReaders: AdminPermission[] = ["usernames:manage", "usernames:reassign", "reserved-usernames:manage"];
const usernameHoldReaders: AdminPermission[] = ["usernames:reassign", "reserved-usernames:manage"];
const verificationReaders: AdminPermission[] = ["verification:review", "verification:revoke"];
const brandReaders: AdminPermission[] = ["brands:review", "brands:revoke", "ip-claims:review"];
const orderReaders: AdminPermission[] = ["orders:read", "disputes:resolve", "refunds:issue", "support:tickets"];
const configReaders: AdminPermission[] = ["config:read", "config:plans", "config:revenue", "config:rules"];
const configWriters: AdminPermission[] = ["config:plans", "config:revenue", "config:rules"];
const priceWriters: AdminPermission[] = ["config:plans", "config:revenue"];
const priceReaders: AdminPermission[] = ["config:read", ...priceWriters];
const adReaders: AdminPermission[] = ["ads:review", "advertisers:manage"];
const adCreditReaders: AdminPermission[] = ["advertisers:manage", "ledger:read"];
const chatReportReaders: AdminPermission[] = ["chat-reports:review", "chat-reports:legal"];
const ticketWorkers: AdminPermission[] = ["support:tickets", "support:assign"];
const helpReaders: AdminPermission[] = ["support:helpContent", "support:tickets", "support:assign"];
const legalReaders: AdminPermission[] = ["legal.documents.view", "legal.documents.edit", "legal.documents.publish", "legal.notices.send"];
const emailTemplateReaders: AdminPermission[] = ["support:email", ...legalReaders];

const ownAccountRoutes: ApiRouteDefinition[] = [
  read("/admin/account", "ownAccount"),
  read("/admin/account/sessions", "ownAccount"),
  write("POST", "/admin/account/sessions/:id/revoke", "ownAccount"),
  write("POST", "/admin/account/recovery-codes/regenerate", "ownAccount", { stepUp: true }),
  write("POST", "/admin/account/passkeys/options", "ownAccount", { stepUp: true }),
  write("POST", "/admin/account/passkeys", "ownAccount", { stepUp: true }),
  write("DELETE", "/admin/account/passkeys/:id", "ownAccount", { stepUp: true }),
  write("POST", "/admin/consents", "ownAccount"),
  write("PATCH", "/admin/users/me/preferences", "ownAccount"),
];

const platformRoutes: ApiRouteDefinition[] = [
  read("/admin/metrics/overview", ["metrics:read"]),
  read("/admin/event-operations/queues", ["events:read"]),
  read("/admin/audit", ["audit:read"]),
  read("/admin/audit/facets", ["audit:read"]),
  read("/admin/audit/export", ["audit:export"]),
  read("/admin/audit/:id", ["audit:read"]),
  read("/admin/admins", ["staff:manage"]),
  read("/admin/admins/:id", ["staff:manage"]),
  write("POST", "/admin/admins", ["staff:manage"], sensitive),
  write("PUT", "/admin/admins/:id/permissions", ["staff:manage"], sensitive),
  write("POST", "/admin/admins/:id/{disable|enable|reset-mfa|suspend|revoke}", ["staff:manage"], sensitive),
  write("POST", "/admin/admins/:id/approve", "superadmin", sensitive),
  read("/admin/roles", ["staff:manage"]),
  write("POST", "/admin/roles", ["staff:manage"], sensitive),
  read("/admin/staff-settings", ["staff:manage"]),
  write("PUT", "/admin/staff-settings", "superadmin", sensitive),
];

const peopleRoutes: ApiRouteDefinition[] = [
  read("/admin/users", userReaders),
  read("/admin/users/:id", userReaders),
  { method: "GET", path: "/admin/users/:id/personal-data", access: ["users:read-pii"], stepUp: true },
  write("POST", "/admin/users/:id/warn", ["users:moderate"], sensitive),
  write("POST", "/admin/users/:id/force-logout", ["users:moderate"], sensitive),
  write("POST", "/admin/users/:id/restrict", ["users:restrict"], sensitive),
  write("POST", "/admin/users/:id/suspend", ["users:suspend"], sensitive),
  write("POST", "/admin/users/:id/reinstate", ["users:suspend"], sensitive),
  write("POST", "/admin/users/:id/{ban|unban}", ["users:ban"], sensitive),
  write("POST", "/admin/users/:id/delete", ["users:delete"], sensitive),
  write("POST", "/admin/users/:id/username/{reassign|assign-held}", ["usernames:reassign"], sensitive),
  write("POST", "/admin/users/:id/username/{withhold|reclaim}", ["usernames:manage"], sensitive),
  read("/admin/users/:id/linked-profiles", linkedProfileReaders),
  write("POST", "/admin/users/:id/linked-profiles/{convert|resolve}", ["users:moderate"], sensitive),
  read("/admin/linked-profiles/conflicts", linkedProfileReaders),
  read("/admin/usernames/withheld", usernameReaders),
  // The response can identify the current owner of a confusable handle.
  // Restrict it to staff who are authorized to resolve ownership conflicts.
  read("/admin/usernames/confusables", ["usernames:reassign"]),
  read("/admin/usernames/held", usernameHoldReaders),
  read("/admin/usernames/hold", usernameHoldReaders),
  read("/admin/usernames/reserved", ["reserved-usernames:manage"]),
  write("POST", "/admin/usernames/reserved", ["reserved-usernames:manage"], { stepUp: true }),
  write("DELETE", "/admin/usernames/reserved/:id", ["reserved-usernames:manage"], { stepUp: true }),
  read("/admin/account-health/:id", ["users:read", "copyright:review"]),
];

const verificationRoutes: ApiRouteDefinition[] = [
  read("/admin/accounts/created", ["users:read", "verification:grant"]),
  write("POST", "/admin/accounts", ["verification:grant"], sensitive),
  read("/admin/checkmark-grants", ["verification:grant", "verification:revoke"]),
  write("POST", "/admin/checkmark-grants", ["verification:grant"], sensitive),
  write("POST", "/admin/checkmark-grants/:id/revoke", ["verification:revoke"], sensitive),
  read("/admin/verifications", verificationReaders),
  read("/admin/verifications/:id", verificationReaders),
  read("/admin/verifications/:id/documents/:documentId", ["verification:documents"]),
  write("POST", "/admin/verifications/:id/{approve|reject|reinstate}", ["verification:review"], sensitive),
  write("POST", "/admin/verifications/:id/{suspend|revoke}", ["verification:revoke"], sensitive),
  read("/admin/verification-cases", ["verification:review"]),
  read("/admin/verification-cases/:id", ["verification:review"]),
  write("POST", "/admin/verification-cases/:id/{approve|reject}", ["verification:review"], sensitive),
  read("/admin/business-documents", ["verification:review"]),
  read("/admin/business-documents/:id/documents/:documentId/access", ["verification:documents"]),
  write("POST", "/admin/business-documents/:id/documents/:documentId/{approve|reject}", ["verification:review"], sensitive),
  read("/admin/black-applications", verificationReaders),
  write("POST", "/admin/black-applications/:id/checklist", ["verification:review"]),
  write("POST", "/admin/black-applications/:id/reverification-reminder", ["verification:review"]),
  write("POST", "/admin/black-applications/:id/{approve|reject}", ["verification:review"], sensitive),
  write("POST", "/admin/black-applications/:id/revoke", ["verification:revoke"], sensitive),
  read("/admin/applications/sellers", ["applications:sellers"]),
  read("/admin/applications/sellers/:id", ["applications:sellers"]),
  write("POST", "/admin/applications/sellers/:id/{approve|reject}", ["applications:sellers"], reasoned),
  read("/admin/applications/creators", ["applications:creators"]),
  read("/admin/applications/creators/:id", ["applications:creators"]),
  write("POST", "/admin/applications/creators/:id/{approve|reject}", ["applications:creators"], sensitive),
  read("/admin/brands", brandReaders),
  read("/admin/brands/:id", brandReaders),
  read("/admin/brands/:id/documents/:documentId", ["brands:review"]),
  write("POST", "/admin/brands/:id/official-status/{approve|reject|request-info}", ["brands:review"], reasoned),
  write("POST", "/admin/brands/:id/official-status/revoke", ["brands:revoke"], sensitive),
  write("POST", "/admin/brands/:id/reassign", ["brands:revoke"], sensitive),
];

const trustRoutes: ApiRouteDefinition[] = [
  read("/admin/ip-claims", ["ip-claims:review"]),
  read("/admin/ip-claims/:id", ["ip-claims:review"]),
  write("POST", "/admin/ip-claims/:id/uphold", ["ip-claims:review"], sensitive),
  write("POST", "/admin/ip-claims/:id/{reject|request-info}", ["ip-claims:review"], reasoned),
  read("/admin/reports", ["moderation:reports"]),
  read("/admin/reports/:id", ["moderation:reports"]),
  write("POST", "/admin/reports/:id/actions", ["moderation:reports"], reasoned),
  write("POST", "/admin/reports/:id/{suspend-author|revoke-author-verification}", ["moderation:reports"], sensitive),
  read("/admin/live-incidents", ["moderation:reports"]),
  read("/admin/live-incidents/:id", ["moderation:reports"]),
  write("POST", "/admin/live-incidents/:id/actions", ["moderation:reports"], reasoned),
  write("POST", "/admin/live-incidents/:id/end-and-suspend", ["moderation:reports"], sensitive),
  read("/admin/suspensions/cases", ["users:suspend", "users:moderate"]),
  read("/admin/suspensions/cases/:id", ["users:suspend", "users:moderate"]),
  write("POST", "/admin/suspensions/cases/:id/{approve|dismiss|escalate}", ["users:suspend"], sensitive),
  read("/admin/suspensions/accounts", ["users:suspend"]),
  write("POST", "/admin/suspensions/accounts/:id/reinstate", ["users:suspend"], sensitive),
  write("POST", "/admin/suspensions/accounts/:id/appeal/decide", ["users:suspend"], sensitive),
  read("/admin/strike-appeals", ["moderation:appeals", "copyright:review"]),
  write("POST", "/admin/strike-appeals/:id/{uphold|overturn}", ["moderation:appeals", "copyright:review"], reasoned),
  read("/admin/appeals", ["moderation:appeals"]),
  read("/admin/appeals/:id", ["moderation:appeals"]),
  write("POST", "/admin/appeals/:id/decide", ["moderation:appeals"], reasoned),
  read("/admin/copyright-policy", ["copyright:review"]),
  write("PUT", "/admin/copyright-policy", ["copyright:review"], sensitive),
  read("/admin/copyright-claims", ["copyright:review"]),
  read("/admin/copyright-claims/:id", ["copyright:review"]),
  write("POST", "/admin/copyright-claims/:id/audio-match", ["copyright:review"]),
  write("POST", "/admin/copyright-claims/:id/uphold", ["copyright:review"], sensitive),
  write("POST", "/admin/copyright-claims/:id/{reject|request-info}", ["copyright:review"], reasoned),
  write("POST", "/admin/copyright-claims/:id/counter-notices/:noticeId/{accept|reject|court-action}", ["copyright:review"], sensitive),
  read("/admin/trending/moderation", ["content:review", "moderation:reports"]),
  write("PUT", "/admin/trending/moderation", ["content:review", "moderation:reports"], { stepUp: true }),
  read("/admin/chat-reports", chatReportReaders),
  read("/admin/chat-reports/retention", chatReportReaders),
  write("PUT", "/admin/chat-reports/retention", ["chat-reports:legal"], sensitive),
  read("/admin/chat-reports/:id", chatReportReaders),
  write("POST", "/admin/chat-reports/:id/actions", chatReportReaders, { reason: true, stepUpWhenBody: isAccountActionInBody }),
  read("/admin/security/cases", ["security:cases"]),
  read("/admin/security/cases/:id", ["security:cases"]),
  write("POST", "/admin/security/cases/:id/decide", ["security:cases"], sensitive),
  read("/admin/ads/credits", adCreditReaders),
  write("POST", "/admin/ads/credits", ["advertisers:manage"], moneyAction),
  write("POST", "/admin/ads/credits/:id/revoke", ["advertisers:manage"], moneyAction),
  read("/admin/ads/cashback", adCreditReaders),
  write("PUT", "/admin/ads/cashback/:id", ["advertisers:manage"], moneyAction),
  read("/admin/ads", adReaders),
  read("/admin/ads/:id", adReaders),
  write("POST", "/admin/ads/:id/approve", ["ads:review"]),
  write("POST", "/admin/ads/:id/reject", ["ads:review"], reasoned),
  read("/admin/advertisers", adReaders),
  read("/admin/advertisers/:id", adReaders),
  write("POST", "/admin/advertisers/:id/{suspend|reinstate}", ["advertisers:manage"], reasoned),
  read("/admin/ad-policies", adReaders),
  write("POST", "/admin/ad-policies", ["advertisers:manage"]),
  write("PUT", "/admin/ad-policies/:id", ["advertisers:manage"], reasoned),
];

const moneyRoutes: ApiRouteDefinition[] = [
  read("/admin/orders", orderReaders),
  read("/admin/orders/:id", orderReaders),
  read("/admin/logistics/shipments", ["logistics:read"]),
  read("/admin/disputes", ["disputes:resolve"]),
  read("/admin/disputes/:id", ["disputes:resolve"]),
  write("POST", "/admin/disputes/:id/resolve", ["disputes:resolve"], moneyAction),
  read("/admin/escrows/undelivered-review", ["disputes:resolve"]),
  write("POST", "/admin/orders/:id/escrow/{release|refund}", ["disputes:resolve"], moneyAction),
  read("/admin/refunds", ["refunds:issue"]),
  write("POST", "/admin/refunds", ["refunds:issue"], sensitive),
  read("/admin/withdrawals", ["payouts:approve"]),
  read("/admin/withdrawals/:id", ["payouts:approve"]),
  write("POST", "/admin/withdrawals/:id/review", ["payouts:approve"], moneyAction),
  write("POST", "/admin/payouts/run", ["payouts:approve"], { stepUp: true, singleUseStepUp: true }),
  read("/admin/coins/transactions", ["coins:review"]),
  read("/admin/coins/transactions/:id", ["coins:review"]),
  write("POST", "/admin/coins/transactions/:id/mark-reviewed", ["coins:review"]),
  write("POST", "/admin/coins/transactions/:id/reverse", ["coins:review"], moneyAction),
  read("/admin/coins/price-table", priceReaders),
  write("PUT", "/admin/coins/price-table/:id", priceWriters, sensitive),
  read("/admin/subscriptions/price-table", priceReaders),
  write("PUT", "/admin/subscriptions/price-table/:planCode/:countryCode", priceWriters, sensitive),
  read("/admin/subscriptions/offer-links", priceReaders),
  write("POST", "/admin/subscriptions/offer-links", priceWriters, sensitive),
  write("POST", "/admin/subscriptions/offer-links/:id/revoke", priceWriters, sensitive),
  write("POST", "/admin/subscriptions/offer-links/:id/sends", priceWriters, sensitive),
  read("/admin/ledger/accounts", ["ledger:read"]),
  read("/admin/ledger/currencies", ["ledger:read"]),
  read("/admin/ledger/journal-entries", ["ledger:read"]),
  read("/admin/ledger/integrity", ["ledger:read"]),
  read("/admin/ledger/statement", ["ledger:read"]),
  read("/admin/payments/webhooks/dead-letters", ["payments:webhooks"]),
  read("/admin/payments/webhooks/dead-letters/:id", ["payments:webhooks"]),
  write("POST", "/admin/payments/webhooks/dead-letters/:id/replay", ["payments:webhooks"], moneyAction),
  write("POST", "/admin/payments/{wallet-fundings|wallets}/:id/{reject|unfreeze}", ["payments:wallets"], moneyAction),
  write("POST", "/admin/payments/wallet-reconciliation/run", ["payments:wallets"], sensitive),
];

const catalogAndConfigRoutes: ApiRouteDefinition[] = [
  ...["/admin/catalog/categories", "/admin/catalog/categories/:id", "/admin/catalog/features", "/admin/catalog/features/image-library", "/admin/catalog/features/:id", "/admin/catalog/topics", "/admin/catalog/topics/:id"].map((path) => read(path, ["catalog:manage"])),
  write("POST", "/admin/catalog/categories", ["catalog:manage"], reasoned),
  write("PATCH", "/admin/catalog/categories/:id", ["catalog:manage"], reasoned),
  write("POST", "/admin/catalog/categories/:id/move", ["catalog:manage"]),
  write("POST", "/admin/catalog/categories/:id/{activate|deactivate}", ["catalog:manage"], reasoned),
  write("POST", "/admin/catalog/features", ["catalog:manage"], reasoned),
  write("PATCH", "/admin/catalog/features/:id", ["catalog:manage"], reasoned),
  write("POST", "/admin/catalog/features/:id/move", ["catalog:manage"]),
  write("POST", "/admin/catalog/features/:id/{publish|unpublish}", ["catalog:manage"], reasoned),
  write("POST", "/admin/catalog/topics", ["catalog:manage"], reasoned),
  write("PATCH", "/admin/catalog/topics/:id", ["catalog:manage"], reasoned),
  read("/admin/config", configReaders),
  read("/admin/config/:key", configReaders),
  read("/admin/config/:key/versions", configReaders),
  write("PUT", "/admin/config/:key", configWriters, sensitive),
  write("POST", "/admin/config/:key/versions/:version/restore", configWriters, sensitive),
  read("/admin/automation/catalog", ["automation:manage"]),
  read("/admin/automation/sample-events", ["automation:manage"]),
  read("/admin/automation/executions", ["automation:manage"]),
  read("/admin/automation/rules", ["automation:manage"]),
  read("/admin/automation/rules/:id", ["automation:manage"]),
  read("/admin/automation/rules/:id/versions", ["automation:manage"]),
  write("PUT", "/admin/automation/rules/:id", ["automation:manage"], sensitive),
  write("POST", "/admin/automation/rules/:id/versions/:version/restore", ["automation:manage"], sensitive),
  write("DELETE", "/admin/automation/rules/:id", ["automation:manage"], sensitive),
];

const supportAndLegalRoutes: ApiRouteDefinition[] = [
  read("/admin/support/agents", ticketWorkers),
  read("/admin/support/tickets", ticketWorkers),
  read("/admin/support/tickets/:id", ticketWorkers),
  write("POST", "/admin/support/tickets/:id/{replies|status}", ["support:tickets"]),
  write("POST", "/admin/support/tickets/:id/assign", ["support:assign"]),
  read("/admin/support/macros", ["support:tickets", "support:assign", "support:chat"]),
  write("POST", "/admin/support/macros", ["support:assign"]),
  write("PUT", "/admin/support/macros/:id", ["support:assign"]),
  write("DELETE", "/admin/support/macros/:id", ["support:assign"]),
  read("/admin/support/chats", ["support:chat"]),
  read("/admin/support/chats/:id", ["support:chat"]),
  write("POST", "/admin/support/chats/:id/{claim|messages|end}", ["support:chat"]),
  read("/admin/support/email/templates", ["support:email", "marketing:email"]),
  read("/admin/support/email/segments", ["support:email", "marketing:email"]),
  read("/admin/support/email/sends", ["support:email", "marketing:email"]),
  read("/admin/support/email/deliveries/failed", ["support:email", "marketing:email"]),
  write("POST", "/admin/support/email/preview", ["support:email", "marketing:email"]),
  write("POST", "/admin/support/email/send", ["support:email", "marketing:email"]),
  read("/admin/help/categories", helpReaders),
  read("/admin/help/topics", helpReaders),
  read("/admin/help/topics/:id", helpReaders),
  read("/admin/help/auto-topics", helpReaders),
  read("/admin/help/settings", helpReaders),
  write("POST", "/admin/help/categories", ["support:helpContent"]),
  write("PUT", "/admin/help/categories/:id", ["support:helpContent"]),
  write("DELETE", "/admin/help/categories/:id", ["support:helpContent"]),
  write("POST", "/admin/help/topics", ["support:helpContent"]),
  write("PUT", "/admin/help/topics/:id", ["support:helpContent"]),
  write("DELETE", "/admin/help/topics/:id", ["support:helpContent"]),
  write("POST", "/admin/help/topics/:id/{publish|unpublish|merge}", ["support:helpContent"]),
  write("PUT", "/admin/help/settings", ["support:helpContent"]),
  read("/admin/email-templates", emailTemplateReaders),
  read("/admin/email-templates/:key/preview", emailTemplateReaders),
  write("POST", "/admin/email-templates/policy-updated/preview", legalReaders),
  read("/admin/legal/documents", legalReaders),
  read("/admin/legal/documents/:key", legalReaders),
  write("POST", "/admin/legal/documents/:key/versions", ["legal.documents.edit"]),
  write("POST", "/admin/legal/documents/:key/rollback", ["legal.documents.edit"], sensitive),
  read("/admin/legal/versions/:id", legalReaders),
  write("PUT", "/admin/legal/versions/:id", ["legal.documents.edit"]),
  write("POST", "/admin/legal/versions/:id/submit", ["legal.documents.edit"]),
  write("POST", "/admin/legal/versions/:id/return", ["legal.documents.publish"], reasoned),
  write("POST", "/admin/legal/versions/:id/publish", ["legal.documents.publish"], sensitive),
  read("/admin/legal/versions/:id/acceptance", legalReaders),
  read("/admin/legal/versions/:id/notice-preview", legalReaders),
  read("/admin/legal/versions/:id/notice-draft", legalReaders),
  write("PUT", "/admin/legal/versions/:id/notice-draft", ["legal.notices.send", "legal.documents.edit"]),
  write("POST", "/admin/legal/versions/:id/notice-draft/test-send", ["legal.notices.send"]),
  read("/admin/legal/notices", legalReaders),
  read("/admin/legal/notices/:id", legalReaders),
  write("POST", "/admin/legal/notices", ["legal.notices.send"], sensitive),
];

export const adminApiRouteTable: readonly ApiRouteDefinition[] = [
  ...ownAccountRoutes,
  ...platformRoutes,
  ...peopleRoutes,
  ...verificationRoutes,
  ...trustRoutes,
  ...moneyRoutes,
  ...catalogAndConfigRoutes,
  ...supportAndLegalRoutes,
];
