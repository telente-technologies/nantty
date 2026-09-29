import type { Money } from "@/types/money.type";
import type { PaymentMethod } from "@/types/store.type";

export interface DiscountInput {
  readonly kind: "amount" | "percent";
  readonly value: number;
  readonly reason: string | null;
  readonly approvedByStaffId: string | null;
}

export interface CashMovement {
  readonly id: string;
  readonly kind: "pay_in" | "pay_out";
  readonly amount: Money;
  readonly reason: string;
  readonly createdBy: { readonly id: string; readonly name: string };
  readonly createdAt: string;
}

export interface ShiftTotals {
  readonly salesCount: number;
  readonly grossSales: Money;
  readonly refunds: Money;
  readonly netSales: Money;
  readonly byPaymentMethod: { readonly method: PaymentMethod; readonly amount: Money }[];
}

export interface PosShift {
  readonly id: string;
  readonly registerId: string;
  readonly locationId: string;
  readonly status: "open" | "closed";
  readonly openedBy: { readonly id: string; readonly name: string };
  readonly openedAt: string;
  readonly openingFloat: Money;
  readonly cashMovements: CashMovement[];
  readonly totals: ShiftTotals;
  readonly expectedCash: Money;
  readonly closedBy: { readonly id: string; readonly name: string } | null;
  readonly closedAt: string | null;
  readonly countedCash: Money | null;
  readonly cashVariance: Money | null;
  readonly closingNote: string | null;
}

export interface SaleLine {
  readonly id: string;
  readonly productId: string;
  readonly variantId: string;
  readonly name: string;
  readonly variantTitle: string;
  readonly sku: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly discount: DiscountInput | null;
  readonly discountAmount: Money;
  readonly taxAmount: Money;
  readonly lineTotal: Money;
  readonly refundedQuantity: number;
}

export interface SalePayment {
  readonly id: string;
  readonly method: PaymentMethod;
  readonly amount: Money;
  readonly tendered: Money | null;
  readonly change: Money | null;
  readonly reference: string | null;
  readonly status: "captured" | "pending" | "failed";
}

export type SaleStatus = "completed" | "partially_refunded" | "refunded" | "voided";

export interface PosSale {
  readonly id: string;
  readonly receiptNumber: string;
  readonly locationId: string;
  readonly registerId: string;
  readonly shiftId: string;
  readonly cashier: { readonly id: string; readonly name: string };
  readonly customer: { readonly id: string; readonly name: string; readonly phone: string | null } | null;
  readonly lines: SaleLine[];
  readonly cartDiscount: DiscountInput | null;
  readonly couponCode: string | null;
  readonly subtotal: Money;
  readonly discountTotal: Money;
  readonly taxTotal: Money;
  readonly total: Money;
  readonly payments: SalePayment[];
  readonly changeDue: Money;
  readonly loyaltyPointsEarned: number;
  readonly loyaltyPointsRedeemed: number;
  readonly status: SaleStatus;
  readonly refundIds: string[];
  readonly createdAt: string;
  readonly offlineCreatedAt: string | null;
  readonly clientSaleId: string;
}

export interface CreateSaleRequest {
  readonly clientSaleId: string;
  readonly registerId: string;
  readonly shiftId: string;
  readonly locationId: string;
  readonly customerId: string | null;
  readonly lines: { readonly variantId: string; readonly quantity: number; readonly discount: DiscountInput | null }[];
  readonly cartDiscount: DiscountInput | null;
  readonly couponCode: string | null;
  readonly loyaltyPointsToRedeem: number;
  readonly payments: { readonly method: PaymentMethod; readonly amountMinor: number; readonly tenderedMinor: number | null; readonly reference: string | null }[];
  readonly offlineCreatedAt: string | null;
}

export interface SaleRefund {
  readonly id: string;
  readonly saleId: string;
  readonly receiptNumber: string;
  readonly kind: "refund" | "exchange";
  readonly lines: { readonly saleLineId: string; readonly quantity: number; readonly restock: boolean; readonly amount: Money }[];
  readonly amount: Money;
  readonly method: PaymentMethod;
  readonly reason: string;
  readonly exchangeSaleId: string | null;
  readonly createdBy: { readonly id: string; readonly name: string };
  readonly createdAt: string;
}

export interface ParkedSale {
  readonly id: string;
  readonly registerId: string;
  readonly label: string;
  readonly customerName: string | null;
  readonly itemsCount: number;
  readonly total: Money;
  readonly cart: unknown;
  readonly parkedBy: { readonly id: string; readonly name: string };
  readonly createdAt: string;
}
