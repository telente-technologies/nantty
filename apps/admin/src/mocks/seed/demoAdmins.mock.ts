import type { AdminPermission } from "@/constants/adminPermissions.constant";
import type { AdminRole, AdminStatus } from "@/types/admin.type";

export const demoAdminPassword = "nantty-admin-demo";
export const demoMockTotpCode = "000000";

export interface MockAdminRecord {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  status: AdminStatus;
  permissions: AdminPermission[];
  roleIds: string[];
  approvedByName: string | null;
  mfaEnrolled: boolean;
  pendingTotpSecret: string | null;
  recoveryCodes: string[];
  passkeys: { id: string; credentialId: string; label: string; createdAt: string; lastUsedAt: string | null }[];
  failedLoginAttempts: number;
  lockedUntilEpochMs: number;
  lastLoginAt: string | null;
  createdAt: string;
  createdByName: string | null;
}

const operationsPermissions: AdminPermission[] = [
  "metrics:read", "users:read", "users:moderate", "usernames:manage", "reserved-usernames:manage",
  "verification:review", "verification:documents", "applications:sellers", "applications:creators",
  "moderation:reports", "moderation:appeals", "chat-reports:review", "copyright:review", "brands:review", "ip-claims:review", "orders:read", "disputes:resolve", "refunds:issue",
  "ads:review", "catalog:manage", "config:read", "audit:read",
  "users:restrict", "users:suspend", "verification:grant", "support:chat", "support:email",
];

const legalPermissions: AdminPermission[] = ["legal.documents.view", "legal.documents.edit", "legal.documents.publish", "legal.notices.send"];

const supportPermissions: AdminPermission[] = ["users:read", "orders:read", "support:tickets", "support:chat", "support:email", "moderation:reports"];

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function buildDemoAdmins(): MockAdminRecord[] {
  const base = { roleIds: [], approvedByName: null, pendingTotpSecret: null, recoveryCodes: [], passkeys: [], failedLoginAttempts: 0, lockedUntilEpochMs: 0 };
  return [
    { ...base, id: "adm_0001", email: "tolu.adeyemi@example.com", name: "Tolu Adeyemi", role: "SUPERADMIN", status: "ACTIVE", permissions: [], mfaEnrolled: true, lastLoginAt: daysAgoIso(1), createdAt: daysAgoIso(420), createdByName: "CLI bootstrap" },
    { ...base, id: "adm_0002", email: "chidi.okafor@example.com", name: "Chidi Okafor", role: "ADMIN", status: "ACTIVE", permissions: operationsPermissions, mfaEnrolled: true, lastLoginAt: daysAgoIso(0.2), createdAt: daysAgoIso(300), createdByName: "Tolu Adeyemi" },
    { ...base, id: "adm_0003", email: "ngozi.eze@example.com", name: "Ngozi Eze", role: "SUPPORT", status: "ACTIVE", permissions: supportPermissions, mfaEnrolled: true, lastLoginAt: daysAgoIso(0.5), createdAt: daysAgoIso(200), createdByName: "Tolu Adeyemi" },
    { ...base, id: "adm_0004", email: "bola.hassan@example.com", name: "Bola Hassan", role: "ADMIN", status: "ACTIVE", permissions: ["metrics:read", "payouts:approve", "ledger:read", "coins:review", "refunds:issue", "audit:read"], mfaEnrolled: false, lastLoginAt: null, createdAt: daysAgoIso(2), createdByName: "Tolu Adeyemi" },
    { ...base, id: "adm_0005", email: "femi.lawal@example.com", name: "Femi Lawal", role: "ADMIN", status: "DISABLED", permissions: ["ads:review", "advertisers:manage"], mfaEnrolled: true, lastLoginAt: daysAgoIso(64), createdAt: daysAgoIso(380), createdByName: "Tolu Adeyemi" },
    { ...base, id: "adm_0006", email: "aisha.garba@example.com", name: "Aisha Garba", role: "ADMIN", status: "ACTIVE", permissions: ["metrics:read", "config:read", "config:plans", "config:revenue", "config:rules", "flags:manage", "automation:manage", "templates:manage", "audit:read", "audit:export"], mfaEnrolled: true, lastLoginAt: daysAgoIso(3), createdAt: daysAgoIso(150), createdByName: "Tolu Adeyemi" },
    { ...base, id: "adm_0007", email: "funmi.balogun@example.com", name: "Funmi Balogun", role: "ADMIN", status: "ACTIVE", permissions: legalPermissions, roleIds: ["tpl_legal"], mfaEnrolled: true, lastLoginAt: daysAgoIso(1), createdAt: daysAgoIso(40), createdByName: "Tolu Adeyemi" },
    { ...base, id: "adm_0008", email: "segun.adebisi@example.com", name: "Segun Adebisi", role: "ADMIN", status: "ACTIVE", permissions: legalPermissions, roleIds: ["tpl_legal"], mfaEnrolled: true, lastLoginAt: daysAgoIso(2), createdAt: daysAgoIso(40), createdByName: "Tolu Adeyemi" },
  ];
}
