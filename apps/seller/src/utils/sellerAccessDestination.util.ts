import type { SellerAccess, SellerAccessDestination } from "@/types/sellerAccess.type";

export function hasActiveGoldSubscription(access: SellerAccess): boolean {
  const subscriptionStatus = access.subscription?.status;
  return subscriptionStatus === "active" || subscriptionStatus === "trialing";
}

export function decideSellerAccessDestination(access: SellerAccess): SellerAccessDestination {
  if (!access.storeId || !access.role) return "not-seller";
  if (access.verification.status !== "verified") return "verification";
  if (!hasActiveGoldSubscription(access)) return "billing";
  return "app";
}

export const gatePagePathByDestination: Record<Exclude<SellerAccessDestination, "app">, string> = {
  "not-seller": "/access/apply",
  verification: "/access/verification",
  billing: "/access/billing",
};
