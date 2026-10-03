import type { DeliveryPipelineStatus } from "@/types/delivery.type";

export const deliveryPipelineOrder: readonly DeliveryPipelineStatus[] = ["pending", "preparing", "ready_for_pickup", "in_transit", "delivered", "failed"];

export const deliverySectionTabs = [
  { href: "/delivery", label: "Shipments", exact: true },
  { href: "/delivery/settings", label: "Areas & fees" },
  { href: "/delivery/shipping", label: "Shipping rules" },
];

export const deliveryPipelineDescriptions: Record<DeliveryPipelineStatus, string> = {
  pending: "Paid orders you have not accepted yet.",
  preparing: "Accepted and being packed.",
  ready_for_pickup: "Packed and waiting for the courier or rider.",
  in_transit: "On the way to the customer.",
  delivered: "Delivered — escrow releases after the customer confirms.",
  failed: "A delivery attempt did not go through. Call the customer and retry.",
};
