export type SellerVerificationStatus = "none" | "pending" | "verified" | "rejected";
export type SellerSubscriptionStatus = "none" | "trialing" | "active" | "past_due" | "cancelled" | "expired";

export interface SellerAccessPolicy {
  assertStoreHasActiveSellerAccess(userId: string, storeId: string): Promise<void>;
}
