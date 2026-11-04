import type { EventMapping } from "./mappingHelpers.js";
import { intentFor } from "./mappingHelpers.js";

export const escrowReleaseFailed: EventMapping = (event, data) => {
  const orderNumber = data.text("orderNumber", "your order");
  return [
    intentFor(event, data.text("sellerUserId"), {
      category: "escrow",
      inApp: {
        category: "orders",
        title: "Payout delayed",
        body: `The payout for order ${orderNumber} could not be completed. Your funds remain protected and Nantty will retry automatically.`,
        data: { orderId: data.text("orderId"), escrowId: data.text("escrowId") },
      },
      push: {
        title: "Payout delayed",
        body: `Nantty will retry the payout for order ${orderNumber} automatically.`,
        data: { orderId: data.text("orderId") },
      },
    }),
  ];
};

// The delivered-order notification already tells the buyer when the inspection window ends.
// Consume this escrow scheduling fact without sending a duplicate user notification.
export const escrowReleaseScheduled: EventMapping = () => [];

export const escrowChargeback: EventMapping = (event, data) => {
  const orderNumber = data.text("orderNumber", "your order");
  const body = `The payment status for order ${orderNumber} has changed. Check your order for the latest information.`;
  const orderId = data.text("orderId");
  const escrowId = data.text("escrowId");

  return [data.text("buyerUserId"), data.text("sellerUserId")].map((recipientUserId) =>
    intentFor(event, recipientUserId, {
      category: "escrow",
      inApp: { category: "orders", title: "Payment status updated", body, data: { orderId, escrowId } },
      push: { title: "Payment status updated", body, data: { orderId } },
    }),
  );
};
