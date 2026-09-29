import type { MockResponse } from "@/mocks/mockRouter.mock";
import { buildDemoCustomers } from "@/mocks/seed/demoCustomers.mock";
import { buildDemoAuditLog, buildDemoGateStores, buildDemoPromotions, buildDemoSubscriptionPlans, buildDemoWalletState, type DemoWalletState, type MockGateStore } from "@/mocks/seed/demoFinance.mock";
import { buildDemoDisputes, buildDemoOnlineOrders, buildDemoReturnRequests } from "@/mocks/seed/demoOrders.mock";
import { buildDemoMemberships, buildDemoStaffRecords, buildDemoUserAccounts, type MockStaffRecord, type MockStoreMembership, type MockUserAccount } from "@/mocks/seed/demoPeople.mock";
import { buildDemoProducts } from "@/mocks/seed/demoProducts.mock";
import { buildDemoSalesHistory } from "@/mocks/seed/demoSales.mock";
import { buildDemoCategories, buildDemoLocations, buildDemoRegisters, buildDemoStoreSettings } from "@/mocks/seed/demoStore.mock";
import type { Product, ProductCategory, StockAdjustment, StockTransfer } from "@/types/catalog.type";
import type { Customer } from "@/types/customer.type";
import type { OnlineOrder, OrderDispute, ReturnRequest } from "@/types/order.type";
import type { ParkedSale, PosSale, PosShift, SaleRefund } from "@/types/pos.type";
import type { Promotion } from "@/types/promotion.type";
import type { PosRegister, StoreLocation, StoreSettings } from "@/types/store.type";
import type { AuditLogEntry } from "@/types/staff.type";
import type { SubscriptionPlan } from "@/types/subscription.type";

export interface MockApiSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly refreshToken: string;
  revoked: boolean;
}

export interface MockOperatorSession {
  readonly staffId: string;
  readonly storeId: string;
  readonly expiresAtEpochMs: number;
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

export interface MockDatabase {
  users: MockUserAccount[];
  memberships: MockStoreMembership[];
  gateStores: MockGateStore[];
  apiSessions: Map<string, MockApiSession>;
  accessTokens: Map<string, { readonly userId: string; readonly sessionId: string; readonly expiresAtEpochMs: number }>;
  usedRefreshTokens: Map<string, string>;
  operatorSessions: Map<string, MockOperatorSession>;
  pendingSubscriptionCheckouts: Map<string, { readonly storeId: string; readonly planId: string }>;
  subscriptionPlans: SubscriptionPlan[];
  settings: StoreSettings;
  locations: StoreLocation[];
  registers: PosRegister[];
  categories: ProductCategory[];
  products: Product[];
  customers: Customer[];
  staff: MockStaffRecord[];
  auditLog: AuditLogEntry[];
  shifts: PosShift[];
  sales: PosSale[];
  refunds: SaleRefund[];
  parkedSales: ParkedSale[];
  stockAdjustments: StockAdjustment[];
  stockTransfers: StockTransfer[];
  onlineOrders: OnlineOrder[];
  returnRequests: ReturnRequest[];
  disputes: OrderDispute[];
  promotions: Promotion[];
  wallet: DemoWalletState;
  idempotentResponses: Map<string, MockResponse>;
  uploads: Map<string, MockUpload>;
  media: Map<string, MockMedia>;
}

function seedMockDatabase(): MockDatabase {
  const settings = buildDemoStoreSettings();
  const products = buildDemoProducts();
  const customers = buildDemoCustomers();
  const { shifts, sales } = buildDemoSalesHistory(products, customers, settings);
  const registers = buildDemoRegisters().map((register) => ({
    ...register,
    openShiftId: shifts.find((shift) => shift.registerId === register.id && shift.status === "open")?.id ?? null,
  }));
  const onlineOrders = buildDemoOnlineOrders(products);
  return {
    users: buildDemoUserAccounts(),
    memberships: buildDemoMemberships(),
    gateStores: buildDemoGateStores(),
    apiSessions: new Map(),
    accessTokens: new Map(),
    usedRefreshTokens: new Map(),
    operatorSessions: new Map(),
    pendingSubscriptionCheckouts: new Map(),
    subscriptionPlans: buildDemoSubscriptionPlans(),
    settings,
    locations: buildDemoLocations(),
    registers,
    categories: buildDemoCategories(),
    products,
    customers,
    staff: buildDemoStaffRecords(),
    auditLog: buildDemoAuditLog(),
    shifts,
    sales,
    refunds: [],
    parkedSales: [],
    stockAdjustments: [],
    stockTransfers: [],
    onlineOrders,
    returnRequests: buildDemoReturnRequests(onlineOrders),
    disputes: buildDemoDisputes(onlineOrders),
    promotions: buildDemoPromotions(),
    wallet: buildDemoWalletState(onlineOrders),
    idempotentResponses: new Map(),
    uploads: new Map(),
    media: new Map(),
  };
}

const globalMockDatabaseHolder = globalThis as typeof globalThis & { __zudomartDashboardMockDatabase?: MockDatabase };

export function readMockDatabase(): MockDatabase {
  globalMockDatabaseHolder.__zudomartDashboardMockDatabase ??= seedMockDatabase();
  return globalMockDatabaseHolder.__zudomartDashboardMockDatabase;
}

export function readGlobalMockSlice<Slice>(sliceKey: string, seedSlice: () => Slice): Slice {
  const holder = globalThis as unknown as Record<string, Slice | undefined>;
  const globalKey = `__zudomartDashboardMockSlice_${sliceKey}`;
  holder[globalKey] ??= seedSlice();
  return holder[globalKey] as Slice;
}

export function appendMockAuditLogEntry(entry: Omit<AuditLogEntry, "id" | "createdAt" | "ipAddress">): void {
  const database = readMockDatabase();
  database.auditLog.unshift({ ...entry, id: `aud_${crypto.randomUUID().slice(0, 8)}`, createdAt: new Date().toISOString(), ipAddress: "127.0.0.1" });
}
