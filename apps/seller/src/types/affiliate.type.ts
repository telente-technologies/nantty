import type { Money } from "@/types/money.type";

export interface AffiliateCreator {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly followers: number;
  readonly niche: string;
  readonly avatarUrl: string | null;
}

export interface AffiliateProgramSettings {
  readonly enabled: boolean;
  readonly defaultCommissionBasisPoints: number;
  readonly autoApproveCreatorsWithFollowersAbove: number | null;
  readonly cookieWindowDays: number;
}

export type AffiliateCreatorStatus = "active" | "paused";

export interface AffiliateCreatorPerformance {
  readonly creator: AffiliateCreator;
  readonly clicks: number;
  readonly orders: number;
  readonly sales: Money;
  readonly commissionOwed: Money;
  readonly commissionPaid: Money;
  readonly lastSaleAt: string | null;
  readonly status: AffiliateCreatorStatus;
}

export interface AffiliateOverview {
  readonly settings: AffiliateProgramSettings;
  readonly creatorDrivenSales: Money;
  readonly commissionsOwed: Money;
  readonly commissionsPaid: Money;
  readonly activeCreatorsCount: number;
  readonly pendingRequestsCount: number;
  readonly topCreators: AffiliateCreatorPerformance[];
}

export type AffiliateRequestStatus = "pending" | "approved" | "declined";

export interface AffiliateRequest {
  readonly id: string;
  readonly creator: AffiliateCreator;
  readonly message: string;
  readonly requestedAt: string;
  readonly status: AffiliateRequestStatus;
  readonly decisionReason: string | null;
}

export interface ProductCommissionRow {
  readonly productId: string;
  readonly productName: string;
  readonly imageUrl: string | null;
  readonly price: Money;
  readonly commissionBasisPoints: number | null;
  readonly excluded: boolean;
  readonly estimatedCommission: Money;
}

export type CommissionLedgerStatus = "owed" | "paid" | "reversed";

export interface CommissionLedgerEntry {
  readonly id: string;
  readonly orderNumber: string;
  readonly creatorId: string;
  readonly creatorUsername: string;
  readonly orderTotal: Money;
  readonly commission: Money;
  readonly status: CommissionLedgerStatus;
  readonly orderedAt: string;
  readonly escrowReleaseAt: string | null;
  readonly paidAt: string | null;
}

export type LiveInvitationStatus = "pending" | "accepted" | "declined" | "live" | "ended" | "cancelled";

export interface LiveInvitation {
  readonly id: string;
  readonly creator: AffiliateCreator;
  readonly products: { readonly id: string; readonly name: string; readonly imageUrl: string | null }[];
  readonly proposedStartAt: string;
  readonly commissionBasisPoints: number | null;
  readonly message: string;
  readonly status: LiveInvitationStatus;
  readonly createdAt: string;
}
