import type { SellerAccess, SellerAccessDestination } from "@/types/sellerAccess.type";

export function decideSellerAccessDestination(access: SellerAccess): SellerAccessDestination {
  if (!access.storeId || !access.role) return "not-seller";
  if (access.verificationStatus !== "verified") return "verification";
  if (access.subscription.status !== "active" && access.subscription.status !== "trialing") return "billing";
  return "app";
}

export const gatePagePathByDestination: Record<Exclude<SellerAccessDestination, "app">, string> = {
  "not-seller": "/access/apply",
  verification: "/access/verification",
  billing: "/access/billing",
};
