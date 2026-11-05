import type { OrderStatus } from "@/types";

const SELLER_FULFILMENT_STATUSES: ReadonlySet<OrderStatus> = new Set(["paid", "new", "processing", "ready"]);

export function isSellerOrderIncludedInFilter(status: OrderStatus, filter: "all" | OrderStatus): boolean {
  return filter === "all" || (filter === "pending" ? SELLER_FULFILMENT_STATUSES.has(status) : status === filter);
}

export function sellerOrderNeedsShipment(status: OrderStatus): boolean {
  return SELLER_FULFILMENT_STATUSES.has(status);
}

export function sellerOrderFundsRemainHeld(status: OrderStatus): boolean {
  return SELLER_FULFILMENT_STATUSES.has(status) || status === "shipped" || status === "delivered" || status === "disputed";
}
