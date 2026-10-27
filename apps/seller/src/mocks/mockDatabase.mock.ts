import { MockHttpError } from "@/mocks/mockResponses.mock";
import type { MockResponse } from "@/mocks/mockRouter.mock";
import { readStoreIdOfCurrentMockScope } from "@/mocks/mockStoreScope.mock";
import { buildDemoGateStores, buildDemoSubscriptionPlans, type MockGateStore } from "@/mocks/seed/demoFinance.mock";
import { buildDemoMemberships, buildDemoUserAccounts, type MockStoreMembership, type MockUserAccount } from "@/mocks/seed/demoPeople.mock";
import { buildDemoStoreDataset, mockStoreDatasetFieldNames, type MockStoreDataset } from "@/mocks/seed/demoStoreDatasets.mock";
import type { AuditLogEntry } from "@/types/staff.type";
import type { SubscriptionPlan } from "@/types/subscription.type";

export interface MockApiSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly refreshToken: string;
  revoked: boolean;
}

export interface MockUpload {
  readonly uploadId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly chunkSizeBytes: number;
  readonly totalChunks: number;
  readonly receivedChunks: Map<number, Uint8Array>;
  mediaId: string | null;
}

export interface MockMedia {
  readonly mediaId: string;
  readonly url: string;
  readonly mimeType: string;
  readonly status: "processing" | "ready" | "failed";
}

export interface MockPlatformState {
  users: MockUserAccount[];
  memberships: MockStoreMembership[];
  gateStores: MockGateStore[];
  apiSessions: Map<string, MockApiSession>;
  accessTokens: Map<string, { readonly userId: string; readonly sessionId: string; readonly expiresAtEpochMs: number }>;
  usedRefreshTokens: Map<string, string>;
  pendingSubscriptionCheckouts: Map<string, { readonly storeId: string; readonly planId: string }>;
  subscriptionPlans: SubscriptionPlan[];
  idempotentResponses: Map<string, MockResponse>;
  uploads: Map<string, MockUpload>;
  media: Map<string, MockMedia>;
  storeDatasets: Map<string, MockStoreDataset>;
}

export type MockDatabase = Omit<MockPlatformState, "storeDatasets"> & MockStoreDataset;

function seedMockPlatformState(): MockPlatformState {
  return {
    users: buildDemoUserAccounts(),
    memberships: buildDemoMemberships(),
    gateStores: buildDemoGateStores(),
    apiSessions: new Map(),
    accessTokens: new Map(),
    usedRefreshTokens: new Map(),
    pendingSubscriptionCheckouts: new Map(),
    subscriptionPlans: buildDemoSubscriptionPlans(),
    idempotentResponses: new Map(),
    uploads: new Map(),
    media: new Map(),
    storeDatasets: new Map(),
  };
}

const globalMockStateHolder = globalThis as typeof globalThis & {
  __nanttyDashboardMockPlatform?: MockPlatformState;
  __nanttyDashboardMockViews?: Map<string | null, MockDatabase>;
};

function readMockPlatformState(): MockPlatformState {
  globalMockStateHolder.__nanttyDashboardMockPlatform ??= seedMockPlatformState();
  return globalMockStateHolder.__nanttyDashboardMockPlatform;
}

export function readMockStoreDataset(storeId: string): MockStoreDataset {
  const platform = readMockPlatformState();
  const existing = platform.storeDatasets.get(storeId);
  if (existing) return existing;
  const seeded = buildDemoStoreDataset(storeId);
  if (!seeded) throw new MockHttpError(404, "STORE_NOT_FOUND", "Store not found.");
  platform.storeDatasets.set(storeId, seeded);
  return seeded;
}

function requireStoreDatasetForScope(storeId: string | null): MockStoreDataset {
  if (!storeId) throw new MockHttpError(403, "NOT_A_SELLER", "This account does not manage a store.");
  return readMockStoreDataset(storeId);
}

function buildMockDatabaseViewForStore(storeId: string | null): MockDatabase {
  const platform = readMockPlatformState();
  const view = {} as MockDatabase;
  for (const fieldName of Object.keys(platform) as (keyof MockPlatformState)[]) {
    if (fieldName === "storeDatasets") continue;
    Object.defineProperty(view, fieldName, { enumerable: true, get: () => platform[fieldName], set: (value: never) => { platform[fieldName] = value; } });
  }
  for (const fieldName of [...mockStoreDatasetFieldNames, "storeId", "receiptPrefix"] as const) {
    Object.defineProperty(view, fieldName, {
      enumerable: true,
      get: () => requireStoreDatasetForScope(storeId)[fieldName],
      set: (value: never) => {
        (requireStoreDatasetForScope(storeId) as unknown as Record<string, unknown>)[fieldName] = value;
      },
    });
  }
  return view;
}

export function readMockDatabase(): MockDatabase {
  const storeId = readStoreIdOfCurrentMockScope();
  globalMockStateHolder.__nanttyDashboardMockViews ??= new Map();
  const views = globalMockStateHolder.__nanttyDashboardMockViews;
  const existingView = views.get(storeId);
  if (existingView) return existingView;
  const view = buildMockDatabaseViewForStore(storeId);
  views.set(storeId, view);
  return view;
}

export function readGlobalMockSlice<Slice>(sliceKey: string, seedSlice: () => Slice): Slice {
  const holder = globalThis as unknown as Record<string, Slice | undefined>;
  const globalKey = `__nanttyDashboardMockSlice_${sliceKey}`;
  holder[globalKey] ??= seedSlice();
  return holder[globalKey] as Slice;
}

export function readStoreScopedMockSlice<Slice>(sliceKey: string, seedSlice: (storeId: string) => Slice): Slice {
  const storeId = readStoreIdOfCurrentMockScope();
  if (!storeId) throw new MockHttpError(403, "NOT_A_SELLER", "This account does not manage a store.");
  return readGlobalMockSlice(`${sliceKey}_${storeId}`, () => seedSlice(storeId));
}

export function appendMockAuditLogEntry(entry: Omit<AuditLogEntry, "id" | "createdAt" | "ipAddress">): void {
  const database = readMockDatabase();
  database.auditLog.unshift({ ...entry, id: `aud_${crypto.randomUUID().slice(0, 8)}`, createdAt: new Date().toISOString(), ipAddress: "127.0.0.1" });
}
