import type { AppLogger } from "../../../loggers/app.logger.js";
import type { Money } from "../../../utils/money.util.js";
import type { CheckoutDiscountSource } from "../../payments/services/checkoutDiscounts.service.js";
import type { CashbackService } from "./cashback.service.js";
import type { LoyaltyPointsService } from "./loyaltyPoints.service.js";
import type { ReferralsService } from "./referrals.service.js";

export class OrderRewardsService implements CheckoutDiscountSource {
  public constructor(
    private readonly points: LoyaltyPointsService,
    private readonly cashback: CashbackService,
    private readonly referrals: ReferralsService,
    private readonly logger: AppLogger,
  ) {}

  public async rewardReleasedOrder(orderId: string): Promise<void> {
    const order = await this.points.dependencies.commerce.findRewardableOrder(orderId);
    if (order === undefined) return;
    const steps: readonly [string, () => Promise<unknown>][] = [
      ["points", () => this.points.earnPointsForOrder(order)],
      ["cashback", () => this.cashback.creditCashbackForOrder(order)],
      ["referral", () => this.referrals.rewardReferralAfterFirstOrder(order)],
    ];
    for (const [name, step] of steps) {
      try {
        await step();
      } catch (error) {
        this.logger.error("Order reward failed", { orderId, reward: name, error: String(error) });
      }
    }
  }

  public findCheckoutDiscount(checkoutId: string): Promise<Money | undefined> {
    return this.points.findCheckoutDiscount(checkoutId);
  }

  public markCheckoutDiscountConsumed(checkoutId: string): Promise<void> {
    return this.points.markCheckoutDiscountConsumed(checkoutId);
  }

  public async redeemAllPointsAtCheckout(userId: string, checkoutId: string): Promise<Money | undefined> {
    const balance = await this.points.readPointBalance(userId);
    if (balance < this.points.dependencies.settings.loyalty.minimumPointsToRedeem) return undefined;
    await this.points.redeemPointsAtCheckout(userId, checkoutId, balance);
    return this.points.findCheckoutDiscount(checkoutId);
  }
}
