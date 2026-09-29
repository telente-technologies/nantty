import { appendMockAuditLogEntry, readGlobalMockSlice, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockStorePrincipal } from "@/mocks/mockResponses.mock";
import type { MockRequest } from "@/mocks/mockRouter.mock";
import { buildDemoAffiliatesState, type AffiliatesMockState } from "@/mocks/seed/demoAffiliates.mock";
import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";
import type { AffiliateCreatorPerformance, CommissionLedgerEntry, CommissionLedgerStatus } from "@/types/affiliate.type";
import type { Money } from "@/types/money.type";
import type { EscrowStatus } from "@/types/order.type";
import { calculateBasisPointsShareOfMinorAmount } from "@/utils/money.util";

export function readAffiliatesMockState(): AffiliatesMockState {
  return readGlobalMockSlice("affiliates", buildDemoAffiliatesState);
}

function buildStoreMoney(amountMinor: number): Money {
  return { amountMinor, currency: readMockDatabase().settings.currency };
}

export function findEffectiveCommissionBasisPointsForProduct(productId: string): number | null {
  const state = readAffiliatesMockState();
  const override = state.productOverrides.get(productId);
  if (override?.excluded) return null;
  return override?.commissionBasisPoints ?? state.settings.defaultCommissionBasisPoints;
}

function convertEscrowStatusToLedgerStatus(escrowStatus: EscrowStatus): CommissionLedgerStatus {
  if (escrowStatus === "released") return "paid";
  if (escrowStatus === "refunded") return "reversed";
  return "owed";
}

export function buildCommissionLedgerEntries(): CommissionLedgerEntry[] {
  const state = readAffiliatesMockState();
  const orderEntries = readMockDatabase()
    .onlineOrders.filter((order) => order.attributedCreator !== null)
    .map((order): CommissionLedgerEntry => {
      const commissionMinor = order.lines.reduce((sum, line) => sum + calculateBasisPointsShareOfMinorAmount(line.lineTotal.amountMinor, findEffectiveCommissionBasisPointsForProduct(line.productId) ?? 0), 0);
      const status = convertEscrowStatusToLedgerStatus(order.escrowStatus);
      return {
        id: `cml_${order.id}`,
        orderNumber: order.orderNumber,
        creatorId: order.attributedCreator?.id ?? "",
        creatorUsername: order.attributedCreator?.username ?? "",
        orderTotal: order.subtotal,
        commission: buildStoreMoney(commissionMinor),
        status,
        orderedAt: order.createdAt,
        escrowReleaseAt: order.escrowReleaseAt,
        paidAt: status === "paid" ? order.deliveredAt ?? order.createdAt : null,
      };
    });
  const historicalEntries = state.historicalCommissions.map((seed): CommissionLedgerEntry => ({
    id: seed.id,
    orderNumber: seed.orderNumber,
    creatorId: seed.creatorId,
    creatorUsername: state.directory.find((creator) => creator.id === seed.creatorId)?.username ?? seed.creatorId,
    orderTotal: buildStoreMoney(seed.orderTotalMinor),
    commission: buildStoreMoney(seed.commissionMinor),
    status: "paid",
    orderedAt: buildIsoDateDaysAgo(seed.orderedDaysAgo, 13),
    escrowReleaseAt: buildIsoDateDaysAgo(seed.orderedDaysAgo - 6, 9),
    paidAt: buildIsoDateDaysAgo(seed.orderedDaysAgo - 6, 9),
  }));
  return [...orderEntries, ...historicalEntries].sort((first, second) => second.orderedAt.localeCompare(first.orderedAt));
}

export function buildCreatorPerformanceRows(range: { from: Date; to: Date } | null): AffiliateCreatorPerformance[] {
  const state = readAffiliatesMockState();
  const entries = buildCommissionLedgerEntries().filter((entry) => {
    if (!range) return true;
    const orderedAt = new Date(entry.orderedAt);
    return orderedAt >= range.from && orderedAt <= range.to;
  });
  return [...state.approvedCreators.entries()]
    .map(([creatorId, membership]): AffiliateCreatorPerformance | null => {
      const creator = state.directory.find((candidate) => candidate.id === creatorId);
      if (!creator) return null;
      const creatorEntries = entries.filter((entry) => entry.creatorId === creatorId && entry.status !== "reversed");
      const sumCommission = (status: CommissionLedgerStatus) => creatorEntries.filter((entry) => entry.status === status).reduce((sum, entry) => sum + entry.commission.amountMinor, 0);
      return {
        creator,
        clicks: membership.clicks,
        orders: creatorEntries.length,
        sales: buildStoreMoney(creatorEntries.reduce((sum, entry) => sum + entry.orderTotal.amountMinor, 0)),
        commissionOwed: buildStoreMoney(sumCommission("owed")),
        commissionPaid: buildStoreMoney(sumCommission("paid")),
        lastSaleAt: creatorEntries[0]?.orderedAt ?? null,
        status: membership.status,
      };
    })
    .filter((row): row is AffiliateCreatorPerformance => row !== null)
    .sort((first, second) => second.sales.amountMinor - first.sales.amountMinor);
}

export function buildStoreMoneyForAffiliates(amountMinor: number): Money {
  return buildStoreMoney(amountMinor);
}

export const maximumAffiliateCommissionBasisPoints = 5000;

export function isValidAffiliateCommissionBasisPoints(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximumAffiliateCommissionBasisPoints;
}

export function recordAffiliateAuditEntry(request: MockRequest, action: string, summary: string, targetId: string | null): void {
  const principal = requireMockStorePrincipal(request);
  appendMockAuditLogEntry({ actor: { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "owner" }, action, targetType: "affiliate", targetId, summary });
}
