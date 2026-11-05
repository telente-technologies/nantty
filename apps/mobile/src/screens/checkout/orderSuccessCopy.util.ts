/** Keep the success message valid for escrow and direct-payment orders. */
export const ORDER_SUCCESS_DESCRIPTION =
  "Your payment has been confirmed. View your order for delivery updates and any payment-protection information available for this order.";

export const ORDER_SUCCESS_SHOPPING_ROUTE = {
  name: "Search",
  params: { scope: "mart", scopeLabel: "Mart" },
} as const;
