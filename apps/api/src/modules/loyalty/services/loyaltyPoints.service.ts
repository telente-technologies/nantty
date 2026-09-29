import type { MonetizationSettings } from "../../../configs/monetization.config.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { invalidState, notFound, unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { Money } from "../../../utils/money.util.js";
import { MonetizationLedgerAccounts } from "../../wallets/constants/monetizationLedgerAccounts.constant.js";
import { LOYALTY_POINT_LEDGER_UNIT, type LedgerLineInput } from "../../wallets/models/wallets.model.js";
import type { LedgerService } from "../../wallets/services/ledger.service.js";
import type { LoyaltyRewardRecord, PointsRedemptionRecord, RewardableOrder } from "../models/loyalty.model.js";
import type { LoyaltyRewardsRepository } from "../repositories/loyaltyRewards.repository.js";
import type { LoyaltyCommerceLookup } from "./loyaltyCommerceLookup.service.js";

export interface LoyaltyDependencies {
  readonly ledger: LedgerService;
  readonly rewards: LoyaltyRewardsRepository;
  readonly commerce: LoyaltyCommerceLookup;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly settings: MonetizationSettings;
}

function pointLines(userId: string, points: number, direction: "earn" | "spend"): LedgerLineInput[] {
  const user = MonetizationLedgerAccounts.loyaltyPoints(userId);
  const issued = MonetizationLedgerAccounts.loyaltyPointsIssued();
  return [
    { account: direction === "earn" ? issued : user, direction: "debit", amount: points, currency: LOYALTY_POINT_LEDGER_UNIT },
    { account: direction === "earn" ? user : issued, direction: "credit", amount: points, currency: LOYALTY_POINT_LEDGER_UNIT },
  ];
}

export function calculatePointsEarned(settings: MonetizationSettings, total: number, currency: CurrencyCode): number {
  const earnedValue = Number((BigInt(total) * BigInt(settings.loyalty.pointsEarnBps)) / 10_000n);
  return Math.floor(earnedValue / settings.loyalty.pointValueMinor[currency]);
}

export class LoyaltyPointsService {
  public constructor(public readonly dependencies: LoyaltyDependencies) {}

  public readPointBalance(userId: string): Promise<number> {
    return this.dependencies.ledger.readAccountBalance(MonetizationLedgerAccounts.loyaltyPoints(userId));
  }

  public listHistory(userId: string, page: PageRequest): Promise<Page<LoyaltyRewardRecord>> {
    return this.dependencies.rewards.listRewards(userId, page);
  }

  public async earnPointsForOrder(order: RewardableOrder): Promise<number> {
    const { ledger, rewards, settings, clock } = this.dependencies;
    const points = calculatePointsEarned(settings, order.total, order.currency);
    if (points <= 0) return 0;
    const reference = `loyalty-earn:${order.id}`;
    await ledger.postLedgerTransaction({ reference, kind: "loyalty_points_earned", description: "Loyalty points for a completed order", lines: pointLines(order.buyerId, points, "earn") });
    await rewards.recordRewardIfNew({
      userId: order.buyerId, kind: "points_earned", reference, points, amount: 0, currency: null, orderId: order.id, description: "Points for a completed order", createdAt: clock.now(),
    });
    return points;
  }

  public async redeemPointsAtCheckout(userId: string, checkoutId: string, points: number): Promise<PointsRedemptionRecord> {
    const { ledger, rewards, commerce, settings, clock, audit } = this.dependencies;
    if (!Number.isSafeInteger(points) || points < settings.loyalty.minimumPointsToRedeem) throw unprocessable(`Redeem at least ${settings.loyalty.minimumPointsToRedeem} points.`);
    const checkout = await commerce.findPayableCheckoutForBuyer(userId, checkoutId);
    if (checkout === undefined) throw notFound("Checkout");
    if (await commerce.hasPaymentAttempts(checkoutId)) throw invalidState("Redeem points before starting payment for this checkout.");
    if ((await rewards.findRedemption(checkoutId)) !== undefined) throw invalidState("Points were already redeemed on this checkout.");
    const pointValue = settings.loyalty.pointValueMinor[checkout.currency];
    const usablePoints = Math.min(points, Math.floor((checkout.total - 1) / pointValue));
    if (usablePoints <= 0) throw unprocessable("This checkout is too small to use points on.");
    const discount = usablePoints * pointValue;
    const reference = `loyalty-redeem:${checkoutId}`;
    await ledger.postLedgerTransaction({ reference, kind: "loyalty_points_redeemed", description: "Loyalty points redeemed at checkout", lines: pointLines(userId, usablePoints, "spend") });
    const redemption: PointsRedemptionRecord = { checkoutId, userId, points: usablePoints, discount, currency: checkout.currency, status: "held", createdAt: clock.now() };
    await rewards.createRedemption(redemption);
    await rewards.recordRewardIfNew({
      userId, kind: "points_redeemed", reference, points: -usablePoints, amount: discount, currency: checkout.currency, orderId: null, description: "Points redeemed at checkout", createdAt: clock.now(),
    });
    await audit.record({ actorId: userId, action: "loyalty.points_redeemed", entityType: "checkout", entityId: checkoutId, metadata: { points: usablePoints, discount, currency: checkout.currency } });
    return redemption;
  }

  public async releaseRedemption(userId: string, checkoutId: string): Promise<void> {
    const { ledger, rewards, commerce, clock } = this.dependencies;
    const redemption = await rewards.findRedemption(checkoutId);
    if (redemption === undefined || redemption.userId !== userId) throw notFound("Points redemption");
    if (await commerce.hasPaymentAttempts(checkoutId)) throw invalidState("Payment has started for this checkout; the points stay applied.");
    if (!(await rewards.changeRedemptionStatus(checkoutId, "held", "released"))) throw invalidState("These points can no longer be released.");
    const reference = `loyalty-redeem-release:${checkoutId}`;
    await ledger.postLedgerTransaction({ reference, kind: "loyalty_points_restored", description: "Loyalty points returned from a checkout", lines: pointLines(userId, redemption.points, "earn") });
    await rewards.recordRewardIfNew({
      userId, kind: "points_restored", reference, points: redemption.points, amount: 0, currency: null, orderId: null, description: "Points returned from a checkout", createdAt: clock.now(),
    });
  }

  public async findCheckoutDiscount(checkoutId: string): Promise<Money | undefined> {
    const redemption = await this.dependencies.rewards.findRedemption(checkoutId);
    return redemption === undefined || redemption.status === "released" ? undefined : Money.of(redemption.discount, redemption.currency);
  }

  public async markCheckoutDiscountConsumed(checkoutId: string): Promise<void> {
    await this.dependencies.rewards.changeRedemptionStatus(checkoutId, "held", "consumed");
  }
}
