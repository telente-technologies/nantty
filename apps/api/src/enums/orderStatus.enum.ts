export const OrderStatus = {
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  DISPUTED: "disputed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
