import { defineEvent } from "@zudojs/events";

export interface OrderLifecyclePayload {
  readonly orderId: string;
  readonly buyerId: string;
  readonly storeId: string;
}

export const OrderPlacedEvent = defineEvent<"orders.orderPlaced", OrderLifecyclePayload>("orders.orderPlaced");
export const OrderShippedEvent = defineEvent<"orders.orderShipped", OrderLifecyclePayload>("orders.orderShipped");
export const OrderDeliveredEvent = defineEvent<"orders.orderDelivered", OrderLifecyclePayload>("orders.orderDelivered");
export const OrderCancelledEvent = defineEvent<"orders.orderCancelled", OrderLifecyclePayload>("orders.orderCancelled");
export const OrderPaidEvent = defineEvent<"orders.orderPaid", OrderLifecyclePayload>("orders.orderPaid");
