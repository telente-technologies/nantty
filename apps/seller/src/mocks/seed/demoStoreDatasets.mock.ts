import { adireLabStudioStoreProfile } from "@/mocks/seed/adireLabStudioProfile.mock";
import { buildDemoCustomersFromPlan } from "@/mocks/seed/demoCustomers.mock";
import { buildDemoAuditLog, buildDemoWalletState, type DemoWalletState } from "@/mocks/seed/demoFinance.mock";
import { buildDemoDisputes, buildDemoOnlineOrders, buildDemoReturnRequests } from "@/mocks/seed/demoOrders.mock";
import type { MockStaffRecord } from "@/mocks/seed/demoPeople.mock";
import { buildDemoProductsFromCatalogPlan } from "@/mocks/seed/demoProducts.mock";
import { buildDemoSalesHistory } from "@/mocks/seed/demoSales.mock";
import type { DemoStoreProfile } from "@/mocks/seed/demoStoreProfile.mock";
import { funmiBakesStoreProfile } from "@/mocks/seed/funmiBakesProfile.mock";
import { ifeLifestyleStoreProfile } from "@/mocks/seed/ifeLifestyleProfile.mock";
import { kelechiKicksStoreProfile } from "@/mocks/seed/kelechiKicksProfile.mock";
import type { Product, ProductCategory, StockAdjustment, StockTransfer } from "@/types/catalog.type";
import type { Customer } from "@/types/customer.type";
import type { OnlineOrder, OrderDispute, ReturnRequest } from "@/types/order.type";
import type { ParkedSale, PosSale, PosShift, SaleRefund } from "@/types/pos.type";
import type { Promotion } from "@/types/promotion.type";
import type { AuditLogEntry } from "@/types/staff.type";
import type { PosRegister, StoreLocation, StoreSettings } from "@/types/store.type";

export interface MockStoreDataset {
  readonly storeId: string;
  readonly receiptPrefix: string;
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
}

export const mockStoreDatasetFieldNames = [
  "settings", "locations", "registers", "categories", "products", "customers", "staff", "auditLog", "shifts", "sales", "refunds",
  "parkedSales", "stockAdjustments", "stockTransfers", "onlineOrders", "returnRequests", "disputes", "promotions", "wallet",
] as const satisfies readonly (keyof MockStoreDataset)[];

const demoStoreProfiles: readonly DemoStoreProfile[] = [ifeLifestyleStoreProfile, adireLabStudioStoreProfile, kelechiKicksStoreProfile, funmiBakesStoreProfile];

export function isKnownDemoStoreId(storeId: string): boolean {
  return demoStoreProfiles.some((profile) => profile.storeId === storeId);
}

export function buildDemoStoreDataset(storeId: string): MockStoreDataset | null {
  const profile = demoStoreProfiles.find((candidate) => candidate.storeId === storeId);
  if (!profile) return null;
  const settings = profile.buildSettings();
  const { recordKey } = profile;
  const products = buildDemoProductsFromCatalogPlan(profile.catalog, settings.currency, profile.randomSeeds.products);
  const customers = buildDemoCustomersFromPlan(profile.customers, recordKey, settings.currency);
  const { shifts, sales } = buildDemoSalesHistory(products, customers, settings, {
    plan: profile.posHistory,
    randomSeed: profile.randomSeeds.posHistory,
    receiptPrefix: profile.receiptPrefix,
    highVolumeCategoryIds: profile.catalog.highVolumeCategoryIds,
  });
  const registers = profile.buildRegisters().map((register) => ({
    ...register,
    openShiftId: shifts.find((shift) => shift.registerId === register.id && shift.status === "open")?.id ?? null,
  }));
  const onlineOrders = buildDemoOnlineOrders(products, { plan: profile.onlineOrders, randomSeed: profile.randomSeeds.onlineOrders, recordKey, currency: settings.currency });
  const staff = profile.buildStaff();
  return {
    storeId: profile.storeId,
    receiptPrefix: profile.receiptPrefix,
    settings,
    locations: profile.buildLocations(),
    registers,
    categories: profile.buildCategories(),
    products,
    customers,
    staff,
    auditLog: buildDemoAuditLog(profile.auditEntries, staff, recordKey),
    shifts,
    sales,
    refunds: [],
    parkedSales: [],
    stockAdjustments: [],
    stockTransfers: [],
    onlineOrders,
    returnRequests: buildDemoReturnRequests(onlineOrders, profile.onlineOrders, recordKey),
    disputes: buildDemoDisputes(onlineOrders, profile.onlineOrders, recordKey),
    promotions: profile.buildPromotions(settings.currency),
    wallet: buildDemoWalletState(onlineOrders, profile.wallet, recordKey, settings.currency),
  };
}
