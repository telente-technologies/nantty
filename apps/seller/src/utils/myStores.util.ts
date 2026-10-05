import type { MyStoreEntry } from "@/types/brand.type";
import type { CursorPage } from "@/types/pagination.type";
import type { SellerAccess } from "@/types/sellerAccess.type";

export type MyStoresResponse = CursorPage<MyStoreEntry> | SellerAccess;

export function readMyStoreEntries(response: MyStoresResponse | null | undefined): MyStoreEntry[] {
  if (!response) return [];
  if ("data" in response && Array.isArray(response.data)) return response.data;
  const access = response as SellerAccess;
  if (!access.storeId || !access.role) return [];
  return [{
    storeId: access.storeId,
    storeName: access.storeName ?? "Your store",
    brandId: null,
    role: access.role,
    verification: { status: access.verification.status, tier: access.verification.tier, badgeVisible: access.verification.badgeVisible },
    subscription: access.subscription ? { status: access.subscription.status, plan: access.subscription.plan } : null,
    isCurrent: true,
  }];
}
