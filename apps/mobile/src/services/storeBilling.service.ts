import { Platform } from "react-native";

export interface StorePurchaseResult {
  readonly productId: string;
  readonly receipt: string;
  readonly transactionId: string;
}

export interface StoreBillingAdapter {
  readonly readStorefrontCountryCode: () => Promise<string | null>;
  readonly purchaseProduct: (storeProductId: string) => Promise<StorePurchaseResult | null>;
  readonly finishTransaction: (transactionId: string) => Promise<void>;
}

let installedAdapter: StoreBillingAdapter | null = null;
let cachedStorefrontCountryCode: string | null = null;

export function installStoreBillingAdapter(adapter: StoreBillingAdapter | null): void {
  installedAdapter = adapter;
  cachedStorefrontCountryCode = null;
  if (adapter) void refreshStorefrontCountryCode();
}

export function isStoreBillingAvailable(): boolean {
  return installedAdapter !== null && (Platform.OS === "ios" || Platform.OS === "android");
}

export async function refreshStorefrontCountryCode(): Promise<string | null> {
  if (!installedAdapter) return null;
  cachedStorefrontCountryCode = await installedAdapter.readStorefrontCountryCode().catch(() => null);
  return cachedStorefrontCountryCode;
}

export function readStoreBillingRequestHeaders(): Record<string, string> {
  if (!isStoreBillingAvailable()) return {};
  const headers: Record<string, string> = { "X-Client-Platform": Platform.OS };
  if (cachedStorefrontCountryCode) headers["X-Store-Storefront"] = cachedStorefrontCountryCode;
  return headers;
}

export function purchaseStoreProduct(storeProductId: string): Promise<StorePurchaseResult | null> {
  if (!installedAdapter) return Promise.resolve(null);
  return installedAdapter.purchaseProduct(storeProductId);
}

export function finishStoreTransaction(transactionId: string): Promise<void> {
  return installedAdapter ? installedAdapter.finishTransaction(transactionId) : Promise.resolve();
}

export function readStorePlatformName(): "ios" | "android" | null {
  return Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;
}
