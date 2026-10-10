import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

export type StoreBillingModule = typeof import("expo-iap");

export type StoreBillingAvailability =
  | { readonly kind: "web" }
  | { readonly kind: "needsAppBuild" }
  | { readonly kind: "ready"; readonly platform: "ios" | "android"; readonly billing: StoreBillingModule };

export const CREATOR_STORE_PRODUCT_PREFIX = "zudomart.creatorsub.";

let cachedAvailability: StoreBillingAvailability | null = null;

function loadNativeStoreBilling(): StoreBillingModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const billing = require("expo-iap") as StoreBillingModule;
    return typeof billing.requestPurchase === "function" ? billing : null;
  } catch {
    return null;
  }
}

export function resolveStoreBillingAvailability(): StoreBillingAvailability {
  if (cachedAvailability) return cachedAvailability;
  const platform = Platform.OS;
  if (platform !== "ios" && platform !== "android") {
    cachedAvailability = { kind: "web" };
    return cachedAvailability;
  }
  const billing = Constants.executionEnvironment === ExecutionEnvironment.StoreClient ? null : loadNativeStoreBilling();
  cachedAvailability = billing ? { kind: "ready", platform, billing } : { kind: "needsAppBuild" };
  return cachedAvailability;
}

export function storeBillingChannel(): "web" | "ios" | "android" {
  const availability = resolveStoreBillingAvailability();
  return availability.kind === "ready" ? availability.platform : "web";
}

export function forgetStoreBillingAvailabilityForTests() {
  cachedAvailability = null;
}

export const isCreatorStoreProduct = (productId: string) => productId.startsWith(CREATOR_STORE_PRODUCT_PREFIX);
