import { buildDemoAdmins, type MockAdminRecord } from "@/mocks/seed/demoAdmins.mock";
import { buildDemoAuditEntries } from "@/mocks/seed/demoAuditEntries.mock";
import { buildDemoPlatformUsers, type MockPlatformUserRecord } from "@/mocks/seed/demoPlatformUsers.mock";
import type { AuditLogEntry } from "@/types/audit.type";

export interface MockAdminSession {
  readonly id: string;
  readonly adminId: string;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly startedAt: string;
  lastSeenAt: string;
  revoked: boolean;
}

export interface MockDatabase {
  readonly admins: MockAdminRecord[];
  readonly platformUsers: MockPlatformUserRecord[];
  readonly auditEntries: AuditLogEntry[];
  readonly adminSessions: Map<string, MockAdminSession>;
  readonly accessTokens: Map<string, { adminId: string; sessionId: string; expiresAtEpochMs: number }>;
  readonly refreshTokens: Map<string, { adminId: string; sessionId: string; expiresAtEpochMs: number; used: boolean }>;
  readonly mfaTokens: Map<string, { adminId: string; expiresAtEpochMs: number; failedAttempts: number; ipAddress: string; userAgent: string }>;
  readonly stepUpTokens: Map<string, { adminId: string; sessionId: string; expiresAtEpochMs: number }>;
  readonly webauthnChallenges: Map<string, { adminId: string; expiresAtEpochMs: number }>;
  readonly idempotentResponses: Map<string, { status: number; body: unknown }>;
  readonly areaStores: Map<string, unknown>;
}

const globalKey = Symbol.for("nantty.admin.mockDatabase");

function createMockDatabase(): MockDatabase {
  const admins = buildDemoAdmins();
  const platformUsers = buildDemoPlatformUsers();
  return {
    admins,
    platformUsers,
    auditEntries: buildDemoAuditEntries(admins, platformUsers),
    adminSessions: new Map(),
    accessTokens: new Map(),
    refreshTokens: new Map(),
    mfaTokens: new Map(),
    stepUpTokens: new Map(),
    webauthnChallenges: new Map(),
    idempotentResponses: new Map(),
    areaStores: new Map(),
  };
}

export function readMockDatabase(): MockDatabase {
  const globalScope = globalThis as unknown as Record<symbol, MockDatabase | undefined>;
  globalScope[globalKey] ??= createMockDatabase();
  return globalScope[globalKey];
}

export function readMockAreaStore<Store>(areaName: string, createInitialStore: () => Store): Store {
  const stores = readMockDatabase().areaStores;
  if (!stores.has(areaName)) stores.set(areaName, createInitialStore());
  return stores.get(areaName) as Store;
}

export function findMockPlatformUserOrFail(userId: string): MockPlatformUserRecord {
  const user = readMockDatabase().platformUsers.find((candidate) => candidate.id === userId);
  if (!user) throw new Error(`Unknown mock user ${userId}`);
  return user;
}

export function findMockPlatformUser(userId: string): MockPlatformUserRecord | null {
  return readMockDatabase().platformUsers.find((candidate) => candidate.id === userId) ?? null;
}
