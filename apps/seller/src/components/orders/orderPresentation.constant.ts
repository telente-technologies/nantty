import type { StatusTone } from "@/components/ui/statusBadge";
import type { DeliveryStatus } from "@/types/delivery.type";
import type { DisputeStatus, EscrowStatus, OnlineOrderStatus, OrderPaymentProvider, OrderPaymentStatus, ReturnRequestStatus } from "@/types/order.type";

export const orderStatusPresentation: Record<OnlineOrderStatus, { readonly label: string; readonly tone: StatusTone }> = {
  new: { label: "New", tone: "highlight" },
  processing: { label: "Processing", tone: "info" },
  ready: { label: "Ready", tone: "info" },
  shipped: { label: "Shipped", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  returned: { label: "Returned", tone: "caution" },
  refunded: { label: "Refunded", tone: "neutral" },
  disputed: { label: "Disputed", tone: "error" },
};

export const escrowStatusPresentation: Record<EscrowStatus, { readonly label: string; readonly tone: StatusTone; readonly explanation: string }> = {
  held: { label: "In escrow", tone: "caution", explanation: "The buyer has paid. The money stays locked in the buyer's own wallet until they confirm delivery, then it moves to your wallet." },
  released: { label: "Paid out", tone: "success", explanation: "The buyer confirmed delivery and the money is in your wallet." },
  refunded: { label: "Refunded", tone: "neutral", explanation: "The money went back to the buyer." },
  disputed: { label: "On hold", tone: "error", explanation: "The buyer opened a dispute. Release is paused until Nantty decides." },
};

export const returnStatusPresentation: Record<ReturnRequestStatus, { readonly label: string; readonly tone: StatusTone }> = {
  requested: { label: "Requested", tone: "highlight" },
  approved: { label: "Approved — awaiting item", tone: "info" },
  received: { label: "Received", tone: "info" },
  refunded: { label: "Refunded", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
};

export const disputeStatusPresentation: Record<DisputeStatus, { readonly label: string; readonly tone: StatusTone }> = {
  open: { label: "Open", tone: "caution" },
  awaiting_seller: { label: "Your reply needed", tone: "error" },
  under_review: { label: "Nantty reviewing", tone: "info" },
  resolved_for_buyer: { label: "Resolved for buyer", tone: "neutral" },
  resolved_for_seller: { label: "Resolved for you", tone: "success" },
};

export const courierOptions = ["GIG Logistics", "Kwik Delivery", "DHL Nigeria", "Sendbox", "Red Star Express", "Other"];

export const ordersSectionTabs = [
  { href: "/orders", label: "Orders", exact: true },
  { href: "/orders/returns", label: "Returns" },
  { href: "/orders/disputes", label: "Disputes" },
];

export const orderStatusFilterOrder: readonly OnlineOrderStatus[] = ["new", "processing", "ready", "shipped", "delivered", "completed", "cancelled", "returned", "refunded", "disputed"];

export const paymentStatusPresentation: Record<OrderPaymentStatus, { readonly label: string; readonly tone: StatusTone }> = {
  paid: { label: "Paid", tone: "success" },
  partially_refunded: { label: "Partly refunded", tone: "caution" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export const deliveryStatusPresentation: Record<DeliveryStatus, { readonly label: string; readonly tone: StatusTone }> = {
  pending: { label: "Pending", tone: "highlight" },
  preparing: { label: "Preparing", tone: "info" },
  ready_for_pickup: { label: "Ready for pickup", tone: "info" },
  in_transit: { label: "In transit", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  failed: { label: "Failed attempt", tone: "error" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  returned: { label: "Returned", tone: "caution" },
};

export const paymentProviderLabels: Record<OrderPaymentProvider, string> = { flutterwave: "Flutterwave" };
