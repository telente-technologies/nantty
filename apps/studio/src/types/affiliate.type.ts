import type { Money } from "@/types";

export type AffiliateAccess = "approved" | "paused" | "requested" | "open" | "approval_required" | "closed";
export type AffiliateCatalogSort = "newest" | "commission" | "price_asc" | "price_desc";
export type AffiliateCatalogAccessFilter = "all" | "approved" | "requestable" | "requested";
export type AffiliateEarningStatus = "pending" | "earned" | "reversed";

export interface AffiliateStore {
  readonly id: string;
  readonly name: string;
  readonly logoUrl: string | null;
}

export interface AffiliateProgrammeTerms {
  readonly defaultCommissionPercent: number;
  readonly attributionWindowDays: number;
  readonly approval: "automatic" | "manual";
  readonly autoApproveFollowersAbove: number | null;
  readonly commissionPaidWhen: "order_completed";
}

export interface AffiliateLink {
  readonly id: string;
  readonly productId: string;
  readonly storeId: string;
  readonly path: string;
  readonly clicks: number;
  readonly createdAt: string;
}

export interface PromotableProduct {
  readonly productId: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly price: Money;
  readonly stock: number | null;
  readonly store: AffiliateStore;
  readonly commissionBasisPoints: number;
  readonly commissionPercent: number;
  readonly estimatedCommission: Money;
  readonly access: AffiliateAccess;
  readonly link: AffiliateLink | null;
  readonly programme: AffiliateProgrammeTerms;
}

export interface AffiliatePromotion {
  readonly productId: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly price: Money;
  readonly stock: number | null;
  readonly store: AffiliateStore;
  readonly commissionPercent: number;
  readonly access: AffiliateAccess;
  readonly link: AffiliateLink | null;
  readonly clicks: number;
  readonly pendingOrders: number;
  readonly completedOrders: number;
  readonly reversedOrders: number;
  readonly conversionPercent: number | null;
  readonly sales: Money;
  readonly earned: Money;
  readonly pendingEarnings: Money;
  readonly programme: AffiliateProgrammeTerms | null;
}

export interface AffiliateEarning {
  readonly id: string;
  readonly status: AffiliateEarningStatus;
  readonly payoutStatus: "awaiting_completion" | "waiting_for_seller_funds" | "transferring" | "paid" | "reversed" | "not_paid";
  readonly reason: string;
  readonly orderNumber: string;
  readonly product: { readonly id: string; readonly name: string };
  readonly store: { readonly id: string; readonly name: string };
  readonly sale: Money;
  readonly commissionPercent: number;
  readonly commission: Money;
  readonly reversed: Money;
  readonly source: { readonly source: string; readonly id: string };
  readonly orderedAt: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
}

export interface AffiliateEarningsSummary {
  readonly pending: readonly Money[];
  readonly earned: readonly Money[];
  readonly paid: readonly Money[];
  readonly reversed: readonly Money[];
}

export interface AffiliateEarningsPage {
  readonly summary: AffiliateEarningsSummary;
  readonly data: readonly AffiliateEarning[];
  readonly nextCursor: string | null;
}

export interface AffiliateCatalogQuery {
  readonly search?: string;
  readonly sort?: AffiliateCatalogSort;
  readonly access?: AffiliateCatalogAccessFilter;
  readonly cursor?: string;
}

export interface AffiliationRequestResult {
  readonly id: string;
  readonly status: "active" | "requested" | "declined";
}
