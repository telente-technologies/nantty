import type { CreateSaleRequest, PosSale } from "@/types/pos.type";
import type { PendingPayment, PosCartState } from "@/types/posExtra.type";
import type { StoreSettings } from "@/types/store.type";
import type { PricedCart } from "@/utils/posCartPricing.util";

export interface SaleContext {
  readonly registerId: string;
  readonly shiftId: string;
  readonly locationId: string;
  readonly cashier: { readonly id: string; readonly name: string };
}

export function buildCreateSaleRequestFromCart(cart: PosCartState, payments: readonly PendingPayment[], context: SaleContext): CreateSaleRequest {
  return {
    clientSaleId: cart.clientSaleId,
    registerId: context.registerId,
    shiftId: context.shiftId,
    locationId: context.locationId,
    customerId: cart.customer?.id ?? null,
    lines: cart.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity, discount: line.discount })),
    cartDiscount: cart.cartDiscount,
    couponCode: cart.coupon?.code ?? null,
    loyaltyPointsToRedeem: cart.loyaltyPointsToRedeem,
    payments: payments.map((payment) => ({ method: payment.method, amountMinor: payment.amountMinor, tenderedMinor: payment.tenderedMinor, reference: payment.reference })),
    offlineCreatedAt: null,
  };
}

export function buildLocalPosSaleFromCart(cart: PosCartState, pricedCart: PricedCart, settings: StoreSettings, payments: readonly PendingPayment[], context: SaleContext): PosSale {
  const currency = pricedCart.currency;
  const money = (amountMinor: number) => ({ amountMinor, currency });
  const changeMinor = payments.reduce((sum, payment) => sum + (payment.tenderedMinor !== null ? payment.tenderedMinor - payment.amountMinor : 0), 0);
  const now = new Date().toISOString();
  return {
    id: cart.clientSaleId,
    receiptNumber: "PENDING",
    locationId: context.locationId,
    registerId: context.registerId,
    shiftId: context.shiftId,
    cashier: context.cashier,
    customer: cart.customer ? { id: cart.customer.id, name: cart.customer.name, phone: cart.customer.phone } : null,
    lines: cart.lines.map((line, index) => {
      const pricedLine = pricedCart.lines[index];
      return {
        id: line.lineId,
        productId: line.productId,
        variantId: line.variantId,
        name: line.name,
        variantTitle: line.variantTitle,
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: money(line.unitPriceMinor),
        discount: line.discount,
        discountAmount: money((pricedLine?.lineDiscountMinor ?? 0) + (pricedLine?.cartDiscountShareMinor ?? 0)),
        taxAmount: money(pricedLine?.taxMinor ?? 0),
        lineTotal: money(pricedLine?.totalMinor ?? 0),
        refundedQuantity: 0,
      };
    }),
    cartDiscount: cart.cartDiscount,
    couponCode: cart.coupon?.code ?? null,
    subtotal: money(pricedCart.subtotalMinor),
    discountTotal: money(pricedCart.discountTotalMinor),
    taxTotal: money(pricedCart.taxTotalMinor),
    total: money(pricedCart.totalMinor),
    payments: payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: money(payment.amountMinor),
      tendered: payment.tenderedMinor === null ? null : money(payment.tenderedMinor),
      change: payment.tenderedMinor === null ? null : money(payment.tenderedMinor - payment.amountMinor),
      reference: payment.reference,
      status: "pending",
    })),
    changeDue: money(changeMinor),
    loyaltyPointsEarned: cart.customer && settings.loyalty.enabled ? Math.floor(pricedCart.totalMinor / Math.max(1, settings.loyalty.spendRequiredPerPoint.amountMinor)) : 0,
    loyaltyPointsRedeemed: cart.loyaltyPointsToRedeem,
    status: "completed",
    refundIds: [],
    createdAt: now,
    offlineCreatedAt: now,
    clientSaleId: cart.clientSaleId,
  };
}
