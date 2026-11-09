import type { CartItem, ReturnRequestInput } from "@/types";

export const RETURN_REASON_MIN_LENGTH = 5;
export const RETURN_REASON_MAX_LENGTH = 500;
export const RETURN_LINE_MIN_COUNT = 1;
export const RETURN_LINE_MAX_COUNT = 50;
export const RETURN_LINE_MAX_QUANTITY = 99;

export type ReturnQuantities = Readonly<Record<string, number>>;

export const maxReturnQuantity = (item: CartItem): number =>
  Math.min(item.quantity, RETURN_LINE_MAX_QUANTITY);

export const activeReturnForOrder = (status: string): boolean =>
  status === "requested" || status === "approved";

export const validateReturnDraft = (
  items: readonly CartItem[],
  quantities: ReturnQuantities,
  reason: string,
): string | null => {
  const selected = items.filter((item) => (quantities[item.id] ?? 0) > 0);
  const trimmedReason = reason.trim();
  if (selected.length < RETURN_LINE_MIN_COUNT) return "Choose at least one item to return.";
  if (selected.length > RETURN_LINE_MAX_COUNT) return `Choose no more than ${RETURN_LINE_MAX_COUNT} items.`;
  if (selected.some((item) => {
    const quantity = quantities[item.id] ?? 0;
    return !Number.isInteger(quantity) || quantity < 1 || quantity > maxReturnQuantity(item);
  })) return "Check the quantity selected for each item.";
  if (trimmedReason.length < RETURN_REASON_MIN_LENGTH) return `Add a reason with at least ${RETURN_REASON_MIN_LENGTH} characters.`;
  if (trimmedReason.length > RETURN_REASON_MAX_LENGTH) return `Keep the reason within ${RETURN_REASON_MAX_LENGTH} characters.`;
  return null;
};

export const toReturnRequestInput = (
  items: readonly CartItem[],
  quantities: ReturnQuantities,
  reason: string,
): ReturnRequestInput => ({
  lines: items
    .filter((item) => (quantities[item.id] ?? 0) > 0)
    .map((item) => ({ orderItemId: item.id, quantity: quantities[item.id]! })),
  reason: reason.trim(),
});
