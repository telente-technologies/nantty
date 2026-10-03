import type { SellerAccess, SellerAccessDestination } from "@/types/sellerAccess.type";

const restrictedVerificationStatuses = new Set<SellerAccess["verification"]["status"]>(["suspended", "revoked"]);

export function decideSellerAccessDestination(access: SellerAccess): SellerAccessDestination {
  if (!access.storeId || !access.role) return "not-seller";
  if (restrictedVerificationStatuses.has(access.verification.status)) return "restricted";
  return "app";
}

export const gatePagePathByDestination: Record<Exclude<SellerAccessDestination, "app">, string> = {
  "not-seller": "/access/apply",
  restricted: "/access/verification",
};
