import type { MockAdminRecord } from "@/mocks/seed/demoAdmins.mock";
import type { MockPlatformUserRecord } from "@/mocks/seed/demoPlatformUsers.mock";
import type { AuditLogEntry } from "@/types/audit.type";

export function buildDemoAuditEntries(admins: readonly MockAdminRecord[], users: readonly MockPlatformUserRecord[]): AuditLogEntry[] {
  const actor = (index: number) => {
    const admin = admins[index] ?? admins[0]!;
    return { id: admin.id, name: admin.name, kind: "ADMIN" as const, role: admin.role };
  };
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  const userLabel = (index: number) => `@${users[index]?.username ?? "unknown"}`;
  const userId = (index: number) => users[index]?.id ?? "usr_0000";
  const rows: Omit<AuditLogEntry, "id" | "requestId" | "ipAddress">[] = [
    { occurredAt: minutesAgo(42), actor: actor(1), action: "user.suspended", area: "users", target: { type: "user", id: userId(11), label: userLabel(11) }, reason: "Repeated counterfeit listings after two warnings.", before: { status: "WARNED" }, after: { status: "SUSPENDED", until: minutesAgo(-7 * 1440) }, stepUpVerified: false },
    { occurredAt: minutesAgo(95), actor: actor(1), action: "verification.approved", area: "verification", target: { type: "verification", id: "ver_seed_01", label: userLabel(0) }, reason: "CAC certificate and director ID match.", before: { status: "PENDING", color: "GOLD", tier: "PRO" }, after: { status: "VERIFIED", color: "GOLD", tier: "PRO", badgeVisible: true }, stepUpVerified: false },
    { occurredAt: minutesAgo(180), actor: actor(0), action: "admin.permissions_changed", area: "admins", target: { type: "admin", id: "adm_0004", label: "Bola Hassan" }, reason: "Joining the payouts desk.", before: { permissions: ["metrics:read", "audit:read"] }, after: { permissions: ["metrics:read", "payouts:approve", "ledger:read", "coins:review", "refunds:issue", "audit:read"] }, stepUpVerified: true },
    { occurredAt: minutesAgo(260), actor: actor(5), action: "config.revenue_rules_changed", area: "config", target: { type: "revenueRules", id: "revenue", label: "Revenue rules v6" }, reason: "Business plan escrow fee set to 1%.", before: { escrowFeeBusinessPlanBasisPoints: 150 }, after: { escrowFeeBusinessPlanBasisPoints: 100 }, stepUpVerified: true },
    { occurredAt: minutesAgo(1440), actor: actor(0), action: "admin.disabled", area: "admins", target: { type: "admin", id: "adm_0005", label: "Femi Lawal" }, reason: "Left the company.", before: { status: "ACTIVE" }, after: { status: "DISABLED" }, stepUpVerified: true },
    { occurredAt: minutesAgo(1600), actor: actor(1), action: "user.banned", area: "users", target: { type: "user", id: userId(19), label: userLabel(19) }, reason: "Impersonating Dangote Group to run a fake giveaway.", before: { status: "SUSPENDED" }, after: { status: "BANNED", duration: "PERMANENT" }, stepUpVerified: true },
    { occurredAt: minutesAgo(2900), actor: actor(0), action: "admin.created", area: "admins", target: { type: "admin", id: "adm_0004", label: "Bola Hassan" }, reason: "Finance operations hire.", before: null, after: { email: "bola.hassan@example.com", role: "ADMIN" }, stepUpVerified: true },
  ];
  return rows.map((row, index) => ({ ...row, id: `aud_seed_${String(index + 1).padStart(3, "0")}`, requestId: `req_seed_${index + 1}`, ipAddress: "102.89.34.17" }));
}
