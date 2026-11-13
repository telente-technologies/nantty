export const orderProgressSteps = [
  "Order placed",
  "Payment confirmed",
  "Seller preparing",
  "Ready to ship",
  "Shipped",
  "Delivered",
  "Completed",
] as const;

export function canConfirmOrderReceipt(status: string): boolean {
  return status === "delivered";
}

const activeStatusStep: Readonly<Record<string, number>> = {
  pending: 0,
  new: 0,
  paid: 1,
  processing: 2,
  ready: 3,
  shipped: 4,
  delivered: 5,
  completed: 6,
};

const timelineStep: Readonly<Record<string, number>> = {
  placed: 0,
  paid: 1,
  accepted: 2,
  processing: 2,
  ready: 3,
  shipped: 4,
  delivery_failed: 4,
  delivered: 5,
  completed: 6,
};

const terminalMessage: Readonly<Record<string, string>> = {
  cancelled: "Order cancelled.",
  disputed: "A dispute is open. View the dispute for updates.",
  returned: "This order was returned.",
  refunded: "Payment was refunded.",
};

export function resolveOrderProgress(
  status: string,
  timeline: readonly { readonly kind: string }[] = [],
): { readonly currentIndex: number | null; readonly terminalMessage: string | null } {
  const currentIndex = activeStatusStep[status];
  if (currentIndex !== undefined) return { currentIndex, terminalMessage: null };

  const latestKnownStep = [...timeline].reverse().find((event) => timelineStep[event.kind] !== undefined);
  const inferredIndex = latestKnownStep ? timelineStep[latestKnownStep.kind] ?? null : null;
  return {
    currentIndex: status === "cancelled" ? inferredIndex ?? 0 : inferredIndex,
    terminalMessage: terminalMessage[status] ?? null,
  };
}
