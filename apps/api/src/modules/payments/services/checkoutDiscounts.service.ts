import type { Money } from "../../../utils/money.util.js";

export interface CheckoutDiscountSource {
  findCheckoutDiscount(checkoutId: string): Promise<Money | undefined>;
  markCheckoutDiscountConsumed(checkoutId: string): Promise<void>;
  redeemAllPointsAtCheckout(userId: string, checkoutId: string): Promise<Money | undefined>;
}

export class CheckoutDiscountSlot implements CheckoutDiscountSource {
  private source: CheckoutDiscountSource | undefined;

  public attachSource(source: CheckoutDiscountSource): void {
    this.source = source;
  }

  public async findCheckoutDiscount(checkoutId: string): Promise<Money | undefined> {
    return this.source?.findCheckoutDiscount(checkoutId);
  }

  public async markCheckoutDiscountConsumed(checkoutId: string): Promise<void> {
    await this.source?.markCheckoutDiscountConsumed(checkoutId);
  }

  public async redeemAllPointsAtCheckout(userId: string, checkoutId: string): Promise<Money | undefined> {
    return this.source?.redeemAllPointsAtCheckout(userId, checkoutId);
  }
}
