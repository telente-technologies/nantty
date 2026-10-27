import type { CurrencyCode } from "@/types/money.type";
import type { MockStaffRecord } from "@/mocks/seed/demoPeople.mock";
import type { ProductBrandTag } from "@/types/brand.type";
import type { ProductCategory } from "@/types/catalog.type";
import type { PayoutAccount } from "@/types/wallet.type";
import type { Promotion } from "@/types/promotion.type";
import type { StoreLocation, StoreSettings } from "@/types/store.type";

export interface DemoProductBlueprint {
  readonly key: string;
  readonly name: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly unsplashPhotoId: string | null;
  readonly priceMajor: number;
  readonly costMajor: number;
  readonly description: string;
  readonly options?: { readonly name: string; readonly values: string[] }[];
  readonly taxable?: boolean;
  readonly publishedOnline?: boolean;
  readonly tags?: string[];
}

export interface DemoCatalogPlan {
  readonly blueprints: readonly DemoProductBlueprint[];
  readonly skuPrefix: string;
  readonly barcodeCompanyDigits: string;
  readonly stockLocationIds: readonly string[];
  readonly bulkStockLocationId: string | null;
  readonly highVolumeCategoryIds: readonly string[];
  readonly brandTagsByProductKey: Readonly<Record<string, ProductBrandTag>>;
}

export type DemoCustomerRow = readonly [name: string, phone: string | null, email: string | null, nanttyUsername: string | null, tags: string[]];

export interface DemoCustomerPlan {
  readonly rows: readonly DemoCustomerRow[];
  readonly firstCustomerNote: { readonly body: string; readonly authorStaffId: string; readonly authorName: string } | null;
}

export interface DemoMarketplaceBuyer {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly city: string;
  readonly state: string;
}

export interface DemoOnlineOrderPlan {
  readonly orderCount: number;
  readonly historyLengthInDays: number;
  readonly firstOrderNumber: number;
  readonly buyers: readonly DemoMarketplaceBuyer[];
  readonly creators: readonly { readonly id: string; readonly username: string }[];
  readonly creatorShare: number;
  readonly fulfilmentLocationId: string;
  readonly disputedOrderIndex: number | null;
  readonly disputeBuyerMessage: string;
  readonly homeState: string;
  readonly shippingFeeMinor: { readonly homeState: number; readonly otherStates: number };
  readonly returnReasons: readonly string[];
}

export interface DemoWalletPlan {
  readonly payoutAccounts: readonly PayoutAccount[];
  readonly payoutAmountsMinor: readonly number[];
  readonly payoutFeeMinor: number;
  readonly payoutAccountSummary: string;
  readonly pendingMinor: number;
  readonly availableMinor: number;
}

export type DemoAuditEntry = readonly [staffId: string, action: string, targetType: string, summary: string, daysAgo: number];

export interface DemoStoreProfile {
  readonly storeId: string;
  readonly recordKey: string | null;
  readonly receiptPrefix: string;
  readonly randomSeeds: { readonly products: number; readonly onlineOrders: number };
  readonly buildSettings: () => StoreSettings;
  readonly buildLocations: () => StoreLocation[];
  readonly buildCategories: () => ProductCategory[];
  readonly buildStaff: () => MockStaffRecord[];
  readonly buildPromotions: (currency: CurrencyCode) => Promotion[];
  readonly catalog: DemoCatalogPlan;
  readonly customers: DemoCustomerPlan;
  readonly onlineOrders: DemoOnlineOrderPlan;
  readonly wallet: DemoWalletPlan;
  readonly auditEntries: readonly DemoAuditEntry[];
}

export function buildStoreScopedRecordId(prefix: string, recordKey: string | null, suffix: string | number): string {
  return recordKey ? `${prefix}_${recordKey}_${suffix}` : `${prefix}_${suffix}`;
}
