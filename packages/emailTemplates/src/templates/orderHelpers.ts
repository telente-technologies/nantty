import type { EmailBlock, Money, RecipientProps, SellerItemGroup } from "../emailTypes";
import { addMoney, multiplyMoney } from "../format/emailFormat";

export interface OrderProps extends RecipientProps {
  readonly orderNumber: string;
  readonly orderUrl: string;
  readonly groups: readonly SellerItemGroup[];
}

export const buyerTrackSteps = ["Ordered", "Paid", "Shipped", "Delivered", "Complete"] as const;
export const disputeTrackSteps = ["Opened", "Evidence", "Review", "Decision"] as const;

export function itemsSubtotal(groups: readonly SellerItemGroup[]): Money {
  return addMoney(...groups.flatMap((group) => group.items.map((item) => multiplyMoney(item.unitPrice, item.quantity))));
}

export function shippingTotal(groups: readonly SellerItemGroup[]): Money {
  return addMoney(...groups.map((group) => group.shipping));
}

export function orderTotal(groups: readonly SellerItemGroup[], discount?: Money): Money {
  const gross = addMoney(itemsSubtotal(groups), shippingTotal(groups));
  return discount ? { ...gross, amountMinor: gross.amountMinor - discount.amountMinor } : gross;
}

export function orderTotalsBlock(groups: readonly SellerItemGroup[], options: { readonly discount?: Money; readonly totalLabel?: string } = {}): EmailBlock {
  const rows = [
    { label: `Items (${groups.reduce((count, group) => count + group.items.reduce((sum, item) => sum + item.quantity, 0), 0)})`, amount: itemsSubtotal(groups) },
    { label: `Shipping (${groups.length} ${groups.length === 1 ? "seller" : "sellers"})`, amount: shippingTotal(groups) },
    ...(options.discount ? [{ label: "Discount", amount: options.discount, credit: true }] : []),
  ];
  return { type: "totals", rows, total: { label: options.totalLabel ?? "Total", amount: orderTotal(groups, options.discount) } };
}

export function sellerCount(groups: readonly SellerItemGroup[]): string {
  return groups.length === 1 ? (groups[0]?.sellerName ?? "your seller") : `${groups.length} sellers`;
}
